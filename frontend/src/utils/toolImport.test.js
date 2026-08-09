import { parseToolImport, parseTags, markDuplicates } from './toolImport';

describe('parseTags', () => {
  test('splits on the separators spreadsheets actually use', () => {
    expect(parseTags('osint; recon')).toEqual(['osint', 'recon']);
    expect(parseTags('osint, recon')).toEqual(['osint', 'recon']);
    expect(parseTags('osint|recon')).toEqual(['osint', 'recon']);
  });

  test('passes arrays through and drops empties', () => {
    expect(parseTags(['a', ' b ', ''])).toEqual(['a', 'b']);
    expect(parseTags('a,,b')).toEqual(['a', 'b']);
  });

  test('handles missing values', () => {
    expect(parseTags(null)).toEqual([]);
    expect(parseTags(undefined)).toEqual([]);
    expect(parseTags('')).toEqual([]);
  });
});

describe('parseToolImport — CSV', () => {
  test('imports a straightforward file', () => {
    const { tools, errors, format } = parseToolImport(
      'name,url,category\nShodan,https://shodan.io,Search Engines\nMaltego,https://maltego.com,Data Analysis'
    );
    expect(format).toBe('csv');
    expect(errors).toEqual([]);
    expect(tools).toHaveLength(2);
    expect(tools[0]).toMatchObject({ name: 'Shodan', link: 'https://shodan.io', category: 'Search Engines' });
  });

  test('accepts the header names people actually use', () => {
    const { tools } = parseToolImport('Tool Name,Website,Desc\nShodan,shodan.io,Device search');
    expect(tools[0]).toMatchObject({ name: 'Shodan', link: 'shodan.io', description: 'Device search' });
  });

  test('ignores columns it does not recognise', () => {
    const { tools, errors } = parseToolImport('name,cost,rating\nShodan,free,5');
    expect(errors).toEqual([]);
    expect(tools[0].name).toBe('Shodan');
  });

  test('handles quoted fields containing commas', () => {
    const { tools } = parseToolImport('name,description\nShodan,"Search engine, for devices"');
    expect(tools[0].description).toBe('Search engine, for devices');
  });

  test('reports a missing name against the spreadsheet row number', () => {
    const { tools, errors } = parseToolImport('name,url\nShodan,https://shodan.io\n,https://nowhere.test');
    expect(tools).toHaveLength(1);
    // Header is row 1, so the offending record is row 3.
    expect(errors).toEqual([expect.objectContaining({ row: 3 })]);
  });

  test('rejects a file with no recognisable columns rather than importing nothing silently', () => {
    const { tools, errors } = parseToolImport('foo,bar\n1,2');
    expect(tools).toEqual([]);
    expect(errors[0].message).toMatch(/recognisable columns/i);
  });

  test('parses tab-separated data too', () => {
    const { tools } = parseToolImport('name\turl\nShodan\thttps://shodan.io');
    expect(tools[0]).toMatchObject({ name: 'Shodan', link: 'https://shodan.io' });
  });
});

describe('parseToolImport — JSON', () => {
  test('accepts a bare array', () => {
    const { tools, format } = parseToolImport('[{"name":"Shodan","link":"https://shodan.io"}]');
    expect(format).toBe('json');
    expect(tools[0]).toMatchObject({ name: 'Shodan', link: 'https://shodan.io' });
  });

  test('accepts an exported { tools: [...] } object', () => {
    const { tools } = parseToolImport('{"tools":[{"name":"Maltego"}]}');
    expect(tools[0].name).toBe('Maltego');
  });

  test('keeps tags that are already arrays', () => {
    const { tools } = parseToolImport('[{"name":"Shodan","tags":["recon","devices"]}]');
    expect(tools[0].tags).toEqual(['recon', 'devices']);
  });

  test('reports invalid JSON without throwing', () => {
    const { tools, errors } = parseToolImport('[{"name": }]');
    expect(tools).toEqual([]);
    expect(errors[0].message).toMatch(/Invalid JSON/);
  });

  test('rejects JSON that is not a list of tools', () => {
    const { errors } = parseToolImport('{"foo":"bar"}');
    expect(errors[0].message).toMatch(/array of tools/i);
  });

  test('one bad entry does not lose the good ones', () => {
    const { tools, errors } = parseToolImport('[{"name":"Shodan"},{"link":"https://x.test"},{"name":"Maltego"}]');
    expect(tools.map((t) => t.name)).toEqual(['Shodan', 'Maltego']);
    expect(errors).toHaveLength(1);
  });
});

describe('parseToolImport — empty input', () => {
  test('returns nothing rather than erroring', () => {
    expect(parseToolImport('')).toEqual({ tools: [], errors: [], format: null });
    expect(parseToolImport('   ')).toEqual({ tools: [], errors: [], format: null });
  });
});

describe('markDuplicates', () => {
  const existing = [{ name: 'Shodan' }];

  test('flags a name that already exists, case-insensitively', () => {
    const [tool] = markDuplicates([{ name: 'shodan' }], existing);
    expect(tool.duplicateOfExisting).toBe(true);
  });

  test('flags a name repeated within the file, but only after the first', () => {
    const marked = markDuplicates([{ name: 'Maltego' }, { name: 'maltego' }], existing);
    expect(marked[0].duplicateInFile).toBe(false);
    expect(marked[1].duplicateInFile).toBe(true);
  });

  test('leaves genuinely new tools unflagged', () => {
    const [tool] = markDuplicates([{ name: 'Recon-ng' }], existing);
    expect(tool.duplicateOfExisting).toBe(false);
    expect(tool.duplicateInFile).toBe(false);
  });
});
