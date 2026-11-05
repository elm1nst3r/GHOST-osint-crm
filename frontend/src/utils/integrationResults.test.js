import { describe, expect, test } from 'vitest';
import { occurrenceTotals, addableValues, occurrenceKey } from './integrations';

const email = (values, counts) => ({ label: 'Email', osintType: 'Email', values, ...(counts ? { counts } : {}) });

describe('occurrence totals across a search (#96)', () => {
  test('rows shown separately (no merging) still add up per value', () => {
    const result = { items: [
      ...Array.from({ length: 27 }, () => ({ fields: [email(['vovk@yandex.ru'])] })),
      { fields: [email(['a@x.co'])] },
    ] };
    const totals = occurrenceTotals(result);
    expect(totals.get(occurrenceKey({ osintType: 'Email' }, 'vovk@yandex.ru'))).toBe(27);
    expect(totals.get(occurrenceKey({ osintType: 'Email' }, 'a@x.co'))).toBe(1);
  });

  test('collected counts and merged rows multiply in', () => {
    const result = { items: [
      { count: 3, fields: [email(['vovk@yandex.ru', 'a@x.co'], [2, 1])] },
      { fields: [email(['vovk@yandex.ru'])] },
    ] };
    expect(occurrenceTotals(result).get(occurrenceKey({ osintType: 'email' }, 'vovk@yandex.ru'))).toBe(7);
  });

  test('display-only fields are counted by their label, apart from addable values', () => {
    const result = { items: [{ fields: [{ label: 'Source', values: ['x'] }, email(['x'])] }] };
    const totals = occurrenceTotals(result);
    expect(totals.size).toBe(2);
  });

  test('addable values come once each, only from fields with an OSINT type', () => {
    const result = { items: [
      { fields: [email(['b@x.co', 'a@x.co']), { label: 'Note', values: ['n'] }] },
      { fields: [email(['a@x.co'])] },
    ] };
    expect(addableValues(result).map((v) => v.value)).toEqual(['b@x.co', 'a@x.co']);
  });
});
