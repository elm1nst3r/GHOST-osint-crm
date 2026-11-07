// User management routes (admin only)
const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { pool } = require('../config/database');
const { requireAdmin, requireAuth } = require('../middleware/auth');
const { validatePasswordStrength } = require('../utils/passwordPolicy');
const { revokeSessionsForUser } = require('../utils/sessions');
const { validateIdParam } = require('../middleware/validation');
const { apiLimiter } = require('../middleware/rateLimiters');
const { mfaStateForAll, resetMfa } = require('../services/accountSecurity');
const { readOidcConfig } = require('../utils/oidcConfig');
const { createUserForIdentity } = require('../services/oidc');
const { validate, SsoLinkSchema, SsoCreateSchema } = require('../middleware/schemas');


router.use(apiLimiter);
// Get all users (admin only)
router.get('/', requireAdmin, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, username, email, first_name, last_name, role, is_active, last_login, created_at, updated_at,
              password_hash IS NOT NULL AS has_password,
              (SELECT COUNT(*)::int FROM user_identities i WHERE i.user_id = users.id) AS sso_identities
       FROM users
       ORDER BY created_at DESC, id DESC` // id: users created together keep one order
    );

    // Two-factor status per user (issue #90), for the user management list.
    const mfa = await mfaStateForAll(pool);
    res.json(result.rows.map((u) => ({
      ...u,
      two_factor: mfa.get(u.id) || { totp: false, passkeys: 0, enabled: false },
    })));
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Lightweight directory for non-admin pickers (issue #84): a project
// manager needs to find users to add as project members without the full
// admin user-management payload (role, last_login, etc.) being exposed to
// them. Declared before /:id so it isn't swallowed by that pattern.
router.get('/directory', requireAuth, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, username, email FROM users WHERE is_active = TRUE ORDER BY username ASC`
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching user directory:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── Single sign-on (issue #105) ──────────────────────────────────────────────
// Sign-ins that matched no linked account wait here until an admin links
// them to an existing user or creates one. Linking is always an admin's
// decision: GHOST never matches an identity to an account by email itself.
// Declared before /:id so they aren't swallowed by that pattern.

router.get('/sso', requireAdmin, async (req, res) => {
  try {
    const cfg = readOidcConfig();
    const { rows } = await pool.query('SELECT * FROM sso_pending ORDER BY last_attempt_at DESC, id DESC');
    res.json({
      config: {
        enabled: cfg.enabled, wanted: cfg.enabled || cfg.problems.length > 0, problems: cfg.problems,
        issuer: cfg.issuer || null, name: cfg.displayName, autoProvision: cfg.autoProvision,
        adminGroup: cfg.adminGroup || null, localLogin: cfg.localLoginEnabled,
      },
      pending: rows,
    });
  } catch (error) {
    console.error('Error fetching SSO status:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

async function loadPending(id) {
  const { rows } = await pool.query('SELECT * FROM sso_pending WHERE id = $1', [id]);
  return rows[0] || null;
}

router.post('/sso/pending/:id/link', requireAdmin, validateIdParam, validate(SsoLinkSchema), async (req, res) => {
  const client = await pool.connect();
  try {
    const pending = await loadPending(req.params.id);
    if (!pending) return res.status(404).json({ error: 'Sign-in request not found' });
    const { rows: users } = await client.query('SELECT id, username FROM users WHERE id = $1', [req.body.user_id]);
    if (!users[0]) return res.status(404).json({ error: 'User not found' });
    await client.query('BEGIN');
    await client.query(
      `INSERT INTO user_identities (user_id, issuer, subject, email, display_name, linked_by)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [users[0].id, pending.issuer, pending.subject, pending.email, pending.display_name, req.session.userId]
    );
    await client.query('DELETE FROM sso_pending WHERE id = $1', [pending.id]);
    await client.query('COMMIT');
    await req.audit.log('user', users[0].id, 'update', 'sso_identity', null, `${pending.email || pending.subject} at ${pending.issuer}`);
    res.json({ linked: true, user_id: users[0].id });
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    if (error.constraint === 'user_identities_unique') return res.status(409).json({ error: 'This identity is already linked to a user' });
    console.error('Error linking SSO identity:', error);
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    client.release();
  }
});

router.post('/sso/pending/:id/create', requireAdmin, validateIdParam, validate(SsoCreateSchema), async (req, res) => {
  const client = await pool.connect();
  try {
    const pending = await loadPending(req.params.id);
    if (!pending) return res.status(404).json({ error: 'Sign-in request not found' });
    await client.query('BEGIN');
    const user = await createUserForIdentity(client, {
      issuer: pending.issuer, subject: pending.subject, email: pending.email, display: pending.display_name,
      preferred: pending.preferred_username, role: req.body.role || 'user', linkedBy: req.session.userId,
    });
    await client.query('DELETE FROM sso_pending WHERE id = $1', [pending.id]);
    await client.query('COMMIT');
    await req.audit.log('user', user.id, 'create', 'sso', null, pending.issuer);
    res.status(201).json({ id: user.id, username: user.username, email: user.email, role: user.role });
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    if (error.constraint === 'users_email_key') return res.status(409).json({ error: 'A user with this email already exists. Link the sign-in to that user instead.' });
    if (error.constraint === 'user_identities_unique') return res.status(409).json({ error: 'This identity is already linked to a user' });
    console.error('Error creating user from SSO identity:', error);
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    client.release();
  }
});

router.delete('/sso/pending/:id', requireAdmin, validateIdParam, async (req, res) => {
  try {
    const { rowCount } = await pool.query('DELETE FROM sso_pending WHERE id = $1', [req.params.id]);
    if (!rowCount) return res.status(404).json({ error: 'Sign-in request not found' });
    res.json({ message: 'Dismissed' });
  } catch (error) {
    console.error('Error dismissing SSO request:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/:id/sso', requireAdmin, validateIdParam, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT i.id, i.issuer, i.subject, i.email, i.display_name, i.created_at, i.last_login_at, u.username AS linked_by_username
       FROM user_identities i LEFT JOIN users u ON u.id = i.linked_by
       WHERE i.user_id = $1 ORDER BY i.created_at, i.id`,
      [req.params.id]
    );
    res.json(rows);
  } catch (error) {
    console.error('Error fetching SSO identities:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Unlinking ends the user's single sign-on: an account without a password
// can then only be used again after it is linked again (or gets a password).
router.delete('/:id/sso/:identityId', requireAdmin, validateIdParam, async (req, res) => {
  const identityId = parseInt(req.params.identityId, 10);
  if (!Number.isInteger(identityId) || identityId < 1) return res.status(400).json({ error: 'Invalid identity id' });
  try {
    const { rows } = await pool.query('DELETE FROM user_identities WHERE id = $1 AND user_id = $2 RETURNING issuer, email, subject', [identityId, req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Identity not found' });
    await revokeSessionsForUser(pool, Number(req.params.id));
    await req.audit.log('user', Number(req.params.id), 'update', 'sso_identity', `${rows[0].email || rows[0].subject} at ${rows[0].issuer}`, null);
    res.json({ message: 'Unlinked' });
  } catch (error) {
    console.error('Error unlinking SSO identity:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get user by ID (admin only)
router.get('/:id', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `SELECT id, username, email, first_name, last_name, role, is_active, last_login, created_at, updated_at
       FROM users
       WHERE id = $1`,
      [id]
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

// Create new user (admin only)
router.post('/', requireAdmin, async (req, res) => {
  try {
    const { username, email, password, first_name, last_name, role } = req.body;

    // Validation
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    if (role && !['admin', 'user'].includes(role)) {
      return res.status(400).json({ error: 'Invalid role. Must be "admin" or "user"' });
    }

    // Enforce password strength policy (issue #33)
    const { valid, errors } = validatePasswordStrength(password, { username });
    if (!valid) {
      return res.status(400).json({ error: 'Password does not meet policy', details: errors });
    }

    // Hash password
    const password_hash = await bcrypt.hash(password, 10);

    // Insert user
    const result = await pool.query(
      `INSERT INTO users (username, email, password_hash, first_name, last_name, role)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, username, email, first_name, last_name, role, is_active, created_at`,
      [username, email, password_hash, first_name, last_name, role || 'user']
    );

    // Log the creation
    await req.audit.log('user', result.rows[0].id, 'create');

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating user:', error);
    if (error.constraint === 'users_username_key') {
      return res.status(400).json({ error: 'Username already exists' });
    }
    if (error.constraint === 'users_email_key') {
      return res.status(400).json({ error: 'Email already exists' });
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update user (admin only)
router.put('/:id', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { username, email, first_name, last_name, role, is_active, password } = req.body;

    // Get old data for audit log
    const oldDataResult = await pool.query('SELECT * FROM users WHERE id = $1', [id]);
    if (oldDataResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    const oldData = oldDataResult.rows[0];

    // Prevent admins from demoting themselves
    if (parseInt(id) === req.session.userId && role && role !== 'admin') {
      return res.status(400).json({ error: 'Cannot change your own role' });
    }

    // Prevent admins from deactivating themselves
    if (parseInt(id) === req.session.userId && is_active === false) {
      return res.status(400).json({ error: 'Cannot deactivate your own account' });
    }

    if (role && !['admin', 'user'].includes(role)) {
      return res.status(400).json({ error: 'Invalid role. Must be "admin" or "user"' });
    }

    // Enforce password strength policy on admin password reset (issue #33)
    if (password) {
      const targetUsername = username || oldData.username;
      const { valid, errors } = validatePasswordStrength(password, { username: targetUsername });
      if (!valid) {
        return res.status(400).json({ error: 'Password does not meet policy', details: errors });
      }
    }

    let query = `UPDATE users SET `;
    const values = [];
    let valueIndex = 1;
    const updates = [];

    if (username !== undefined) {
      updates.push(`username = $${valueIndex++}`);
      values.push(username);
    }
    if (email !== undefined) {
      updates.push(`email = $${valueIndex++}`);
      values.push(email);
    }
    if (first_name !== undefined) {
      updates.push(`first_name = $${valueIndex++}`);
      values.push(first_name);
    }
    if (last_name !== undefined) {
      updates.push(`last_name = $${valueIndex++}`);
      values.push(last_name);
    }
    if (role !== undefined) {
      updates.push(`role = $${valueIndex++}`);
      values.push(role);
    }
    if (is_active !== undefined) {
      updates.push(`is_active = $${valueIndex++}`);
      values.push(is_active);
    }
    if (password) {
      const password_hash = await bcrypt.hash(password, 10);
      updates.push(`password_hash = $${valueIndex++}`);
      values.push(password_hash);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    query += updates.join(', ');
    query += ` WHERE id = $${valueIndex} RETURNING id, username, email, first_name, last_name, role, is_active, last_login, created_at, updated_at`;
    values.push(id);

    const result = await pool.query(query, values);

    // Revoke active sessions when role changes, account deactivated, or password reset (issue #32)
    const roleChanged = role !== undefined && role !== oldData.role;
    const deactivated = is_active === false && oldData.is_active !== false;
    const passwordReset = !!password;

    if (roleChanged || deactivated || passwordReset) {
      await revokeSessionsForUser(pool, parseInt(id));
    }

    // Log changes
    await req.audit.logChanges('user', parseInt(id), oldData, result.rows[0]);

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating user:', error);
    if (error.constraint === 'users_username_key') {
      return res.status(400).json({ error: 'Username already exists' });
    }
    if (error.constraint === 'users_email_key') {
      return res.status(400).json({ error: 'Email already exists' });
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Reset two-factor (admin only, issue #90) for someone who lost their phone
// or passkey: removes the authenticator app, passkeys and recovery codes, and
// signs the user out everywhere. Not for the admin's own account; that goes
// through Settings → Security, which asks for the password.
router.delete('/:id/two-factor', requireAdmin, validateIdParam, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (id === req.session.userId) {
      return res.status(400).json({ error: 'Use Settings → Security to change your own two-factor settings' });
    }
    const { rows } = await pool.query('SELECT id FROM users WHERE id = $1', [id]);
    if (!rows.length) return res.status(404).json({ error: 'User not found' });
    await resetMfa(pool, id);
    await revokeSessionsForUser(pool, id);
    await req.audit.log('user', id, 'update', 'two_factor', null, 'reset_by_admin');
    res.json({ success: true });
  } catch (error) {
    console.error('Error resetting two-factor:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete user (admin only)
router.delete('/:id', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    // Prevent admins from deleting themselves
    if (parseInt(id) === req.session.userId) {
      return res.status(400).json({ error: 'Cannot delete your own account' });
    }

    // Revoke all active sessions before deleting (issue #32)
    await revokeSessionsForUser(pool, parseInt(id));

    const result = await pool.query(
      'DELETE FROM users WHERE id = $1 RETURNING id, username',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Log deletion
    await req.audit.log('user', parseInt(id), 'delete');

    res.json({ success: true, deleted: result.rows[0] });
  } catch (error) {
    console.error('Error deleting user:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
