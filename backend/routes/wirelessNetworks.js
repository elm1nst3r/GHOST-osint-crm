// File: backend/routes/wirelessNetworks.js
const express = require('express');
const router = express.Router();
const multer = require('multer');
const xml2js = require('xml2js');
const { pool } = require('../config/database');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const { validateIdParam } = require('../middleware/validation');

// -------------------------------------------------------------------------
// IMPORTANT: /stats, /nearby, and /bulk-delete MUST be defined BEFORE /:id
// to avoid Express treating "stats", "nearby", "bulk-delete" as an :id param.
// -------------------------------------------------------------------------

// GET /stats — wireless network statistics
router.get('/stats', requireAuth, async (req, res) => {
  try {
    const stats = await pool.query(`
      SELECT
        COUNT(*) as total,
        COUNT(DISTINCT ssid) as unique_ssids,
        COUNT(DISTINCT bssid) as unique_bssids,
        COUNT(CASE WHEN
          cardinality(COALESCE(associated_person_ids, ARRAY[]::int[])) > 0
          OR cardinality(COALESCE(associated_business_ids, ARRAY[]::int[])) > 0
          OR person_id IS NOT NULL
        THEN 1 END) as associated_count,
        COUNT(CASE WHEN encryption IN ('WPA2', 'WPA3') THEN 1 END) as encrypted_count,
        COUNT(CASE WHEN encryption IN ('Open', 'Unknown') THEN 1 END) as open_count,
        AVG(signal_strength) as avg_signal
      FROM wireless_networks
    `);

    const byType = await pool.query(`
      SELECT network_type, COUNT(*) as count
      FROM wireless_networks
      GROUP BY network_type
      ORDER BY count DESC
    `);

    const byEncryption = await pool.query(`
      SELECT encryption, COUNT(*) as count
      FROM wireless_networks
      GROUP BY encryption
      ORDER BY count DESC
    `);

    res.json({
      ...stats.rows[0],
      byType: byType.rows,
      byEncryption: byEncryption.rows
    });
  } catch (err) {
    console.error('Error getting wireless network stats:', err);
    res.status(500).json({ error: 'Failed to get statistics' });
  }
});

// GET /nearby — search for networks near a location
router.get('/nearby', requireAuth, async (req, res) => {
  try {
    const lat = parseFloat(req.query.latitude);
    const lng = parseFloat(req.query.longitude);
    const radius = parseFloat(req.query.radius) || 0.5;

    if (isNaN(lat) || isNaN(lng)) {
      return res.status(400).json({ error: 'Valid latitude and longitude are required' });
    }
    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      return res.status(400).json({ error: 'Latitude must be -90 to 90, longitude -180 to 180' });
    }

    const latDelta = radius / 111.0;
    const lonDelta = radius / (111.0 * Math.cos(lat * Math.PI / 180));

    const result = await pool.query(
      `SELECT * FROM wireless_networks
       WHERE latitude BETWEEN $1 AND $2
       AND longitude BETWEEN $3 AND $4
       ORDER BY scan_date DESC`,
      [lat - latDelta, lat + latDelta, lng - lonDelta, lng + lonDelta]
    );

    res.json(result.rows);
  } catch (err) {
    console.error('Error searching nearby networks:', err);
    res.status(500).json({ error: 'Failed to search nearby networks' });
  }
});

// POST /bulk-delete — bulk delete wireless networks (admin only)
router.post('/bulk-delete', requireAdmin, async (req, res) => {
  try {
    const { ids } = req.body;
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: 'IDs array is required' });
    }

    const result = await pool.query(
      'DELETE FROM wireless_networks WHERE id = ANY($1::int[]) RETURNING id',
      [ids]
    );

    res.json({ message: `Deleted ${result.rowCount} wireless networks`, deletedIds: result.rows.map(r => r.id) });
  } catch (err) {
    console.error('Error bulk deleting wireless networks:', err);
    res.status(500).json({ error: 'Failed to bulk delete wireless networks' });
  }
});

// POST /import-kml — import WiGLE KML file
// KML upload multer instance — bounded by KML_MAX_BYTES env var (default 5 MB).
// For very large WiGLE exports consider switching to disk storage + streaming XML parsing.
const kmlUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: parseInt(process.env.KML_MAX_BYTES || String(5 * 1024 * 1024), 10),
    files: 1,
  },
});

