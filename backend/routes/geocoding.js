const express = require('express');
const router = express.Router();
const { pool } = require('../config/database');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const { geocodingLimiter } = require('../middleware/rateLimiters');

// Single-address geocode
router.get('/', requireAuth, async (req, res) => {
  const { q } = req.query;
  if (!q || q.trim().length < 3) {
    return res.status(400).json({ error: 'Query must be at least 3 characters' });
  }
  const improvedGeocodingService = req.app.locals.improvedGeocodingService;
  if (!improvedGeocodingService) {
    return res.status(503).json({ reason: 'service_error', message: 'Geocoding service not initialized' });
  }
  const result = await improvedGeocodingService.geocodeAddress(q.trim());
  if (result && !result.failure) {
    res.json({ lat: result.lat, lng: result.lng });
  } else {
    res.status(404).json({
      reason: result?.failure || 'not_found',
      message: result?.message || 'No results found for this address'
    });
  }
});

// Address suggestions for autocomplete
router.get('/suggestions', requireAuth, geocodingLimiter, async (req, res) => {
  const { q, limit = 5 } = req.query;

  if (!q || q.length < 3) {
    return res.json([]);
  }

  try {
    const improvedGeocodingService = req.app.locals.improvedGeocodingService;
    if (!improvedGeocodingService) {
      return res.status(503).json({ error: 'Geocoding service not initialized' });
    }

    const suggestions = await improvedGeocodingService.getSuggestions(q, parseInt(limit));
    res.json(suggestions);
  } catch (err) {
    console.error('Error getting address suggestions:', err);
    res.status(500).json({ error: 'Failed to get address suggestions' });
  }
});

// Enhanced single address geocoding
router.post('/address', requireAuth, geocodingLimiter, async (req, res) => {
  const { address, minConfidence = 30 } = req.body;

  if (!address) {
    return res.status(400).json({ error: 'Address is required' });
  }

  try {
    const improvedGeocodingService = req.app.locals.improvedGeocodingService;
    if (!improvedGeocodingService) {
      return res.status(503).json({ error: 'Geocoding service not initialized' });
    }

    const result = await improvedGeocodingService.geocodeAddress(address, { minConfidence });

    if (result && !result.failure) {
      res.json({ success: true, result, cached: result.cached || false });
    } else {
      res.json({
        success: false,
        reason: result?.failure || 'unknown',
        message: result?.message || 'Could not geocode this address',
        best_match: result?.best_match || null
      });
    }
  } catch (err) {
    console.error('Error geocoding address:', err);
    res.status(500).json({ error: 'Failed to geocode address' });
  }
});

// Batch geocode all locations missing coordinates (legacy)
router.post('/batch', requireAuth, requireAdmin, async (req, res) => {
  try {
    const batchGeocode = req.app.locals.batchGeocode;
    const peopleResult = await pool.query(`
      SELECT id, locations
      FROM people
      WHERE locations IS NOT NULL AND locations != '[]'::jsonb
    `);

    let totalGeocoded = 0;
    let totalFailed = 0;

    for (const person of peopleResult.rows) {
      const locations = person.locations || [];
      const needsGeocoding = locations.some(
        loc => (!loc.latitude || !loc.longitude) && (loc.address || loc.city || loc.country)
      );

      if (needsGeocoding && batchGeocode) {
        console.log(`Geocoding locations for person ${person.id}`);
        const geocodedLocations = await batchGeocode(locations);

        const geocodedCount = geocodedLocations.filter(
          loc => loc.latitude && loc.longitude
        ).length - locations.filter(
          loc => loc.latitude && loc.longitude
        ).length;

        totalGeocoded += geocodedCount;

        await pool.query(
          'UPDATE people SET locations = $1 WHERE id = $2',
          [JSON.stringify(geocodedLocations), person.id]
        );
      }
    }

    res.json({
      message: 'Batch geocoding completed',
      totalGeocoded,
      totalFailed
    });
  } catch (err) {
    console.error('Error in batch geocoding:', err);
    res.status(500).json({ error: 'Batch geocoding failed' });
  }
});

// Enhanced batch geocoding with improved service
router.post('/batch-enhanced', requireAuth, requireAdmin, async (req, res) => {
  const { locations, minConfidence = 30, maxConcurrent = 3 } = req.body;

  if (!locations || !Array.isArray(locations)) {
    return res.status(400).json({ error: 'Locations array is required' });
  }

  try {
    const improvedGeocodingService = req.app.locals.improvedGeocodingService;
    if (!improvedGeocodingService) {
      return res.status(503).json({ error: 'Geocoding service not initialized' });
    }

    const results = await improvedGeocodingService.batchGeocode(locations, {
      minConfidence,
      maxConcurrent
    });

    // Group geocoded results by person and write back to people.locations
    const byPerson = {};
    for (const result of results) {
      if (!result.person_id) continue;
      if (!byPerson[result.person_id]) byPerson[result.person_id] = [];
      byPerson[result.person_id].push(result);
    }

    for (const [personId, geocodedLocs] of Object.entries(byPerson)) {
      const personResult = await pool.query(
        'SELECT locations FROM people WHERE id = $1',
        [parseInt(personId)]
      );
      if (!personResult.rows.length) continue;

      const existingLocations = personResult.rows[0].locations || [];
      const updatedLocations = existingLocations.map(loc => {
        const match = geocodedLocs.find(g =>
          g.address === loc.address &&
          g.city === loc.city &&
          g.country === loc.country
        );
        if (match && match.latitude && match.longitude) {
          return {
            ...loc,
            latitude: match.latitude,
            longitude: match.longitude,
            geocode_confidence: match.geocode_confidence || 0,
            geocode_provider: match.geocode_provider || 'nominatim',
            geocoded_at: new Date().toISOString()
          };
        }
        return loc;
      });

      await pool.query(
        'UPDATE people SET locations = $1 WHERE id = $2',
        [JSON.stringify(updatedLocations), parseInt(personId)]
      );
    }

    const summary = {
      total: results.length,
      geocoded: results.filter(r => r.latitude && r.longitude).length,
      cached: results.filter(r => r.geocoded_at && r.geocode_confidence > 0).length
    };

    res.json({ results, summary });
  } catch (err) {
    console.error('Error in enhanced batch geocoding:', err);
    res.status(500).json({ error: 'Enhanced batch geocoding failed' });
  }
});

// Get geocoding cache statistics
router.get('/stats', requireAuth, async (req, res) => {
  try {
    const improvedGeocodingService = req.app.locals.improvedGeocodingService;
    if (!improvedGeocodingService) {
      return res.status(503).json({ error: 'Geocoding service not initialized' });
    }

    const stats = await improvedGeocodingService.getCacheStats();
    res.json(stats);
  } catch (err) {
    console.error('Error getting geocoding stats:', err);
    res.status(500).json({ error: 'Failed to get geocoding stats' });
  }
});

module.exports = router;
