// Authentication routes
const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { pool } = require('../config/database');
const { requireAuth } = require('../middleware/auth');
const { loginLimiter, apiLimiter, mfaLimiter } = require('../middleware/rateLimiters');
const { validate, MfaVerifySchema, PasskeySignInSchema } = require('../middleware/schemas');
const { validatePasswordStrength } = require('../utils/passwordPolicy');
const { revokeSessionsForUser, regenerateSession, saveSession, establishSession } = require('../utils/sessions');
const { PENDING_MFA_TTL_MS } = require('../utils/twoFactor');
const security = require('../services/accountSecurity');
const passkeys = require('../services/passkeys');

// /login carries its own stricter loginLimiter; everything else (in
// particular /me, which lets a session re-check current_password before
// changing it) still needs the general limiter so it can't be hammered.
router.use(apiLimiter);

const publicUser = (user) => ({
  id: user.id,
  username: user.username,
  email: user.email,
  first_name: user.first_name,
  last_name: user.last_name,
  role: user.role,
  // Per-user overrides of the global defaults (issue #91). NULL means
  // "no override" — the frontend falls back to /settings/branding.
  language: user.language,
  theme_mode: user.theme_mode
});

// The user is fully signed in from here: last login, session, response.
async function finishLogin(req, res, user) {
  const mfaSetupRequired = !(await security.mfaState(pool, user.id)).enabled
    && await security.mfaRequiredByPolicy(pool);
  await pool.query('UPDATE users SET last_login = NOW() WHERE id = $1', [user.id]);
  await establishSession(req, user, { mfaSetupRequired });
  res.json({ success: true, user: publicUser(user), mfa_setup_required: mfaSetupRequired });
}

