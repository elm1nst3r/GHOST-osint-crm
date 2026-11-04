import { isolate, isolateList } from './bidi';

const FSI = '⁨';
const PDI = '⁩';

describe('bidi isolation (issue #99)', () => {
  test('wraps a value in first-strong isolate marks', () => {
    expect(isolate('Ali R.')).toBe(`${FSI}Ali R.${PDI}`);
  });

  test('empty and missing values stay empty', () => {
    expect(isolate('')).toBe('');
    expect(isolate(null)).toBe('');
    expect(isolate(undefined)).toBe('');
  });

  test('isolates each list item, not the separators', () => {
    expect(isolateList(['Ali R.', 'علی‌رضا'])).toBe(`${FSI}Ali R.${PDI}, ${FSI}علی‌رضا${PDI}`);
    expect(isolateList([])).toBe('');
    expect(isolateList(undefined)).toBe('');
  });
});
