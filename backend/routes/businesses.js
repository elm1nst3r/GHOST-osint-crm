const express = require('express');
const router = express.Router();
const { pool } = require('../config/database');
const { requireAuth } = require('../middleware/auth');
const { validateIdParam } = require('../middleware/validation');
const { validate, BusinessCreateSchema, BusinessUpdateSchema } = require('../middleware/schemas');
const logAudit = require('../utils/logAudit');
const { apiLimiter } = require('../middleware/rateLimiters');
const { syncBusinessRelationships, syncBusinessOwnership } = require('./relationships');
const { checkCaseProjectConsistency } = require('../utils/projectConsistency');
const { applyProjectScope, requireProjectMember } = require('../utils/projectAccess');

// Computed from the relationships table (issue #83) -- owner_person_id and
// employees[] entries with a real person_id were migrated there. Outgoing
// only (b as source): doesn't include the case where b is owned BY another
// business (b as target of an 'owner' row) -- RelationshipManager.js still
// does its own bidirectional enrichment client-side for the graph, this is
// additive, not yet a replacement for that.
const BUSINESS_CONNECTIONS_SUBQUERY = `
  (SELECT COALESCE(
     jsonb_agg(jsonb_build_object(
       'person_id', CASE WHEN r.target_type = 'person' THEN r.target_id END,
       'business_id', CASE WHEN r.target_type = 'business' THEN r.target_id END,
       'type', r.relationship_type,
       'note', r.note
     ) ORDER BY r.id),
     '[]'::jsonb
   ) FROM relationships r WHERE r.source_type = 'business' AND r.source_id = b.id) AS connections
`;

router.use(apiLimiter);
// GET / — list all businesses
router.get('/', requireAuth, async (req, res) => {
  try {
    const where = [];
    const params = [];
    const scopeErr = await applyProjectScope(req, 'b', where, params);
    if (scopeErr) return res.status(403).json({ error: scopeErr });
    if (req.query.case_id) { params.push(parseInt(req.query.case_id, 10)); where.push(`b.case_id = $${params.length}`); }
    const whereClause = where.length ? `WHERE ${where.join(' AND ')}` : '';

    const result = await pool.query(`
      SELECT
        b.*,
        CONCAT_WS(' ', p.first_name, NULLIF(p.patronymic, ''), NULLIF(p.last_name, '')) as owner_name,
        ob.name as owner_business_name,
        ${BUSINESS_CONNECTIONS_SUBQUERY}
      FROM businesses b
      LEFT JOIN people p ON b.owner_person_id = p.id
      LEFT JOIN businesses ob ON b.owner_business_id = ob.id
      ${whereClause}
      ORDER BY b.created_at DESC
    `, params);
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching businesses:', err);
    res.status(500).json({ error: 'Failed to fetch businesses', ...(process.env.NODE_ENV !== 'production' && { detail: err.message }) });
  }
});

