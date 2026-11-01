import {
  slugify, humanizeKey, templateFromExample, requestLine, parseRequestLine, interpretClick, parsePath,
  segmentsToPath, buildManifest, stateFromManifest, emptyState,
} from './integrationBuilder';

test('slugify and humanizeKey', () => {
  expect(slugify('Have I Been Pwned!')).toBe('have-i-been-pwned');
  expect(slugify('Почта')).toBe('integration');
  expect(humanizeKey('first_name')).toBe('First name');
  expect(humanizeKey('DataClasses')).toBe('Data classes');
  expect(humanizeKey('data.emails[].linkedin')).toBe('Linkedin');
});

describe('templateFromExample', () => {
  test('finds the sample in the path, even when encoded', () => {
    const r = templateFromExample('https://api.example.com/v1/lookup/test%40example.com?full=true', 'test@example.com');
    expect(r).toMatchObject({ baseUrl: 'https://api.example.com', path: '/v1/lookup/{{input}}', query: { full: 'true' }, found: true });
  });

  test('finds it in the query and removes a key passed in the URL', () => {
    const r = templateFromExample('https://api.hunter.io/v2/domain-search?domain=stripe.com&api_key=SECRET', 'stripe.com',
      { authType: 'query', authName: 'api_key' });
    expect(r.query).toEqual({ domain: '{{input}}' });
    expect(r.removedKey).toBe(true);
  });

  test('reports a sample it cannot find, and bad URLs', () => {
    expect(templateFromExample('https://api.example.com/x', 'nothere').found).toBe(false);
    expect(templateFromExample('not a url', 'x').error).toBe('notUrl');
    expect(templateFromExample('http://api.example.com/x', 'x').error).toBe('notHttps');
  });
});

test('requestLine and parseRequestLine round-trip', () => {
  const line = requestLine('https://api.example.com', '/v1/{{input}}', { q: '{{input}}', size: '50' });
  expect(line).toBe('https://api.example.com/v1/{{input}}?q={{input}}&size=50');
  expect(parseRequestLine(line)).toEqual({ baseUrl: 'https://api.example.com', path: '/v1/{{input}}', query: { q: '{{input}}', size: '50' }, found: true });
  expect(parseRequestLine('http://x.com').error).toBe('notHttps');
});

describe('interpretClick', () => {
  test('a value outside any list is a plain field of a single result', () => {
    expect(interpretClick(['data', 'name'], undefined)).toEqual({ field: 'data.name', root: '' });
  });

  test('a value in a list offers per-item or collected', () => {
    const r = interpretClick(['data', 'emails', 2, 'sources', 0, 'uri'], undefined);
    expect(r.perItem).toEqual({ root: 'data.emails', field: 'sources[].uri' });
    expect(r.collected).toEqual({ root: '', field: 'data.emails[].sources[].uri' });
  });

  test('once a list is chosen, clicks inside it are relative to an item', () => {
    expect(interpretClick(['data', 'emails', 4, 'value'], 'data.emails')).toEqual({ field: 'value' });
    expect(interpretClick(['meta', 'total'], 'data.emails')).toEqual({ error: 'outsideRoot' });
  });

  test('with the whole response as one result, list indexes become []', () => {
    expect(interpretClick(['verified_accounts', 1, 'url'], '')).toEqual({ field: 'verified_accounts[].url' });
  });

  test('top-level list responses', () => {
    expect(interpretClick([3, 'name_value'], undefined).perItem).toEqual({ root: '', field: 'name_value' });
  });
});

test('parsePath / segmentsToPath', () => {
  expect(parsePath('data.emails[0].value')).toEqual(['data', 'emails', 0, 'value']);
  expect(segmentsToPath(['a', '[]', 'b'])).toBe('a[].b');
});

test('buildManifest produces a manifest that stateFromManifest reads back', () => {
  const state = {
    ...emptyState(), name: 'Example Service', baseUrl: 'https://api.example.com', authType: 'query', authName: 'key',
    operations: [{
      id: '', label: 'Emails at a domain', input: 'domain', cost: 'quota', path: '/search', query: { domain: '{{input}}' },
      root: 'data', title: 'value', link: '', fields: [{ label: '', path: 'value', osintType: 'Email', split: '' }],
    }],
  };
  const m = buildManifest(state);
  expect(m).toMatchObject({
    id: 'example-service', auth: { type: 'query', name: 'key' },
    operations: [{ id: 'emails-at-a-domain', results: { root: 'data', title: 'value', fields: [{ label: 'Value', path: 'value', osintType: 'Email' }] } }],
  });
  expect(buildManifest(stateFromManifest(m))).toEqual(m);
});
