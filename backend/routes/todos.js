const express = require('express');
const router = express.Router();
const { pool } = require('../config/database');
const { requireAuth } = require('../middleware/auth');
const { validateIdParam } = require('../middleware/validation');
const { validate, TodoCreateSchema, TodoUpdateSchema } = require('../middleware/schemas');
const { apiLimiter } = require('../middleware/rateLimiters');
const { checkCaseProjectConsistency } = require('../utils/projectConsistency');
const { applyProjectScope, requireProjectMember } = require('../utils/projectAccess');


router.use(apiLimiter);
router.get('/', requireAuth, async (req, res) => {
  try {
    const where = [];
    const params = [];
    const scopeErr = await applyProjectScope(req, 'todos', where, params);
    if (scopeErr) return res.status(403).json({ error: scopeErr });
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
    const accessErr = await requireProjectMember(req, project_id);
    if (accessErr) return res.status(403).json({ error: accessErr });

    const caseErr = await checkCaseProjectConsistency(case_id, project_id);
    if (caseErr) return res.status(400).json({ error: caseErr });

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
    const existing = await pool.query('SELECT project_id FROM todos WHERE id = $1', [todoId]);
    if (existing.rows.length === 0) return res.status(404).json({ error: 'Todo not found' });
    const accessErr = await requireProjectMember(req, existing.rows[0].project_id);
    if (accessErr) return res.status(403).json({ error: accessErr });

    if (case_id != null) {
      const caseErr = await checkCaseProjectConsistency(case_id, existing.rows[0].project_id);
      if (caseErr) return res.status(400).json({ error: caseErr });
    }

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
    const existing = await pool.query('SELECT project_id FROM todos WHERE id = $1', [todoId]);
    if (existing.rows.length === 0) return res.status(404).json({ error: 'Todo not found' });
    const accessErr = await requireProjectMember(req, existing.rows[0].project_id);
    if (accessErr) return res.status(403).json({ error: accessErr });

    const result = await pool.query('DELETE FROM todos WHERE id = $1 RETURNING *;', [todoId]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Todo not found' });
    res.status(200).json({ message: 'Todo deleted successfully', deletedTodo: result.rows[0] });
  } catch (err) {
    console.error('Error deleting todo:', err.message);
    res.status(500).json({ error: 'Failed to delete todo' });
  }
});

module.exports = router;
