// File: backend/routes/assets.js
const express = require('express');
const router = express.Router();
const { pool } = require('../config/database');
const { requireAuth } = require('../middleware/auth');
const { validateIdParam } = require('../middleware/validation');
const { validate, AssetCreateSchema, AssetUpdateSchema } = require('../middleware/schemas');
const { TX_SELECT, decorateTransaction, geocodeFields, deriveCustody, fullName } = require('../utils/transactionHelpers');
const { apiLimiter } = require('../middleware/rateLimiters');
const { checkCaseProjectConsistency } = require('../utils/projectConsistency');
const { applyProjectScope, requireProjectMember } = require('../utils/projectAccess');

const LOCATION_MODES = ['with_holder', 'fixed_known', 'fixed_custom', 'unknown'];
const num = (v) => (v == null ? null : parseFloat(v));


router.use(apiLimiter);
// Build a holder object from the latest-transaction join columns (alias prefix lt_).
function holderFromRow(row) {
  if (row.lt_to_person_id) return { type: 'person', id: row.lt_to_person_id, label: fullName(row.lt_to_person_first, row.lt_to_person_last) || `Person #${row.lt_to_person_id}`, since: row.lt_occurred_on };
  if (row.lt_to_business_id) return { type: 'business', id: row.lt_to_business_id, label: row.lt_to_business_name || `Business #${row.lt_to_business_id}`, since: row.lt_occurred_on };
  if (row.lt_to_external) return { type: 'external', id: null, label: row.lt_to_external, since: row.lt_occurred_on };
  return null;
}

const HOLDER_JOIN = `
  LEFT JOIN LATERAL (
    SELECT tx.to_person_id AS lt_to_person_id, tx.to_business_id AS lt_to_business_id,
           tx.to_external AS lt_to_external, tx.occurred_on AS lt_occurred_on
    FROM transactions tx
    WHERE tx.subject_asset_id = a.id
    ORDER BY tx.occurred_on DESC NULLS LAST, tx.id DESC LIMIT 1
  ) lt ON true
  LEFT JOIN people     ltp ON lt.lt_to_person_id   = ltp.id
  LEFT JOIN businesses ltb ON lt.lt_to_business_id = ltb.id
`;
const HOLDER_COLS = `
  lt.lt_to_person_id, lt.lt_to_business_id, lt.lt_to_external, lt.lt_occurred_on,
  ltp.first_name AS lt_to_person_first, ltp.last_name AS lt_to_person_last,
  ltb.name AS lt_to_business_name
`;

// Resolve the live position of an asset based on its location_mode.
async function resolveAssetLocation(asset, holder) {
  const mode = asset.location_mode || 'with_holder';
  if (mode === 'fixed_custom') {
    return { mode, latitude: num(asset.latitude), longitude: num(asset.longitude), label: asset.location_name || [asset.city, asset.country].filter(Boolean).join(', ') || null, source: 'asset' };
  }
  if (mode === 'fixed_known') {
    if (asset.location_person_id) {
      const pr = await pool.query('SELECT locations FROM people WHERE id = $1', [asset.location_person_id]);
      const locs = (pr.rows[0] && pr.rows[0].locations) || [];
      let entry = null;
      if (asset.location_ref != null) {
        const idx = parseInt(asset.location_ref, 10);
        if (!isNaN(idx) && locs[idx]) entry = locs[idx];
        if (!entry) entry = locs.find(l => String(l.id) === String(asset.location_ref));
      }
      if (entry && entry.latitude && entry.longitude) {
        return { mode, latitude: num(entry.latitude), longitude: num(entry.longitude), label: entry.location_name || entry.address || 'Linked location', source: 'people.locations' };
      }
    }
    return { mode, latitude: num(asset.latitude), longitude: num(asset.longitude), label: asset.location_name || 'Snapshot location', source: 'snapshot' };
  }
  if (mode === 'with_holder') {
    if (!holder) return { mode, latitude: null, longitude: null, label: null, source: 'unknown' };
    if (holder.type === 'person') {
      const th = await pool.query(
        `SELECT latitude, longitude, location_name, city, country FROM travel_history
         WHERE person_id = $1 AND latitude IS NOT NULL
         ORDER BY COALESCE(departure_date, arrival_date) DESC NULLS LAST, id DESC LIMIT 1`, [holder.id]);
      if (th.rows[0]) {
        const r = th.rows[0];
        return { mode, latitude: num(r.latitude), longitude: num(r.longitude), label: r.location_name || [r.city, r.country].filter(Boolean).join(', ') || holder.label, source: 'travel_history', holder };
      }
      const pr = await pool.query('SELECT locations FROM people WHERE id = $1', [holder.id]);
      const locs = (pr.rows[0] && pr.rows[0].locations) || [];
      const entry = locs.find(l => l.location_type === 'primary_residence' && l.latitude && l.longitude) || locs.find(l => l.latitude && l.longitude);
      if (entry) return { mode, latitude: num(entry.latitude), longitude: num(entry.longitude), label: entry.location_name || entry.address || holder.label, source: 'people.locations', holder };
      return { mode, latitude: null, longitude: null, label: holder.label, source: 'holder_unknown', holder };
    }
    if (holder.type === 'business') {
      const b = await pool.query('SELECT latitude, longitude, name FROM businesses WHERE id = $1', [holder.id]);
      if (b.rows[0] && b.rows[0].latitude) return { mode, latitude: num(b.rows[0].latitude), longitude: num(b.rows[0].longitude), label: b.rows[0].name, source: 'business', holder };
      return { mode, latitude: null, longitude: null, label: holder.label, source: 'holder_unknown', holder };
    }
    return { mode, latitude: null, longitude: null, label: holder.label, source: 'external', holder };
  }
  return { mode: 'unknown', latitude: null, longitude: null, label: null, source: 'unknown' };
}

