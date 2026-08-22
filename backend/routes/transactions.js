// File: backend/routes/transactions.js
const express = require('express');
const router = express.Router();
const { pool } = require('../config/database');
const { requireAuth } = require('../middleware/auth');
const { validateIdParam } = require('../middleware/validation');
const { validate, TransactionCreateSchema, TransactionUpdateSchema } = require('../middleware/schemas');
const { apiLimiter } = require('../middleware/rateLimiters');
const { checkCaseProjectConsistency } = require('../utils/projectConsistency');

router.use(apiLimiter);
const {
  TX_SELECT, decorateTransaction, geocodeFields,
  SUBJECT_REFS, LOCATION_REFS, countSet, validateTransactionShape,
} = require('../utils/transactionHelpers');

async function validateTransaction(body) {
  if (!body.transaction_type || typeof body.transaction_type !== 'string' || !body.transaction_type.trim()) {
    return 'transaction_type is required';
  }
  const typeCheck = await pool.query(
    `SELECT 1 FROM model_options WHERE model_type = 'transaction_type' AND option_value = $1 AND is_active = TRUE`,
    [body.transaction_type]);
  if (typeCheck.rows.length === 0) return `Unknown transaction_type: ${body.transaction_type}`;
  return validateTransactionShape(body);
}

// Normalise the body: a referenced subject clears free-text item_label (§5.3).
function normaliseSubject(body) {
  if (countSet(body, SUBJECT_REFS) > 0) {
    body.item_label = null;
  }
}

