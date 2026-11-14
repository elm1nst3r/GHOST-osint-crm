// File: backend/routes/ledger.js
// Convenience sub-routes + entity ledger + venue analytics for the transaction feature.
const express = require('express');
const router = express.Router();
const { pool } = require('../config/database');
const { requireAuth } = require('../middleware/auth');
const { validateIdParam } = require('../middleware/validation');
const { txSelect, decorateTransaction, fullName, aggregateVenueStats, deriveLedger } = require('../utils/transactionHelpers');
const { apiLimiter } = require('../middleware/rateLimiters');
const { requireProjectMember, visibleProjectIds, addVisibleParam, inProjects } = require('../utils/projectAccess');

const ENTITY_TYPES = { people: 'person', businesses: 'business', properties: 'property' };

// Every route here starts from one person, business or property (#116): the
// caller must be a member of its project, like on the entity's own page. The
// transactions listed are those in projects the caller may see (a project
// that allows cross-project links can hold transactions about this entity).
const ENTITY_QUERY = {
  person: 'SELECT project_id, first_name, last_name FROM people WHERE id = $1',
  business: 'SELECT project_id, name FROM businesses WHERE id = $1',
  property: 'SELECT project_id, name FROM properties WHERE id = $1',
};

// → { entity, vis, params } or sends the 404/403 and returns null.
// `params` starts as [id, <visible ids>?]; `vis` is the placeholder or null.
async function openEntity(req, res, kind) {
  const id = req.params.id;
  const { rows } = await pool.query(ENTITY_QUERY[kind], [id]);
  if (!rows[0]) { res.status(404).json({ error: 'Entity not found' }); return null; }
  const accessErr = await requireProjectMember(req, rows[0].project_id);
  if (accessErr) { res.status(403).json({ error: accessErr }); return null; }
  const params = [id];
  const vis = addVisibleParam(params, await visibleProjectIds(req));
  const label = kind === 'person' ? fullName(rows[0].first_name, rows[0].last_name) : rows[0].name;
  return { entity: { id, label }, vis, params };
}


router.use(apiLimiter);
// ── Convenience sub-routes ────────────────────────────────────────────────

// GET /people/:id/transactions — given + received (direction per row)
router.get('/people/:id/transactions', requireAuth, validateIdParam, async (req, res) => {
  try {
    const id = req.params.id;
    const open = await openEntity(req, res, 'person');
    if (!open) return;
    const result = await pool.query(
      `${txSelect(open.vis)} WHERE (t.from_person_id = $1 OR t.to_person_id = $1) AND ${inProjects('t.project_id', open.vis)}
       ORDER BY t.occurred_on DESC NULLS LAST, t.id DESC`, open.params);
    const rows = result.rows.map(r => {
      const d = decorateTransaction(r);
      d.direction = r.to_person_id === id ? 'received' : 'given';
      return d;
    });
    res.json({ data: rows, meta: { total: rows.length } });
  } catch (err) {
    console.error('Error fetching person transactions:', err);
    res.status(500).json({ error: 'Failed to fetch person transactions' });
  }
});

// GET /people/:id/assets — assets currently held by this person (derived)
router.get('/people/:id/assets', requireAuth, validateIdParam, async (req, res) => {
  try {
    const open = await openEntity(req, res, 'person');
    if (!open) return;
    const rows = await currentHoldings('person', open);
    res.json({ data: rows, meta: { total: rows.length } });
  } catch (err) {
    console.error('Error fetching person assets:', err);
    res.status(500).json({ error: 'Failed to fetch person assets' });
  }
});

// GET /businesses/:id/transactions — party | subject | venue (role per row)
router.get('/businesses/:id/transactions', requireAuth, validateIdParam, async (req, res) => {
  try {
    const id = req.params.id;
    const open = await openEntity(req, res, 'business');
    if (!open) return;
    const result = await pool.query(
      `${txSelect(open.vis)} WHERE (t.from_business_id = $1 OR t.to_business_id = $1
        OR t.subject_business_id = $1 OR t.location_business_id = $1) AND ${inProjects('t.project_id', open.vis)}
       ORDER BY t.occurred_on DESC NULLS LAST, t.id DESC`, open.params);
    const rows = result.rows.map(r => {
      const d = decorateTransaction(r);
      if (r.location_business_id === id) d.role = 'venue';
      else if (r.subject_business_id === id) d.role = 'subject';
      else if (r.to_business_id === id) d.role = 'received';
      else d.role = 'gave';
      return d;
    });
    res.json({ data: rows, meta: { total: rows.length } });
  } catch (err) {
    console.error('Error fetching business transactions:', err);
    res.status(500).json({ error: 'Failed to fetch business transactions' });
  }
});

