// File: backend/routes/people.js
const express = require('express');
const router = express.Router();
const { pool } = require('../config/database');
const { requireAuth } = require('../middleware/auth');
const { validatePersonData, validateIdParam } = require('../middleware/validation');
const logAudit = require('../utils/logAudit');

// GET / — paginated people list
router.get('/', requireAuth, async (req, res) => {
  try {
    // Honour ?limit and ?offset; cap at 1000. Response stays an array for backwards
    // compatibility — pagination metadata exposed via response headers (issue #40).
    const limit = Math.min(parseInt(req.query.limit, 10) || 100, 1000);
    const offset = Math.max(parseInt(req.query.offset, 10) || 0, 0);

    const [dataResult, countResult] = await Promise.all([
      pool.query(
        `SELECT *, CONCAT(first_name, ' ', COALESCE(last_name, '')) as full_name
         FROM people ORDER BY created_at DESC LIMIT $1 OFFSET $2`,
        [limit, offset]
      ),
      pool.query('SELECT COUNT(*)::int AS count FROM people'),
    ]);

    const total = countResult.rows[0].count;
    res.set('X-Total-Count', String(total));
    res.set('X-Has-More', String(offset + dataResult.rows.length < total));
    res.json(dataResult.rows);
  } catch (err) {
    console.error('Error fetching people:', err.message);
    res.status(500).json({ error: 'Failed to fetch people' });
  }
});

// POST / — create person
router.post('/', requireAuth, validatePersonData, async (req, res) => {
  const {
    firstName, lastName, aliases, dateOfBirth, category, status, crmStatus,
    caseName, profilePictureUrl, notes, osintData, attachments, connections,
    locations, custom_fields
  } = req.body;

  if (!firstName) return res.status(400).json({ error: 'First name is required' });

  // Geocode locations before saving using improved service if available.
  // Always merge results back into the original array so already-geocoded entries
  // are not lost (issue #34).
  const geocodedLocations = Array.isArray(locations) ? [...locations] : [];
  if (geocodedLocations.length > 0) {
    const locationsToGeocode = geocodedLocations.filter(
      loc => loc && (!loc.latitude || !loc.longitude) && (loc.address || loc.city || loc.country)
    );

    if (locationsToGeocode.length > 0) {
      const improvedGeocodingService = req.app.locals.improvedGeocodingService;
      const batchGeocode = req.app.locals.batchGeocode;
      console.log(`Geocoding ${locationsToGeocode.length} locations for new person`);

      if (improvedGeocodingService) {
        const geocoded = await improvedGeocodingService.batchGeocode(locationsToGeocode, {
          minConfidence: 30,
          maxConcurrent: 3
        });
        // Merge geocoded results back by reference into the original array
        for (let i = 0; i < geocoded.length; i++) {
          const idx = geocodedLocations.indexOf(locationsToGeocode[i]);
          if (idx >= 0 && geocoded[i] && !geocoded[i].failure) {
            geocodedLocations[idx] = { ...locationsToGeocode[i], ...geocoded[i] };
          }
        }
      } else if (batchGeocode) {
        const geocoded = await batchGeocode(locationsToGeocode);
        for (let i = 0; i < geocodedLocations.length; i++) {
          if (!geocodedLocations[i].latitude || !geocodedLocations[i].longitude) {
            const geocodedLoc = geocoded.find(g =>
              g.address === geocodedLocations[i].address &&
              g.city === geocodedLocations[i].city &&
              g.country === geocodedLocations[i].country
            );
            if (geocodedLoc) {
              geocodedLocations[i] = {
                ...geocodedLocations[i],
                latitude: geocodedLoc.latitude,
                longitude: geocodedLoc.longitude
              };
            }
          }
        }
      }
    }
  }

  const query = `
    INSERT INTO people (first_name, last_name, aliases, date_of_birth, category, status, crm_status, case_name, profile_picture_url, notes, osint_data, attachments, connections, locations, custom_fields)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
    RETURNING *, CONCAT(first_name, ' ', COALESCE(last_name, '')) as full_name;
  `;

  const values = [
    firstName,
    lastName || null,
    aliases || [],
    dateOfBirth || null,
    category || null,
    status || null,
    crmStatus || null,
    caseName || null,
    profilePictureUrl || null,
    notes || null,
    JSON.stringify(osintData || []),
    JSON.stringify(attachments || []),
    JSON.stringify(connections || []),
    JSON.stringify(geocodedLocations),
    JSON.stringify(custom_fields || {})
  ];

  try {
    const result = await pool.query(query, values);
    const newPerson = result.rows[0];

    // Log audit
    await logAudit('person', newPerson.id, 'create', {
      record: { oldValue: null, newValue: JSON.stringify(newPerson) }
    });

    res.status(201).json(newPerson);
  } catch (err) {
    console.error('Error creating person:', err.message, err.stack);
    res.status(500).json({ error: 'Failed to create person' });
  }
});

