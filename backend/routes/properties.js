// File: backend/routes/properties.js
const express = require('express');
const router = express.Router();
const { pool } = require('../config/database');
const { requireAuth } = require('../middleware/auth');
const { validateIdParam } = require('../middleware/validation');
const { validate, PropertyCreateSchema, PropertyUpdateSchema } = require('../middleware/schemas');
const { txSelect, decorateTransaction, geocodeFields, deriveCustody } = require('../utils/transactionHelpers');
const { apiLimiter } = require('../middleware/rateLimiters');
const { checkCaseProjectConsistency } = require('../utils/projectConsistency');
const { applyProjectScope, requireProjectMember, visibleProjectIds, addVisibleParam, inProjects } = require('../utils/projectAccess');
const { checkRefs } = require('../utils/projectRefs');

// The owner's name only when the viewer may see the owner's project (#116).
const ownerJoin = (vis) => `LEFT JOIN people o ON p.owner_person_id = o.id AND ${inProjects('o.project_id', vis)}`;

const OWNERSHIP_TYPES = ['sale', 'purchase', 'transfer', 'acquisition'];


router.use(apiLimiter);
// GET / — list properties
router.get('/', requireAuth, async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit, 10) || 100, 1000);
    const offset = Math.max(parseInt(req.query.offset, 10) || 0, 0);

    const where = [];
    const params = [];
    if (req.query.property_type) { params.push(req.query.property_type); where.push(`p.property_type = $${params.length}`); }
    if (req.query.case_id) { params.push(parseInt(req.query.case_id, 10)); where.push(`p.case_id = $${params.length}`); }
    const scopeErr = await applyProjectScope(req, 'p', where, params);
    if (scopeErr) return res.status(403).json({ error: scopeErr });
    if (req.query.owner_person_id) { params.push(parseInt(req.query.owner_person_id, 10)); where.push(`p.owner_person_id = $${params.length}`); }
    if (req.query.q) { params.push(`%${req.query.q}%`); where.push(`(p.name ILIKE $${params.length} OR p.address ILIKE $${params.length} OR p.city ILIKE $${params.length})`); }
    if (req.query.bbox) {
      const [w, s, e, n] = String(req.query.bbox).split(',').map(Number);
      if ([w, s, e, n].every(v => !isNaN(v))) {
        params.push(w, s, e, n);
        where.push(`p.longitude BETWEEN $${params.length - 3} AND $${params.length - 1} AND p.latitude BETWEEN $${params.length - 2} AND $${params.length}`);
      }
    }
    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

    const dataParams = [...params];
    const vis = addVisibleParam(dataParams, await visibleProjectIds(req));
    dataParams.push(limit, offset);
    const dataResult = await pool.query(
      `SELECT p.*, CONCAT(o.first_name, ' ', COALESCE(o.last_name, '')) AS owner_name
       FROM properties p
       ${ownerJoin(vis)}
       ${whereSql}
       ORDER BY p.created_at DESC, p.id DESC
       LIMIT $${dataParams.length - 1} OFFSET $${dataParams.length}`,
      dataParams
    );
    const countResult = await pool.query(`SELECT COUNT(*)::int AS count FROM properties p ${whereSql}`, params);
    const total = countResult.rows[0].count;

    res.set('X-Total-Count', String(total));
    res.set('X-Has-More', String(offset + dataResult.rows.length < total));
    res.json({ data: dataResult.rows, meta: { total, limit, offset, hasMore: offset + dataResult.rows.length < total } });
  } catch (err) {
    console.error('Error fetching properties:', err);
    res.status(500).json({ error: 'Failed to fetch properties' });
  }
});

