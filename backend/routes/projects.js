const express = require('express');
const router = express.Router();
const { pool } = require('../config/database');
const { requireAuth } = require('../middleware/auth');
const { validateIdParam } = require('../middleware/validation');
const { validate, ProjectCreateSchema, ProjectUpdateSchema } = require('../middleware/schemas');
const { apiLimiter } = require('../middleware/rateLimiters');

// Tables that carry a project_id — used by DELETE to refuse to orphan data.
// Kept as a flat list rather than deriving it from information_schema so the
// check stays fast and explicit as more tables gain the column.
const PROJECT_SCOPED_TABLES = [
  'cases', 'people', 'businesses', 'wireless_networks', 'travel_history',
  'todos', 'properties', 'assets', 'transactions', 'relationships',
];

router.use(apiLimiter);
router.get('/', requireAuth, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM projects ORDER BY name ASC');
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching projects:', err);
    res.status(500).json({ error: 'Failed to fetch projects' });
  }
});

router.post('/', requireAuth, validate(ProjectCreateSchema), async (req, res) => {
  const { name, description, status, allow_cross_linking } = req.body;

  try {
    const result = await pool.query(
      `INSERT INTO projects (name, description, status, allow_cross_linking)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [name, description || null, status || 'active', allow_cross_linking || false]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Error creating project:', err);
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Project name already exists' });
    }
    res.status(500).json({ error: 'Failed to create project' });
  }
});

router.put('/:id', requireAuth, validateIdParam, validate(ProjectUpdateSchema), async (req, res) => {
  const projectId = req.params.id;
  const { name, description, status, allow_cross_linking } = req.body;

  try {
    const result = await pool.query(
      `UPDATE projects SET name = $1, description = $2, status = $3, allow_cross_linking = $4
       WHERE id = $5 RETURNING *`,
      [name, description || null, status || 'active', allow_cross_linking || false, projectId]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Project not found' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error updating project:', err);
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Project name already exists' });
    }
    res.status(500).json({ error: 'Failed to update project' });
  }
});

router.delete('/:id', requireAuth, validateIdParam, async (req, res) => {
  const projectId = req.params.id;

  try {
    for (const table of PROJECT_SCOPED_TABLES) {
      const { rows } = await pool.query(
        `SELECT 1 FROM ${table} WHERE project_id = $1 LIMIT 1`,
        [projectId]
      );
      if (rows.length > 0) {
        return res.status(409).json({
          error: `Cannot delete project: it still has data in "${table}". Reassign or remove that data first.`,
        });
      }
    }

    const result = await pool.query('DELETE FROM projects WHERE id = $1 RETURNING *', [projectId]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Project not found' });
    res.json({ message: 'Project deleted successfully' });
  } catch (err) {
    console.error('Error deleting project:', err);
    res.status(500).json({ error: 'Failed to delete project' });
  }
});

module.exports = router;
