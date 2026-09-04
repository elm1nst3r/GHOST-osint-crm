// Authentication routes
const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { pool } = require('../config/database');
const { requireAuth } = require('../middleware/auth');
const { loginLimiter, apiLimiter } = require('../middleware/rateLimiters');
const { validatePasswordStrength } = require('../utils/passwordPolicy');
const { revokeSessionsForUser } = require('../utils/sessions');

// /login carries its own stricter loginLimiter; everything else (in
// particular /me, which lets a session re-check current_password before
// changing it) still needs the general limiter so it can't be hammered.
router.use(apiLimiter);

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

    // Update last login timestamp
    await pool.query(
      'UPDATE users SET last_login = NOW() WHERE id = $1',
      [user.id]
    );

    // Regenerate session ID before setting any authenticated fields
    // — prevents session fixation (issue #29)
    await new Promise((resolve, reject) => {
      req.session.regenerate(err => err ? reject(err) : resolve());
    });

    req.session.userId = user.id;
    req.session.username = user.username;
    req.session.userRole = user.role;

    await new Promise((resolve, reject) => {
      req.session.save(err => err ? reject(err) : resolve());
    });

    res.json({
      success: true,
      user: {
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
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Logout
router.post('/logout', requireAuth, (req, res) => {
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
