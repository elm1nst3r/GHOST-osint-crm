// File: backend/services/accountSecurity.js
//
// Database side of two-factor sign-in, passkeys and API tokens (issue #90).
// Pure helpers are in utils/twoFactor.js.
const { encryptAtRest, decryptAtRest } = require('../utils/secretBox');
const tf = require('../utils/twoFactor');

const MFA_REQUIRED_KEY = 'mfa_required';

async function mfaRequiredByPolicy(db) {
  const { rows } = await db.query('SELECT value FROM app_settings WHERE key = $1', [MFA_REQUIRED_KEY]);
  return rows[0]?.value === 'true';
}

async function setMfaRequired(db, required) {
  await db.query(
    `INSERT INTO app_settings (key, value, updated_at) VALUES ($1, $2, CURRENT_TIMESTAMP)
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = CURRENT_TIMESTAMP`,
    [MFA_REQUIRED_KEY, String(Boolean(required))]
  );
}

// What second steps a user has set up.
async function mfaState(db, userId) {
  const { rows } = await db.query(
    `SELECT u.totp_enabled_at,
            (SELECT COUNT(*)::int FROM user_passkeys p WHERE p.user_id = u.id) AS passkeys,
            (SELECT COUNT(*)::int FROM user_recovery_codes r WHERE r.user_id = u.id AND r.used_at IS NULL) AS recovery_codes
       FROM users u WHERE u.id = $1`,
    [userId]
  );
  const row = rows[0];
  if (!row) return null;
  const totp = Boolean(row.totp_enabled_at);
  return {
    totp,
    totp_enabled_at: row.totp_enabled_at,
    passkeys: row.passkeys,
    recovery_codes: row.recovery_codes,
    enabled: totp || row.passkeys > 0,
  };
}

// The same, for every user at once (user management list).
async function mfaStateForAll(db) {
  const { rows } = await db.query(
    `SELECT u.id, (u.totp_enabled_at IS NOT NULL) AS totp,
            (SELECT COUNT(*)::int FROM user_passkeys p WHERE p.user_id = u.id) AS passkeys
       FROM users u`
  );
  return new Map(rows.map((r) => [r.id, { totp: r.totp, passkeys: r.passkeys, enabled: r.totp || r.passkeys > 0 }]));
}

// ── TOTP ─────────────────────────────────────────────────────────────────────

async function enableTotp(db, userId, secretBase32, step) {
  await db.query(
    `UPDATE users SET totp_secret = $1, totp_enabled_at = NOW(), totp_last_step = $2 WHERE id = $3`,
    [encryptAtRest(secretBase32), step, userId]
  );
}

async function disableTotp(db, userId) {
  await db.query(
    'UPDATE users SET totp_secret = NULL, totp_enabled_at = NULL, totp_last_step = NULL WHERE id = $1',
    [userId]
  );
}

// Checks a code and records its time step in one statement, so two requests
// racing with the same code can't both succeed.
async function verifyTotp(db, userId, code) {
  const { rows } = await db.query(
    'SELECT totp_secret, totp_last_step FROM users WHERE id = $1 AND totp_enabled_at IS NOT NULL',
    [userId]
  );
  if (!rows[0]) return false;
  const secret = decryptAtRest(rows[0].totp_secret);
  if (!secret) return false; // SECRETS_KEY changed; an admin has to reset 2FA
  const step = tf.matchTotp(secret, code, { lastStep: rows[0].totp_last_step });
  if (step === null) return false;
  const updated = await db.query(
    `UPDATE users SET totp_last_step = $1
      WHERE id = $2 AND (totp_last_step IS NULL OR totp_last_step < $1) RETURNING id`,
    [step, userId]
  );
  return updated.rowCount === 1;
}

// ── Recovery codes ───────────────────────────────────────────────────────────

async function replaceRecoveryCodes(db, userId) {
  const codes = tf.generateRecoveryCodes();
  await db.query('DELETE FROM user_recovery_codes WHERE user_id = $1', [userId]);
  await db.query(
    `INSERT INTO user_recovery_codes (user_id, code_hash)
     SELECT $1, unnest($2::text[])`,
    [userId, codes.map(tf.hashRecoveryCode)]
  );
  return codes;
}

