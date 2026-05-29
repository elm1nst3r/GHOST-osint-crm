const { validatePasswordStrength } = require('./passwordPolicy');

describe('validatePasswordStrength', () => {
  // ── Passing cases ──────────────────────────────────────────────────────────

  test('accepts a strong password', () => {
    expect(validatePasswordStrength('Tr0ub4dor&3XY!').valid).toBe(true);
  });

  test('accepts minimum 12-character password', () => {
    expect(validatePasswordStrength('Abcdef1234!g').valid).toBe(true);
  });

  test('accepts 128-character password', () => {
    const pw = 'Aa1!' + 'x'.repeat(124);
    const result = validatePasswordStrength(pw);
    expect(result.valid).toBe(true);
  });

  // ── Failing cases — length ─────────────────────────────────────────────────

  test('rejects empty string', () => {
    const r = validatePasswordStrength('');
    expect(r.valid).toBe(false);
    expect(r.errors[0]).toBe('Password is required.');
  });

  test('rejects non-string input', () => {
    const r = validatePasswordStrength(null);
    expect(r.valid).toBe(false);
    expect(r.errors[0]).toBe('Password is required.');
  });

  test('rejects password shorter than 12 characters', () => {
    const r = validatePasswordStrength('Abc1!defg');
    expect(r.valid).toBe(false);
    expect(r.errors).toContain('Must be at least 12 characters.');
  });

  test('rejects password longer than 128 characters', () => {
    const r = validatePasswordStrength('Aa1!' + 'x'.repeat(125));
    expect(r.valid).toBe(false);
    expect(r.errors).toContain('Must be at most 128 characters.');
  });

  // ── Failing cases — character classes ─────────────────────────────────────

  test('rejects password with no lowercase letters', () => {
    const r = validatePasswordStrength('ALLCAPSDIGITS1234!');
    expect(r.valid).toBe(false);
    expect(r.errors).toContain('Must contain at least one lowercase letter.');
  });

  test('rejects password with no uppercase letters', () => {
    const r = validatePasswordStrength('nouppercase1234!x');
    expect(r.valid).toBe(false);
    expect(r.errors).toContain('Must contain at least one uppercase letter.');
  });

  test('rejects password with no digits', () => {
    const r = validatePasswordStrength('NoDigitsHereAtAll!');
    expect(r.valid).toBe(false);
    expect(r.errors).toContain('Must contain at least one digit.');
  });

  // ── Failing cases — common passwords ──────────────────────────────────────

  test('rejects a known common password', () => {
    const r = validatePasswordStrength('Password123');
    expect(r.valid).toBe(false);
    expect(r.errors).toContain('Password is too common.');
  });

  test('rejects common password regardless of case', () => {
    const r = validatePasswordStrength('PASSWORD123');
    expect(r.valid).toBe(false);
    expect(r.errors).toContain('Password is too common.');
  });

  // ── Username inclusion ─────────────────────────────────────────────────────

  test('rejects password that contains the username', () => {
    const r = validatePasswordStrength('JohnDoe!Secure12', { username: 'johndoe' });
    expect(r.valid).toBe(false);
    expect(r.errors).toContain('Password must not contain your username.');
  });

  test('accepts password that does not contain the username', () => {
    const r = validatePasswordStrength('Secure!Pass9876', { username: 'johndoe' });
    expect(r.valid).toBe(true);
  });

  test('ignores username check when no username supplied', () => {
    const r = validatePasswordStrength('Secure!Pass9876');
    expect(r.valid).toBe(true);
  });

  // ── Multiple errors returned at once ──────────────────────────────────────

  test('returns all applicable errors simultaneously', () => {
    const r = validatePasswordStrength('short');
    expect(r.valid).toBe(false);
    expect(r.errors.length).toBeGreaterThan(1);
  });
});
