// File: backend/routes/scratchpad.js
//
// The scratchpad: a private, per-user notepad (not project-scoped). Every
// query is keyed on the session's user id, so a user can only ever see or
// change their own notes. Nothing here is audit-logged on purpose: the audit
// log is readable by admins, and these notes are meant for their owner only.

const express = require('express');
const router = express.Router();
const { pool } = require('../config/database');
const { requireAuth } = require('../middleware/auth');
const { validateIdParam } = require('../middleware/validation');
const {
  validate,
  ScratchpadEntryCreateSchema,
  ScratchpadEntryUpdateSchema,
  ScratchpadSettingsSchema,
} = require('../middleware/schemas');
const { apiLimiter } = require('../middleware/rateLimiters');

// Plenty for a scratchpad; stops it being used as unbounded storage.
const MAX_ENTRIES_PER_USER = 500;

router.use(apiLimiter);
router.use(requireAuth);

const ENTRY_COLUMNS = 'id, content, source_label, created_at, updated_at';

async function loadSettings(userId) {
  const { rows } = await pool.query('SELECT settings FROM scratchpad_settings WHERE user_id = $1', [userId]);
  return rows[0]?.settings || {};
}

// Everything the panel needs in one request: notes (oldest first, so new ones
// append at the bottom like a notepad) and this user's settings.
router.get('/', async (req, res) => {
  try {
    const userId = req.session.userId;
    const [entries, settings] = await Promise.all([
      pool.query(`SELECT ${ENTRY_COLUMNS} FROM scratchpad_entries WHERE user_id = $1 ORDER BY created_at ASC, id ASC`, [userId]),
      loadSettings(userId),
    ]);
    res.json({ entries: entries.rows, settings });
  } catch (err) {
    console.error('Error fetching scratchpad:', err.message);
    res.status(500).json({ error: 'Failed to fetch scratchpad' });
  }
});

router.post('/entries', validate(ScratchpadEntryCreateSchema), async (req, res) => {
  const { content, source_label } = req.body;
  try {
    const userId = req.session.userId;
    const { rows: [{ count }] } = await pool.query('SELECT COUNT(*)::int AS count FROM scratchpad_entries WHERE user_id = $1', [userId]);
    if (count >= MAX_ENTRIES_PER_USER) {
      return res.status(400).json({ error: `Scratchpad is full (${MAX_ENTRIES_PER_USER} notes). Clear some notes first.` });
    }
    const { rows } = await pool.query(
      `INSERT INTO scratchpad_entries (user_id, content, source_label) VALUES ($1, $2, $3) RETURNING ${ENTRY_COLUMNS}`,
      [userId, content, source_label || null]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error('Error creating scratchpad entry:', err.message);
    res.status(500).json({ error: 'Failed to save note' });
  }
});

router.put('/entries/:id', validateIdParam, validate(ScratchpadEntryUpdateSchema), async (req, res) => {
  const { content } = req.body;
  try {
    const { rows } = await pool.query(
      `UPDATE scratchpad_entries SET content = $1, updated_at = CURRENT_TIMESTAMP
       WHERE id = $2 AND user_id = $3 RETURNING ${ENTRY_COLUMNS}`,
      [content, req.params.id, req.session.userId]
    );
    if (!rows.length) return res.status(404).json({ error: 'Note not found' });
    res.json(rows[0]);
  } catch (err) {
    console.error('Error updating scratchpad entry:', err.message);
    res.status(500).json({ error: 'Failed to update note' });
  }
});

router.delete('/entries/:id', validateIdParam, async (req, res) => {
  try {
    const { rowCount } = await pool.query(
      'DELETE FROM scratchpad_entries WHERE id = $1 AND user_id = $2',
      [req.params.id, req.session.userId]
    );
    if (!rowCount) return res.status(404).json({ error: 'Note not found' });
    res.json({ deleted: 1 });
  } catch (err) {
    console.error('Error deleting scratchpad entry:', err.message);
    res.status(500).json({ error: 'Failed to delete note' });
  }
});

// Clear the whole scratchpad. ?up_to_id=N limits it to notes with id <= N:
// the client clears what it was showing, so a note added during the undo
// window isn't swept up with the rest.
router.delete('/entries', async (req, res) => {
  try {
    const params = [req.session.userId];
    let sql = 'DELETE FROM scratchpad_entries WHERE user_id = $1';
    if (req.query.up_to_id !== undefined) {
      const upTo = Number(req.query.up_to_id);
      if (!Number.isInteger(upTo) || upTo < 1) return res.status(400).json({ error: 'Invalid up_to_id' });
      params.push(upTo);
      sql += ' AND id <= $2';
    }
    const { rowCount } = await pool.query(sql, params);
    res.json({ deleted: rowCount });
  } catch (err) {
    console.error('Error clearing scratchpad:', err.message);
    res.status(500).json({ error: 'Failed to clear scratchpad' });
  }
});

// Partial update: only the keys sent change; the rest keep their stored value.
router.put('/settings', validate(ScratchpadSettingsSchema), async (req, res) => {
  try {
    const { rows } = await pool.query(
      `INSERT INTO scratchpad_settings (user_id, settings) VALUES ($1, $2::jsonb)
       ON CONFLICT (user_id) DO UPDATE
         SET settings = scratchpad_settings.settings || EXCLUDED.settings, updated_at = CURRENT_TIMESTAMP
       RETURNING settings`,
      [req.session.userId, JSON.stringify(req.body)]
    );
    res.json(rows[0].settings);
  } catch (err) {
    console.error('Error saving scratchpad settings:', err.message);
    res.status(500).json({ error: 'Failed to save scratchpad settings' });
  }
});

module.exports = router;
module.exports.MAX_ENTRIES_PER_USER = MAX_ENTRIES_PER_USER;
