const {
  isValidEmail,
  isValidUrl,
  isValidId,
} = require('./validation');

// ── isValidEmail ───────────────────────────────────────────────────────────

describe('isValidEmail', () => {
  test('accepts standard email addresses', () => {
    expect(isValidEmail('user@example.com')).toBe(true);
    expect(isValidEmail('user.name+tag@sub.domain.org')).toBe(true);
  });

  test('rejects addresses without @', () => {
    expect(isValidEmail('notanemail')).toBe(false);
  });

  test('rejects addresses without domain', () => {
    expect(isValidEmail('user@')).toBe(false);
  });

  test('rejects addresses without local part', () => {
    expect(isValidEmail('@example.com')).toBe(false);
  });

  test('rejects empty string', () => {
    expect(isValidEmail('')).toBe(false);
  });
});

// ── isValidUrl ─────────────────────────────────────────────────────────────

describe('isValidUrl', () => {
  test('accepts http URLs', () => {
    expect(isValidUrl('http://example.com')).toBe(true);
  });

  test('accepts https URLs', () => {
    expect(isValidUrl('https://example.com/path?q=1')).toBe(true);
  });

  test('rejects bare hostnames without scheme', () => {
    expect(isValidUrl('example.com')).toBe(false);
  });

  test('rejects empty string', () => {
    expect(isValidUrl('')).toBe(false);
  });

  test('rejects plain text', () => {
    expect(isValidUrl('not a url')).toBe(false);
  });
});

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
