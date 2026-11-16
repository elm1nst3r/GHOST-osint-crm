// GET /api/graph — the project graph, or the graph around one entity
// (graph plan, phase 1). Built by utils/graph.js; see there for what's in it.
// Phase 3: GET /path (shortest chain of links between two entities) and the
// caller's saved layouts (/layouts).
const express = require('express');
const router = express.Router();
const { pool } = require('../config/database');
const { requireAuth } = require('../middleware/auth');
const { apiLimiter } = require('../middleware/rateLimiters');
const { requireProjectMember, visibleProjectIds } = require('../utils/projectAccess');
const {
  buildProjectGraph, buildFocusGraph, shortestPath, ENTITY_TYPES, OPTIONAL_TYPES, TABLES, nodeId,
} = require('../utils/graph');

const INCLUDE = [...OPTIONAL_TYPES, 'transactions', 'identifiers'];
const ENTITY_RE = /^([a-z_]+):(\d+)$/;

// "<type>:<id>" → { type, id }, or null.
const parseEntity = (value) => {
  const m = ENTITY_RE.exec(String(value || ''));
  return m && ENTITY_TYPES.includes(m[1]) ? { type: m[1], id: Number(m[2]) } : null;
};
const projectOf = async (entity) => {
  const { rows } = await pool.query(`SELECT project_id FROM ${TABLES[entity.type]} WHERE id = $1`, [entity.id]);
  return rows[0]?.project_id ?? null;
};
// The include list from the query; null when it names something unknown.
const parseInclude = (value, fallback) => {
  if (value == null) return fallback;
  const include = String(value).split(',').map((s) => s.trim()).filter(Boolean);
  return include.every((i) => INCLUDE.includes(i)) ? include : null;
};

router.use(apiLimiter);

router.get('/', requireAuth, async (req, res) => {
  try {
    const visible = await visibleProjectIds(req);

    // The graph around one entity: its project, every type, `depth` links out.
    if (req.query.focus) {
      const entity = parseEntity(req.query.focus);
      if (!entity) {
        return res.status(400).json({ error: `focus must be <type>:<id>, type one of ${ENTITY_TYPES.join(', ')}` });
      }
      const depth = Math.min(Math.max(parseInt(req.query.depth, 10) || 1, 1), 3);
      const projectId = await projectOf(entity);
      if (projectId == null) return res.status(404).json({ error: 'Entity not found' });
      const accessErr = await requireProjectMember(req, projectId);
      if (accessErr) return res.status(403).json({ error: accessErr });
      const focus = nodeId(entity.type, entity.id);
      const graph = await buildFocusGraph(pool, projectId, focus, { visible, depth });
      return res.json({ ...graph, meta: { project_id: projectId, focus, depth } });
    }

    const projectId = parseInt(req.query.project_id, 10);
    if (!projectId) return res.status(400).json({ error: 'project_id or focus is required' });
    const accessErr = await requireProjectMember(req, projectId);
    if (accessErr) return res.status(403).json({ error: accessErr });

    const include = parseInclude(req.query.include || '', []);
    if (!include) return res.status(400).json({ error: `Unknown include (allowed: ${INCLUDE.join(', ')})` });
    const identifiers = req.query.identifiers === 'all' ? 'all' : 'shared';

    const graph = await buildProjectGraph(pool, projectId, { visible, include, identifiers });
    res.json({ ...graph, meta: { project_id: projectId, include, identifiers } });
  } catch (err) {
    console.error('Error building graph:', err);
    res.status(500).json({ error: 'Failed to build the graph' });
  }
});

// The shortest chain of links between two entities of a project, over the
// project graph (by default with every type, transactions and shared
// identifiers, so "how is A tied to B" sees everything).
router.get('/path', requireAuth, async (req, res) => {
  try {
    const from = parseEntity(req.query.from);
    const to = parseEntity(req.query.to);
    if (!from || !to) {
      return res.status(400).json({ error: `from and to must be <type>:<id>, type one of ${ENTITY_TYPES.join(', ')}` });
    }
    const include = parseInclude(req.query.include, INCLUDE);
    if (!include) return res.status(400).json({ error: `Unknown include (allowed: ${INCLUDE.join(', ')})` });
    const projectId = await projectOf(from);
    if (projectId == null) return res.status(404).json({ error: 'Entity not found' });
    const accessErr = await requireProjectMember(req, projectId);
    if (accessErr) return res.status(403).json({ error: accessErr });

    const visible = await visibleProjectIds(req);
    const graph = await buildProjectGraph(pool, projectId, { visible, include, identifiers: 'shared' });
    const fromId = nodeId(from.type, from.id);
    const toId = nodeId(to.type, to.id);
    const path = shortestPath(graph, fromId, toId);
    const meta = { project_id: projectId, from: fromId, to: toId, include };
    if (!path) return res.json({ found: false, length: null, nodes: [], edges: [], meta });
    const nodes = new Map(graph.nodes.map((n) => [n.id, n]));
    const edges = new Map(graph.edges.map((e) => [e.id, e]));
    res.json({
      found: true,
      length: path.edges.length,
      nodes: path.nodes.map((id) => nodes.get(id)),
      edges: path.edges.map((id) => edges.get(id)),
      meta,
    });
  } catch (err) {
    console.error('Error finding a path:', err);
    res.status(500).json({ error: 'Failed to find a path' });
  }
});

