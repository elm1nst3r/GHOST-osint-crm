const express = require('express');
const router = express.Router();
const { pool } = require('../config/database');
const { requireAuth } = require('../middleware/auth');
const { validateToolData, validateIdParam } = require('../middleware/validation');

router.get('/', requireAuth, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM tools ORDER BY name ASC');
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching tools:', err.message);
    res.status(500).json({ error: 'Failed to fetch tools' });
  }
});

router.post('/', requireAuth, validateToolData, async (req, res) => {
  const { name, link, description, category, status, tags, notes } = req.body;

  const query = `INSERT INTO tools (name, link, description, category, status, tags, notes) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *;`;
  const values = [name, link || null, description || null, category || null, status || null, tags || [], notes || null];

  try {
    const result = await pool.query(query, values);
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Error creating tool:', err.message);
    res.status(500).json({ error: 'Failed to create tool' });
  }
});

router.put('/:id', requireAuth, validateIdParam, validateToolData, async (req, res) => {
  const toolId = req.params.id;
  const { name, link, description, category, status, tags, notes } = req.body;

  const query = `UPDATE tools SET name = $1, link = $2, description = $3, category = $4, status = $5, tags = $6, notes = $7 WHERE id = $8 RETURNING *;`;
  const values = [name, link || null, description || null, category || null, status || null, tags || [], notes || null, toolId];

  try {
    const result = await pool.query(query, values);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Tool not found' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error updating tool:', err.message);
    res.status(500).json({ error: 'Failed to update tool' });
  }
});

router.delete('/:id', requireAuth, validateIdParam, async (req, res) => {
  const toolId = req.params.id;

  try {
    const result = await pool.query('DELETE FROM tools WHERE id = $1 RETURNING *;', [toolId]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Tool not found' });
    res.status(200).json({ message: 'Tool deleted successfully', deletedTool: result.rows[0] });
  } catch (err) {
    console.error('Error deleting tool:', err.message);
    res.status(500).json({ error: 'Failed to delete tool' });
  }
});

module.exports = router;
