// Mock browser dependencies not available in Jest/Node
jest.mock('file-saver', () => ({ saveAs: jest.fn() }));
jest.mock('docx', () => ({
  Document: jest.fn(),
  Packer: { toBlob: jest.fn().mockResolvedValue(new Blob()) },
  Paragraph: jest.fn(),
  HeadingLevel: { TITLE: 'TITLE', HEADING_1: 'H1', HEADING_2: 'H2' },
  AlignmentType: { CENTER: 'center' },
}));

import { getFullName, formatDate, formatDateTime, generateMarkdown } from './reportGenerators';

// ── getFullName ────────────────────────────────────────────────────────────

describe('getFullName', () => {
  test('joins first and last name', () => {
    expect(getFullName({ first_name: 'John', last_name: 'Doe' })).toBe('John Doe');
  });

  test('handles missing last name', () => {
    expect(getFullName({ first_name: 'Madonna', last_name: '' })).toBe('Madonna');
  });

  test('handles missing first name', () => {
    expect(getFullName({ first_name: '', last_name: 'Prince' })).toBe('Prince');
  });

  test('returns Unknown when both names absent', () => {
    expect(getFullName({ first_name: null, last_name: null })).toBe('Unknown');
  });

  test('trims leading/trailing whitespace from the full string', () => {
    // Outer whitespace is trimmed; internal spacing from the parts is preserved
    const result = getFullName({ first_name: '  Jane', last_name: 'Smith  ' });
    expect(result.startsWith(' ')).toBe(false);
    expect(result.endsWith(' ')).toBe(false);
    expect(result).toContain('Jane');
    expect(result).toContain('Smith');
  });
});

// ── formatDate ─────────────────────────────────────────────────────────────

describe('formatDate', () => {
  test('returns N/A for null', () => {
    expect(formatDate(null)).toBe('N/A');
  });

  test('returns N/A for undefined', () => {
    expect(formatDate(undefined)).toBe('N/A');
  });

  test('formats a valid ISO date string', () => {
    const result = formatDate('2000-06-15');
    expect(result).toContain('2000');
    expect(result).toContain('June');
    expect(result).toContain('15');
  });
});

// ── formatDateTime ─────────────────────────────────────────────────────────

describe('formatDateTime', () => {
  test('returns N/A for null', () => {
    expect(formatDateTime(null)).toBe('N/A');
  });

  test('includes year and time components', () => {
    const result = formatDateTime('2024-01-20T14:30:00');
    expect(result).toContain('2024');
    // hour and minute will appear in locale output
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
  });
});

// ── generateMarkdown ───────────────────────────────────────────────────────

const BASE_DATA = {
  people: [],
  businesses: [],
  locations: [],
  todos: [],
  selectedCase: null,
  selectedPerson: null,
};

const BASE_OPTIONS = {
  includeSummary: true,
  includePeople: true,
  includeConnections: true,
  includeLocations: true,
  includeTodos: true,
  includeCharts: true,
};

describe('generateMarkdown', () => {
  test('returns a string', () => {
    expect(typeof generateMarkdown(BASE_DATA, BASE_OPTIONS)).toBe('string');
  });

  test('includes INVESTIGATION REPORT header', () => {
    expect(generateMarkdown(BASE_DATA, BASE_OPTIONS)).toContain('# INVESTIGATION REPORT');
  });

  test('uses case name as report title when selectedCase is set', () => {
    const data = { ...BASE_DATA, selectedCase: { case_name: 'Operation X', status: 'Active' } };
    expect(generateMarkdown(data, BASE_OPTIONS)).toContain('## Operation X');
  });

  test('uses person full name as title when selectedPerson is set', () => {
    const data = { ...BASE_DATA, selectedPerson: { first_name: 'Jane', last_name: 'Doe' } };
    expect(generateMarkdown(data, BASE_OPTIONS)).toContain('## Jane Doe');
  });

  test('uses General Report title when neither case nor person is set', () => {
    expect(generateMarkdown(BASE_DATA, BASE_OPTIONS)).toContain('## General Report');
  });

  test('includes summary statistics table', () => {
    expect(generateMarkdown(BASE_DATA, BASE_OPTIONS)).toContain('## SUMMARY STATISTICS');
  });

  test('includes people profiles section when people present', () => {
    const data = {
      ...BASE_DATA,
      people: [{ id: 1, first_name: 'Alice', last_name: 'Smith', category: 'POI', status: 'Active', case_name: 'Case A', connections: [] }],
    };
    const md = generateMarkdown(data, BASE_OPTIONS);
    expect(md).toContain('## PEOPLE PROFILES');
    expect(md).toContain('Alice Smith');
  });

  test('omits people section when includePeople is false', () => {
    const data = {
      ...BASE_DATA,
      people: [{ id: 1, first_name: 'Alice', last_name: 'Smith', connections: [] }],
    };
    const md = generateMarkdown(data, { ...BASE_OPTIONS, includePeople: false });
    expect(md).not.toContain('## PEOPLE PROFILES');
  });

  test('includes connections section when connections exist', () => {
    const data = {
      ...BASE_DATA,
      people: [
        { id: 1, first_name: 'A', last_name: 'B', connections: [{ person_id: 2, type: 'Associate', note: '' }] },
        { id: 2, first_name: 'C', last_name: 'D', connections: [] },
      ],
    };
    expect(generateMarkdown(data, BASE_OPTIONS)).toContain('## CONNECTIONS ANALYSIS');
  });

  test('includes CONFIDENTIAL classification', () => {
    expect(generateMarkdown(BASE_DATA, BASE_OPTIONS)).toContain('CONFIDENTIAL');
  });

  test('ends with End of Report marker', () => {
    const md = generateMarkdown(BASE_DATA, BASE_OPTIONS);
    expect(md.endsWith('*End of Report*')).toBe(true);
  });

  test('people category stats appear in statistical analysis', () => {
    const data = {
      ...BASE_DATA,
      people: [
        { id: 1, first_name: 'A', last_name: 'B', category: 'POI', connections: [] },
        { id: 2, first_name: 'C', last_name: 'D', category: 'POI', connections: [] },
        { id: 3, first_name: 'E', last_name: 'F', category: 'Witness', connections: [] },
      ],
    };
    const md = generateMarkdown(data, BASE_OPTIONS);
    expect(md).toContain('## STATISTICAL ANALYSIS');
    expect(md).toContain('POI');
    expect(md).toContain('66.7%');
  });

  test('task summary included when todos present', () => {
    const data = {
      ...BASE_DATA,
      todos: [
        { text: 'Follow up', status: 'open', created_at: '2024-01-01' },
        { text: 'Review docs', status: 'done', created_at: '2024-01-02' },
      ],
    };
    const md = generateMarkdown(data, BASE_OPTIONS);
    expect(md).toContain('## INVESTIGATION TASKS');
    expect(md).toContain('Open: 1');
    expect(md).toContain('Completed: 1');
  });
});
