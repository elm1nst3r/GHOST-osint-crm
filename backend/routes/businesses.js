const express = require('express');
const router = express.Router();
const { pool } = require('../config/database');
const { requireAuth } = require('../middleware/auth');
const { validateBusinessData, validateIdParam } = require('../middleware/validation');
const logAudit = require('../utils/logAudit');

// GET / — list all businesses
router.get('/', requireAuth, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        b.*,
        CONCAT(p.first_name, ' ', COALESCE(p.last_name, '')) as owner_name
      FROM businesses b
      LEFT JOIN people p ON b.owner_person_id = p.id
      ORDER BY b.created_at DESC
    `);
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching businesses:', err);
    res.status(500).json({ error: 'Failed to fetch businesses' });
  }
});

// POST / — create business
router.post('/', requireAuth, validateBusinessData, async (req, res) => {
  try {
    const {
      name, type, industry, address, city, state, country, postal_code,
      latitude, longitude, phone, email, website, owner_person_id,
      registration_number, registration_date, status, employees, notes
    } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Business name is required' });
    }

    // Geocode address if provided and coordinates not set
    let finalLatitude = latitude;
    let finalLongitude = longitude;

    if (!finalLatitude && !finalLongitude && (address || city || country)) {
      const locationParts = [address, city, state, country].filter(Boolean);
      const improvedGeocodingService = req.app.locals.improvedGeocodingService;
      if (locationParts.length > 0 && improvedGeocodingService) {
        try {
          const geocodeResult = await improvedGeocodingService.geocodeAddress(locationParts.join(', '), { minConfidence: 30 });
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
        latitude, longitude, phone, email, website, owner_person_id,
        registration_number, registration_date, status, employees, notes
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)
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
      registration_number || null,
      registration_date || null,
      status || 'active',
      JSON.stringify(employees || []),
      notes || null
    ];

    const result = await pool.query(query, values);
    const newBusiness = result.rows[0];

    // Log audit
    await logAudit('business', newBusiness.id, 'create', {
      record: { oldValue: null, newValue: JSON.stringify(newBusiness) }
    });

    res.status(201).json(newBusiness);
  } catch (err) {
    console.error('Error creating business:', err);
    res.status(500).json({ error: 'Failed to create business' });
  }
});

// PUT /:id — update business
router.put('/:id', requireAuth, validateIdParam, validateBusinessData, async (req, res) => {
  try {
    const businessId = req.params.id;

    const {
      name, type, industry, address, city, state, country, postal_code,
      latitude, longitude, phone, email, website, owner_person_id,
      registration_number, registration_date, status, employees, notes
    } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Business name is required' });
    }

    // Get old business for audit
    const oldResult = await pool.query('SELECT * FROM businesses WHERE id = $1', [businessId]);
    if (oldResult.rows.length === 0) {
      return res.status(404).json({ error: 'Business not found' });
    }
    const oldBusiness = oldResult.rows[0];

    // Geocode address if changed and coordinates not manually set
    let finalLatitude = latitude;
    let finalLongitude = longitude;

    if (!finalLatitude && !finalLongitude && (address || city || country)) {
      const locationParts = [address, city, state, country].filter(Boolean);
      const improvedGeocodingService = req.app.locals.improvedGeocodingService;
      if (locationParts.length > 0 && improvedGeocodingService) {
        try {
          const geocodeResult = await improvedGeocodingService.geocodeAddress(locationParts.join(', '), { minConfidence: 30 });
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
          registration_number = $15, registration_date = $16, status = $17,
          employees = $18, notes = $19, updated_at = CURRENT_TIMESTAMP
      WHERE id = $20
      RETURNING *
    `;

    const values = [
      name, type || null, industry || null, address || null, city || null, state || null,
      country || null, postal_code || null, finalLatitude, finalLongitude,
      phone || null, email || null, website || null, owner_person_id || null,
      registration_number || null, registration_date || null, status || 'active',
      JSON.stringify(employees || []), notes || null, businessId
    ];

    const result = await pool.query(query, values);
    const updatedBusiness = result.rows[0];

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
    console.error('Error updating business:', err);
    res.status(500).json({ error: 'Failed to update business' });
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

    // Delete the business
    await pool.query('DELETE FROM businesses WHERE id = $1', [businessId]);

    // Log audit
    await logAudit('business', businessId, 'delete', {
      record: { oldValue: JSON.stringify(business), newValue: null }
    });

    res.json({ message: 'Business deleted successfully' });
  } catch (err) {
    console.error('Error deleting business:', err);
    res.status(500).json({ error: 'Failed to delete business' });
  }
});

module.exports = router;