// ── Saved layouts: the caller's own, per project and view ──

const VIEW_RE = /^(project|focus:[a-z_]+:\d+)$/;
const MAX_POSITIONS = 20000;

// Validated project and view; { error } otherwise.
function layoutKey(project, viewName) {
  const projectId = parseInt(project, 10);
  const view = String(viewName || '');
  if (!projectId) return { error: 'project_id is required' };
  if (!VIEW_RE.test(view)) return { error: 'view must be "project" or "focus:<type>:<id>"' };
  return { projectId, view };
}

router.get('/layouts', requireAuth, async (req, res) => {
  try {
    const key = layoutKey(req.query.project_id, req.query.view);
    if (key.error) return res.status(400).json({ error: key.error });
    const accessErr = await requireProjectMember(req, key.projectId);
    if (accessErr) return res.status(403).json({ error: accessErr });
    const { rows } = await pool.query(
      'SELECT positions, updated_at FROM graph_layouts WHERE user_id = $1 AND project_id = $2 AND view = $3',
      [req.session.userId, key.projectId, key.view]);
    res.json(rows[0] ? { saved: true, positions: rows[0].positions, updated_at: rows[0].updated_at } : { saved: false, positions: {} });
  } catch (err) {
    console.error('Error reading a graph layout:', err);
    res.status(500).json({ error: 'Failed to read the layout' });
  }
});

router.put('/layouts', requireAuth, async (req, res) => {
  try {
    const key = layoutKey(req.body?.project_id, req.body?.view);
    if (key.error) return res.status(400).json({ error: key.error });
    const input = req.body.positions;
    if (!input || typeof input !== 'object' || Array.isArray(input)) return res.status(400).json({ error: 'positions must be an object' });
    const entries = Object.entries(input);
    if (entries.length > MAX_POSITIONS) return res.status(400).json({ error: `At most ${MAX_POSITIONS} positions` });
    const positions = {};
    for (const [id, p] of entries) {
      if (id.length > 300 || !p || !Number.isFinite(p.x) || !Number.isFinite(p.y)) {
        return res.status(400).json({ error: 'Each position must be { x, y } with numbers' });
      }
      positions[id] = { x: Math.round(p.x), y: Math.round(p.y) };
    }
    const accessErr = await requireProjectMember(req, key.projectId);
    if (accessErr) return res.status(403).json({ error: accessErr });
    const { rows } = await pool.query(
      `INSERT INTO graph_layouts (user_id, project_id, view, positions) VALUES ($1, $2, $3, $4)
       ON CONFLICT (user_id, project_id, view) DO UPDATE SET positions = EXCLUDED.positions, updated_at = CURRENT_TIMESTAMP
       RETURNING updated_at`,
      [req.session.userId, key.projectId, key.view, JSON.stringify(positions)]);
    res.json({ saved: true, count: entries.length, updated_at: rows[0].updated_at });
  } catch (err) {
    console.error('Error saving a graph layout:', err);
    res.status(500).json({ error: 'Failed to save the layout' });
  }
});

router.delete('/layouts', requireAuth, async (req, res) => {
  try {
    const key = layoutKey(req.query.project_id, req.query.view);
    if (key.error) return res.status(400).json({ error: key.error });
    const accessErr = await requireProjectMember(req, key.projectId);
    if (accessErr) return res.status(403).json({ error: accessErr });
    await pool.query('DELETE FROM graph_layouts WHERE user_id = $1 AND project_id = $2 AND view = $3',
      [req.session.userId, key.projectId, key.view]);
    res.json({ saved: false });
  } catch (err) {
    console.error('Error deleting a graph layout:', err);
    res.status(500).json({ error: 'Failed to delete the layout' });
  }
});

module.exports = router;
