const express = require('express');
const router = express.Router();
const { pool } = require('../config/database');
const { requireAuth } = require('../middleware/auth');
const { validateIdParam } = require('../middleware/validation');
const { validate, TodoCreateSchema, TodoUpdateSchema } = require('../middleware/schemas');
const { apiLimiter } = require('../middleware/rateLimiters');


router.use(apiLimiter);
router.get('/', requireAuth, async (req, res) => {
  try {
    const where = [];
    const params = [];
    if (req.query.project_id) { params.push(parseInt(req.query.project_id, 10)); where.push(`project_id = $${params.length}`); }
    if (req.query.case_id) { params.push(parseInt(req.query.case_id, 10)); where.push(`case_id = $${params.length}`); }
    const whereClause = where.length ? `WHERE ${where.join(' AND ')}` : '';

    const result = await pool.query(`SELECT * FROM todos ${whereClause} ORDER BY created_at DESC`, params);
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching todos:', err.message);
    res.status(500).json({ error: 'Failed to fetch todos' });
  }
});

router.post('/', requireAuth, validate(TodoCreateSchema), async (req, res) => {
  const { text, status, last_update_comment, project_id, case_id } = req.body;

  const query = `INSERT INTO todos (text, status, last_update_comment, project_id, case_id) VALUES ($1, $2, $3, $4, $5) RETURNING *;`;
  const values = [text, status || 'open', last_update_comment || null, project_id, case_id || null];

  try {
    const result = await pool.query(query, values);
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Error creating todo:', err.message);
    res.status(500).json({ error: 'Failed to create todo' });
  }
});

router.put('/:id', requireAuth, validateIdParam, validate(TodoUpdateSchema), async (req, res) => {
  const todoId = req.params.id;
  const { text, status, last_update_comment, case_id } = req.body;

  const query = `UPDATE todos SET text = COALESCE($1, text), status = COALESCE($2, status), last_update_comment = $3, case_id = COALESCE($4, case_id) WHERE id = $5 RETURNING *;`;
  const values = [text, status, last_update_comment, case_id, todoId];

  try {
    const result = await pool.query(query, values);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Todo not found' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error updating todo:', err.message);
    res.status(500).json({ error: 'Failed to update todo' });
  }
});

router.delete('/:id', requireAuth, validateIdParam, async (req, res) => {
  const todoId = req.params.id;

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
