import { describe, expect, test } from 'vitest';
import { flattenRecord, normalizeRecords, recordSections } from './recordNormalize';

// hunterghoul1's example from #96: one search, four databases, four shapes.
const result = [
  { FULL_NAME: 'Alex Example', PHONE: '+10000000001', database: 'Sample database A' },
  { FULL_NAME: 'Alex Example', PHONE: '+10000000001', LAST_UPDATED: '2025-01-15', EMAIL: 'alex@example.com', database: 'Sample database B' },
  { FULL_NAME: 'A. Example', PHONE: '+10000000001', email: 'alex@example.com', LAST_UPDATED: '2025-02-20', IP: '192.0.2.10', database: 'Sample database C' },
  { FULL_NAME: 'Alexander Example', PHONE: '+10000000001' },
];
const rec = (data, extra = {}) => ({ person_id: 1, integration_id: 'leaks', tool_name: 'Leak search', operation: 'phone', query: '+10000000001', data, ...extra });

describe('saved records in reports (#96)', () => {
  test('nested values become named fields', () => {
    expect(flattenRecord({ name: 'Alex', address: { city: 'Springfield', zip: null }, phones: [{ number: '1' }, { number: '2' }], tags: ['a', 'b'], ok: true }))
      .toEqual([['name', 'Alex'], ['address.city', 'Springfield'], ['address.zip', ''], ['phones[1].number', '1'], ['phones[2].number', '2'], ['tags', 'a, b'], ['ok', 'true']]);
    expect(flattenRecord('plain')).toEqual([['value', 'plain']]);
  });

  test('records of different shapes line up under the same fields', () => {
    const { columns, rows } = normalizeRecords(result.map((d) => rec(d)));
    expect(columns).toEqual(['FULL_NAME', 'PHONE', 'database', 'LAST_UPDATED', 'EMAIL', 'IP']);
    expect(rows[0].values).toEqual({ FULL_NAME: 'Alex Example', PHONE: '+10000000001', database: 'Sample database A' });
    expect(rows[2].values.EMAIL).toBe('alex@example.com'); // "email" joins "EMAIL"
    expect(rows[3].values.EMAIL).toBeUndefined();
  });

  test('the same columns whatever order the records come in', () => {
    const saved = result.map((d, i) => rec(d, { id: i + 1 }));
    const columns = normalizeRecords(saved).columns;
    expect(columns).toEqual(['FULL_NAME', 'PHONE', 'database', 'LAST_UPDATED', 'EMAIL', 'IP']);
    expect(normalizeRecords([...saved].reverse()).columns).toEqual(columns); // newest first, as the API lists them
  });

  test('fields empty in every record are dropped', () => {
    expect(normalizeRecords([rec({ a: '1', b: null }), rec({ a: '2', b: '' })]).columns).toEqual(['a']);
  });

  test('grouped per person and per tool + search; wide groups become lists', () => {
    const records = [
      ...result.map((d) => rec(d)),
      rec({ domain: 'example.com', registrar: 'X' }, { integration_id: 'whois', tool_name: 'WHOIS', operation: 'domain', query: 'example.com' }),
      rec({ a: 1 }, { person_id: 2 }),
      rec(Object.fromEntries('abcdefgh'.split('').map((k) => [k, k])), { integration_id: 'wide', tool_name: 'Wide', operation: 'x' }),
    ];
    const sections = recordSections([{ id: 1, first_name: 'Alex' }, { id: 3, first_name: 'Nobody' }], records);
    expect(sections).toHaveLength(1);
    const [leaks, whois, wide] = sections[0].groups;
    expect(leaks).toMatchObject({ tool: 'Leak search', queries: ['+10000000001'], layout: 'table' });
    expect(leaks.rows).toHaveLength(4);
    expect(whois).toMatchObject({ tool: 'WHOIS', layout: 'table', columns: ['domain', 'registrar'] });
    expect(wide.layout).toBe('list'); // 8 fields + Found
  });
});
