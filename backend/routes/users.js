// User management routes (admin only)
const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { pool } = require('../config/database');
const { requireAdmin, requireAuth } = require('../middleware/auth');

// Get all users (admin only)
router.get('/', requireAdmin, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, username, email, first_name, last_name, role, is_active, last_login, created_at, updated_at
       FROM users
       ORDER BY created_at DESC`
    );

    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching users:', error);
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

    console.log('Creating user with data:', { username, email, password: password ? '[PROVIDED]' : '[MISSING]', first_name, last_name, role });

    // Validation
    if (!username || !password) {
      console.log('Validation failed: missing username or password');
      return res.status(400).json({ error: 'Username and password are required' });
    }

    if (role && !['admin', 'user'].includes(role)) {
      return res.status(400).json({ error: 'Invalid role. Must be "admin" or "user"' });
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

// Delete user (admin only)
router.delete('/:id', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    // Prevent admins from deleting themselves
    if (parseInt(id) === req.session.userId) {
      return res.status(400).json({ error: 'Cannot delete your own account' });
    }

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
