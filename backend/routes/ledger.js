// File: backend/routes/ledger.js
// Convenience sub-routes + entity ledger + venue analytics for the transaction feature.
const express = require('express');
const router = express.Router();
const { pool } = require('../config/database');
const { requireAuth } = require('../middleware/auth');
const { validateIdParam } = require('../middleware/validation');
const { TX_SELECT, decorateTransaction, fullName } = require('../utils/transactionHelpers');

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
    const txns = txResult.rows.map(decorateTransaction);

    const peopleMap = new Map();
    const byType = {};
    let firstEvent = null, lastEvent = null;
    for (const t of txns) {
      byType[t.transaction_type] = (byType[t.transaction_type] || 0) + 1;
      if (t.occurred_on) {
        if (!firstEvent || t.occurred_on < firstEvent) firstEvent = t.occurred_on;
        if (!lastEvent || t.occurred_on > lastEvent) lastEvent = t.occurred_on;
      }
      for (const party of [t.resolved_from, t.resolved_to]) {
        if (party && party.type === 'person' && party.id) {
          const cur = peopleMap.get(party.id) || { id: party.id, label: party.label, event_count: 0 };
          cur.event_count += 1;
          peopleMap.set(party.id, cur);
        }
      }
    }
    const people = Array.from(peopleMap.values()).sort((a, b) => b.event_count - a.event_count);

    res.json({
      business: { id: bizResult.rows[0].id, label: bizResult.rows[0].name },
      event_count: txns.length,
      distinct_people: people.length,
      people,
      first_event: firstEvent,
      last_event: lastEvent,
      by_type: byType,
    });
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
    const txns = txResult.rows.map(decorateTransaction);

    const entries = [];
    const seen = new Set();
    const counterpartyKeys = new Set();
    const countByType = {};
    const byCurrencyMap = new Map();

    const ensureCurrency = (cur) => {
      const c = cur || 'UNSPEC';
      if (!byCurrencyMap.has(c)) byCurrencyMap.set(c, { currency: cur || null, value_in: 0, value_out: 0, net: 0 });
      return byCurrencyMap.get(c);
    };

    for (const t of txns) {
      countByType[t.transaction_type] = (countByType[t.transaction_type] || 0) + 1;
      const raw = txResult.rows.find(r => r.id === t.id);
      const isTo = kind === 'person' ? raw.to_person_id === id : kind === 'business' ? raw.to_business_id === id : false;
      const isFrom = kind === 'person' ? raw.from_person_id === id : kind === 'business' ? raw.from_business_id === id : false;
      const isSubject = kind === 'business' ? raw.subject_business_id === id : kind === 'property' ? raw.subject_property_id === id : false;
      const isVenue = kind === 'business' ? raw.location_business_id === id : kind === 'property' ? raw.location_property_id === id : false;
      const value = t.value != null ? parseFloat(t.value) : null;

      const pushEntry = (role, value_direction, counterparty, entryValue) => {
        const key = `${t.id}:${role}`;
        if (seen.has(key)) return;
        seen.add(key);
        if (counterparty && counterparty.label) counterpartyKeys.add(`${counterparty.type}:${counterparty.id}:${counterparty.label}`);
        entries.push({
          transaction_id: t.id,
          occurred_on: t.occurred_on,
          transaction_type: t.transaction_type,
          role,
          counterparty: counterparty || null,
          subject: t.resolved_subject,
          location: t.resolved_location,
          value: entryValue,
          currency: t.currency,
          value_direction,
          notes: t.notes,
        });
      };

      if (isTo) {
        pushEntry('received', 'in', t.resolved_from, value);
        if (value != null) { const c = ensureCurrency(t.currency); c.value_in += value; }
        if (raw.subject_asset_id) pushEntry('acquired_custody', 'in', t.resolved_from, null);
      }
      if (isFrom) {
        pushEntry('gave', 'out', t.resolved_to, value);
        if (value != null) { const c = ensureCurrency(t.currency); c.value_out += value; }
        if (raw.subject_asset_id) pushEntry('released_custody', 'out', t.resolved_to, null);
      }
      if (isSubject) pushEntry('subject', 'neutral', t.resolved_from || t.resolved_to, value);
      if (isVenue) pushEntry('venue', 'neutral', t.resolved_from || t.resolved_to, value);
    }

    entries.sort((a, b) => {
      const da = a.occurred_on || ''; const db = b.occurred_on || '';
      if (da === db) return a.transaction_id - b.transaction_id;
      return da < db ? -1 : 1;
    });

    const byCurrency = Array.from(byCurrencyMap.values()).map(c => ({ ...c, net: c.value_in - c.value_out }));
    const totalIn = byCurrency.reduce((s, c) => s + c.value_in, 0);
    const totalOut = byCurrency.reduce((s, c) => s + c.value_out, 0);
    const singleCurrency = byCurrency.length <= 1;

    let assetsHeld = [];
    if (kind === 'person') assetsHeld = await currentHoldings('person', id);
    else if (kind === 'business') assetsHeld = await currentHoldings('business', id);

    res.json({
      entity: { type: kind, id, label },
      entries,
      summary: {
        value_in: singleCurrency ? totalIn : null,
        value_out: singleCurrency ? totalOut : null,
        net: singleCurrency ? totalIn - totalOut : null,
        by_currency: byCurrency,
        count_by_type: countByType,
        distinct_counterparties: counterpartyKeys.size,
        assets_currently_held: assetsHeld,
      },
    });
  } catch (err) {
    console.error('Error building ledger:', err);
    res.status(500).json({ error: 'Failed to build ledger' });
  }
});

module.exports = router;
