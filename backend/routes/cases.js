const express = require('express');
const router = express.Router();
const { pool } = require('../config/database');
const { requireAuth } = require('../middleware/auth');
const { validateIdParam } = require('../middleware/validation');
const { validate, CaseCreateSchema, CaseUpdateSchema } = require('../middleware/schemas');
const { apiLimiter } = require('../middleware/rateLimiters');
const { applyProjectScope, requireProjectMember } = require('../utils/projectAccess');


router.use(apiLimiter);
router.get('/', requireAuth, async (req, res) => {
  try {
    const where = [];
    const params = [];
    const scopeErr = await applyProjectScope(req, 'cases', where, params);
    if (scopeErr) return res.status(403).json({ error: scopeErr });
    const whereClause = where.length ? `WHERE ${where.join(' AND ')}` : '';

    const result = await pool.query(`SELECT * FROM cases ${whereClause} ORDER BY case_name ASC`, params);
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching cases:', err);
    res.status(500).json({ error: 'Failed to fetch cases' });
  }
});

router.post('/', requireAuth, validate(CaseCreateSchema), async (req, res) => {
  const { case_name, description, project_id } = req.body;

  try {
    const accessErr = await requireProjectMember(req, project_id);
    if (accessErr) return res.status(403).json({ error: accessErr });

    const result = await pool.query(
      'INSERT INTO cases (case_name, description, project_id) VALUES ($1, $2, $3) RETURNING *',
      [case_name, description || null, project_id]
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

router.put('/:id', requireAuth, validateIdParam, validate(CaseUpdateSchema), async (req, res) => {
  const caseId = req.params.id;
  const { case_name, description, status } = req.body;

  try {
    const existing = await pool.query('SELECT project_id FROM cases WHERE id = $1', [caseId]);
    if (existing.rows.length === 0) return res.status(404).json({ error: 'Case not found' });
    const accessErr = await requireProjectMember(req, existing.rows[0].project_id);
    if (accessErr) return res.status(403).json({ error: accessErr });

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
    const existing = await pool.query('SELECT project_id FROM cases WHERE id = $1', [caseId]);
    if (existing.rows.length === 0) return res.status(404).json({ error: 'Case not found' });
    const accessErr = await requireProjectMember(req, existing.rows[0].project_id);
    if (accessErr) return res.status(403).json({ error: accessErr });

    const result = await pool.query('DELETE FROM cases WHERE id = $1 RETURNING *', [caseId]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Case not found' });
    res.json({ message: 'Case deleted successfully' });
  } catch (err) {
    console.error('Error deleting case:', err);
    res.status(500).json({ error: 'Failed to delete case' });
  }
});

module.exports = router;