// GET /:id — get single business
router.get('/:id', requireAuth, validateIdParam, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        b.*,
        CONCAT_WS(' ', p.first_name, NULLIF(p.patronymic, ''), NULLIF(p.last_name, '')) as owner_name,
        ob.name as owner_business_name,
        ${BUSINESS_CONNECTIONS_SUBQUERY}
      FROM businesses b
      LEFT JOIN people p ON b.owner_person_id = p.id
      LEFT JOIN businesses ob ON b.owner_business_id = ob.id
      WHERE b.id = $1
    `, [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Business not found' });
    }
    const accessErr = await requireProjectMember(req, result.rows[0].project_id);
    if (accessErr) return res.status(403).json({ error: accessErr });
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error fetching business:', err);
    res.status(500).json({ error: 'Failed to fetch business', ...(process.env.NODE_ENV !== 'production' && { detail: err.message }) });
  }
});

// POST / — create business
router.post('/', requireAuth, validate(BusinessCreateSchema), async (req, res) => {
  try {
    const {
      name, type, industry, address, city, state, country, postal_code,
      latitude, longitude, phone, email, website, owner_person_id, owner_business_id,
      registration_number, registration_date, status, employees, notes, case_id, project_id
    } = req.body;

    const accessErr = await requireProjectMember(req, project_id);
    if (accessErr) return res.status(403).json({ error: accessErr });

    const caseErr = await checkCaseProjectConsistency(case_id, project_id);
    if (caseErr) return res.status(400).json({ error: caseErr });

    // Geocode address if provided and coordinates not set
    let finalLatitude = latitude;
    let finalLongitude = longitude;

    if (!finalLatitude && !finalLongitude && (address || city || country)) {
      const locationParts = [address, city, state, country].filter(Boolean);
      const improvedGeocodingService = req.app.locals.improvedGeocodingService;
      if (locationParts.length > 0 && improvedGeocodingService) {
        try {
          const geocodeResult = await improvedGeocodingService.geocodeAddress(locationParts.join(', '), { minConfidence: 30, projectId: project_id });
          if (geocodeResult && !geocodeResult.failure) {
            finalLatitude = geocodeResult.lat;
            finalLongitude = geocodeResult.lng;
          }
        } catch (geocodeError) {
          console.error('Error geocoding business address:', geocodeError);
        }
      }
    }

    const query = `
      INSERT INTO businesses (
        name, type, industry, address, city, state, country, postal_code,
        latitude, longitude, phone, email, website, owner_person_id, owner_business_id,
        registration_number, registration_date, status, employees, notes, case_id, project_id
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22)
      RETURNING *
    `;

    const values = [
      name,
      type || null,
      industry || null,
      address || null,
      city || null,
      state || null,
      country || null,
      postal_code || null,
      finalLatitude,
      finalLongitude,
      phone || null,
      email || null,
      website || null,
      owner_person_id || null,
      owner_business_id || null,
      registration_number || null,
      registration_date || null,
      status || 'active',
      JSON.stringify(employees || []),
      notes || null,
      case_id || null,
      project_id
    ];

    const result = await pool.query(query, values);
    const newBusiness = result.rows[0];

    await syncBusinessRelationships(newBusiness.id, newBusiness.project_id, newBusiness.case_id, {
      ownerPersonId: owner_person_id,
      employees,
    });
    await syncBusinessOwnership(newBusiness.id, newBusiness.project_id, newBusiness.case_id, null, owner_business_id);

    // Log audit
    await logAudit('business', newBusiness.id, 'create', {
      record: { oldValue: null, newValue: JSON.stringify(newBusiness) }
    });

    res.status(201).json(newBusiness);
  } catch (err) {
    if (err.statusCode) return res.status(err.statusCode).json({ error: err.message });
    console.error('Error creating business:', err);
    res.status(500).json({ error: 'Failed to create business', ...(process.env.NODE_ENV !== 'production' && { detail: err.message }) });
  }
});

// PUT /:id — update business
router.put('/:id', requireAuth, validateIdParam, validate(BusinessUpdateSchema), async (req, res) => {
  try {
    const businessId = req.params.id;

    const {
      name, type, industry, address, city, state, country, postal_code,
      latitude, longitude, phone, email, website, owner_person_id, owner_business_id,
      registration_number, registration_date, status, employees, notes, case_id
    } = req.body;

    // A business owning itself would draw a self-loop in the entity network and
    // makes no sense as an ownership chain.
    if (owner_business_id != null && Number(owner_business_id) === Number(businessId)) {
      return res.status(400).json({
        error: 'Validation failed',
        fields: { owner_business_id: ['A business cannot own itself'] },
      });
    }

    // Get old business for audit
    const oldResult = await pool.query('SELECT * FROM businesses WHERE id = $1', [businessId]);
    if (oldResult.rows.length === 0) {
      return res.status(404).json({ error: 'Business not found' });
    }
    const oldBusiness = oldResult.rows[0];

    const accessErr = await requireProjectMember(req, oldBusiness.project_id);
    if (accessErr) return res.status(403).json({ error: accessErr });

    const caseErr = await checkCaseProjectConsistency(case_id, oldBusiness.project_id);
    if (caseErr) return res.status(400).json({ error: caseErr });

    // Geocode address if changed and coordinates not manually set
    let finalLatitude = latitude;
    let finalLongitude = longitude;

    if (!finalLatitude && !finalLongitude && (address || city || country)) {
      const locationParts = [address, city, state, country].filter(Boolean);
      const improvedGeocodingService = req.app.locals.improvedGeocodingService;
      if (locationParts.length > 0 && improvedGeocodingService) {
        try {
          const geocodeResult = await improvedGeocodingService.geocodeAddress(locationParts.join(', '), { minConfidence: 30, projectId: oldBusiness.project_id });
          if (geocodeResult && !geocodeResult.failure) {
            finalLatitude = geocodeResult.lat;
            finalLongitude = geocodeResult.lng;
          }
        } catch (geocodeError) {
          console.error('Error geocoding business address:', geocodeError);
        }
      }
    }

    const query = `
      UPDATE businesses
      SET name = $1, type = $2, industry = $3, address = $4, city = $5, state = $6,
          country = $7, postal_code = $8, latitude = $9, longitude = $10,
          phone = $11, email = $12, website = $13, owner_person_id = $14,
          owner_business_id = $15,
          registration_number = $16, registration_date = $17, status = $18,
          employees = $19, notes = $20, case_id = $21, updated_at = CURRENT_TIMESTAMP
      WHERE id = $22
      RETURNING *
    `;

    const values = [
      name, type || null, industry || null, address || null, city || null, state || null,
      country || null, postal_code || null, finalLatitude, finalLongitude,
      phone || null, email || null, website || null, owner_person_id || null,
      owner_business_id || null,
      registration_number || null, registration_date || null, status || 'active',
      JSON.stringify(employees || []), notes || null, case_id || null, businessId
    ];

    const result = await pool.query(query, values);
    const updatedBusiness = result.rows[0];

    await syncBusinessRelationships(updatedBusiness.id, updatedBusiness.project_id, updatedBusiness.case_id, {
      ownerPersonId: owner_person_id,
      employees,
    });
    await syncBusinessOwnership(updatedBusiness.id, updatedBusiness.project_id, updatedBusiness.case_id, oldBusiness.owner_business_id, owner_business_id);

    // Log audit changes
    const changes = {};
    Object.keys(req.body).forEach(key => {
      if (oldBusiness[key] !== req.body[key]) {
        changes[key] = { oldValue: oldBusiness[key], newValue: req.body[key] };
      }
    });

    if (Object.keys(changes).length > 0) {
      await logAudit('business', businessId, 'update', changes);
    }

    res.json(updatedBusiness);
  } catch (err) {
    if (err.statusCode) return res.status(err.statusCode).json({ error: err.message });
    console.error('Error updating business:', err);
    res.status(500).json({ error: 'Failed to update business', ...(process.env.NODE_ENV !== 'production' && { detail: err.message }) });
  }
});

// DELETE /:id — delete business
router.delete('/:id', requireAuth, validateIdParam, async (req, res) => {
  try {
    const businessId = req.params.id;

    // Get business for audit
    const businessResult = await pool.query('SELECT * FROM businesses WHERE id = $1', [businessId]);
    if (businessResult.rows.length === 0) {
      return res.status(404).json({ error: 'Business not found' });
    }
    const business = businessResult.rows[0];

    const accessErr = await requireProjectMember(req, business.project_id);
    if (accessErr) return res.status(403).json({ error: accessErr });

    // Delete the business
    await pool.query('DELETE FROM businesses WHERE id = $1', [businessId]);

    // Log audit
    await logAudit('business', businessId, 'delete', {
      record: { oldValue: JSON.stringify(business), newValue: null }
    });

    res.json({ message: 'Business deleted successfully' });
  } catch (err) {
    console.error('Error deleting business:', err);
    res.status(500).json({ error: 'Failed to delete business', ...(process.env.NODE_ENV !== 'production' && { detail: err.message }) });
  }
});

module.exports = router;
