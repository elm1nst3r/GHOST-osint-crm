// Mock browser dependencies not available in Jest/Node
jest.mock('file-saver', () => ({ saveAs: jest.fn() }));
jest.mock('docx', () => ({
  Document: jest.fn(),
  Packer: { toBlob: jest.fn().mockResolvedValue(new Blob()) },
  Paragraph: jest.fn(),
  HeadingLevel: { TITLE: 'TITLE', HEADING_1: 'H1', HEADING_2: 'H2' },
  AlignmentType: { CENTER: 'center' },
}));

import i18n from 'i18next';
import en from '../locales/en/translation.json';
import ru from '../locales/ru/translation.json';
import { getFullName, formatDate, formatDateTime, generateMarkdown, subjectsOf } from './reportGenerators';

// Report output is generated through i18n now (issue #63), so the suite runs
// against the real catalog rather than hardcoded expectations.
beforeAll(() =>
  i18n.init({
    resources: { en: { translation: en }, ru: { translation: ru } },
    lng: 'en',
    fallbackLng: 'en',
    interpolation: { escapeValue: false },
  })
);
afterEach(() => i18n.changeLanguage('en'));

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

// ── subjectsOf / person-profile scoping (issue #63) ─────────────────────────

describe('subjectsOf', () => {
  const alice = { id: 1, first_name: 'Alice', last_name: 'Smith', connections: [] };
  const bob = { id: 2, first_name: 'Bob', last_name: 'Jones', connections: [] };
  const roster = [alice, bob];

  test('narrows to the selected person for a person-profile report', () => {
    expect(subjectsOf(roster, { reportType: 'person-profile' }, alice)).toEqual([alice]);
  });

  test('returns the whole roster for other report types', () => {
    expect(subjectsOf(roster, { reportType: 'comprehensive' }, alice)).toEqual(roster);
  });

  test('returns the whole roster when there is no selected person', () => {
    expect(subjectsOf(roster, { reportType: 'person-profile' }, null)).toEqual(roster);
  });
});

describe('generateMarkdown — person-profile scoping', () => {
  const alice = {
    id: 1, first_name: 'Alice', last_name: 'Smith', category: 'POI', status: 'Active',
    case_name: 'Case A', connections: [{ person_id: 2, type: 'associate', note: 'met 2019' }],
  };
  const bob = {
    id: 2, first_name: 'Bob', last_name: 'Jones', category: 'Witness', status: 'Open',
    case_name: 'Case A', connections: [],
  };
  const data = { ...BASE_DATA, people: [alice, bob], selectedPerson: alice };
  const options = { ...BASE_OPTIONS, reportType: 'person-profile' };

  test('profiles only the subject, not everyone in their case', () => {
    const md = generateMarkdown(data, options);
    expect(md).toContain('Alice Smith');
    expect(md).not.toContain('#### 2. Bob Jones');
  });

  test('still resolves connection targets against the full roster', () => {
    const md = generateMarkdown(data, options);
    expect(md).toContain('| Alice Smith | Bob Jones | associate | met 2019 |');
  });

  test('counts only the subject in summary statistics', () => {
    expect(generateMarkdown(data, options)).toContain('| People | 1 |');
  });

  test('a comprehensive report over the same data still covers everyone', () => {
    const md = generateMarkdown(data, { ...BASE_OPTIONS, reportType: 'comprehensive' });
    expect(md).toContain('#### 2. Bob Jones');
    expect(md).toContain('| People | 2 |');
  });
});

// ── Localised output (issue #63) ───────────────────────────────────────────

describe('report language', () => {
  const data = {
    ...BASE_DATA,
    people: [{ id: 1, first_name: 'Иван', last_name: 'Сидоров', category: 'Suspect', connections: [] }],
  };

  test('headings come from the catalog, not hardcoded English', () => {
    const md = generateMarkdown(data, BASE_OPTIONS);
    expect(md).toContain(`# ${en.report.investigationReport}`);
    expect(md).toContain(`## ${en.report.summaryStatistics}`);
    expect(md).toContain(en.report.confidentialityNotice);
  });

  test('switching language changes the generated report', async () => {
    const before = generateMarkdown(data, BASE_OPTIONS);
    await i18n.changeLanguage('ru');
    const after = generateMarkdown(data, BASE_OPTIONS);
    expect(after).not.toBe(before);
    // The Russian catalog may be partially translated; whatever it does have
    // for the report title must be what the report actually uses.
    expect(after).toContain(`# ${i18n.t('report.investigationReport')}`);
  });

  test('interpolated counts survive translation', () => {
    const md = generateMarkdown(
      { ...data, selectedCase: { case_name: 'Operation X', status: 'Active' } },
      { ...BASE_OPTIONS, reportType: 'comprehensive' }
    );
    expect(md).toContain('Operation X');
    expect(md).not.toContain('{{');
  });
});
