// Authentication routes
const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { pool } = require('../config/database');
const { requireAuth, requireAdmin } = require('../middleware/auth');

// Login
router.post('/login', async (req, res) => {
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

    // Set session
    req.session.userId = user.id;
    req.session.username = user.username;
    req.session.userRole = user.role;

    res.json({
      success: true,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        first_name: user.first_name,
        last_name: user.last_name,
        role: user.role
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
router.get('/session', (req, res) => {
  if (!req.session || !req.session.userId) {
    return res.json({ authenticated: false });
  }

  res.json({
    authenticated: true,
    user: {
      id: req.session.userId,
      username: req.session.username,
      role: req.session.userRole
    }
  });
});

// Get current user details
router.get('/me', requireAuth, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, username, email, first_name, last_name, role, last_login, created_at FROM users WHERE id = $1',
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
    const { email, first_name, last_name, current_password, new_password } = req.body;
    const userId = req.session.userId;

    // If changing password, verify current password
    if (new_password) {
      if (!current_password) {
        return res.status(400).json({ error: 'Current password is required to set a new password' });
      }

      const userResult = await pool.query('SELECT password_hash FROM users WHERE id = $1', [userId]);
      const isValidPassword = await bcrypt.compare(current_password, userResult.rows[0].password_hash);

      if (!isValidPassword) {
        return res.status(401).json({ error: 'Current password is incorrect' });
      }

      const password_hash = await bcrypt.hash(new_password, 10);
      await pool.query(
        'UPDATE users SET password_hash = $1 WHERE id = $2',
        [password_hash, userId]
      );
    }

    // Update other profile fields
    const result = await pool.query(
      `UPDATE users SET
        email = COALESCE($1, email),
        first_name = COALESCE($2, first_name),
        last_name = COALESCE($3, last_name)
      WHERE id = $4
      RETURNING id, username, email, first_name, last_name, role`,
      [email, first_name, last_name, userId]
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
