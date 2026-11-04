// File: backend/utils/twoFactor.js
//
// Pure helpers for two-factor sign-in and API tokens (issue #90). Database
// access lives in services/accountSecurity.js; this file has no I/O so it can
// be unit-tested directly.
const crypto = require('crypto');
const net = require('net');
const OTPAuth = require('otpauth');

const TOTP_PERIOD = 30;
const TOTP_DIGITS = 6;
// Accept the previous and next 30-second code too, for clock drift.
const TOTP_WINDOW = 1;

// A password-verified login waits this long for its second step.
const PENDING_MFA_TTL_MS = 5 * 60 * 1000;

const RECOVERY_CODE_COUNT = 10;
// No 0/1/i/l/o, so codes survive being read aloud or written down.
const RECOVERY_ALPHABET = 'abcdefghjkmnpqrstuvwxyz23456789';

const API_TOKEN_PREFIX = 'ghost_';
const API_TOKEN_RE = /^ghost_[A-Za-z0-9_-]{43}$/;

const sha256 = (value) => crypto.createHash('sha256').update(String(value)).digest('hex');

// ── Authenticator app (TOTP) ─────────────────────────────────────────────────

function newTotpSecret() {
  return new OTPAuth.Secret({ size: 20 }).base32;
}

function totpFor(secretBase32, { issuer = 'GHOST', label = '' } = {}) {
  return new OTPAuth.TOTP({
    issuer,
    label,
    algorithm: 'SHA1', // what every authenticator app supports
    digits: TOTP_DIGITS,
    period: TOTP_PERIOD,
    secret: OTPAuth.Secret.fromBase32(secretBase32),
  });
}

function otpauthUrl(secretBase32, { issuer, label }) {
  return totpFor(secretBase32, { issuer, label }).toString();
}

// Digits only, spaces and dashes allowed in between ("123 456").
function normaliseTotpCode(input) {
  const code = String(input || '').replace(/[\s-]/g, '');
  return /^\d{6}$/.test(code) ? code : null;
}

// Returns the time step the code belongs to, or null. The caller stores the
// step and refuses any step at or below it, so a code can't be used twice.
function matchTotp(secretBase32, input, { lastStep = null, now = Date.now() } = {}) {
  const code = normaliseTotpCode(input);
  if (!code) return null;
  const delta = totpFor(secretBase32).validate({ token: code, window: TOTP_WINDOW, timestamp: now });
  if (delta === null) return null;
  const step = Math.floor(now / 1000 / TOTP_PERIOD) + delta;
  if (lastStep !== null && lastStep !== undefined && step <= Number(lastStep)) return null;
  return step;
}

// ── Recovery codes ───────────────────────────────────────────────────────────

function randomFromAlphabet(length) {
  let out = '';
  while (out.length < length) {
    // Rejection sampling keeps every character equally likely.
    const byte = crypto.randomBytes(1)[0];
    if (byte < 256 - (256 % RECOVERY_ALPHABET.length)) out += RECOVERY_ALPHABET[byte % RECOVERY_ALPHABET.length];
  }
  return out;
}

// "abcde-fghjk": 10 characters, about 49 bits each.
function generateRecoveryCodes(count = RECOVERY_CODE_COUNT) {
  return Array.from({ length: count }, () => {
    const raw = randomFromAlphabet(10);
    return `${raw.slice(0, 5)}-${raw.slice(5)}`;
  });
}

function normaliseRecoveryCode(input) {
  const code = String(input || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  return code.length === 10 ? code : null;
}

const hashRecoveryCode = (code) => sha256(normaliseRecoveryCode(code) || '');

// ── API tokens ───────────────────────────────────────────────────────────────

function generateApiToken() {
  const token = API_TOKEN_PREFIX + crypto.randomBytes(32).toString('base64url');
  return { token, hash: sha256(token), hint: token.slice(0, API_TOKEN_PREFIX.length + 4) };
}

const isApiTokenFormat = (value) => API_TOKEN_RE.test(String(value || ''));
const hashApiToken = (token) => sha256(token);

// "Bearer ghost_…" → the token, or null when the header isn't one of ours.
function bearerToken(header) {
  const m = /^Bearer\s+(\S+)\s*$/i.exec(String(header || ''));
  return m && m[1].startsWith(API_TOKEN_PREFIX) ? m[1] : null;
}

// ── Passkeys ─────────────────────────────────────────────────────────────────
// A passkey is bound to a domain name (the "relying party ID"). Browsers only
// allow them on HTTPS, or on localhost, and never on a bare IP address. The
// addresses GHOST may use them on come from FRONTEND_URL, plus PASSKEY_ORIGINS
// (comma-separated) for an install reached under more than one name.

const isLocalhost = (host) => host === 'localhost' || host.endsWith('.localhost');

function passkeyOrigin(value) {
  let url;
  try { url = new URL(String(value).trim()); } catch { return null; }
  const host = url.hostname.replace(/^\[|\]$/g, '');
  if (!host || net.isIP(host)) return null;
  if (url.protocol !== 'https:' && !(url.protocol === 'http:' && isLocalhost(host))) return null;
  return { origin: url.origin, rpID: host };
}

function passkeyOrigins(env = process.env) {
  const candidates = [env.FRONTEND_URL, ...String(env.PASSKEY_ORIGINS || '').split(',')]
    .filter((v) => v && String(v).trim());
  const seen = new Map();
  for (const value of candidates) {
    const parsed = passkeyOrigin(value);
    if (parsed && !seen.has(parsed.origin)) seen.set(parsed.origin, parsed);
  }
  return [...seen.values()];
}

// The browser's Origin header for this request, if passkeys may be used there.
function resolvePasskeyOrigin(originHeader, env = process.env) {
  if (!originHeader) return null;
  let origin;
  try { origin = new URL(originHeader).origin; } catch { return null; }
  return passkeyOrigins(env).find((o) => o.origin === origin) || null;
}

module.exports = {
  PENDING_MFA_TTL_MS,
  RECOVERY_CODE_COUNT,
  API_TOKEN_PREFIX,
  newTotpSecret,
  otpauthUrl,
  normaliseTotpCode,
  matchTotp,
  generateRecoveryCodes,
  normaliseRecoveryCode,
  hashRecoveryCode,
  generateApiToken,
  isApiTokenFormat,
  hashApiToken,
  bearerToken,
  passkeyOrigin,
  passkeyOrigins,
  resolvePasskeyOrigin,
};
