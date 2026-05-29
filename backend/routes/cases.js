const express = require('express');
const router = express.Router();
const { pool } = require('../config/database');
const { requireAuth } = require('../middleware/auth');
const { validateIdParam } = require('../middleware/validation');

router.get('/', requireAuth, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM cases ORDER BY case_name ASC');
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching cases:', err);
    res.status(500).json({ error: 'Failed to fetch cases' });
  }
});

router.post('/', requireAuth, async (req, res) => {
  const { case_name, description } = req.body;
  if (!case_name) return res.status(400).json({ error: 'Case name is required' });

  try {
    const result = await pool.query(
      'INSERT INTO cases (case_name, description) VALUES ($1, $2) RETURNING *',
      [case_name, description || null]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Error creating case:', err);
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Case name already exists' });
    }
    res.status(500).json({ error: 'Failed to create case' });
  }
});

router.put('/:id', requireAuth, validateIdParam, async (req, res) => {
  const caseId = req.params.id;
  const { case_name, description, status } = req.body;

  if (!case_name) return res.status(400).json({ error: 'Case name is required for update' });

  try {
    const result = await pool.query(
      'UPDATE cases SET case_name = $1, description = $2, status = $3 WHERE id = $4 RETURNING *',
      [case_name, description || null, status || 'open', caseId]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Case not found' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error updating case:', err);
    res.status(500).json({ error: 'Failed to update case' });
  }
});

router.delete('/:id', requireAuth, validateIdParam, async (req, res) => {
  const caseId = req.params.id;

  try {
    const result = await pool.query('DELETE FROM cases WHERE id = $1 RETURNING *', [caseId]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Case not found' });
    res.json({ message: 'Case deleted successfully' });
  } catch (err) {
    console.error('Error deleting case:', err);
    res.status(500).json({ error: 'Failed to delete case' });
  }
});

module.exports = router;
