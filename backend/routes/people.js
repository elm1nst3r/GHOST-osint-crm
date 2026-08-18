// File: backend/routes/people.js
const express = require('express');
const router = express.Router();
const { pool } = require('../config/database');
const { requireAuth } = require('../middleware/auth');
const { validateIdParam } = require('../middleware/validation');
const { validate, PersonCreateSchema, PersonUpdateSchema } = require('../middleware/schemas');
const logAudit = require('../utils/logAudit');
const { apiLimiter } = require('../middleware/rateLimiters');
const { syncPersonConnections } = require('./relationships');
const { checkCaseProjectConsistency } = require('../utils/projectConsistency');

// connections is now backed by the relationships table (issue #83), not the
// stored JSONB column -- read it computed here so 11+ frontend consumers that
// read person.connections keep working unmodified. Listed AFTER `p.*` on
// purpose: pg (and the node driver) keeps the LAST column when two share a
// name, so this silently wins over the raw (now-unused-for-reads) column.
const PERSON_CONNECTIONS_SUBQUERY = `
  (SELECT COALESCE(
     jsonb_agg(jsonb_build_object('person_id', r.target_id, 'type', r.relationship_type, 'note', r.note) ORDER BY r.id),
     '[]'::jsonb
   ) FROM relationships r WHERE r.source_type = 'person' AND r.source_id = p.id AND r.target_type = 'person') AS connections
`;

async function fetchPersonById(id) {
  const result = await pool.query(
    `SELECT p.*, CONCAT_WS(' ', p.first_name, NULLIF(p.patronymic, ''), NULLIF(p.last_name, '')) as full_name,
            ${PERSON_CONNECTIONS_SUBQUERY}
     FROM people p WHERE p.id = $1`,
    [id]
  );
  return result.rows[0];
}

