const OTPAuth = require('otpauth');
const tf = require('./twoFactor');

const codeAt = (secret, ms) => new OTPAuth.TOTP({ secret: OTPAuth.Secret.fromBase32(secret), digits: 6, period: 30 }).generate({ timestamp: ms });

describe('authenticator codes', () => {
  const secret = tf.newTotpSecret();
  const now = Date.UTC(2026, 10, 4, 12, 0, 15);
  const step = Math.floor(now / 30000);

  test('a current code matches and reports its time step', () => {
    expect(tf.matchTotp(secret, codeAt(secret, now), { now })).toBe(step);
  });

  test('spaces and a dash in the code are fine', () => {
    const code = codeAt(secret, now);
    expect(tf.matchTotp(secret, `${code.slice(0, 3)} ${code.slice(3)}`, { now })).toBe(step);
    expect(tf.matchTotp(secret, `${code.slice(0, 3)}-${code.slice(3)}`, { now })).toBe(step);
  });

  test('the previous and next code are accepted for clock drift, older ones are not', () => {
    expect(tf.matchTotp(secret, codeAt(secret, now - 30000), { now })).toBe(step - 1);
    expect(tf.matchTotp(secret, codeAt(secret, now + 30000), { now })).toBe(step + 1);
    expect(tf.matchTotp(secret, codeAt(secret, now - 90000), { now })).toBeNull();
  });

  test('a code at or before the last used step is refused (no replay)', () => {
    const code = codeAt(secret, now);
    expect(tf.matchTotp(secret, code, { now, lastStep: step })).toBeNull();
    expect(tf.matchTotp(secret, code, { now, lastStep: step - 1 })).toBe(step);
    // An older code is refused once a newer one was used.
    expect(tf.matchTotp(secret, codeAt(secret, now - 30000), { now, lastStep: step })).toBeNull();
  });

  test('malformed input never matches', () => {
    for (const bad of ['', null, undefined, '12345', '1234567', 'abcdef', '12 34 5x']) {
      expect(tf.matchTotp(secret, bad, { now })).toBeNull();
    }
  });

  test('otpauth URL carries issuer, account name and secret', () => {
    const url = tf.otpauthUrl(secret, { issuer: 'GHOST', label: 'alice' });
    expect(url).toMatch(/^otpauth:\/\/totp\/GHOST:alice\?/);
    expect(url).toContain(`secret=${secret}`);
    expect(url).toContain('issuer=GHOST');
  });
});

describe('recovery codes', () => {
  test('ten distinct codes in the readable alphabet', () => {
    const codes = tf.generateRecoveryCodes();
    expect(codes).toHaveLength(10);
    expect(new Set(codes).size).toBe(10);
    for (const c of codes) expect(c).toMatch(/^[a-hjkmnp-z2-9]{5}-[a-hjkmnp-z2-9]{5}$/);
  });

  test('case, spaces and the dash do not matter', () => {
    const [code] = tf.generateRecoveryCodes(1);
    const hash = tf.hashRecoveryCode(code);
    expect(tf.hashRecoveryCode(code.toUpperCase())).toBe(hash);
    expect(tf.hashRecoveryCode(code.replace('-', ' '))).toBe(hash);
    expect(tf.hashRecoveryCode(code.replace('-', ''))).toBe(hash);
    expect(tf.normaliseRecoveryCode('short')).toBeNull();
  });
});

describe('API tokens', () => {
  test('format, hint and hash', () => {
    const { token, hash, hint } = tf.generateApiToken();
    expect(tf.isApiTokenFormat(token)).toBe(true);
    expect(token.startsWith(hint)).toBe(true);
    expect(hint).toHaveLength(10);
    expect(tf.hashApiToken(token)).toBe(hash);
    expect(hash).not.toContain(token);
  });

  test('bearer header parsing only picks up GHOST tokens', () => {
    const { token } = tf.generateApiToken();
    expect(tf.bearerToken(`Bearer ${token}`)).toBe(token);
    expect(tf.bearerToken(`bearer ${token}`)).toBe(token);
    expect(tf.bearerToken('Bearer someone-elses-jwt')).toBeNull();
    expect(tf.bearerToken('Basic dXNlcjpwYXNz')).toBeNull();
    expect(tf.bearerToken(undefined)).toBeNull();
  });
});

describe('passkey addresses', () => {
  test('HTTPS with a domain name, or localhost, qualifies', () => {
    expect(tf.passkeyOrigin('https://ghost.example.org')).toEqual({ origin: 'https://ghost.example.org', rpID: 'ghost.example.org' });
    expect(tf.passkeyOrigin('https://ghost.example.org:8443/app')).toEqual({ origin: 'https://ghost.example.org:8443', rpID: 'ghost.example.org' });
    expect(tf.passkeyOrigin('http://localhost:8080')).toEqual({ origin: 'http://localhost:8080', rpID: 'localhost' });
    expect(tf.passkeyOrigin('http://ghost.localhost')).toEqual({ origin: 'http://ghost.localhost', rpID: 'ghost.localhost' });
  });

  test('plain HTTP on a network name, and IP addresses, do not', () => {
    expect(tf.passkeyOrigin('http://ghost.example.org')).toBeNull();
    expect(tf.passkeyOrigin('https://192.168.1.10')).toBeNull();
    expect(tf.passkeyOrigin('https://[::1]:8443')).toBeNull();
    expect(tf.passkeyOrigin('not a url')).toBeNull();
  });

  test('FRONTEND_URL plus PASSKEY_ORIGINS, without duplicates or unusable entries', () => {
    const env = { FRONTEND_URL: 'https://ghost.example.org', PASSKEY_ORIGINS: 'https://ghost.example.org, https://osint.example.net ,http://10.0.0.5' };
    expect(tf.passkeyOrigins(env).map((o) => o.origin)).toEqual(['https://ghost.example.org', 'https://osint.example.net']);
  });

  test('the request origin must be one of them', () => {
    const env = { FRONTEND_URL: 'https://ghost.example.org' };
    expect(tf.resolvePasskeyOrigin('https://ghost.example.org', env)).toEqual({ origin: 'https://ghost.example.org', rpID: 'ghost.example.org' });
    expect(tf.resolvePasskeyOrigin('https://evil.example.com', env)).toBeNull();
    expect(tf.resolvePasskeyOrigin(undefined, env)).toBeNull();
  });
});
