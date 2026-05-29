const express = require('express');
const router = express.Router();
const { pool } = require('../config/database');
const { requireAuth } = require('../middleware/auth');
const { validateIdParam } = require('../middleware/validation');

// Get travel history for a person
router.get('/people/:id/travel-history', requireAuth, validateIdParam, async (req, res) => {
  const personId = req.params.id;

  try {
    const result = await pool.query(
      `SELECT * FROM travel_history
       WHERE person_id = $1
       ORDER BY arrival_date DESC`,
      [personId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching travel history:', err);
    res.status(500).json({ error: 'Failed to fetch travel history' });
  }
});

// Create travel history entry
router.post('/people/:id/travel-history', requireAuth, validateIdParam, async (req, res) => {
  const personId = req.params.id;

  const {
    location_type, location_name, address, city, state, country, postal_code,
    latitude, longitude, arrival_date, departure_date, purpose, transportation_mode, notes
  } = req.body;

  const parsedArrival = arrival_date ? new Date(arrival_date) : null;
  const parsedDeparture = departure_date ? new Date(departure_date) : null;
  if (arrival_date && isNaN(parsedArrival)) return res.status(400).json({ error: 'Invalid arrival_date' });
  if (departure_date && isNaN(parsedDeparture)) return res.status(400).json({ error: 'Invalid departure_date' });

  try {
    const result = await pool.query(
      `INSERT INTO travel_history
       (person_id, location_type, location_name, address, city, state, country, postal_code,
        latitude, longitude, arrival_date, departure_date, purpose, transportation_mode, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
       RETURNING *`,
      [personId, location_type, location_name, address, city, state, country, postal_code,
       latitude, longitude, parsedArrival, parsedDeparture, purpose, transportation_mode, notes]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Error creating travel history:', err);
    res.status(500).json({ error: 'Failed to create travel history' });
  }
});

// Update travel history entry
router.put('/travel-history/:id', requireAuth, validateIdParam, async (req, res) => {
  const travelId = req.params.id;

  const {
    location_type, location_name, address, city, state, country, postal_code,
    latitude, longitude, arrival_date, departure_date, purpose, transportation_mode, notes
  } = req.body;

  const parsedArrival = arrival_date ? new Date(arrival_date) : null;
  const parsedDeparture = departure_date ? new Date(departure_date) : null;
  if (arrival_date && isNaN(parsedArrival)) return res.status(400).json({ error: 'Invalid arrival_date' });
  if (departure_date && isNaN(parsedDeparture)) return res.status(400).json({ error: 'Invalid departure_date' });

  try {
    const result = await pool.query(
      `UPDATE travel_history
       SET location_type = $1, location_name = $2, address = $3, city = $4, state = $5,
           country = $6, postal_code = $7, latitude = $8, longitude = $9,
           arrival_date = $10, departure_date = $11, purpose = $12,
           transportation_mode = $13, notes = $14
       WHERE id = $15
       RETURNING *`,
      [location_type, location_name, address, city, state, country, postal_code,
       latitude, longitude, parsedArrival, parsedDeparture, purpose, transportation_mode, notes, travelId]
    );

    if (result.rows.length === 0) return res.status(404).json({ error: 'Travel record not found' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error updating travel history:', err);
    res.status(500).json({ error: 'Failed to update travel history' });
  }
});

// Delete travel history entry
router.delete('/travel-history/:id', requireAuth, validateIdParam, async (req, res) => {
  const travelId = req.params.id;

  try {
    const result = await pool.query('DELETE FROM travel_history WHERE id = $1 RETURNING *', [travelId]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Travel record not found' });
    res.json({ message: 'Travel record deleted successfully' });
  } catch (err) {
    console.error('Error deleting travel history:', err);
    res.status(500).json({ error: 'Failed to delete travel history' });
  }
});

// Travel pattern analysis
router.get('/people/:id/travel-analysis', requireAuth, validateIdParam, async (req, res) => {
  const personId = req.params.id;

  try {
    const travelHistory = await pool.query(
      `SELECT * FROM travel_history
       WHERE person_id = $1
       ORDER BY arrival_date ASC`,
      [personId]
    );

    const stats = await pool.query(`
      SELECT
        COUNT(DISTINCT country) as countries_visited,
        COUNT(DISTINCT city) as cities_visited,
        COUNT(*) as total_trips,
        MIN(arrival_date) as first_trip,
        MAX(departure_date) as last_trip,
        AVG(EXTRACT(DAY FROM (departure_date - arrival_date))) as avg_trip_duration
      FROM travel_history
      WHERE person_id = $1 AND arrival_date IS NOT NULL
    `, [personId]);

    const frequentLocations = await pool.query(`
      SELECT country, city, COUNT(*) as visit_count
      FROM travel_history
      WHERE person_id = $1 AND country IS NOT NULL
      GROUP BY country, city
      ORDER BY visit_count DESC
      LIMIT 10
    `, [personId]);

    const travelByPurpose = await pool.query(`
      SELECT purpose, COUNT(*) as count
      FROM travel_history
      WHERE person_id = $1 AND purpose IS NOT NULL
      GROUP BY purpose
      ORDER BY count DESC
    `, [personId]);

    const monthlyFrequency = await pool.query(`
      SELECT
        EXTRACT(YEAR FROM arrival_date) as year,
        EXTRACT(MONTH FROM arrival_date) as month,
        COUNT(*) as trips
      FROM travel_history
      WHERE person_id = $1 AND arrival_date IS NOT NULL
      GROUP BY year, month
      ORDER BY year DESC, month DESC
      LIMIT 24
    `, [personId]);

    res.json({
      history: travelHistory.rows,
      statistics: stats.rows[0],
      frequentLocations: frequentLocations.rows,
      travelByPurpose: travelByPurpose.rows,
      monthlyFrequency: monthlyFrequency.rows
    });
  } catch (err) {
    console.error('Error analyzing travel patterns:', err);
    res.status(500).json({ error: 'Failed to analyze travel patterns' });
  }
});

module.exports = router;