router.use(apiLimiter);
// GET / — paginated people list
router.get('/', requireAuth, async (req, res) => {
  try {
    // Honour ?limit and ?offset; cap at 1000. Response stays an array for backwards
    // compatibility — pagination metadata exposed via response headers (issue #40).
    const limit = Math.min(parseInt(req.query.limit, 10) || 100, 1000);
    const offset = Math.max(parseInt(req.query.offset, 10) || 0, 0);

    const where = [];
    const params = [];
    if (req.query.project_id) { params.push(parseInt(req.query.project_id, 10)); where.push(`p.project_id = $${params.length}`); }
    if (req.query.case_id) { params.push(parseInt(req.query.case_id, 10)); where.push(`p.case_id = $${params.length}`); }
    const whereClause = where.length ? `WHERE ${where.join(' AND ')}` : '';

    const [dataResult, countResult] = await Promise.all([
      pool.query(
        `SELECT p.*, CONCAT_WS(' ', p.first_name, NULLIF(p.patronymic, ''), NULLIF(p.last_name, '')) as full_name,
                ${PERSON_CONNECTIONS_SUBQUERY}
         FROM people p ${whereClause} ORDER BY p.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
        [...params, limit, offset]
      ),
      pool.query(`SELECT COUNT(*)::int AS count FROM people p ${whereClause}`, params),
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
router.post('/', requireAuth, validate(PersonCreateSchema), async (req, res) => {
  const {
    firstName, lastName, patronymic, aliases, dateOfBirth, category, status, crmStatus,
    caseName, case_id, project_id, profilePictureUrl, notes, osintData, attachments, connections,
    locations, custom_fields
  } = req.body;

  const caseErr = await checkCaseProjectConsistency(case_id, project_id);
  if (caseErr) return res.status(400).json({ error: caseErr });

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

  // connections is intentionally not written here (issue #83) -- it's now
  // backed by the relationships table, synced below once the person exists.
  const query = `
    INSERT INTO people (first_name, last_name, patronymic, aliases, date_of_birth, category, status, crm_status, case_name, case_id, project_id, profile_picture_url, notes, osint_data, attachments, locations, custom_fields)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
    RETURNING *, CONCAT_WS(' ', first_name, NULLIF(patronymic, ''), NULLIF(last_name, '')) as full_name;
  `;

  const values = [
    firstName,
    lastName || null,
    patronymic || null,
    aliases || [],
    dateOfBirth || null,
    category || null,
    status || null,
    crmStatus || null,
    caseName || null,
    case_id || null,
    project_id,
    profilePictureUrl || null,
    notes || null,
    JSON.stringify(osintData || []),
    JSON.stringify(attachments || []),
    JSON.stringify(geocodedLocations),
    JSON.stringify(custom_fields || {})
  ];

  try {
    const result = await pool.query(query, values);
    let newPerson = result.rows[0];

    await syncPersonConnections(newPerson.id, newPerson.project_id, newPerson.case_id, connections);
    newPerson = await fetchPersonById(newPerson.id);

    // Log audit
    await logAudit('person', newPerson.id, 'create', {
      record: { oldValue: null, newValue: JSON.stringify(newPerson) }
    });

    res.status(201).json(newPerson);
  } catch (err) {
    if (err.statusCode) return res.status(err.statusCode).json({ error: err.message });
    console.error('Error creating person:', err.message, err.stack);
    res.status(500).json({ error: 'Failed to create person' });
  }
});

// GET /:id — get single person by ID
router.get('/:id', requireAuth, validateIdParam, async (req, res) => {
  try {
    const personId = req.params.id;
    const result = await pool.query(
      `SELECT p.*, CONCAT_WS(' ', p.first_name, NULLIF(p.patronymic, ''), NULLIF(p.last_name, '')) as full_name,
              ${PERSON_CONNECTIONS_SUBQUERY}
       FROM people p WHERE p.id = $1`,
      [personId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Person not found' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error fetching person:', err.message);
    res.status(500).json({ error: 'Failed to fetch person' });
  }
});

// PUT /:id — update person
router.put('/:id', requireAuth, validateIdParam, validate(PersonUpdateSchema), async (req, res) => {
  const personId = req.params.id;
  const {
    firstName, lastName, patronymic, aliases, dateOfBirth, category, status, crmStatus,
    caseName, case_id, profilePictureUrl, notes, osintData, attachments, connections,
    locations, custom_fields
  } = req.body;

  try {
    // Get old values for audit. connections comes from relationships now, not
    // the (stale-for-reads) raw column, so it's fetched separately.
    const oldResult = await pool.query('SELECT * FROM people WHERE id = $1', [personId]);
    if (oldResult.rows.length === 0) return res.status(404).json({ error: 'Person not found' });
    const oldPerson = oldResult.rows[0];
    const oldConnectionsResult = await pool.query(
      `SELECT jsonb_build_object('person_id', target_id, 'type', relationship_type, 'note', note) AS c
       FROM relationships WHERE source_type = 'person' AND source_id = $1 AND target_type = 'person'`,
      [personId]
    );
    const oldConnections = oldConnectionsResult.rows.map((r) => r.c);

    const caseErr = await checkCaseProjectConsistency(case_id, oldPerson.project_id);
    if (caseErr) return res.status(400).json({ error: caseErr });

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
      SET first_name = $1, last_name = $2, patronymic = $3, aliases = $4, date_of_birth = $5, category = $6,
          status = $7, crm_status = $8, case_name = $9, case_id = $10, profile_picture_url = $11, notes = $12,
          osint_data = $13, attachments = $14, locations = $15, custom_fields = $16
      WHERE id = $17
      RETURNING *, CONCAT_WS(' ', first_name, NULLIF(patronymic, ''), NULLIF(last_name, '')) as full_name;
    `;

    const values = [
      firstName,
      lastName || null,
      patronymic || null,
      aliases || [],
      dateOfBirth || null,
      category || null,
      status || null,
      crmStatus || null,
      caseName || null,
      case_id || null,
      profilePictureUrl || null,
      notes || null,
      JSON.stringify(osintData || []),
      JSON.stringify(attachments || []),
      JSON.stringify(geocodedLocations),
      JSON.stringify(custom_fields || {}),
      personId
    ];

    let result = await pool.query(query, values);
    let newPerson = result.rows[0];

    await syncPersonConnections(newPerson.id, newPerson.project_id, newPerson.case_id, connections);
    newPerson = await fetchPersonById(personId);

    // Log audit changes — scalar fields compared directly, JSON fields by serialisation
    const changes = {};
    if (oldPerson.first_name !== firstName) changes.first_name = { oldValue: oldPerson.first_name, newValue: firstName };
    if (oldPerson.last_name !== lastName) changes.last_name = { oldValue: oldPerson.last_name, newValue: lastName };
    if (oldPerson.patronymic !== (patronymic || null)) changes.patronymic = { oldValue: oldPerson.patronymic, newValue: patronymic || null };
    if (oldPerson.category !== category) changes.category = { oldValue: oldPerson.category, newValue: category };
    if (oldPerson.status !== status) changes.status = { oldValue: oldPerson.status, newValue: status };
    if (oldPerson.case_name !== caseName) changes.case_name = { oldValue: oldPerson.case_name, newValue: caseName };
    if (oldPerson.case_id !== (case_id || null)) changes.case_id = { oldValue: oldPerson.case_id, newValue: case_id || null };
    if (oldPerson.notes !== (notes || null)) changes.notes = { oldValue: oldPerson.notes, newValue: notes || null };
    // Store actual before/after JSON for tracked fields (issue #39).
    // connections compares against oldConnections (fetched from relationships
    // pre-update above), not oldPerson.connections -- that raw column is no
    // longer authoritative as of issue #83.
    const jsonFieldMap = [
      ['locations', geocodedLocations, oldPerson.locations],
      ['connections', connections, oldConnections],
      ['osint_data', osintData, oldPerson.osint_data],
    ];
    for (const [field, newVal, oldVal] of jsonFieldMap) {
      const oldSerialized = JSON.stringify(oldVal ?? null);
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
    if (err.statusCode) return res.status(err.statusCode).json({ error: err.message });
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
