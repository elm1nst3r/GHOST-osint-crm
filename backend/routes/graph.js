// GET /api/graph — the project graph, or the graph around one entity
// (graph plan, phase 1). Built by utils/graph.js; see there for what's in it.
const express = require('express');
const router = express.Router();
const { pool } = require('../config/database');
const { requireAuth } = require('../middleware/auth');
const { apiLimiter } = require('../middleware/rateLimiters');
const { requireProjectMember, visibleProjectIds } = require('../utils/projectAccess');
const { buildProjectGraph, buildFocusGraph, ENTITY_TYPES, OPTIONAL_TYPES, TABLES, nodeId } = require('../utils/graph');

const INCLUDE = [...OPTIONAL_TYPES, 'transactions', 'identifiers'];

router.use(apiLimiter);

router.get('/', requireAuth, async (req, res) => {
  try {
    const visible = await visibleProjectIds(req);

    // The graph around one entity: its project, every type, `depth` links out.
    if (req.query.focus) {
      const m = /^([a-z_]+):(\d+)$/.exec(String(req.query.focus));
      if (!m || !ENTITY_TYPES.includes(m[1])) {
        return res.status(400).json({ error: `focus must be <type>:<id>, type one of ${ENTITY_TYPES.join(', ')}` });
      }
      const depth = Math.min(Math.max(parseInt(req.query.depth, 10) || 1, 1), 3);
      const { rows } = await pool.query(`SELECT project_id FROM ${TABLES[m[1]]} WHERE id = $1`, [m[2]]);
      if (!rows[0]) return res.status(404).json({ error: 'Entity not found' });
      const accessErr = await requireProjectMember(req, rows[0].project_id);
      if (accessErr) return res.status(403).json({ error: accessErr });
      const focus = nodeId(m[1], Number(m[2]));
      const graph = await buildFocusGraph(pool, rows[0].project_id, focus, { visible, depth });
      return res.json({ ...graph, meta: { project_id: rows[0].project_id, focus, depth } });
    }

    const projectId = parseInt(req.query.project_id, 10);
    if (!projectId) return res.status(400).json({ error: 'project_id or focus is required' });
    const accessErr = await requireProjectMember(req, projectId);
    if (accessErr) return res.status(403).json({ error: accessErr });

    const include = String(req.query.include || '').split(',').map((s) => s.trim()).filter(Boolean);
    const unknown = include.filter((i) => !INCLUDE.includes(i));
    if (unknown.length) return res.status(400).json({ error: `Unknown include: ${unknown.join(', ')} (allowed: ${INCLUDE.join(', ')})` });
    const identifiers = req.query.identifiers === 'all' ? 'all' : 'shared';

    const graph = await buildProjectGraph(pool, projectId, { visible, include, identifiers });
    res.json({ ...graph, meta: { project_id: projectId, include, identifiers } });
  } catch (err) {
    console.error('Error building graph:', err);
    res.status(500).json({ error: 'Failed to build the graph' });
  }
});

module.exports = router;
