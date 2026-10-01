const {
  isValidId,
} = require('./validation');

// ── isValidId ──────────────────────────────────────────────────────────────

describe('isValidId', () => {
  test('accepts positive integers', () => {
    expect(isValidId(1)).toBe(true);
    expect(isValidId(9999)).toBe(true);
  });

  test('accepts numeric strings', () => {
    expect(isValidId('42')).toBe(true);
  });

  test('rejects zero', () => {
    expect(isValidId(0)).toBe(false);
  });

  test('rejects negative numbers', () => {
    expect(isValidId(-1)).toBe(false);
  });

  // Note: isValidId uses parseInt, so '1.5' truncates to 1 and passes — by design for route params.

  test('rejects non-numeric strings', () => {
    expect(isValidId('abc')).toBe(false);
  });

  test('rejects null', () => {
    expect(isValidId(null)).toBe(false);
  });

  test('rejects undefined', () => {
    expect(isValidId(undefined)).toBe(false);
  });
});
