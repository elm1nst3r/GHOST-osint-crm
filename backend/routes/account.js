// File: backend/routes/account.js
//
// The signed-in user's own security settings (issue #90): authenticator app,
// passkeys, recovery codes and personal API tokens.
//
// Every route needs a browser session; API tokens are refused here, so a
// leaked token can't create more tokens or switch two-factor off. Two-factor
// routes also work while "require two-factor" holds the user at the setup
// screen. Removing a sign-in method, new recovery codes and new tokens all ask
// for the current password again.
const express = require('express');
const QRCode = require('qrcode');
const bcrypt = require('bcryptjs');
const router = express.Router();
const { pool } = require('../config/database');
const { requireAuth, requireAccountSession } = require('../middleware/auth');
const { apiLimiter } = require('../middleware/rateLimiters');
const { validateIdParam } = require('../middleware/validation');
const {
  validate, TotpEnableSchema, PasswordConfirmSchema, PasskeyCreateSchema, ApiTokenCreateSchema,
} = require('../middleware/schemas');
const { encryptAtRest, decryptAtRest } = require('../utils/secretBox');
const tf = require('../utils/twoFactor');
const security = require('../services/accountSecurity');
const passkeys = require('../services/passkeys');
const { revokeSessionsForUser, saveSession } = require('../utils/sessions');

router.use(apiLimiter);
router.use(requireAccountSession);

const SETUP_TTL_MS = 10 * 60 * 1000;

async function currentUser(userId) {
  const { rows } = await pool.query(
    'SELECT id, username, first_name, last_name, password_hash FROM users WHERE id = $1 AND is_active = true',
    [userId]
  );
  return rows[0] || null;
}

async function passwordMatches(userId, password) {
  const user = await currentUser(userId);
  return Boolean(user && password && await bcrypt.compare(password, user.password_hash));
}

// Name shown in the authenticator app and the passkey prompt.
async function appName() {
  const { rows } = await pool.query("SELECT value FROM app_settings WHERE key = 'app_name'");
  return (rows[0]?.value || '').trim() || 'GHOST';
}

const fail = (res, status, error, code) => res.status(status).json({ error, ...(code ? { code } : {}) });

function serverError(res, label, err) {
  console.error(`${label}:`, err);
  return res.status(500).json({ error: 'Internal server error' });
}

// After the first method is added: recovery codes, the setup gate lifted,
// and every other session signed out (one of them could be whoever had the
// password before two-factor was on).
async function firstMethodAdded(req, userId) {
  const codes = await security.replaceRecoveryCodes(pool, userId);
  delete req.session.mfaSetupRequired;
  await saveSession(req);
  await revokeSessionsForUser(pool, userId, { keepSessionId: req.sessionID });
  return codes;
}

// "Require two-factor" is on and this would remove the user's last method.
async function blockedByPolicy(userId, removing) {
  if (!(await security.mfaRequiredByPolicy(pool))) return false;
  const state = await security.mfaState(pool, userId);
  const left = (state.totp && removing !== 'totp' ? 1 : 0) + state.passkeys - (removing === 'passkey' ? 1 : 0);
  return left < 1;
}
const POLICY_BLOCK = 'Two-factor authentication is required on this server. Add another method before removing this one.';

// ── Overview ─────────────────────────────────────────────────────────────────

router.get('/security', async (req, res) => {
  try {
    const userId = req.session.userId;
    const [state, list, required] = await Promise.all([
      security.mfaState(pool, userId),
      security.passkeysFor(pool, userId),
      security.mfaRequiredByPolicy(pool),
    ]);
    res.json({
      totp: { enabled: state.totp, enabled_at: state.totp_enabled_at },
      passkeys: list.map(security.publicPasskey),
      recovery_codes_remaining: state.enabled ? state.recovery_codes : 0,
      enabled: state.enabled,
      required_by_policy: required,
      setup_required: Boolean(req.session.mfaSetupRequired),
      // Where passkeys can be used. The page compares this with its own
      // address before offering "Add a passkey".
      passkey_origins: tf.passkeyOrigins().map((o) => o.origin),
    });
  } catch (err) {
    serverError(res, 'Account security overview', err);
  }
});