router.post('/import-kml', requireAuth, (req, res, next) => {
  kmlUpload.single('kmlFile')(req, res, (err) => {
    if (err && err.code === 'LIMIT_FILE_SIZE') {
      const limitBytes = parseInt(process.env.KML_MAX_BYTES || String(5 * 1024 * 1024), 10);
      return res.status(413).json({ error: 'KML file exceeds size limit', limit_bytes: limitBytes });
    }
    if (err) return res.status(400).json({ error: err.message });
    next();
  });
}, async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'KML file is required' });
    }

    const kmlContent = req.file.buffer.toString('utf-8');
    const parser = new xml2js.Parser();
    const parsed = await parser.parseStringPromise(kmlContent);

    const placemarks = parsed.kml?.Document?.[0]?.Folder?.[0]?.Placemark || [];
    const importSource = req.file.originalname;
    const importedNetworks = [];
    const errors = [];

    for (const placemark of placemarks) {
      try {
        const name = placemark.name?.[0]?.trim() || 'Unknown';
        const description = placemark.description?.[0] || '';
        const coordinates = placemark.Point?.[0]?.coordinates?.[0];
        const styleUrl = placemark.styleUrl?.[0]?.replace('#', '') || 'zeroConfidence';

        if (!coordinates) {
          errors.push({ ssid: name, error: 'No coordinates found' });
          continue;
        }

        // Parse coordinates (longitude, latitude format in KML)
        const [longitude, latitude] = coordinates.split(',').map(parseFloat);

        // Parse description for details
        const descLines = description.split('\n');
        let bssid = null, encryption = 'Unknown', signal = null, accuracy = null, timestamp = null, networkType = 'WIFI';

        descLines.forEach(line => {
          if (line.includes('Network ID:')) bssid = line.split('Network ID:')[1].trim() || null;
          if (line.includes('Encryption:')) encryption = line.split('Encryption:')[1].trim();
          if (line.includes('Signal:')) signal = parseFloat(line.split('Signal:')[1].trim());
          if (line.includes('Accuracy:')) accuracy = parseFloat(line.split('Accuracy:')[1].trim());
          if (line.includes('Time:')) timestamp = line.split('Time:')[1].trim();
          if (line.includes('Type:')) networkType = line.split('Type:')[1].trim();
        });

        // Map confidence from style
        const confidenceMap = {
          'highConfidence': 'high',
          'mediumConfidence': 'medium',
          'lowConfidence': 'low',
          'zeroConfidence': 'zero',
          'bluetoothClassic': 'high',
          'bluetoothLe': 'high',
          'cell': 'high'
        };
        const confidence = confidenceMap[styleUrl] || 'low';

        // Insert into database (using ON CONFLICT to handle duplicates)
        const result = await pool.query(
          `INSERT INTO wireless_networks (
            ssid, bssid, latitude, longitude, accuracy, encryption, signal_strength,
            network_type, confidence_level, scan_date, import_source
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
          ON CONFLICT (bssid, latitude, longitude, scan_date)
          DO UPDATE SET
            signal_strength = GREATEST(wireless_networks.signal_strength, EXCLUDED.signal_strength),
            last_seen = CURRENT_TIMESTAMP
          RETURNING *`,
          [name, bssid, latitude, longitude, accuracy, encryption, signal,
           networkType, confidence, timestamp, importSource]
        );

        importedNetworks.push(result.rows[0]);
      } catch (itemError) {
        errors.push({ ssid: placemark.name?.[0], error: itemError.message });
      }
    }

    res.json({
      message: `Imported ${importedNetworks.length} wireless networks`,
      imported: importedNetworks.length,
      errors: errors.length,
      errorDetails: errors.length > 0 ? errors : undefined
    });
  } catch (err) {
    console.error('Error importing KML:', err);
    res.status(500).json({ error: 'Failed to import KML file: ' + err.message });
  }
});