async function consumeRecoveryCode(db, userId, input) {
  if (!tf.normaliseRecoveryCode(input)) return false;
  const { rowCount } = await db.query(
    `UPDATE user_recovery_codes SET used_at = NOW()
      WHERE id = (SELECT id FROM user_recovery_codes
                   WHERE user_id = $1 AND code_hash = $2 AND used_at IS NULL
                   LIMIT 1 FOR UPDATE SKIP LOCKED)
      RETURNING id`,
    [userId, tf.hashRecoveryCode(input)]
  );
  return rowCount === 1;
}

// Removes every second step: the user's own "turn off" for the last method,
// and an admin's reset for someone who lost their phone.
async function resetMfa(db, userId) {
  await disableTotp(db, userId);
  await db.query('DELETE FROM user_passkeys WHERE user_id = $1', [userId]);
  await db.query('DELETE FROM user_recovery_codes WHERE user_id = $1', [userId]);
}

// After removing one method: if none is left, the recovery codes go too.
async function dropRecoveryCodesIfUnused(db, userId) {
  const state = await mfaState(db, userId);
  if (state && !state.enabled) await db.query('DELETE FROM user_recovery_codes WHERE user_id = $1', [userId]);
}

// ── Passkeys ─────────────────────────────────────────────────────────────────

async function passkeysFor(db, userId) {
  const { rows } = await db.query(
    `SELECT id, credential_id, public_key, counter, transports, rp_id, device_type, backed_up,
            name, created_at, last_used_at
       FROM user_passkeys WHERE user_id = $1 ORDER BY created_at`,
    [userId]
  );
  return rows;
}

const publicPasskey = (p) => ({
  id: p.id,
  name: p.name,
  rp_id: p.rp_id,
  backed_up: p.backed_up,
  created_at: p.created_at,
  last_used_at: p.last_used_at,
});

// ── API tokens ───────────────────────────────────────────────────────────────

const publicToken = (t) => ({
  id: t.id,
  name: t.name,
  hint: t.token_hint,
  expires_at: t.expires_at,
  last_used_at: t.last_used_at,
  created_at: t.created_at,
});

async function tokensFor(db, userId) {
  const { rows } = await db.query(
    `SELECT id, name, token_hint, expires_at, last_used_at, created_at
       FROM api_tokens WHERE user_id = $1 ORDER BY created_at DESC`,
    [userId]
  );
  return rows.map(publicToken);
}

async function createToken(db, userId, { name, expiresInDays }) {
  const { token, hash, hint } = tf.generateApiToken();
  const { rows } = await db.query(
    `INSERT INTO api_tokens (user_id, name, token_hash, token_hint, expires_at)
     VALUES ($1, $2, $3, $4, CASE WHEN $5::int IS NULL THEN NULL ELSE NOW() + make_interval(days => $5::int) END)
     RETURNING id, name, token_hint, expires_at, last_used_at, created_at`,
    [userId, name, hash, hint, expiresInDays ?? null]
  );
  return { token, record: publicToken(rows[0]) };
}

// The user behind a token, or null when the token is unknown, expired or
// belongs to a deactivated account. Role comes from the users row on every
// request, so a role change applies to tokens immediately.
async function userForToken(db, token) {
  if (!tf.isApiTokenFormat(token)) return null;
  const { rows } = await db.query(
    `SELECT t.id AS token_id, t.last_used_at, u.id, u.username, u.role
       FROM api_tokens t JOIN users u ON u.id = t.user_id
      WHERE t.token_hash = $1 AND u.is_active = TRUE
        AND (t.expires_at IS NULL OR t.expires_at > NOW())`,
    [tf.hashApiToken(token)]
  );
  return rows[0] || null;
}

// Last-used is shown to the user; once a minute is precise enough and keeps
// a busy MCP client from writing on every call.
async function touchToken(db, tokenId) {
  await db.query(
    `UPDATE api_tokens SET last_used_at = NOW()
      WHERE id = $1 AND (last_used_at IS NULL OR last_used_at < NOW() - INTERVAL '1 minute')`,
    [tokenId]
  );
}

module.exports = {
  MFA_REQUIRED_KEY,
  mfaRequiredByPolicy,
  setMfaRequired,
  mfaState,
  mfaStateForAll,
  enableTotp,
  disableTotp,
  verifyTotp,
  replaceRecoveryCodes,
  consumeRecoveryCode,
  resetMfa,
  dropRecoveryCodesIfUnused,
  passkeysFor,
  publicPasskey,
  tokensFor,
  createToken,
  userForToken,
  touchToken,
};