// ── Authenticator app ────────────────────────────────────────────────────────

// Step 1: a new secret, kept (encrypted) in the session until confirmed.
router.post('/totp/setup', async (req, res) => {
  try {
    const user = await currentUser(req.session.userId);
    if (!user) return fail(res, 401, 'Authentication required');
    const secret = tf.newTotpSecret();
    const url = tf.otpauthUrl(secret, { issuer: await appName(), label: user.username });
    req.session.totpSetup = { secret: encryptAtRest(secret), at: Date.now() };
    await saveSession(req);
    const qrSvg = await QRCode.toString(url, { type: 'svg', margin: 1, errorCorrectionLevel: 'M' });
    res.json({ secret, otpauth_url: url, qr_svg: qrSvg });
  } catch (err) {
    serverError(res, 'Authenticator setup', err);
  }
});

// Step 2: a code from the app proves it was set up right.
router.post('/totp', validate(TotpEnableSchema), async (req, res) => {
  try {
    const userId = req.session.userId;
    const setup = req.session.totpSetup;
    const secret = setup && Date.now() - setup.at < SETUP_TTL_MS ? decryptAtRest(setup.secret) : null;
    if (!secret) return fail(res, 400, 'Setup expired. Start again.', 'totp_setup_expired');
    const step = tf.matchTotp(secret, req.body.code);
    if (step === null) return fail(res, 400, 'That code is not valid. Check the time on your device and try again.', 'mfa_invalid');

    const before = await security.mfaState(pool, userId);
    await security.enableTotp(pool, userId, secret, step);
    delete req.session.totpSetup;
    const recoveryCodes = before.enabled ? null : await firstMethodAdded(req, userId);
    if (before.enabled) await saveSession(req);
    await req.audit.log('user', userId, 'update', 'two_factor', null, 'authenticator_app_enabled');
    res.json({ enabled: true, recovery_codes: recoveryCodes });
  } catch (err) {
    serverError(res, 'Authenticator enable', err);
  }
});

router.delete('/totp', validate(PasswordConfirmSchema), async (req, res) => {
  try {
    const userId = req.session.userId;
    if (!(await passwordMatches(userId, req.body.password))) return fail(res, 401, 'Password is incorrect', 'password_invalid');
    if (await blockedByPolicy(userId, 'totp')) return fail(res, 400, POLICY_BLOCK, 'mfa_required_by_policy');
    await security.disableTotp(pool, userId);
    await security.dropRecoveryCodesIfUnused(pool, userId);
    await req.audit.log('user', userId, 'update', 'two_factor', null, 'authenticator_app_removed');
    res.json({ enabled: false });
  } catch (err) {
    serverError(res, 'Authenticator disable', err);
  }
});

// ── Recovery codes ───────────────────────────────────────────────────────────

router.post('/recovery-codes', validate(PasswordConfirmSchema), async (req, res) => {
  try {
    const userId = req.session.userId;
    if (!(await passwordMatches(userId, req.body.password))) return fail(res, 401, 'Password is incorrect', 'password_invalid');
    if (!(await security.mfaState(pool, userId)).enabled) return fail(res, 400, 'Turn on two-factor authentication first.');
    const codes = await security.replaceRecoveryCodes(pool, userId);
    await req.audit.log('user', userId, 'update', 'two_factor', null, 'recovery_codes_replaced');
    res.json({ recovery_codes: codes });
  } catch (err) {
    serverError(res, 'Recovery codes', err);
  }
});

// ── Passkeys ─────────────────────────────────────────────────────────────────

router.post('/passkeys/options', async (req, res) => {
  try {
    const user = await currentUser(req.session.userId);
    if (!user) return fail(res, 401, 'Authentication required');
    const options = await passkeys.registrationOptions(req, pool, user, await appName());
    await saveSession(req);
    res.json(options);
  } catch (err) {
    if (err instanceof passkeys.PasskeyError) return fail(res, 400, err.message, err.code);
    serverError(res, 'Passkey options', err);
  }
});