// PUT /:id — update person
router.put('/:id', requireAuth, validateIdParam, validatePersonData, async (req, res) => {
  const personId = req.params.id;
  const {
    firstName, lastName, aliases, dateOfBirth, category, status, crmStatus,
    caseName, profilePictureUrl, notes, osintData, attachments, connections,
    locations, custom_fields
  } = req.body;

  if (!firstName) return res.status(400).json({ error: 'First name is required for update' });

  try {
    // Get old values for audit
    const oldResult = await pool.query('SELECT * FROM people WHERE id = $1', [personId]);
    if (oldResult.rows.length === 0) return res.status(404).json({ error: 'Person not found' });
    const oldPerson = oldResult.rows[0];

    // Geocode any locations that don't have coordinates using improved service if available.
    // Always merge results back into the original array so already-geocoded entries
    // are not lost (issue #34).
    const geocodedLocations = Array.isArray(locations) ? [...locations] : [];
    if (geocodedLocations.length > 0) {
      const locationsToGeocode = geocodedLocations.filter(
        loc => loc && (!loc.latitude || !loc.longitude) && (loc.address || loc.city || loc.country)
      );

      if (locationsToGeocode.length > 0) {
        const improvedGeocodingService = req.app.locals.improvedGeocodingService;
        const batchGeocode = req.app.locals.batchGeocode;
        console.log(`Geocoding ${locationsToGeocode.length} locations for person ${personId}`);

        if (improvedGeocodingService) {
          const geocoded = await improvedGeocodingService.batchGeocode(locationsToGeocode, {
            minConfidence: 30,
            maxConcurrent: 3
          });
          // Merge geocoded results back by reference into the original array
          for (let i = 0; i < geocoded.length; i++) {
            const idx = geocodedLocations.indexOf(locationsToGeocode[i]);
            if (idx >= 0 && geocoded[i] && !geocoded[i].failure) {
              geocodedLocations[idx] = { ...locationsToGeocode[i], ...geocoded[i] };
            }
          }
        } else if (batchGeocode) {
          const geocoded = await batchGeocode(locationsToGeocode);
          for (let i = 0; i < geocodedLocations.length; i++) {
            if (!geocodedLocations[i].latitude || !geocodedLocations[i].longitude) {
              const geocodedLoc = geocoded.find(g =>
                g.address === geocodedLocations[i].address &&
                g.city === geocodedLocations[i].city &&
                g.country === geocodedLocations[i].country
              );
              if (geocodedLoc) {
                geocodedLocations[i] = {
                  ...geocodedLocations[i],
                  latitude: geocodedLoc.latitude,
                  longitude: geocodedLoc.longitude
                };
              }
            }
          }
        }
      }
    }

    const query = `
      UPDATE people
      SET first_name = $1, last_name = $2, aliases = $3, date_of_birth = $4, category = $5,
          status = $6, crm_status = $7, case_name = $8, profile_picture_url = $9, notes = $10,
          osint_data = $11, attachments = $12, connections = $13, locations = $14, custom_fields = $15
      WHERE id = $16
      RETURNING *, CONCAT(first_name, ' ', COALESCE(last_name, '')) as full_name;
    `;

    const values = [
      firstName,
      lastName || null,
      aliases || [],
      dateOfBirth || null,
      category || null,
      status || null,
      crmStatus || null,
      caseName || null,
      profilePictureUrl || null,
      notes || null,
      JSON.stringify(osintData || []),
      JSON.stringify(attachments || []),
      JSON.stringify(connections || []),
      JSON.stringify(geocodedLocations),
      JSON.stringify(custom_fields || {}),
      personId
    ];

    const result = await pool.query(query, values);
    const newPerson = result.rows[0];

    // Log audit changes — scalar fields compared directly, JSON fields by serialisation
    const changes = {};
    if (oldPerson.first_name !== firstName) changes.first_name = { oldValue: oldPerson.first_name, newValue: firstName };
    if (oldPerson.last_name !== lastName) changes.last_name = { oldValue: oldPerson.last_name, newValue: lastName };
    if (oldPerson.category !== category) changes.category = { oldValue: oldPerson.category, newValue: category };
    if (oldPerson.status !== status) changes.status = { oldValue: oldPerson.status, newValue: status };
    if (oldPerson.case_name !== caseName) changes.case_name = { oldValue: oldPerson.case_name, newValue: caseName };
    if (oldPerson.notes !== (notes || null)) changes.notes = { oldValue: oldPerson.notes, newValue: notes || null };
    // Store actual before/after JSON for tracked fields (issue #39)
    const jsonFieldMap = [
      ['locations', geocodedLocations],
      ['connections', connections],
      ['osint_data', osintData],
    ];
    for (const [field, newVal] of jsonFieldMap) {
      const oldSerialized = JSON.stringify(oldPerson[field] ?? null);
      const newSerialized = JSON.stringify(newVal ?? null);
      if (oldSerialized !== newSerialized) {
        changes[field] = { oldValue: oldSerialized, newValue: newSerialized };
      }
    }

    if (Object.keys(changes).length > 0) {
      await logAudit('person', personId, 'update', changes);
    }

    res.json(newPerson);
  } catch (err) {
    console.error('Error updating person:', err.message, err.stack);
    res.status(500).json({ error: 'Failed to update person' });
  }
});

