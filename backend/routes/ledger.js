// File: backend/routes/ledger.js
// Convenience sub-routes + entity ledger + venue analytics for the transaction feature.
const express = require('express');
const router = express.Router();
const { pool } = require('../config/database');
const { requireAuth } = require('../middleware/auth');
const { validateIdParam } = require('../middleware/validation');
const { TX_SELECT, decorateTransaction, fullName, aggregateVenueStats, deriveLedger } = require('../utils/transactionHelpers');

const ENTITY_TYPES = { people: 'person', businesses: 'business', properties: 'property' };

// ── Convenience sub-routes ────────────────────────────────────────────────

// GET /people/:id/transactions — given + received (direction per row)
router.get('/people/:id/transactions', requireAuth, validateIdParam, async (req, res) => {
  try {
    const id = req.params.id;
    const result = await pool.query(
      `${TX_SELECT} WHERE t.from_person_id = $1 OR t.to_person_id = $1
       ORDER BY t.occurred_on DESC NULLS LAST, t.id DESC`, [id]);
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
    const rows = await currentHoldings('person', req.params.id);
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
    const result = await pool.query(
      `${TX_SELECT} WHERE t.from_business_id = $1 OR t.to_business_id = $1
        OR t.subject_business_id = $1 OR t.location_business_id = $1
       ORDER BY t.occurred_on DESC NULLS LAST, t.id DESC`, [id]);
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
    const id = req.params.id;
    const bizResult = await pool.query('SELECT id, name FROM businesses WHERE id = $1', [id]);
    if (bizResult.rows.length === 0) return res.status(404).json({ error: 'Business not found' });

    const txResult = await pool.query(
      `${TX_SELECT} WHERE t.location_business_id = $1 ORDER BY t.occurred_on ASC NULLS FIRST, t.id ASC`, [id]);
    const stats = aggregateVenueStats(txResult.rows);

    res.json({ business: { id: bizResult.rows[0].id, label: bizResult.rows[0].name }, ...stats });
  } catch (err) {
    console.error('Error fetching venue stats:', err);
    res.status(500).json({ error: 'Failed to fetch venue stats' });
  }
});

// ── Entity ledger ─────────────────────────────────────────────────────────

async function currentHoldings(entityKind, id) {
  const col = entityKind === 'person' ? 'to_person_id' : 'to_business_id';
  const result = await pool.query(
    `SELECT a.id, a.name, lt.since FROM assets a
     JOIN LATERAL (
       SELECT tx.${col} AS holder_id, tx.occurred_on AS since
       FROM transactions tx WHERE tx.subject_asset_id = a.id
       ORDER BY tx.occurred_on DESC NULLS LAST, tx.id DESC LIMIT 1
     ) lt ON true
     WHERE lt.holder_id = $1
     ORDER BY a.name ASC`, [id]);
  return result.rows.map(r => ({ id: r.id, name: r.name, since: r.since }));
}

// GET /:entityType/:id/ledger
router.get('/:entityType/:id/ledger', requireAuth, validateIdParam, async (req, res) => {
  const { entityType } = req.params;
  const id = req.params.id;
  const kind = ENTITY_TYPES[entityType];
  if (!kind) return res.status(400).json({ error: 'Invalid entity type for ledger' });

  try {
    // entity label
    let label = null;
    if (kind === 'person') {
      const r = await pool.query('SELECT first_name, last_name FROM people WHERE id = $1', [id]);
      if (r.rows.length === 0) return res.status(404).json({ error: 'Entity not found' });
      label = fullName(r.rows[0].first_name, r.rows[0].last_name);
    } else if (kind === 'business') {
      const r = await pool.query('SELECT name FROM businesses WHERE id = $1', [id]);
      if (r.rows.length === 0) return res.status(404).json({ error: 'Entity not found' });
      label = r.rows[0].name;
    } else {
      const r = await pool.query('SELECT name FROM properties WHERE id = $1', [id]);
      if (r.rows.length === 0) return res.status(404).json({ error: 'Entity not found' });
      label = r.rows[0].name;
    }

    // role-match clause
    const filters = [];
    const params = [id];
    if (kind === 'person') filters.push(`(t.from_person_id = $1 OR t.to_person_id = $1)`);
    if (kind === 'business') filters.push(`(t.from_business_id = $1 OR t.to_business_id = $1 OR t.subject_business_id = $1 OR t.location_business_id = $1)`);
    if (kind === 'property') filters.push(`(t.subject_property_id = $1 OR t.location_property_id = $1)`);
    if (req.query.case_id) { params.push(parseInt(req.query.case_id, 10)); filters.push(`t.case_id = $${params.length}`); }
    if (req.query.date_from) { params.push(req.query.date_from); filters.push(`t.occurred_on >= $${params.length}`); }
    if (req.query.date_to) { params.push(req.query.date_to); filters.push(`t.occurred_on <= $${params.length}`); }

    const txResult = await pool.query(
      `${TX_SELECT} WHERE ${filters.join(' AND ')} ORDER BY t.occurred_on ASC NULLS FIRST, t.id ASC`, params);

    const { entries, summary } = deriveLedger(kind, id, txResult.rows);

    let assetsHeld = [];
    if (kind === 'person') assetsHeld = await currentHoldings('person', id);
    else if (kind === 'business') assetsHeld = await currentHoldings('business', id);

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
