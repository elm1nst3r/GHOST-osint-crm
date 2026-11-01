process.env.SESSION_SECRET = process.env.SESSION_SECRET || 'x'.repeat(40);
const { encryptAtRest, decryptAtRest, encryptWithPassphrase, decryptWithPassphrase } = require('./secretBox');

test('at-rest round trip, and a different secret cannot read it', () => {
  const sealed = encryptAtRest('api-key-123');
  expect(sealed.startsWith('v1:')).toBe(true);
  expect(sealed).not.toContain('api-key-123');
  expect(decryptAtRest(sealed)).toBe('api-key-123');

  const before = process.env.SECRETS_KEY;
  process.env.SECRETS_KEY = 'another-secret-entirely-0123456789';
  expect(decryptAtRest(sealed)).toBeNull();
  if (before === undefined) delete process.env.SECRETS_KEY; else process.env.SECRETS_KEY = before;
});

test('tampered or foreign values decrypt to null', () => {
  const sealed = encryptAtRest('k');
  expect(decryptAtRest(`${sealed.slice(0, -4)}AAAA`)).toBeNull();
  expect(decryptAtRest('plaintext')).toBeNull();
  expect(decryptAtRest(null)).toBeNull();
});

test('passphrase round trip', () => {
  const env = encryptWithPassphrase('correct horse', JSON.stringify({ a: 1 }));
  expect(JSON.stringify(env)).not.toContain('"a"');
  expect(JSON.parse(decryptWithPassphrase('correct horse', env))).toEqual({ a: 1 });
});

test('wrong passphrase, short passphrase and odd envelopes are rejected', () => {
  const env = encryptWithPassphrase('correct horse', 'x');
  expect(() => decryptWithPassphrase('wrong horse!', env)).toThrow('Wrong passphrase');
  expect(() => encryptWithPassphrase('short', 'x')).toThrow(/at least 8/);
  expect(() => decryptWithPassphrase('correct horse', { ...env, kdf: 'md5' })).toThrow(/Unsupported/);
  expect(() => decryptWithPassphrase('correct horse', { ...env, N: 2 ** 30 })).toThrow(/Unsupported/);
});
