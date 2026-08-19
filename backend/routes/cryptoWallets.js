// File: backend/routes/cryptoWallets.js
// Crypto wallet entity (issue #82) -- see the migration comment in
// 20260819000001_crypto_wallets.js for scope. Modeled directly on
// assets.js/properties.js (project/case-scoped, no audit logging, same as
// those siblings rather than people.js's outlier behavior).
const express = require('express');
const router = express.Router();
const { pool } = require('../config/database');
const { requireAuth } = require('../middleware/auth');
const { validateIdParam } = require('../middleware/validation');
const { validate, CryptoWalletCreateSchema, CryptoWalletUpdateSchema } = require('../middleware/schemas');
const { apiLimiter } = require('../middleware/rateLimiters');
const { checkCaseProjectConsistency } = require('../utils/projectConsistency');

// A wallet has no legacy JSONB connections field to stay backward-compatible
// with (unlike BUSINESS_CONNECTIONS_SUBQUERY, which is outgoing-only), so
// this reads relationships in both directions -- a wallet can be either
// source or target of a relationship row.
const WALLET_CONNECTIONS_SUBQUERY = `
  (SELECT COALESCE(
     jsonb_agg(jsonb_build_object(
       'relationship_id', r.id,
       'direction', CASE WHEN r.source_type = 'crypto_wallet' AND r.source_id = w.id THEN 'outgoing' ELSE 'incoming' END,
       'entity_type', CASE WHEN r.source_type = 'crypto_wallet' AND r.source_id = w.id THEN r.target_type ELSE r.source_type END,
       'entity_id', CASE WHEN r.source_type = 'crypto_wallet' AND r.source_id = w.id THEN r.target_id ELSE r.source_id END,
       'type', r.relationship_type,
       'note', r.note
     ) ORDER BY r.id),
     '[]'::jsonb
   ) FROM relationships r
   WHERE (r.source_type = 'crypto_wallet' AND r.source_id = w.id)
      OR (r.target_type = 'crypto_wallet' AND r.target_id = w.id)
  ) AS connections
`;

router.use(apiLimiter);

// GET / — list wallets
router.get('/', requireAuth, async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit, 10) || 100, 1000);
    const offset = Math.max(parseInt(req.query.offset, 10) || 0, 0);

    const where = [];
    const params = [];
    if (req.query.network) { params.push(req.query.network); where.push(`w.network = $${params.length}`); }
    if (req.query.status) { params.push(req.query.status); where.push(`w.status = $${params.length}`); }
    if (req.query.case_id) { params.push(parseInt(req.query.case_id, 10)); where.push(`w.case_id = $${params.length}`); }
    if (req.query.project_id) { params.push(parseInt(req.query.project_id, 10)); where.push(`w.project_id = $${params.length}`); }
    if (req.query.q) { params.push(`%${req.query.q}%`); where.push(`(w.address ILIKE $${params.length} OR w.label ILIKE $${params.length})`); }
    if (req.query.tag) { params.push(req.query.tag); where.push(`w.tags @> ARRAY[$${params.length}]::text[]`); }
    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

    const dataResult = await pool.query(
      `SELECT w.* FROM crypto_wallets w ${whereSql}
       ORDER BY w.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, limit, offset]
    );
    const countResult = await pool.query(`SELECT COUNT(*)::int AS count FROM crypto_wallets w ${whereSql}`, params);
    const total = countResult.rows[0].count;

    res.set('X-Total-Count', String(total));
    res.set('X-Has-More', String(offset + dataResult.rows.length < total));
    res.json({ data: dataResult.rows, meta: { total, limit, offset, hasMore: offset + dataResult.rows.length < total } });
  } catch (err) {
    console.error('Error fetching crypto wallets:', err);
    res.status(500).json({ error: 'Failed to fetch crypto wallets' });
  }
});

// GET /:id — detail + relationships
router.get('/:id', requireAuth, validateIdParam, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT w.*, ${WALLET_CONNECTIONS_SUBQUERY} FROM crypto_wallets w WHERE w.id = $1`,
      [req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Crypto wallet not found' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error fetching crypto wallet:', err);
    res.status(500).json({ error: 'Failed to fetch crypto wallet' });
  }
});

// POST / — create wallet
router.post('/', requireAuth, validate(CryptoWalletCreateSchema), async (req, res) => {
  const b = req.body;
  try {
    const caseErr = await checkCaseProjectConsistency(b.case_id, b.project_id);
    if (caseErr) return res.status(400).json({ error: caseErr });

    const result = await pool.query(
      `INSERT INTO crypto_wallets
        (address, network, label, tags, external_reference_url, notes, status, case_id, project_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [b.address.trim(), b.network || null, b.label || null, b.tags || [], b.external_reference_url || null,
       b.notes || null, b.status || 'active', b.case_id || null, b.project_id]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Error creating crypto wallet:', err);
    res.status(500).json({ error: 'Failed to create crypto wallet' });
  }
});

// PUT /:id — update
router.put('/:id', requireAuth, validateIdParam, validate(CryptoWalletUpdateSchema), async (req, res) => {
  const b = req.body;
  try {
    const existing = await pool.query('SELECT * FROM crypto_wallets WHERE id = $1', [req.params.id]);
    if (existing.rows.length === 0) return res.status(404).json({ error: 'Crypto wallet not found' });

    const caseErr = await checkCaseProjectConsistency(b.case_id, existing.rows[0].project_id);
    if (caseErr) return res.status(400).json({ error: caseErr });

    const result = await pool.query(
      `UPDATE crypto_wallets SET
         address=$1, network=$2, label=$3, tags=$4, external_reference_url=$5, notes=$6, status=$7,
         case_id=$8, updated_at=CURRENT_TIMESTAMP
       WHERE id=$9 RETURNING *`,
      [b.address.trim(), b.network || null, b.label || null, b.tags || [], b.external_reference_url || null,
       b.notes || null, b.status || 'active', b.case_id || null, req.params.id]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error updating crypto wallet:', err);
    res.status(500).json({ error: 'Failed to update crypto wallet' });
  }
});

// DELETE /:id
router.delete('/:id', requireAuth, validateIdParam, async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM crypto_wallets WHERE id = $1 RETURNING *', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Crypto wallet not found' });
    res.json({ message: 'Crypto wallet deleted successfully' });
  } catch (err) {
    console.error('Error deleting crypto wallet:', err);
    res.status(500).json({ error: 'Failed to delete crypto wallet' });
  }
});

module.exports = router;
