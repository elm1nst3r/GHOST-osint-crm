const express = require('express');
const router = express.Router();
const { pool } = require('../config/database');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const { validateIdParam } = require('../middleware/validation');
const { validate, ProjectCreateSchema, ProjectUpdateSchema, ProjectMemberCreateSchema, ProjectMemberUpdateSchema } = require('../middleware/schemas');
const { apiLimiter } = require('../middleware/rateLimiters');
const { requireProjectMember, requireProjectManager } = require('../utils/projectAccess');
const { deleteProjectCascade, getProjectStats } = require('../utils/deleteProjectCascade');

router.use(apiLimiter);

// GET / — admins see every project; everyone else sees only projects they're
// a member of. my_role lets the frontend gate manager-only UI (the members
// button, project settings edit) without a second request per project
// (issue #84).
router.get('/', requireAuth, async (req, res) => {
  try {
    if (req.session.userRole === 'admin') {
      const result = await pool.query(`SELECT p.*, 'admin' AS my_role FROM projects p ORDER BY p.name ASC`);
      return res.json(result.rows);
    }
    const result = await pool.query(
      `SELECT p.*, pm.project_role AS my_role
       FROM projects p
       JOIN project_members pm ON pm.project_id = p.id AND pm.user_id = $1
       ORDER BY p.name ASC`,
      [req.session.userId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching projects:', err);
    res.status(500).json({ error: 'Failed to fetch projects' });
  }
});

// POST / — admin only (issue #84 v1: project creation isn't a delegable
// permission yet, see the migration/plan notes for why).
router.post('/', requireAuth, requireAdmin, validate(ProjectCreateSchema), async (req, res) => {
  const { name, description, status, allow_cross_linking, icon } = req.body;

  try {
    const result = await pool.query(
      `INSERT INTO projects (name, description, status, allow_cross_linking, icon)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [name, description || null, status || 'active', allow_cross_linking || false, icon || null]
    );
    res.status(201).json({ ...result.rows[0], my_role: 'admin' });
  } catch (err) {
    console.error('Error creating project:', err);
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Project name already exists' });
    }
    res.status(500).json({ error: 'Failed to create project' });
  }
});

// PUT /:id — admin or that project's manager.
router.put('/:id', requireAuth, validateIdParam, validate(ProjectUpdateSchema), async (req, res) => {
  const projectId = req.params.id;
  const { name, description, status, allow_cross_linking, icon } = req.body;

  const accessErr = await requireProjectManager(req, projectId);
  if (accessErr) return res.status(403).json({ error: accessErr });

  try {
    const nextStatus = status || 'active';
    // archived_at tracks when the project entered 'closed' — set it on the
    // transition in, clear it on the way out, leave it alone otherwise
    // (issue #88 retention policy counts from this).
    const archivedAtExpr =
      nextStatus === 'closed'
        ? `CASE WHEN status = 'closed' THEN archived_at ELSE CURRENT_TIMESTAMP END`
        : `NULL`;
    const result = await pool.query(
      `UPDATE projects SET name = $1, description = $2, status = $3, allow_cross_linking = $4, icon = $5,
              archived_at = ${archivedAtExpr}
       WHERE id = $6 RETURNING *`,
      [name, description || null, nextStatus, allow_cross_linking || false, icon || null, projectId]
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

// GET /:id/stats — per-entity row counts for this project. Powers the
// delete-confirmation dialog (issue #88). Any member (or admin) may read it.
router.get('/:id/stats', requireAuth, validateIdParam, async (req, res) => {
  const projectId = req.params.id;
  const accessErr = await requireProjectMember(req, projectId);
  if (accessErr) return res.status(403).json({ error: accessErr });

  try {
    const project = await pool.query('SELECT id, name FROM projects WHERE id = $1', [projectId]);
    if (project.rows.length === 0) return res.status(404).json({ error: 'Project not found' });
    const { counts, total } = await getProjectStats(pool, projectId);
    res.json({ projectId: project.rows[0].id, name: project.rows[0].name, counts, total });
  } catch (err) {
    console.error('Error fetching project stats:', err);
    res.status(500).json({ error: 'Failed to fetch project stats' });
  }
});

// DELETE /:id — admin only, same reasoning as POST /. Deletes every
// project-scoped entity in one transaction (issue #88), not just the empty
// shell. When the project holds any data the caller must echo its exact name
// back in `confirm_name` — a guard against deleting the wrong project.
router.delete('/:id', requireAuth, requireAdmin, validateIdParam, async (req, res) => {
  const projectId = req.params.id;
  const confirmName = req.body?.confirm_name ?? req.query.confirm_name;

  const client = await pool.connect();
  try {
    const projectRes = await client.query('SELECT id, name FROM projects WHERE id = $1', [projectId]);
    if (projectRes.rows.length === 0) return res.status(404).json({ error: 'Project not found' });
    const project = projectRes.rows[0];

    const { counts, total } = await getProjectStats(client, projectId);
    if (total > 0 && confirmName !== project.name) {
      return res.status(409).json({
        error: 'This project contains data. Confirm deletion by sending its exact name in "confirm_name".',
        requiresConfirmation: true,
        name: project.name,
        counts,
        total,
      });
    }

    await client.query('BEGIN');
    await deleteProjectCascade(client, projectId);
    await client.query('COMMIT');

    await req.audit.log('project', parseInt(projectId, 10), 'delete', 'cascade',
      JSON.stringify({ name: project.name, deleted: counts }), null);

    res.json({ message: 'Project and all its data deleted successfully', deleted: counts, total });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('Error deleting project:', err);
    res.status(500).json({ error: 'Failed to delete project' });
  } finally {
    client.release();
  }
});

// ── Membership (issue #84) ───────────────────────────────────────────────────
// Read: any member (or admin) of the project. Write: manager or admin only.

router.get('/:id/members', requireAuth, validateIdParam, async (req, res) => {
  const projectId = req.params.id;
  const accessErr = await requireProjectMember(req, projectId);
  if (accessErr) return res.status(403).json({ error: accessErr });

  try {
    const result = await pool.query(
      `SELECT pm.id, pm.project_id, pm.user_id, pm.project_role, pm.created_at,
              u.username, u.email
       FROM project_members pm
       JOIN users u ON u.id = pm.user_id
       WHERE pm.project_id = $1
       ORDER BY u.username ASC`,
      [projectId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching project members:', err);
    res.status(500).json({ error: 'Failed to fetch project members' });
  }
});

router.post('/:id/members', requireAuth, validateIdParam, validate(ProjectMemberCreateSchema), async (req, res) => {
  const projectId = req.params.id;
  const { user_id, project_role } = req.body;

  const accessErr = await requireProjectManager(req, projectId);
  if (accessErr) return res.status(403).json({ error: accessErr });

  try {
    const userCheck = await pool.query('SELECT id FROM users WHERE id = $1 AND is_active = TRUE', [user_id]);
    if (userCheck.rows.length === 0) return res.status(404).json({ error: 'User not found or inactive' });

    const result = await pool.query(
      `INSERT INTO project_members (project_id, user_id, project_role)
       VALUES ($1, $2, $3) RETURNING id, project_id, user_id, project_role, created_at`,
      [projectId, user_id, project_role]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'User is already a member of this project' });
    }
    console.error('Error adding project member:', err);
    res.status(500).json({ error: 'Failed to add project member' });
  }
});

router.put('/:id/members/:userId', requireAuth, validateIdParam, validate(ProjectMemberUpdateSchema), async (req, res) => {
  const projectId = req.params.id;
  const userId = parseInt(req.params.userId, 10);
  if (!Number.isInteger(userId) || userId <= 0) return res.status(400).json({ error: 'Invalid userId parameter' });
  const { project_role } = req.body;

  const accessErr = await requireProjectManager(req, projectId);
  if (accessErr) return res.status(403).json({ error: accessErr });

  try {
    const result = await pool.query(
      `UPDATE project_members SET project_role = $1
       WHERE project_id = $2 AND user_id = $3
       RETURNING id, project_id, user_id, project_role, created_at`,
      [project_role, projectId, userId]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Membership not found' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error updating project member:', err);
    res.status(500).json({ error: 'Failed to update project member' });
  }
});

router.delete('/:id/members/:userId', requireAuth, validateIdParam, async (req, res) => {
  const projectId = req.params.id;
  const userId = parseInt(req.params.userId, 10);
  if (!Number.isInteger(userId) || userId <= 0) return res.status(400).json({ error: 'Invalid userId parameter' });

  const accessErr = await requireProjectManager(req, projectId);
  if (accessErr) return res.status(403).json({ error: accessErr });

  try {
    const result = await pool.query(
      'DELETE FROM project_members WHERE project_id = $1 AND user_id = $2 RETURNING *',
      [projectId, userId]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Membership not found' });
    res.json({ message: 'Member removed successfully' });
  } catch (err) {
    console.error('Error removing project member:', err);
    res.status(500).json({ error: 'Failed to remove project member' });
  }
});

module.exports = router;