// GET / — list with filters
router.get('/', requireAuth, async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit, 10) || 100, 1000);
    const offset = Math.max(parseInt(req.query.offset, 10) || 0, 0);
    const q = req.query;
    const where = [];
    const params = [];
    const add = (cond, ...vals) => { vals.forEach(v => params.push(v)); where.push(cond); };

    if (q.transaction_type) add(`t.transaction_type = $${params.length + 1}`, q.transaction_type);
    if (q.item_category) add(`t.item_category = $${params.length + 1}`, q.item_category);
    if (q.from_person_id) add(`t.from_person_id = $${params.length + 1}`, parseInt(q.from_person_id, 10));
    if (q.to_person_id) add(`t.to_person_id = $${params.length + 1}`, parseInt(q.to_person_id, 10));
    if (q.wallet_id) {
      const v = parseInt(q.wallet_id, 10);
      add(`(t.from_wallet_id = $${params.length + 1} OR t.to_wallet_id = $${params.length + 1})`, v);
    }
    if (q.tx_hash) add(`t.tx_hash = $${params.length + 1}`, q.tx_hash);
    if (q.person_id) {
      const v = parseInt(q.person_id, 10);
      add(`(t.from_person_id = $${params.length + 1} OR t.to_person_id = $${params.length + 1})`, v);
    }
    if (q.business_id) {
      const v = parseInt(q.business_id, 10);
      add(`(t.from_business_id = $${params.length + 1} OR t.to_business_id = $${params.length + 1} OR t.subject_business_id = $${params.length + 1} OR t.location_business_id = $${params.length + 1})`, v);
    }
    if (q.subject_asset_id) add(`t.subject_asset_id = $${params.length + 1}`, parseInt(q.subject_asset_id, 10));
    if (q.subject_business_id) add(`t.subject_business_id = $${params.length + 1}`, parseInt(q.subject_business_id, 10));
    if (q.subject_property_id) add(`t.subject_property_id = $${params.length + 1}`, parseInt(q.subject_property_id, 10));
    if (q.location_business_id) add(`t.location_business_id = $${params.length + 1}`, parseInt(q.location_business_id, 10));
    if (q.location_property_id) add(`t.location_property_id = $${params.length + 1}`, parseInt(q.location_property_id, 10));
    if (q.case_id) add(`t.case_id = $${params.length + 1}`, parseInt(q.case_id, 10));
    if (q.project_id) add(`t.project_id = $${params.length + 1}`, parseInt(q.project_id, 10));
    if (q.date_from) add(`t.occurred_on >= $${params.length + 1}`, q.date_from);
    if (q.date_to) add(`t.occurred_on <= $${params.length + 1}`, q.date_to);
    if (q.bbox) {
      const [w, s, e, n] = String(q.bbox).split(',').map(Number);
      if ([w, s, e, n].every(v => !isNaN(v))) {
        params.push(w, s, e, n);
        where.push(`t.longitude BETWEEN $${params.length - 3} AND $${params.length - 1} AND t.latitude BETWEEN $${params.length - 2} AND $${params.length}`);
      }
    }
    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

    const dataResult = await pool.query(
      `${TX_SELECT} ${whereSql} ORDER BY t.occurred_on DESC NULLS LAST, t.id DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, limit, offset]);
    const countResult = await pool.query(`SELECT COUNT(*)::int AS count FROM transactions t ${whereSql}`, params);
    const total = countResult.rows[0].count;
    const data = dataResult.rows.map(decorateTransaction);

    res.set('X-Total-Count', String(total));
    res.set('X-Has-More', String(offset + data.length < total));
    res.json({ data, meta: { total, limit, offset, hasMore: offset + data.length < total } });
  } catch (err) {
    console.error('Error fetching transactions:', err);
    res.status(500).json({ error: 'Failed to fetch transactions' });
  }
});

const TX_COLUMNS = [
  'transaction_type', 'item_label', 'item_category', 'subject_asset_id', 'subject_business_id', 'subject_property_id',
  'from_person_id', 'from_business_id', 'from_wallet_id', 'from_external',
  'to_person_id', 'to_business_id', 'to_wallet_id', 'to_external', 'tx_hash',
  'value', 'currency', 'occurred_on', 'location_business_id', 'location_property_id', 'location_name',
  'address', 'city', 'state', 'country', 'postal_code', 'latitude', 'longitude',
  'geocode_confidence', 'geocode_provider', 'geocoded_at', 'case_id', 'notes', 'tags',
];

function buildValues(body, geo) {
  return TX_COLUMNS.map(col => {
    if (['latitude', 'longitude', 'geocode_confidence', 'geocode_provider', 'geocoded_at'].includes(col)) return geo[col];
    // tags is text[] NOT NULL DEFAULT '{}' — null would violate the constraint,
    // and trimming here keeps '  foo ' and 'foo' from becoming distinct tags.
    if (col === 'tags') {
      const raw = Array.isArray(body.tags) ? body.tags : [];
      return [...new Set(raw.map(tg => String(tg).trim()).filter(Boolean))];
    }
    const v = body[col];
    return v === undefined || v === '' ? null : v;
  });
}

// POST /
router.post('/', requireAuth, validate(TransactionCreateSchema), async (req, res) => {
  const err = await validateTransaction(req.body);
  if (err) return res.status(400).json({ error: err });
  normaliseSubject(req.body);
  try {
    const caseErr = await checkCaseProjectConsistency(req.body.case_id, req.body.project_id);
    if (caseErr) return res.status(400).json({ error: caseErr });

    let geo = { latitude: req.body.latitude || null, longitude: req.body.longitude || null, geocode_confidence: null, geocode_provider: null, geocoded_at: null, geocode_failure: null };
    const hasRefLocation = countSet(req.body, LOCATION_REFS) > 0;
    if (!hasRefLocation && (req.body.latitude == null || req.body.longitude == null) && (req.body.address || req.body.city || req.body.country)) {
      geo = await geocodeFields(req.app.locals.improvedGeocodingService, req.body, req.body.project_id);
    }
    // project_id is intentionally NOT in TX_COLUMNS: that array is shared with
    // PUT's buildValues(), and PUT's schema omits project_id (immutable via the
    // generic update route, issue #83) -- including it there would write
    // `undefined` -> null on every update and wipe the column. Insert-only,
    // appended as its own column.
    const insertColumns = [...TX_COLUMNS, 'project_id'];
    const placeholders = insertColumns.map((_, i) => `$${i + 1}`).join(', ');
    const result = await pool.query(
      `INSERT INTO transactions (${insertColumns.join(', ')}) VALUES (${placeholders}) RETURNING id`,
      [...buildValues(req.body, geo), req.body.project_id]);
    const full = await pool.query(`${TX_SELECT} WHERE t.id = $1`, [result.rows[0].id]);
    res.status(201).json({ ...decorateTransaction(full.rows[0]), geocode_failure: geo.geocode_failure });
  } catch (e) {
    console.error('Error creating transaction:', e);
    res.status(500).json({ error: 'Failed to create transaction' });
  }
});

// GET /:id
router.get('/:id', requireAuth, validateIdParam, async (req, res) => {
  try {
    const result = await pool.query(`${TX_SELECT} WHERE t.id = $1`, [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Transaction not found' });
    res.json(decorateTransaction(result.rows[0]));
  } catch (err) {
    console.error('Error fetching transaction:', err);
    res.status(500).json({ error: 'Failed to fetch transaction' });
  }
});

// PUT /:id
router.put('/:id', requireAuth, validateIdParam, validate(TransactionUpdateSchema), async (req, res) => {
  const err = await validateTransaction(req.body);
  if (err) return res.status(400).json({ error: err });
  normaliseSubject(req.body);
  try {
    const existing = await pool.query('SELECT * FROM transactions WHERE id = $1', [req.params.id]);
    if (existing.rows.length === 0) return res.status(404).json({ error: 'Transaction not found' });

    const caseErr = await checkCaseProjectConsistency(req.body.case_id, existing.rows[0].project_id);
    if (caseErr) return res.status(400).json({ error: caseErr });

    let geo = { latitude: req.body.latitude || null, longitude: req.body.longitude || null, geocode_confidence: existing.rows[0].geocode_confidence, geocode_provider: existing.rows[0].geocode_provider, geocoded_at: existing.rows[0].geocoded_at, geocode_failure: null };
    const hasRefLocation = countSet(req.body, LOCATION_REFS) > 0;
    if (!hasRefLocation && (req.body.latitude == null || req.body.longitude == null) && (req.body.address || req.body.city || req.body.country)) {
      geo = await geocodeFields(req.app.locals.improvedGeocodingService, req.body, existing.rows[0].project_id);
    }
    const setSql = TX_COLUMNS.map((col, i) => `${col} = $${i + 1}`).join(', ');
    const values = buildValues(req.body, geo);
    values.push(req.params.id);
    await pool.query(
      `UPDATE transactions SET ${setSql}, updated_at = CURRENT_TIMESTAMP WHERE id = $${values.length}`, values);
    const full = await pool.query(`${TX_SELECT} WHERE t.id = $1`, [req.params.id]);
    res.json({ ...decorateTransaction(full.rows[0]), geocode_failure: geo.geocode_failure });
  } catch (e) {
    console.error('Error updating transaction:', e);
    res.status(500).json({ error: 'Failed to update transaction' });
  }
});

// DELETE /:id
router.delete('/:id', requireAuth, validateIdParam, async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM transactions WHERE id = $1 RETURNING *', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Transaction not found' });
    res.json({ message: 'Transaction deleted successfully' });
  } catch (err) {
    console.error('Error deleting transaction:', err);
    res.status(500).json({ error: 'Failed to delete transaction' });
  }
});

module.exports = router;