router.post('/passkeys', validate(PasskeyCreateSchema), async (req, res) => {
  try {
    const userId = req.session.userId;
    let credential;
    try {
      credential = await passkeys.verifyRegistration(req, req.body.response);
    } catch (err) {
      await saveSession(req); // the used challenge is gone either way
      if (err instanceof passkeys.PasskeyError) return fail(res, 400, err.message, err.code);
      throw err;
    }
    const before = await security.mfaState(pool, userId);
    let row;
    try {
      ({ rows: [row] } = await pool.query(
        `INSERT INTO user_passkeys (user_id, credential_id, public_key, counter, transports, rp_id, device_type, backed_up, name)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         RETURNING id, name, rp_id, backed_up, created_at, last_used_at`,
        [userId, credential.credential_id, credential.public_key, credential.counter, credential.transports,
          credential.rp_id, credential.device_type, credential.backed_up, req.body.name]
      ));
    } catch (err) {
      if (err.code === '23505') return fail(res, 400, 'This passkey is already registered.', 'passkey_exists');
      throw err;
    }
    const recoveryCodes = before.enabled ? null : await firstMethodAdded(req, userId);
    if (before.enabled) await saveSession(req);
    await req.audit.log('user', userId, 'update', 'two_factor', null, `passkey_added:${row.name}`);
    res.status(201).json({ passkey: security.publicPasskey(row), recovery_codes: recoveryCodes });
  } catch (err) {
    serverError(res, 'Passkey create', err);
  }
});

router.delete('/passkeys/:id', validateIdParam, validate(PasswordConfirmSchema), async (req, res) => {
  try {
    const userId = req.session.userId;
    if (!(await passwordMatches(userId, req.body.password))) return fail(res, 401, 'Password is incorrect', 'password_invalid');
    const { rows } = await pool.query('SELECT id, name FROM user_passkeys WHERE id = $1 AND user_id = $2', [req.params.id, userId]);
    if (!rows[0]) return fail(res, 404, 'Passkey not found');
    if (await blockedByPolicy(userId, 'passkey')) return fail(res, 400, POLICY_BLOCK, 'mfa_required_by_policy');
    await pool.query('DELETE FROM user_passkeys WHERE id = $1', [rows[0].id]);
    await security.dropRecoveryCodesIfUnused(pool, userId);
    await req.audit.log('user', userId, 'update', 'two_factor', null, `passkey_removed:${rows[0].name}`);
    res.json({ deleted: true });
  } catch (err) {
    serverError(res, 'Passkey delete', err);
  }
});

// ── API tokens ───────────────────────────────────────────────────────────────
// Not available while two-factor setup is still required: requireAuth.

router.get('/tokens', requireAuth, async (req, res) => {
  try {
    res.json(await security.tokensFor(pool, req.session.userId));
  } catch (err) {
    serverError(res, 'API token list', err);
  }
});

// The token is in this one response and nowhere else.
router.post('/tokens', requireAuth, validate(ApiTokenCreateSchema), async (req, res) => {
  try {
    const userId = req.session.userId;
    const { name, expires_in_days, password } = req.body;
    if (!(await passwordMatches(userId, password))) return fail(res, 401, 'Password is incorrect', 'password_invalid');
    const { token, record } = await security.createToken(pool, userId, { name, expiresInDays: expires_in_days });
    await req.audit.log('user', userId, 'update', 'api_token', null, `created:${record.name}`);
    res.status(201).json({ token, ...record });
  } catch (err) {
    serverError(res, 'API token create', err);
  }
});

router.delete('/tokens/:id', requireAuth, validateIdParam, async (req, res) => {
  try {
    const userId = req.session.userId;
    const { rows } = await pool.query('DELETE FROM api_tokens WHERE id = $1 AND user_id = $2 RETURNING name', [req.params.id, userId]);
    if (!rows[0]) return fail(res, 404, 'Token not found');
    await req.audit.log('user', userId, 'update', 'api_token', null, `revoked:${rows[0].name}`);
    res.json({ deleted: true });
  } catch (err) {
    serverError(res, 'API token delete', err);
  }
});

module.exports = router;