// Login — regenerate session ID on successful auth to prevent session fixation
router.post('/login', loginLimiter, async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    // Find user by username
    const result = await pool.query(
      'SELECT * FROM users WHERE username = $1 AND is_active = true',
      [username]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    const user = result.rows[0];

    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.password_hash);

    if (!isValidPassword) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    // Two-factor (issue #90): the password was right, but the session only
    // remembers that it's waiting for the second step. It has no userId, so
    // requireAuth treats it as signed out until /auth/mfa/verify.
    const mfa = await security.mfaState(pool, user.id);
    if (mfa.enabled) {
      await regenerateSession(req);
      req.session.pendingMfa = { userId: user.id, at: Date.now(), failures: 0 };
      await saveSession(req);
      const usable = await passkeys.usablePasskeys(req, pool, user.id);
      return res.json({
        mfa_required: true,
        methods: { totp: mfa.totp, passkey: usable.length > 0, recovery_code: true },
      });
    }

    await finishLogin(req, res, user);
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── Second sign-in step (issue #90) ──────────────────────────────────────────

// The user waiting for their second step, or null (and the reply sent).
async function pendingUser(req, res) {
  const pending = req.session?.pendingMfa;
  if (!pending || Date.now() - pending.at > PENDING_MFA_TTL_MS) {
    if (pending) delete req.session.pendingMfa;
    res.status(401).json({ error: 'Sign-in expired. Enter your password again.', code: 'mfa_expired' });
    return null;
  }
  const { rows } = await pool.query('SELECT * FROM users WHERE id = $1 AND is_active = true', [pending.userId]);
  if (!rows[0]) {
    delete req.session.pendingMfa;
    res.status(401).json({ error: 'Sign-in expired. Enter your password again.', code: 'mfa_expired' });
    return null;
  }
  return rows[0];
}

// Five wrong codes and the password has to be entered again, which brings
// the login limiter back into play.
const MAX_MFA_FAILURES = 5;
async function mfaFailed(req, res, message) {
  const pending = req.session.pendingMfa;
  pending.failures = (pending.failures || 0) + 1;
  if (pending.failures >= MAX_MFA_FAILURES) {
    delete req.session.pendingMfa;
    await saveSession(req);
    return res.status(401).json({ error: 'Too many wrong codes. Enter your password again.', code: 'mfa_expired' });
  }
  await saveSession(req);
  return res.status(401).json({ error: message, code: 'mfa_invalid' });
}

router.post('/mfa/verify', mfaLimiter, validate(MfaVerifySchema), async (req, res) => {
  try {
    const user = await pendingUser(req, res);
    if (!user) return;
    const { code, recovery_code } = req.body;
    if (code) {
      if (!(await security.verifyTotp(pool, user.id, code))) return mfaFailed(req, res, 'That code is not valid. Check the time on your device and try again.');
    } else {
      if (!(await security.consumeRecoveryCode(pool, user.id, recovery_code))) return mfaFailed(req, res, 'That recovery code is not valid or was already used.');
    }
    await finishLogin(req, res, user);
    // Logged after finishLogin so the entry carries the signed-in user.
    if (recovery_code) await req.audit.log('user', user.id, 'update', 'two_factor', null, 'recovery_code_used');
  } catch (error) {
    console.error('Two-factor verify error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/mfa/passkey/options', mfaLimiter, async (req, res) => {
  try {
    const user = await pendingUser(req, res);
    if (!user) return;
    const options = await passkeys.authenticationOptions(req, pool, user.id);
    await saveSession(req);
    res.json(options);
  } catch (error) {
    if (error instanceof passkeys.PasskeyError) return res.status(400).json({ error: error.message, code: error.code });
    console.error('Passkey options error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/mfa/passkey/verify', mfaLimiter, validate(PasskeySignInSchema), async (req, res) => {
  try {
    const user = await pendingUser(req, res);
    if (!user) return;
    try {
      await passkeys.verifyAuthentication(req, pool, user.id, req.body.response);
    } catch (error) {
      if (error instanceof passkeys.PasskeyError) return mfaFailed(req, res, error.message);
      throw error;
    }
    await finishLogin(req, res, user);
  } catch (error) {
    console.error('Passkey verify error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Logout. No requireAuth: it also ends a sign-in that is waiting for its
// second step, or for two-factor setup (issue #90).
router.post('/logout', (req, res) => {
  if (!req.session) return res.json({ success: true });
  req.session.destroy((err) => {
    if (err) {
      console.error('Logout error:', err);
      return res.status(500).json({ error: 'Failed to logout' });
    }
    res.clearCookie('connect.sid');
    res.json({ success: true });
  });
});

// Get current session
router.get('/session', async (req, res) => {
  if (!req.session || !req.session.userId) {
    return res.json({ authenticated: false });
  }

  // language/theme_mode aren't in the session cookie itself (issue #91) —
  // an admin flipping the global default, or the user changing their own
  // override on another device, needs to show up on the next page load, not
  // just the next login.
  let language = null;
  let theme_mode = null;
  try {
    const result = await pool.query('SELECT language, theme_mode FROM users WHERE id = $1', [req.session.userId]);
    if (result.rows.length > 0) {
      ({ language, theme_mode } = result.rows[0]);
    }
  } catch (err) {
    console.error('Error fetching user preferences for session:', err);
  }

  res.json({
    authenticated: true,
    // "Require two-factor" is on and this account has none yet: the app shows
    // only the setup screen until it's done (issue #90).
    mfa_setup_required: Boolean(req.session.mfaSetupRequired),
    user: {
      id: req.session.userId,
      username: req.session.username,
      role: req.session.userRole,
      language,
      theme_mode
    }
  });
});

// Get current user details
router.get('/me', requireAuth, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, username, email, first_name, last_name, role, last_login, created_at, language, theme_mode FROM users WHERE id = $1',
      [req.session.userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching user:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update current user's profile
router.put('/me', requireAuth, async (req, res) => {
  try {
    const { email, first_name, last_name, current_password, new_password, language, theme_mode } = req.body;
    const userId = req.session.userId;

    // Personal overrides of the global defaults (issue #91). Self-service —
    // any authenticated user sets their own, no admin needed. `null` (or
    // '') explicitly clears the override back to "inherit the global
    // default"; the key being absent from the body just leaves it alone —
    // same absent-vs-null convention as the geocoding settings route.
    if (language !== undefined && language !== null && language !== '' && !/^[a-z]{2}(-[A-Z]{2})?$/.test(language)) {
      return res.status(400).json({ error: 'Invalid language code' });
    }
    if (theme_mode !== undefined && theme_mode !== null && theme_mode !== '' && !['light', 'dark', 'system'].includes(theme_mode)) {
      return res.status(400).json({ error: 'Invalid theme_mode' });
    }
    const languageValue = language === '' ? null : language;
    const themeModeValue = theme_mode === '' ? null : theme_mode;

    // If changing password, validate and enforce policy
    if (new_password) {
      if (req.apiToken) {
        return res.status(403).json({ error: 'The password cannot be changed with an API token', code: 'session_required' });
      }
      if (!current_password) {
        return res.status(400).json({ error: 'Current password is required to set a new password' });
      }

      const userResult = await pool.query(
        'SELECT username, password_hash FROM users WHERE id = $1',
        [userId]
      );
      const user = userResult.rows[0];
      const isValidPassword = await bcrypt.compare(current_password, user.password_hash);

      if (!isValidPassword) {
        return res.status(401).json({ error: 'Current password is incorrect' });
      }

      // Enforce password strength policy (issue #33)
      const { valid, errors } = validatePasswordStrength(new_password, { username: user.username });
      if (!valid) {
        return res.status(400).json({ error: 'Password does not meet policy', details: errors });
      }

      const password_hash = await bcrypt.hash(new_password, 10);
      await pool.query(
        'UPDATE users SET password_hash = $1 WHERE id = $2',
        [password_hash, userId]
      );

      // Revoke all other sessions after a self-service password change (issue #32)
      await revokeSessionsForUser(pool, userId, { keepSessionId: req.sessionID });
    }

    // Update other profile fields. language/theme_mode use CASE, not
    // COALESCE, so an explicit clear (value null, key present) can actually
    // reach NULL in the column instead of being coerced back to the old value.
    const result = await pool.query(
      `UPDATE users SET
        email = COALESCE($1, email),
        first_name = COALESCE($2, first_name),
        last_name = COALESCE($3, last_name),
        language = CASE WHEN $4 THEN $5 ELSE language END,
        theme_mode = CASE WHEN $6 THEN $7 ELSE theme_mode END
      WHERE id = $8
      RETURNING id, username, email, first_name, last_name, role, language, theme_mode`,
      [email, first_name, last_name, language !== undefined, languageValue, theme_mode !== undefined, themeModeValue, userId]
    );

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating user:', error);
    if (error.constraint === 'users_email_key') {
      return res.status(400).json({ error: 'Email already in use' });
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
