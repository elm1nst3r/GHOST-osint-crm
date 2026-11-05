import { afterEach, describe, expect, test } from 'vitest';
import i18n, { fillPluralForms } from './i18n';

afterEach(() => i18n.changeLanguage('en'));

describe('plural forms', () => {
  test('missing forms are filled from the same language, not English', () => {
    const ru = fillPluralForms({ files_one: '{{count}} файл', files_other: '{{count}} файла', nested: { x_other: 'x' } }, 'ru');
    expect(ru.files_few).toBe('{{count}} файла');
    expect(ru.files_many).toBe('{{count}} файла');
    expect(ru.files_one).toBe('{{count}} файл');
    expect(ru.nested.x_few).toBe('x');
  });

  test('a real form from the catalog is kept', () => {
    const ru = fillPluralForms({ files_one: 'файл', files_few: 'файла', files_other: 'файлов' }, 'ru');
    expect(ru.files_few).toBe('файла');
    expect(ru.files_many).toBe('файлов');
  });

  test('Arabic gets all six forms', () => {
    const ar = fillPluralForms({ n_one: 'one', n_other: 'other' }, 'ar');
    expect(Object.keys(ar).sort()).toEqual(['n_few', 'n_many', 'n_one', 'n_other', 'n_two', 'n_zero']);
  });

  test('Russian counts no longer drop to English', async () => {
    await i18n.changeLanguage('ru');
    const key = 'businessDetailModal.eventCount';
    for (const n of [1, 3, 5, 21]) expect(i18n.t(key, { count: n })).toMatch(/событи/);
  });
});

test('only English is in the main bundle; other languages load when chosen', async () => {
  expect(i18n.hasResourceBundle('en', 'translation')).toBe(true);
  expect(i18n.hasResourceBundle('fa', 'translation')).toBe(false);
  await i18n.changeLanguage('fa');
  expect(i18n.hasResourceBundle('fa', 'translation')).toBe(true);
  expect(i18n.resolvedLanguage).toBe('fa');
});