// GET / — list wireless networks with filters
router.get('/', requireAuth, async (req, res) => {
  try {
    const { person_id, ssid, bssid, network_type, encryption, import_source, signal_min, signal_max } = req.query;

    let query = 'SELECT id, ssid, bssid, latitude, longitude, accuracy, encryption, signal_strength, frequency, channel, network_type, confidence_level, first_seen, last_seen, scan_date, person_id, association_note, association_confidence, import_source, notes, tags, area_name, associated_person_ids, associated_business_ids, created_at, updated_at FROM wireless_networks WHERE 1=1';
    const params = [];
    let paramCount = 0;

    if (person_id) {
      // Match against the authoritative arrays; OR singular for backwards compatibility (issue #41)
      query += ` AND ($${++paramCount}::int = ANY(COALESCE(associated_person_ids, ARRAY[]::int[])) OR person_id = $${paramCount}::int)`;
      params.push(person_id);
    }

    if (ssid) {
      query += ` AND LOWER(ssid) LIKE $${++paramCount}`;
      params.push(`%${ssid.toLowerCase()}%`);
    }

    if (bssid) {
      query += ` AND bssid = $${++paramCount}`;
      params.push(bssid);
    }

    if (network_type) {
      query += ` AND network_type = $${++paramCount}`;
      params.push(network_type);
    }

    if (encryption) {
      query += ` AND encryption = $${++paramCount}`;
      params.push(encryption);
    }

    if (import_source) {
      query += ` AND import_source = $${++paramCount}`;
      params.push(import_source);
    }

    if (signal_min) {
      query += ` AND signal_strength >= $${++paramCount}`;
      params.push(parseInt(signal_min));
    }

    if (signal_max) {
      query += ` AND signal_strength <= $${++paramCount}`;
      params.push(parseInt(signal_max));
    }

    query += ' ORDER BY scan_date DESC, signal_strength DESC';

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching wireless networks:', err);
    res.status(500).json({ error: 'Failed to fetch wireless networks' });
  }
});