// POST / — create property
router.post('/', requireAuth, validate(PropertyCreateSchema), async (req, res) => {
  try {
    const {
      name, property_type, description, address, city, state, country, postal_code,
      latitude, longitude, owner_person_id, case_id, notes, project_id
    } = req.body;

    const accessErr = await requireProjectMember(req, project_id);
    if (accessErr) return res.status(403).json({ error: accessErr });

    const caseErr = await checkCaseProjectConsistency(case_id, project_id);
    if (caseErr) return res.status(400).json({ error: caseErr });
    const refErr = await checkRefs(req, project_id, [{ field: 'owner_person_id', type: 'person', id: owner_person_id }]);
    if (refErr) return res.status(refErr.status).json({ error: refErr.error });

    let geo = { latitude, longitude, geocode_confidence: null, geocode_provider: null, geocoded_at: null, geocode_failure: null };
    if ((latitude == null || longitude == null) && (address || city || country)) {
      geo = await geocodeFields(req.app.locals.improvedGeocodingService, { address, city, state, country }, project_id);
    }

    const result = await pool.query(
      `INSERT INTO properties
        (name, property_type, description, address, city, state, country, postal_code,
         latitude, longitude, geocode_confidence, geocode_provider, geocoded_at,
         owner_person_id, case_id, notes, project_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17) RETURNING *`,
      [name.trim(), property_type || null, description || null, address || null, city || null,
       state || null, country || null, postal_code || null, geo.latitude, geo.longitude,
       geo.geocode_confidence, geo.geocode_provider, geo.geocoded_at,
       owner_person_id || null, case_id || null, notes || null, project_id]
    );
    res.status(201).json({ ...result.rows[0], geocode_failure: geo.geocode_failure });
  } catch (err) {
    console.error('Error creating property:', err);
    res.status(500).json({ error: 'Failed to create property' });
  }
});

// GET /:id — detail + derived owner + chain of custody + venue transactions
router.get('/:id', requireAuth, validateIdParam, async (req, res) => {
  try {
    const id = req.params.id;
    const params = [id];
    const vis = addVisibleParam(params, await visibleProjectIds(req));
    const propResult = await pool.query(
      `SELECT p.*, CONCAT(o.first_name, ' ', COALESCE(o.last_name, '')) AS owner_name
       FROM properties p ${ownerJoin(vis)} WHERE p.id = $1`, params);
    if (propResult.rows.length === 0) return res.status(404).json({ error: 'Property not found' });

    const accessErr = await requireProjectMember(req, propResult.rows[0].project_id);
    if (accessErr) return res.status(403).json({ error: accessErr });

    const subjectTx = await pool.query(
      `${txSelect(vis)} WHERE t.subject_property_id = $1 AND ${inProjects('t.project_id', vis)}
       ORDER BY t.occurred_on ASC NULLS FIRST, t.id ASC`, params);
    const decoratedSubject = subjectTx.rows.map(decorateTransaction);
    const { currentHolder, since, chain } = deriveCustody(decoratedSubject, OWNERSHIP_TYPES);

    const venueTx = await pool.query(
      `${txSelect(vis)} WHERE t.location_property_id = $1 AND ${inProjects('t.project_id', vis)}
       ORDER BY t.occurred_on DESC NULLS LAST, t.id DESC`, params);

    res.json({
      ...propResult.rows[0],
      derived_current_owner: currentHolder,
      derived_owner_since: since,
      chain_of_custody: chain,
      venue_transactions: venueTx.rows.map(decorateTransaction),
    });
  } catch (err) {
    console.error('Error fetching property:', err);
    res.status(500).json({ error: 'Failed to fetch property' });
  }
});

