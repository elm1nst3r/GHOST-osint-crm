// File: backend/routes/relationships.js
// Real CRUD over the `relationships` table (issue #83), replacing the dead
// entityNetwork.js JSONB-scanning endpoints. `people.connections` /
// `businesses.employees` stay the read-time computed view for backward
// compatibility with existing frontend consumers — this route is the
// write-of-record and the one place cross-project-link enforcement lives.
const express = require('express');
const router = express.Router();
const { pool } = require('../config/database');
const { requireAuth } = require('../middleware/auth');
const { validateIdParam } = require('../middleware/validation');
const { validate, RelationshipCreateSchema, RelationshipUpdateSchema } = require('../middleware/schemas');
const { apiLimiter } = require('../middleware/rateLimiters');

const ENTITY_TABLE = { person: 'people', business: 'businesses' };

async function fetchEntityProject(entityType, entityId) {
  const table = ENTITY_TABLE[entityType];
  const { rows } = await pool.query(`SELECT project_id FROM ${table} WHERE id = $1`, [entityId]);
  return rows[0]?.project_id ?? null;
}

router.use(apiLimiter);

// GET /?source_type=&source_id=&target_type=&target_id=&project_id=&case_id=
router.get('/', requireAuth, async (req, res) => {
  try {
    const where = [];
    const params = [];
    const add = (clause, value) => { params.push(value); where.push(clause.replace('?', `$${params.length}`)); };

    if (req.query.source_type) add('source_type = ?', req.query.source_type);
    if (req.query.source_id) add('source_id = ?', parseInt(req.query.source_id, 10));
    if (req.query.target_type) add('target_type = ?', req.query.target_type);
    if (req.query.target_id) add('target_id = ?', parseInt(req.query.target_id, 10));
    if (req.query.project_id) add('project_id = ?', parseInt(req.query.project_id, 10));
    if (req.query.case_id) add('case_id = ?', parseInt(req.query.case_id, 10));

    const sql = `SELECT * FROM relationships${where.length ? ' WHERE ' + where.join(' AND ') : ''} ORDER BY created_at DESC`;
    const result = await pool.query(sql, params);
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching relationships:', err);
    res.status(500).json({ error: 'Failed to fetch relationships' });
  }
});

router.post('/', requireAuth, validate(RelationshipCreateSchema), async (req, res) => {
  const { project_id, case_id, source_type, source_id, target_type, target_id, relationship_type, note } = req.body;

  try {
    const [sourceProjectId, targetProjectId] = await Promise.all([
      fetchEntityProject(source_type, source_id),
      fetchEntityProject(target_type, target_id),
    ]);
    if (sourceProjectId === null) return res.status(404).json({ error: `${source_type} ${source_id} not found` });
    if (targetProjectId === null) return res.status(404).json({ error: `${target_type} ${target_id} not found` });

    if (sourceProjectId !== targetProjectId) {
      const { rows } = await pool.query('SELECT allow_cross_linking FROM projects WHERE id = $1', [project_id]);
      if (!rows[0] || !rows[0].allow_cross_linking) {
        return res.status(409).json({
          error: 'Cannot link entities from different projects unless the project has allow_cross_linking enabled',
        });
      }
    }

    const result = await pool.query(
      `INSERT INTO relationships (project_id, case_id, source_type, source_id, target_type, target_id, relationship_type, note)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [project_id, case_id || null, source_type, source_id, target_type, target_id, relationship_type, note || null]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Error creating relationship:', err);
    res.status(500).json({ error: 'Failed to create relationship' });
  }
});

router.put('/:id', requireAuth, validateIdParam, validate(RelationshipUpdateSchema), async (req, res) => {
  const { case_id, relationship_type, note } = req.body;

  try {
    const result = await pool.query(
      `UPDATE relationships SET case_id = $1, relationship_type = $2, note = $3
       WHERE id = $4 RETURNING *`,
      [case_id || null, relationship_type, note || null, req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Relationship not found' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error updating relationship:', err);
    res.status(500).json({ error: 'Failed to update relationship' });
  }
});

router.delete('/:id', requireAuth, validateIdParam, async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM relationships WHERE id = $1 RETURNING *', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Relationship not found' });
    res.json({ message: 'Relationship deleted successfully' });
  } catch (err) {
    console.error('Error deleting relationship:', err);
    res.status(500).json({ error: 'Failed to delete relationship' });
  }
});

module.exports = router;
