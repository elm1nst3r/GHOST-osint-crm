const express = require('express');
const router = express.Router();
const { pool } = require('../config/database');
const { requireAuth } = require('../middleware/auth');

// Get locations with filtering and pagination
router.get('/', requireAuth, async (req, res) => {
  try {
    const {
      limit = 100,
      offset = 0,
      bbox,
      confidence = 30,
      includeUngeocoded = false
    } = req.query;

    let where = `WHERE p.locations IS NOT NULL AND p.locations != '[]'::jsonb`;
    const params = [];
    let paramIndex = 1;

    if (bbox) {
      const [minLng, minLat, maxLng, maxLat] = bbox.split(',').map(Number);
      where += ` AND EXISTS (
        SELECT 1 FROM jsonb_array_elements(p.locations) AS loc
        WHERE (loc->>'latitude')::float BETWEEN $${paramIndex++} AND $${paramIndex++}
        AND (loc->>'longitude')::float BETWEEN $${paramIndex++} AND $${paramIndex++}
      )`;
      params.push(minLat, maxLat, minLng, maxLng);
    }

    if (!includeUngeocoded && confidence > 0) {
      where += ` AND EXISTS (
        SELECT 1 FROM jsonb_array_elements(p.locations) AS loc
        WHERE (loc->>'latitude') IS NOT NULL
        AND (loc->>'longitude') IS NOT NULL
        AND COALESCE((loc->>'geocode_confidence')::int, 0) >= $${paramIndex++}
      )`;
      params.push(confidence);
    }

    const query = `
      SELECT
        p.id,
        p.first_name,
        p.last_name,
        p.case_name,
        p.category,
        p.locations,
        p.connections,
        p.updated_at
      FROM people p
      ${where}
      ORDER BY p.updated_at DESC
      LIMIT $${paramIndex++} OFFSET $${paramIndex++}
    `;
    params.push(parseInt(limit), parseInt(offset));

    const result = await pool.query(query, params);

    const processedRows = result.rows.map(row => {
      const locations = row.locations || [];
      const enhancedLocations = locations.map(loc => ({
        ...loc,
        geocoded: !!(loc.latitude && loc.longitude),
        confidence: loc.geocode_confidence || 0,
        provider: loc.geocode_provider || 'unknown',
        cached: !!loc.geocoded_at
      }));

      return {
        ...row,
        locations: enhancedLocations,
        locationStats: {
          total: locations.length,
          geocoded: enhancedLocations.filter(l => l.geocoded).length,
          highConfidence: enhancedLocations.filter(l => l.confidence >= 80).length
        }
      };
    });

    const countResult = await pool.query(
      `SELECT COUNT(*) as total FROM people p ${where}`,
      params.slice(0, params.length - 2)
    );

    res.json({
      data: processedRows,
      pagination: {
        total: countResult.rows[0].total,
        limit: parseInt(limit),
        offset: parseInt(offset),
        hasMore: parseInt(offset) + parseInt(limit) < countResult.rows[0].total
      }
    });
  } catch (err) {
    console.error('Error fetching locations:', err);
    res.status(500).json({ error: 'Failed to fetch locations' });
  }
});

module.exports = router;
