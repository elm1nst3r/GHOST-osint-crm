// File: backend/utils/secretBox.js
//
// Encryption for integration API keys (issue #96).
//
// At rest: keys in tool_credentials are encrypted with AES-256-GCM under a key
// derived from SECRETS_KEY, or SESSION_SECRET when that isn't set. A database
// dump or backup on its own therefore doesn't leak working API keys. If the
// secret changes, stored keys can no longer be read; decryptAtRest returns
// null and the tool shows as needing its key again.
//
// For export: a tool-list export "with configuration" encrypts the keys with a
// passphrase the user picks (scrypt + AES-256-GCM), needed again on import.
const crypto = require('crypto');

const AT_REST_PREFIX = 'v1:';

function atRestKey() {
  const secret = process.env.SECRETS_KEY || process.env.SESSION_SECRET;
  if (!secret) throw new Error('SECRETS_KEY or SESSION_SECRET must be set to store API keys');
  return Buffer.from(crypto.hkdfSync('sha256', secret, 'ghost-tool-credentials', 'v1', 32));
}

function seal(key, plaintext) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const data = Buffer.concat([cipher.update(String(plaintext), 'utf8'), cipher.final()]);
  return { iv, tag: cipher.getAuthTag(), data };
}

function open(key, { iv, tag, data }) {
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
}

function encryptAtRest(plaintext) {
  const { iv, tag, data } = seal(atRestKey(), plaintext);
  return AT_REST_PREFIX + Buffer.concat([iv, tag, data]).toString('base64');
}

function decryptAtRest(stored) {
  if (typeof stored !== 'string' || !stored.startsWith(AT_REST_PREFIX)) return null;
  try {
    const raw = Buffer.from(stored.slice(AT_REST_PREFIX.length), 'base64');
    return open(atRestKey(), { iv: raw.subarray(0, 12), tag: raw.subarray(12, 28), data: raw.subarray(28) });
  } catch {
    return null;
  }
}

const SCRYPT = { N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };

function passphraseKey(passphrase, salt, params = SCRYPT) {
  return crypto.scryptSync(String(passphrase), salt, 32, params);
}

// Returns a JSON-safe envelope.
function encryptWithPassphrase(passphrase, plaintext) {
  if (!passphrase || String(passphrase).length < 8) throw new Error('The passphrase must be at least 8 characters');
  const salt = crypto.randomBytes(16);
  const { iv, tag, data } = seal(passphraseKey(passphrase, salt), plaintext);
  return {
    alg: 'aes-256-gcm',
    kdf: 'scrypt',
    N: SCRYPT.N, r: SCRYPT.r, p: SCRYPT.p,
    salt: salt.toString('base64'),
    iv: iv.toString('base64'),
    tag: tag.toString('base64'),
    data: data.toString('base64'),
  };
}

// Throws 'Wrong passphrase' when it doesn't decrypt.
function decryptWithPassphrase(passphrase, envelope) {
  if (!envelope || envelope.alg !== 'aes-256-gcm' || envelope.kdf !== 'scrypt') throw new Error('Unsupported encryption format');
  const N = Number(envelope.N);
  if (!Number.isInteger(N) || N < 1024 || N > 1048576) throw new Error('Unsupported encryption format');
  try {
    const key = passphraseKey(passphrase, Buffer.from(envelope.salt, 'base64'), { ...SCRYPT, N, r: Number(envelope.r), p: Number(envelope.p) });
    return open(key, {
      iv: Buffer.from(envelope.iv, 'base64'),
      tag: Buffer.from(envelope.tag, 'base64'),
      data: Buffer.from(envelope.data, 'base64'),
    });
  } catch {
    throw new Error('Wrong passphrase');
  }
}

module.exports = { encryptAtRest, decryptAtRest, encryptWithPassphrase, decryptWithPassphrase };