// POST /:id/locations — append a single location to person's locations JSONB array
router.post('/:id/locations', requireAuth, validateIdParam, async (req, res) => {
  const personId = req.params.id;

  const location = req.body;
  if (!location || typeof location !== 'object') {
    return res.status(400).json({ error: 'Location object is required' });
  }

  try {
    const result = await pool.query(
      `UPDATE people
       SET locations = COALESCE(locations, '[]'::jsonb) || $1::jsonb
       WHERE id = $2
       RETURNING id`,
      [JSON.stringify(location), personId]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Person not found' });
    res.status(201).json({ message: 'Location added' });
  } catch (err) {
    console.error('Error appending location:', err);
    res.status(500).json({ error: 'Failed to add location' });
  }
});

// PUT /:id/locations/:index — update a single location by array index
router.put('/:id/locations/:index', requireAuth, validateIdParam, async (req, res) => {
  const personId = req.params.id;
  const idx = parseInt(req.params.index, 10);
  if (isNaN(idx) || idx < 0) {
    return res.status(400).json({ error: 'Invalid location index' });
  }
  const location = req.body;
  if (!location || typeof location !== 'object') {
    return res.status(400).json({ error: 'Location object is required' });
  }
  try {
    const result = await pool.query(
      `UPDATE people
       SET locations = jsonb_set(locations, ARRAY[$1::text], $2::jsonb, false)
       WHERE id = $3
       RETURNING id`,
      [idx.toString(), JSON.stringify(location), personId]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Person not found' });
    res.json({ message: 'Location updated' });
  } catch (err) {
    console.error('Error updating location:', err);
    res.status(500).json({ error: 'Failed to update location' });
  }
});

// DELETE /:id/locations/:index — remove location by array index
router.delete('/:id/locations/:index', requireAuth, validateIdParam, async (req, res) => {
  const personId = req.params.id;
  const idx = parseInt(req.params.index, 10);
  if (isNaN(idx) || idx < 0) {
    return res.status(400).json({ error: 'Invalid location index' });
  }
  try {
    const result = await pool.query(
      `UPDATE people
       SET locations = locations - $1
       WHERE id = $2
       RETURNING id`,
      [idx, personId]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Person not found' });
    res.json({ message: 'Location deleted' });
  } catch (err) {
    console.error('Error deleting location:', err);
    res.status(500).json({ error: 'Failed to delete location' });
  }
});

// DELETE /:id — delete person
router.delete('/:id', requireAuth, validateIdParam, async (req, res) => {
  const personId = req.params.id;

  try {
    // Get person first for audit
    const oldResult = await pool.query('SELECT * FROM people WHERE id = $1', [personId]);
    if (oldResult.rows.length === 0) return res.status(404).json({ error: 'Person not found' });

    const result = await pool.query('DELETE FROM people WHERE id = $1 RETURNING *;', [personId]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Person not found' });

    await logAudit('person', personId, 'delete', {
      record: { oldValue: JSON.stringify(result.rows[0]), newValue: null }
    });

    res.status(200).json({ message: 'Person deleted successfully', deletedPerson: result.rows[0] });
  } catch (err) {
    console.error('Error deleting person:', err.message);
    res.status(500).json({ error: 'Failed to delete person' });
  }
});

module.exports = router;