// PUT /:id — update
router.put('/:id', requireAuth, validateIdParam, validate(PropertyUpdateSchema), async (req, res) => {
  try {
    const id = req.params.id;
    const existing = await pool.query('SELECT * FROM properties WHERE id = $1', [id]);
    if (existing.rows.length === 0) return res.status(404).json({ error: 'Property not found' });

    const accessErr = await requireProjectMember(req, existing.rows[0].project_id);
    if (accessErr) return res.status(403).json({ error: accessErr });

    const {
      name, property_type, description, address, city, state, country, postal_code,
      latitude, longitude, owner_person_id, case_id, notes
    } = req.body;

    const caseErr = await checkCaseProjectConsistency(case_id, existing.rows[0].project_id);
    if (caseErr) return res.status(400).json({ error: caseErr });
    const refErr = await checkRefs(req, existing.rows[0].project_id, [{ field: 'owner_person_id', type: 'person', id: owner_person_id }], { existing: existing.rows[0] });
    if (refErr) return res.status(refErr.status).json({ error: refErr.error });

    let geo = { latitude, longitude, geocode_confidence: existing.rows[0].geocode_confidence, geocode_provider: existing.rows[0].geocode_provider, geocoded_at: existing.rows[0].geocoded_at, geocode_failure: null };
    if ((latitude == null || longitude == null) && (address || city || country)) {
      geo = await geocodeFields(req.app.locals.improvedGeocodingService, { address, city, state, country }, existing.rows[0].project_id);
    }

    const result = await pool.query(
      `UPDATE properties SET
         name=$1, property_type=$2, description=$3, address=$4, city=$5, state=$6, country=$7,
         postal_code=$8, latitude=$9, longitude=$10, geocode_confidence=$11, geocode_provider=$12,
         geocoded_at=$13, owner_person_id=$14, case_id=$15, notes=$16, updated_at=CURRENT_TIMESTAMP
       WHERE id=$17 RETURNING *`,
      [name.trim(), property_type || null, description || null, address || null, city || null,
       state || null, country || null, postal_code || null, geo.latitude, geo.longitude,
       geo.geocode_confidence, geo.geocode_provider, geo.geocoded_at,
       owner_person_id || null, case_id || null, notes || null, id]
    );
    res.json({ ...result.rows[0], geocode_failure: geo.geocode_failure });
  } catch (err) {
    console.error('Error updating property:', err);
    res.status(500).json({ error: 'Failed to update property' });
  }
});

// DELETE /:id
router.delete('/:id', requireAuth, validateIdParam, async (req, res) => {
  try {
    const existing = await pool.query('SELECT project_id FROM properties WHERE id = $1', [req.params.id]);
    if (existing.rows.length === 0) return res.status(404).json({ error: 'Property not found' });
    const accessErr = await requireProjectMember(req, existing.rows[0].project_id);
    if (accessErr) return res.status(403).json({ error: accessErr });

    const result = await pool.query('DELETE FROM properties WHERE id = $1 RETURNING *', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Property not found' });
    res.json({ message: 'Property deleted successfully' });
  } catch (err) {
    console.error('Error deleting property:', err);
    res.status(500).json({ error: 'Failed to delete property' });
  }
});

// GET /:id/transactions — subject | venue (flag role)
router.get('/:id/transactions', requireAuth, validateIdParam, async (req, res) => {
  try {
    const id = req.params.id;
    const propCheck = await pool.query('SELECT project_id FROM properties WHERE id = $1', [id]);
    if (propCheck.rows.length === 0) return res.status(404).json({ error: 'Property not found' });
    const accessErr = await requireProjectMember(req, propCheck.rows[0].project_id);
    if (accessErr) return res.status(403).json({ error: accessErr });

    const params = [id];
    const vis = addVisibleParam(params, await visibleProjectIds(req));
    const result = await pool.query(
      `${txSelect(vis)} WHERE (t.subject_property_id = $1 OR t.location_property_id = $1) AND ${inProjects('t.project_id', vis)}
       ORDER BY t.occurred_on DESC NULLS LAST, t.id DESC`, params);
    const rows = result.rows.map(r => {
      const d = decorateTransaction(r);
      d.role = r.subject_property_id === id ? 'subject' : 'venue';
      return d;
    });
    res.json({ data: rows, meta: { total: rows.length } });
  } catch (err) {
    console.error('Error fetching property transactions:', err);
    res.status(500).json({ error: 'Failed to fetch property transactions' });
  }
});

module.exports = router;