// GET /:id — get single wireless network by ID
router.get('/:id', requireAuth, validateIdParam, async (req, res) => {
  const id = req.params.id;
  try {
    const result = await pool.query('SELECT id, ssid, bssid, latitude, longitude, accuracy, encryption, signal_strength, frequency, channel, network_type, confidence_level, first_seen, last_seen, scan_date, person_id, association_note, association_confidence, import_source, notes, tags, area_name, associated_person_ids, associated_business_ids, created_at, updated_at FROM wireless_networks WHERE id = $1', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Wireless network not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error fetching wireless network:', err);
    res.status(500).json({ error: 'Failed to fetch wireless network' });
  }
});

// POST / — create wireless network (manual entry)
router.post('/', requireAuth, async (req, res) => {
  try {
    const {
      ssid, bssid, latitude, longitude, accuracy, encryption, signal_strength,
      frequency, channel, network_type, confidence_level, first_seen, last_seen,
      scan_date, person_id, association_note, association_confidence,
      import_source, notes, tags, area_name, password, associated_person_ids, associated_business_ids
    } = req.body;

    if (!ssid) {
      return res.status(400).json({ error: 'SSID is required' });
    }

    // If location is provided, both lat and long must be present
    if ((latitude && !longitude) || (!latitude && longitude)) {
      return res.status(400).json({ error: 'Both latitude and longitude must be provided if specifying location' });
    }

    const result = await pool.query(
      `INSERT INTO wireless_networks (
        ssid, bssid, latitude, longitude, accuracy, encryption, signal_strength,
        frequency, channel, network_type, confidence_level, first_seen, last_seen,
        scan_date, person_id, association_note, association_confidence,
        import_source, notes, tags, area_name, password, associated_person_ids, associated_business_ids
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24)
      RETURNING *`,
      [ssid, bssid, latitude, longitude, accuracy, encryption, signal_strength,
       frequency, channel, network_type || 'WIFI', confidence_level, first_seen, last_seen,
       scan_date, person_id, association_note, association_confidence,
       import_source, notes, tags, area_name, password, associated_person_ids, associated_business_ids]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Error creating wireless network:', err);
    res.status(500).json({ error: 'Failed to create wireless network' });
  }
});

// PUT /:id — update wireless network
router.put('/:id', requireAuth, validateIdParam, async (req, res) => {
  const id = req.params.id;
  try {
    const {
      ssid, bssid, latitude, longitude, accuracy, encryption, signal_strength,
      frequency, channel, network_type, confidence_level, first_seen, last_seen,
      scan_date, person_id, association_note, association_confidence,
      notes, tags, area_name, password, associated_person_ids, associated_business_ids
    } = req.body;

    const result = await pool.query(
      `UPDATE wireless_networks SET
        ssid = $1, bssid = $2, latitude = $3, longitude = $4, accuracy = $5,
        encryption = $6, signal_strength = $7, frequency = $8, channel = $9,
        network_type = $10, confidence_level = $11, first_seen = $12, last_seen = $13,
        scan_date = $14, person_id = $15, association_note = $16,
        association_confidence = $17, notes = $18, tags = $19, area_name = $20,
        password = $21, associated_person_ids = $22, associated_business_ids = $23
      WHERE id = $24 RETURNING *`,
      [ssid, bssid, latitude, longitude, accuracy, encryption, signal_strength,
       frequency, channel, network_type, confidence_level, first_seen, last_seen,
       scan_date, person_id, association_note, association_confidence,
       notes, tags, area_name, password, associated_person_ids, associated_business_ids, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Wireless network not found' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error updating wireless network:', err);
    res.status(500).json({ error: 'Failed to update wireless network' });
  }
});

// DELETE /:id — delete single wireless network
router.delete('/:id', requireAuth, validateIdParam, async (req, res) => {
  const id = req.params.id;
  try {
    const result = await pool.query('DELETE FROM wireless_networks WHERE id = $1 RETURNING *', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Wireless network not found' });
    }
    res.json({ message: 'Wireless network deleted successfully' });
  } catch (err) {
    console.error('Error deleting wireless network:', err);
    res.status(500).json({ error: 'Failed to delete wireless network' });
  }
});

// POST /:id/associate — associate wireless network with person or business
// Arrays are authoritative (issue #41); singular person_id kept in sync as deprecated mirror.
router.post('/:id/associate', requireAuth, validateIdParam, async (req, res) => {
  const id = req.params.id;
  try {
    const { person_id, business_id, association_note, association_confidence } = req.body;

    if (!person_id && !business_id) {
      return res.status(400).json({ error: 'person_id or business_id is required' });
    }

    let query;
    let params;

    if (person_id) {
      const pid = parseInt(person_id, 10);
      if (isNaN(pid)) return res.status(400).json({ error: 'Invalid person_id' });
      query = `UPDATE wireless_networks
               SET associated_person_ids = (
                     SELECT ARRAY(SELECT DISTINCT unnest(COALESCE(associated_person_ids, ARRAY[]::int[]) || ARRAY[$1::int]))
                   ),
                   person_id = COALESCE(person_id, $1),
                   association_note = $2,
                   association_confidence = $3
               WHERE id = $4 RETURNING *`;
      params = [pid, association_note, association_confidence || 'investigating', id];
    } else {
      const bid = parseInt(business_id, 10);
      if (isNaN(bid)) return res.status(400).json({ error: 'Invalid business_id' });
      query = `UPDATE wireless_networks
               SET associated_business_ids = (
                     SELECT ARRAY(SELECT DISTINCT unnest(COALESCE(associated_business_ids, ARRAY[]::int[]) || ARRAY[$1::int]))
                   ),
                   association_note = $2,
                   association_confidence = $3
               WHERE id = $4 RETURNING *`;
      params = [bid, association_note, association_confidence || 'investigating', id];
    }

    const result = await pool.query(query, params);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Wireless network not found' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error associating wireless network:', err);
    res.status(500).json({ error: 'Failed to associate wireless network' });
  }
});

// DELETE /:id/associate — remove a specific person or business association (issue #41)
// Removes from the authoritative array and clears the deprecated singular column if it matches.
router.delete('/:id/associate', requireAuth, validateIdParam, async (req, res) => {
  const id = req.params.id;
  try {
    const { person_id, business_id } = req.body;

    if (!person_id && !business_id) {
      // Legacy behaviour: clear all associations
      const result = await pool.query(
        `UPDATE wireless_networks
         SET person_id = NULL, associated_person_ids = ARRAY[]::int[],
             associated_business_ids = ARRAY[]::int[],
             association_note = NULL, association_confidence = NULL
         WHERE id = $1 RETURNING *`,
        [id]
      );
      if (result.rows.length === 0) return res.status(404).json({ error: 'Wireless network not found' });
      return res.json(result.rows[0]);
    }

    let query;
    let params;

    if (person_id) {
      const pid = parseInt(person_id, 10);
      if (isNaN(pid)) return res.status(400).json({ error: 'Invalid person_id' });
      query = `UPDATE wireless_networks
               SET associated_person_ids = array_remove(COALESCE(associated_person_ids, ARRAY[]::int[]), $1::int),
                   person_id = CASE WHEN person_id = $1 THEN NULL ELSE person_id END
               WHERE id = $2 RETURNING *`;
      params = [pid, id];
    } else {
      const bid = parseInt(business_id, 10);
      if (isNaN(bid)) return res.status(400).json({ error: 'Invalid business_id' });
      query = `UPDATE wireless_networks
               SET associated_business_ids = array_remove(COALESCE(associated_business_ids, ARRAY[]::int[]), $1::int)
               WHERE id = $2 RETURNING *`;
      params = [bid, id];
    }

    const result = await pool.query(query, params);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Wireless network not found' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error removing association:', err);
    res.status(500).json({ error: 'Failed to remove association' });
  }
});

module.exports = router;