// GET / — list assets
router.get('/', requireAuth, async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit, 10) || 100, 1000);
    const offset = Math.max(parseInt(req.query.offset, 10) || 0, 0);

    const where = [];
    const params = [];
    if (req.query.category) { params.push(req.query.category); where.push(`a.category = $${params.length}`); }
    if (req.query.status) { params.push(req.query.status); where.push(`a.status = $${params.length}`); }
    if (req.query.case_id) { params.push(parseInt(req.query.case_id, 10)); where.push(`a.case_id = $${params.length}`); }
    const scopeErr = await applyProjectScope(req, 'a', where, params);
    if (scopeErr) return res.status(403).json({ error: scopeErr });
    if (req.query.q) { params.push(`%${req.query.q}%`); where.push(`(a.name ILIKE $${params.length} OR a.identifier ILIKE $${params.length})`); }
    if (req.query.holder_person_id) {
      params.push(parseInt(req.query.holder_person_id, 10));
      where.push(`lt.lt_to_person_id = $${params.length}`);
    }
    if (req.query.bbox) {
      const [w, s, e, n] = String(req.query.bbox).split(',').map(Number);
      if ([w, s, e, n].every(v => !isNaN(v))) {
        params.push(w, s, e, n);
        where.push(`a.longitude BETWEEN $${params.length - 3} AND $${params.length - 1} AND a.latitude BETWEEN $${params.length - 2} AND $${params.length}`);
      }
    }
    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

    const dataResult = await pool.query(
      `SELECT a.*, ${HOLDER_COLS} FROM assets a ${HOLDER_JOIN} ${whereSql}
       ORDER BY a.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, limit, offset]
    );
    const countResult = await pool.query(
      `SELECT COUNT(*)::int AS count FROM assets a ${HOLDER_JOIN} ${whereSql}`, params);
    const total = countResult.rows[0].count;

    const data = [];
    for (const row of dataResult.rows) {
      const holder = holderFromRow(row);
      const location = await resolveAssetLocation(row, holder);
      const clean = { ...row };
      ['lt_to_person_id', 'lt_to_business_id', 'lt_to_external', 'lt_occurred_on', 'lt_to_person_first', 'lt_to_person_last', 'lt_to_business_name'].forEach(k => delete clean[k]);
      data.push({ ...clean, current_holder: holder, resolved_location: location });
    }

    res.set('X-Total-Count', String(total));
    res.set('X-Has-More', String(offset + data.length < total));
    res.json({ data, meta: { total, limit, offset, hasMore: offset + data.length < total } });
  } catch (err) {
    console.error('Error fetching assets:', err);
    res.status(500).json({ error: 'Failed to fetch assets' });
  }
});

function validateAssetBody(body) {
  if (!body.name || typeof body.name !== 'string' || !body.name.trim()) return 'Asset name is required';
  const mode = body.location_mode || 'with_holder';
  if (!LOCATION_MODES.includes(mode)) return `location_mode must be one of: ${LOCATION_MODES.join(', ')}`;
  if (mode === 'fixed_known' && !body.location_person_id) return 'location_person_id is required when location_mode is fixed_known';
  if (mode === 'fixed_custom' && body.latitude == null && body.longitude == null && !body.address && !body.city && !body.country) {
    return 'fixed_custom location requires an address or coordinates';
  }
  if (body.estimated_value != null && (isNaN(Number(body.estimated_value)) || Number(body.estimated_value) < 0)) return 'estimated_value must be a non-negative number';
  return null;
}

// POST / — create asset (optional initial_holder seeds an acquisition transaction)
router.post('/', requireAuth, validate(AssetCreateSchema), async (req, res) => {
  const clientErr = validateAssetBody(req.body);
  if (clientErr) return res.status(400).json({ error: clientErr });

  const b = req.body;
  const mode = b.location_mode || 'with_holder';
  try {
    const accessErr = await requireProjectMember(req, b.project_id);
    if (accessErr) return res.status(403).json({ error: accessErr });

    const caseErr = await checkCaseProjectConsistency(b.case_id, b.project_id);
    if (caseErr) return res.status(400).json({ error: caseErr });

    let geo = { latitude: b.latitude, longitude: b.longitude, geocode_confidence: null, geocode_provider: null, geocoded_at: null, geocode_failure: null };

    if (mode === 'fixed_custom' && (b.latitude == null || b.longitude == null) && (b.address || b.city || b.country)) {
      geo = await geocodeFields(req.app.locals.improvedGeocodingService, { address: b.address, city: b.city, state: b.state, country: b.country }, b.project_id);
    } else if (mode === 'fixed_known' && b.location_person_id && b.location_ref != null) {
      // snapshot the chosen people.locations entry coords
      const pr = await pool.query('SELECT locations FROM people WHERE id = $1', [b.location_person_id]);
      const locs = (pr.rows[0] && pr.rows[0].locations) || [];
      const idx = parseInt(b.location_ref, 10);
      const entry = (!isNaN(idx) && locs[idx]) || locs.find(l => String(l.id) === String(b.location_ref));
      if (entry) { geo.latitude = entry.latitude || null; geo.longitude = entry.longitude || null; b.location_name = b.location_name || entry.location_name || entry.address; }
    }

    const result = await pool.query(
      `INSERT INTO assets
        (name, category, identifier, description, notes, estimated_value, currency, status,
         location_mode, location_person_id, location_ref, location_name, address, city, state, country, postal_code,
         latitude, longitude, geocode_confidence, geocode_provider, geocoded_at, case_id, project_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24) RETURNING *`,
      [b.name.trim(), b.category || null, b.identifier || null, b.description || null, b.notes || null,
       b.estimated_value != null ? b.estimated_value : null, b.currency || null, b.status || 'active',
       mode, b.location_person_id || null, b.location_ref != null ? String(b.location_ref) : null, b.location_name || null,
       b.address || null, b.city || null, b.state || null, b.country || null, b.postal_code || null,
       geo.latitude, geo.longitude, geo.geocode_confidence, geo.geocode_provider, geo.geocoded_at, b.case_id || null, b.project_id]
    );
    const asset = result.rows[0];

    // optional initial holder → acquisition transaction
    const ih = b.initial_holder;
    if (ih && (ih.person_id || ih.business_id || ih.external)) {
      const occurred = ih.occurred_on || new Date().toISOString().slice(0, 10);
      await pool.query(
        `INSERT INTO transactions (transaction_type, subject_asset_id, to_person_id, to_business_id, to_external, occurred_on, case_id, project_id)
         VALUES ('acquisition', $1, $2, $3, $4, $5, $6, $7)`,
        [asset.id, ih.person_id || null, ih.business_id || null, ih.external || null, occurred, b.case_id || null, b.project_id]);
    }

    res.status(201).json({ ...asset, geocode_failure: geo.geocode_failure });
  } catch (err) {
    console.error('Error creating asset:', err);
    res.status(500).json({ error: 'Failed to create asset' });
  }
});

// GET /:id — detail + chain of custody + resolved location
router.get('/:id', requireAuth, validateIdParam, async (req, res) => {
  try {
    const id = req.params.id;
    const assetResult = await pool.query('SELECT * FROM assets WHERE id = $1', [id]);
    if (assetResult.rows.length === 0) return res.status(404).json({ error: 'Asset not found' });
    const asset = assetResult.rows[0];

    const accessErr = await requireProjectMember(req, asset.project_id);
    if (accessErr) return res.status(403).json({ error: accessErr });

    const txResult = await pool.query(
      `${TX_SELECT} WHERE t.subject_asset_id = $1 ORDER BY t.occurred_on ASC NULLS FIRST, t.id ASC`, [id]);
    const decorated = txResult.rows.map(decorateTransaction);
    const { currentHolder, since, chain } = deriveCustody(decorated);
    const location = await resolveAssetLocation(asset, currentHolder);

    res.json({
      ...asset,
      current_holder: currentHolder,
      holder_since: since,
      chain_of_custody: chain,
      transactions: decorated,
      resolved_location: location,
    });
  } catch (err) {
    console.error('Error fetching asset:', err);
    res.status(500).json({ error: 'Failed to fetch asset' });
  }
});

// PUT /:id — update (incl. location_mode changes)
router.put('/:id', requireAuth, validateIdParam, validate(AssetUpdateSchema), async (req, res) => {
  const clientErr = validateAssetBody(req.body);
  if (clientErr) return res.status(400).json({ error: clientErr });
  const b = req.body;
  const mode = b.location_mode || 'with_holder';
  try {
    const existing = await pool.query('SELECT * FROM assets WHERE id = $1', [req.params.id]);
    if (existing.rows.length === 0) return res.status(404).json({ error: 'Asset not found' });

    const accessErr = await requireProjectMember(req, existing.rows[0].project_id);
    if (accessErr) return res.status(403).json({ error: accessErr });

    const caseErr = await checkCaseProjectConsistency(b.case_id, existing.rows[0].project_id);
    if (caseErr) return res.status(400).json({ error: caseErr });

    let geo = { latitude: b.latitude, longitude: b.longitude, geocode_confidence: existing.rows[0].geocode_confidence, geocode_provider: existing.rows[0].geocode_provider, geocoded_at: existing.rows[0].geocoded_at, geocode_failure: null };
    if (mode === 'fixed_custom' && (b.latitude == null || b.longitude == null) && (b.address || b.city || b.country)) {
      geo = await geocodeFields(req.app.locals.improvedGeocodingService, { address: b.address, city: b.city, state: b.state, country: b.country }, existing.rows[0].project_id);
    } else if (mode === 'fixed_known' && b.location_person_id && b.location_ref != null) {
      const pr = await pool.query('SELECT locations FROM people WHERE id = $1', [b.location_person_id]);
      const locs = (pr.rows[0] && pr.rows[0].locations) || [];
      const idx = parseInt(b.location_ref, 10);
      const entry = (!isNaN(idx) && locs[idx]) || locs.find(l => String(l.id) === String(b.location_ref));
      if (entry) { geo.latitude = entry.latitude || null; geo.longitude = entry.longitude || null; b.location_name = b.location_name || entry.location_name || entry.address; }
    }

    const result = await pool.query(
      `UPDATE assets SET
         name=$1, category=$2, identifier=$3, description=$4, notes=$5, estimated_value=$6, currency=$7, status=$8,
         location_mode=$9, location_person_id=$10, location_ref=$11, location_name=$12, address=$13, city=$14, state=$15,
         country=$16, postal_code=$17, latitude=$18, longitude=$19, geocode_confidence=$20, geocode_provider=$21,
         geocoded_at=$22, case_id=$23, updated_at=CURRENT_TIMESTAMP
       WHERE id=$24 RETURNING *`,
      [b.name.trim(), b.category || null, b.identifier || null, b.description || null, b.notes || null,
       b.estimated_value != null ? b.estimated_value : null, b.currency || null, b.status || 'active',
       mode, b.location_person_id || null, b.location_ref != null ? String(b.location_ref) : null, b.location_name || null,
       b.address || null, b.city || null, b.state || null, b.country || null, b.postal_code || null,
       geo.latitude, geo.longitude, geo.geocode_confidence, geo.geocode_provider, geo.geocoded_at, b.case_id || null, req.params.id]
    );
    res.json({ ...result.rows[0], geocode_failure: geo.geocode_failure });
  } catch (err) {
    console.error('Error updating asset:', err);
    res.status(500).json({ error: 'Failed to update asset' });
  }
});

// DELETE /:id
router.delete('/:id', requireAuth, validateIdParam, async (req, res) => {
  try {
    const existing = await pool.query('SELECT project_id FROM assets WHERE id = $1', [req.params.id]);
    if (existing.rows.length === 0) return res.status(404).json({ error: 'Asset not found' });
    const accessErr = await requireProjectMember(req, existing.rows[0].project_id);
    if (accessErr) return res.status(403).json({ error: accessErr });

    const result = await pool.query('DELETE FROM assets WHERE id = $1 RETURNING *', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Asset not found' });
    res.json({ message: 'Asset deleted successfully' });
  } catch (err) {
    console.error('Error deleting asset:', err);
    res.status(500).json({ error: 'Failed to delete asset' });
  }
});

module.exports = router;
module.exports.resolveAssetLocation = resolveAssetLocation;
module.exports.holderFromRow = holderFromRow;
module.exports.HOLDER_JOIN = HOLDER_JOIN;
module.exports.HOLDER_COLS = HOLDER_COLS;
