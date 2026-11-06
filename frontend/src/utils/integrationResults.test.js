import { describe, expect, test } from 'vitest';
import { occurrenceTotals, addableValues, occurrenceKey, guessOsintType } from './integrations';

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

describe('records in results (#96)', () => {
  test('a value lists the sources of the records it occurred in', () => {
    const result = { items: [
      { recordSource: 'A', fields: [email(['x@y.co'])] },
      { recordSource: 'B', fields: [email(['x@y.co'])] },
      { recordSource: 'A', fields: [email(['x@y.co', 'z@y.co'])] },
      { fields: [email(['z@y.co'])] },
    ] };
    const byValue = Object.fromEntries(addableValues(result).map((v) => [v.value, v.recordSources]));
    expect(byValue).toEqual({ 'x@y.co': ['A', 'B'], 'z@y.co': ['A'] });
  });

  test('guessing a type for a value from a record', () => {
    expect(guessOsintType('result[2].EMAIL', 'alex@example.com')).toBe('Email');
    expect(guessOsintType('PHONE', '+10000000001')).toBe('Phone');
    expect(guessOsintType('IP', '192.0.2.10')).toBe('IP Address');
    expect(guessOsintType('profile', 'https://vk.com/id1')).toBe('Website');
    expect(guessOsintType('login', 'vovk')).toBe('Username');
    expect(guessOsintType('FULL_NAME', 'Alex Example')).toBe('Other');
  });
});
