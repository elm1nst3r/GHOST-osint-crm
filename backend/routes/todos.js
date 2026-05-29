const express = require('express');
const router = express.Router();
const { pool } = require('../config/database');
const { requireAuth } = require('../middleware/auth');

router.get('/', requireAuth, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM todos ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching todos:', err.message);
    res.status(500).json({ error: 'Failed to fetch todos' });
  }
});

router.post('/', requireAuth, async (req, res) => {
  const { text, status, last_update_comment } = req.body;
  if (!text) return res.status(400).json({ error: 'Todo text is required' });

  const query = `INSERT INTO todos (text, status, last_update_comment) VALUES ($1, $2, $3) RETURNING *;`;
  const values = [text, status || 'open', last_update_comment || null];

  try {
    const result = await pool.query(query, values);
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Error creating todo:', err.message);
    res.status(500).json({ error: 'Failed to create todo' });
  }
});

router.put('/:id', requireAuth, async (req, res) => {
  const todoId = parseInt(req.params.id, 10);
  const { text, status, last_update_comment } = req.body;

  if (isNaN(todoId)) return res.status(400).json({ error: 'Invalid todo ID' });
  if (!text && status === undefined) return res.status(400).json({ error: 'Text or status is required for update' });

  const query = `UPDATE todos SET text = COALESCE($1, text), status = COALESCE($2, status), last_update_comment = $3 WHERE id = $4 RETURNING *;`;
  const values = [text, status, last_update_comment, todoId];

  try {
    const result = await pool.query(query, values);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Todo not found' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error updating todo:', err.message);
    res.status(500).json({ error: 'Failed to update todo' });
  }
});

router.delete('/:id', requireAuth, async (req, res) => {
  const todoId = parseInt(req.params.id, 10);
  if (isNaN(todoId)) return res.status(400).json({ error: 'Invalid todo ID' });

  try {
    const result = await pool.query('DELETE FROM todos WHERE id = $1 RETURNING *;', [todoId]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Todo not found' });
    res.status(200).json({ message: 'Todo deleted successfully', deletedTodo: result.rows[0] });
  } catch (err) {
    console.error('Error deleting todo:', err.message);
    res.status(500).json({ error: 'Failed to delete todo' });
  }
});

module.exports = router;