// GET /businesses/:id/venue-stats — venue analytics
router.get('/businesses/:id/venue-stats', requireAuth, validateIdParam, async (req, res) => {
  try {
    const open = await openEntity(req, res, 'business');
    if (!open) return;
    const txResult = await pool.query(
      `${txSelect(open.vis)} WHERE t.location_business_id = $1 AND ${inProjects('t.project_id', open.vis)}
       ORDER BY t.occurred_on ASC NULLS FIRST, t.id ASC`, open.params);
    const stats = aggregateVenueStats(txResult.rows);

    res.json({ business: { id: Number(open.entity.id), label: open.entity.label }, ...stats });
  } catch (err) {
    console.error('Error fetching venue stats:', err);
    res.status(500).json({ error: 'Failed to fetch venue stats' });
  }
});

// ── Entity ledger ─────────────────────────────────────────────────────────

// Assets whose latest visible transaction hands them to this person/business.
async function currentHoldings(entityKind, { vis, params }) {
  const col = entityKind === 'person' ? 'to_person_id' : 'to_business_id';
  const result = await pool.query(
    `SELECT a.id, a.name, lt.since FROM assets a
     JOIN LATERAL (
       SELECT tx.${col} AS holder_id, tx.occurred_on AS since
       FROM transactions tx WHERE tx.subject_asset_id = a.id AND ${inProjects('tx.project_id', vis)}
       ORDER BY tx.occurred_on DESC NULLS LAST, tx.id DESC LIMIT 1
     ) lt ON true
     WHERE lt.holder_id = $1 AND ${inProjects('a.project_id', vis)}
     ORDER BY a.name ASC, a.id ASC`, params);
  return result.rows.map(r => ({ id: r.id, name: r.name, since: r.since }));
}

// GET /:entityType/:id/ledger
router.get('/:entityType/:id/ledger', requireAuth, validateIdParam, async (req, res) => {
  const { entityType } = req.params;
  const id = req.params.id;
  const kind = ENTITY_TYPES[entityType];
  if (!kind) return res.status(400).json({ error: 'Invalid entity type for ledger' });

  try {
    const open = await openEntity(req, res, kind);
    if (!open) return;
    const label = open.entity.label;

    // role-match clause
    const filters = [];
    const params = [...open.params];
    if (kind === 'person') filters.push(`(t.from_person_id = $1 OR t.to_person_id = $1)`);
    if (kind === 'business') filters.push(`(t.from_business_id = $1 OR t.to_business_id = $1 OR t.subject_business_id = $1 OR t.location_business_id = $1)`);
    if (kind === 'property') filters.push(`(t.subject_property_id = $1 OR t.location_property_id = $1)`);
    filters.push(inProjects('t.project_id', open.vis));
    if (req.query.case_id) { params.push(parseInt(req.query.case_id, 10)); filters.push(`t.case_id = $${params.length}`); }
    if (req.query.date_from) { params.push(req.query.date_from); filters.push(`t.occurred_on >= $${params.length}`); }
    if (req.query.date_to) { params.push(req.query.date_to); filters.push(`t.occurred_on <= $${params.length}`); }

    const txResult = await pool.query(
      `${txSelect(open.vis)} WHERE ${filters.join(' AND ')} ORDER BY t.occurred_on ASC NULLS FIRST, t.id ASC`, params);

    const { entries, summary } = deriveLedger(kind, id, txResult.rows);

    let assetsHeld = [];
    if (kind === 'person') assetsHeld = await currentHoldings('person', open);
    else if (kind === 'business') assetsHeld = await currentHoldings('business', open);

    res.json({
      entity: { type: kind, id, label },
      entries,
      summary: { ...summary, assets_currently_held: assetsHeld },
    });
  } catch (err) {
    console.error('Error building ledger:', err);
    res.status(500).json({ error: 'Failed to build ledger' });
  }
});

module.exports = router;
