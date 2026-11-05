import { afterAll, afterEach, beforeAll, describe, expect, test } from 'vitest';
import i18n from '../i18n';
import { ageFrom, formatDate, formatDateTime, formatNumber } from './format';

const originalTz = process.env.TZ;
beforeAll(() => { process.env.TZ = 'America/Los_Angeles'; }); // west of UTC
afterAll(() => { process.env.TZ = originalTz; });
afterEach(() => i18n.changeLanguage('en'));

describe('formatDate', () => {
  test('follows the UI language, not the browser', async () => {
    expect(formatDate('2026-11-04', { dateStyle: 'long' })).toBe('November 4, 2026');
    await i18n.changeLanguage('ru');
    expect(formatDate('2026-11-04', { dateStyle: 'long' })).toBe('4 ноября 2026 г.');
  });

  test('a date-only value is that calendar day everywhere (no shift west of UTC)', () => {
    // Read as midnight UTC, 1980-05-01 is still April 30 in Los Angeles.
    expect(formatDate('1980-05-01', { dateStyle: 'long' })).toBe('May 1, 1980');
  });

  test('Persian keeps the Gregorian calendar and Latin digits', async () => {
    await i18n.changeLanguage('fa');
    const text = formatDate('2026-11-04', { dateStyle: 'long' });
    expect(text).toContain('2026');
    expect(text).toContain('4');
    expect(text).not.toMatch(/[۰-۹]/); // no Persian digits
    expect(text).not.toContain('1405'); // not the Solar Hijri year
  });

  test('empty values give the fallback, unparseable ones are shown as they are', () => {
    expect(formatDate(null, undefined, '—')).toBe('—');
    expect(formatDate('', undefined, 'N/A')).toBe('N/A');
    expect(formatDate('not a date')).toBe('not a date');
  });
});

describe('formatDateTime', () => {
  test('includes the time in the local zone', () => {
    expect(formatDateTime('2026-11-04T20:30:00Z', { dateStyle: 'medium', timeStyle: 'short', hour12: false })).toBe('Nov 4, 2026, 12:30');
  });
});

describe('formatNumber', () => {
  test('uses the language’s separators with Latin digits', async () => {
    const money = { minimumFractionDigits: 2, maximumFractionDigits: 2 };
    expect(formatNumber(1234.5, money)).toBe('1,234.50');
    await i18n.changeLanguage('ru');
    expect(formatNumber(1234.5, money)).toBe('1 234,50');
    await i18n.changeLanguage('fa');
    expect(formatNumber(1234.5, money)).toMatch(/^1.234.50$/);
  });
});

describe('ageFrom', () => {
  const on = (iso) => new Date(`${iso}T12:00:00`);
  test('counts whole years, birthday included', () => {
    expect(ageFrom('1990-05-01', on('2026-04-30'))).toBe(35);
    expect(ageFrom('1990-05-01', on('2026-05-01'))).toBe(36);
  });
  test('the birthday is not moved a day earlier west of UTC', () => {
    // As a timestamp, 1990-01-01 is 31 Dec 1989 in Los Angeles, which made
    // the age go up a day early (on 31 December).
    expect(ageFrom('1990-01-01', on('2026-12-31'))).toBe(36);
    expect(ageFrom('1990-01-01', on('2027-01-01'))).toBe(37);
  });
  test('no date, or not a date', () => {
    expect(ageFrom(null)).toBeNull();
    expect(ageFrom('unknown')).toBeNull();
  });
});
