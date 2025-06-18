// File: backend/routes/people.js
const express = require('express');
const router = express.Router();
const { pool } = require('../config/database');
const { logAudit } = require('../middleware/audit');

// Load geocoding service
let geocodingService;
try {
  geocodingService = require('../services/geocodingService');
} catch (err) {
  console.error('Failed to load geocoding service:', err);
  geocodingService = {
    geocodeAddress: async () => null,
    batchGeocode: async (locations) => locations
  };
}
const { batchGeocode } = geocodingService;

// Get all people
router.get('/', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT *,
        CONCAT(first_name, ' ', COALESCE(last_name, '')) as full_name
      FROM people 
      ORDER BY created_at DESC
    `);
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching people:', err.message);
    res.status(500).json({ error: 'Failed to fetch people' });
  }
});

// Create new person
router.post('/', async (req, res) => {
  const { firstName, lastName, aliases, dateOfBirth, category, status, crmStatus, caseName, profilePictureUrl, notes, osintData, attachments, connections, locations, custom_fields } = req.body;
  if (!firstName) return res.status(400).json({ error: 'First name is required' });
  
  // Geocode locations before saving
  let geocodedLocations = locations || [];
  if (geocodedLocations.length > 0) {
    const locationsToGeocode = geocodedLocations.filter(
      loc => (!loc.latitude || !loc.longitude) && (loc.address || loc.city || loc.country)
    );
    
    if (locationsToGeocode.length > 0) {
      console.log(`Geocoding ${locationsToGeocode.length} locations for new person`);
      const geocoded = await batchGeocode(locationsToGeocode);
      
      geocodedLocations = geocodedLocations.map(loc => {
        if (!loc.latitude || !loc.longitude) {
          const geocodedLoc = geocoded.find(g => 
            g.address === loc.address && 
            g.city === loc.city && 
            g.country === loc.country
          );
          if (geocodedLoc) {
            return {
              ...loc,
              latitude: geocodedLoc.latitude,
              longitude: geocodedLoc.longitude
            };
          }
        }
        return loc;
      });
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

// Update person
router.put('/:id', async (req, res) => {
  const personId = parseInt(req.params.id, 10);
  const { firstName, lastName, aliases, dateOfBirth, category, status, crmStatus, caseName, profilePictureUrl, notes, osintData, attachments, connections, locations, custom_fields } = req.body;
  
  if (isNaN(personId)) return res.status(400).json({ error: 'Invalid person ID' });
  if (!firstName) return res.status(400).json({ error: 'First name is required for update' });
  
  try {
    // Get old values for audit
    const oldResult = await pool.query('SELECT * FROM people WHERE id = $1', [personId]);
    if (oldResult.rows.length === 0) return res.status(404).json({ error: 'Person not found' });
    const oldPerson = oldResult.rows[0];
    
    // Geocode any locations that don't have coordinates
    let geocodedLocations = locations || [];
    if (geocodedLocations.length > 0) {
      const locationsToGeocode = geocodedLocations.filter(
        loc => (!loc.latitude || !loc.longitude) && (loc.address || loc.city || loc.country)
      );
      
      if (locationsToGeocode.length > 0) {
        console.log(`Geocoding ${locationsToGeocode.length} locations for person ${personId}`);
        const geocoded = await batchGeocode(locationsToGeocode);
        
        // Merge geocoded results back
        geocodedLocations = geocodedLocations.map(loc => {
          if (!loc.latitude || !loc.longitude) {
            const geocodedLoc = geocoded.find(g => 
              g.address === loc.address && 
              g.city === loc.city && 
              g.country === loc.country
            );
            if (geocodedLoc) {
              return {
                ...loc,
                latitude: geocodedLoc.latitude,
                longitude: geocodedLoc.longitude
              };
            }
          }
          return loc;
        });
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
    
    // Log audit changes
    const changes = {};
    if (oldPerson.first_name !== firstName) changes.first_name = { oldValue: oldPerson.first_name, newValue: firstName };
    if (oldPerson.last_name !== lastName) changes.last_name = { oldValue: oldPerson.last_name, newValue: lastName };
    if (oldPerson.category !== category) changes.category = { oldValue: oldPerson.category, newValue: category };
    if (oldPerson.status !== status) changes.status = { oldValue: oldPerson.status, newValue: status };
    if (oldPerson.case_name !== caseName) changes.case_name = { oldValue: oldPerson.case_name, newValue: caseName };
    
    if (Object.keys(changes).length > 0) {
      await logAudit('person', personId, 'update', changes);
    }
    
    res.json(newPerson);
  } catch (err) {
    console.error('Error updating person:', err.message, err.stack);
    res.status(500).json({ error: 'Failed to update person' });
  }
});

// Delete person
router.delete('/:id', async (req, res) => {
  const personId = parseInt(req.params.id, 10);
  if (isNaN(personId)) return res.status(400).json({ error: 'Invalid person ID' });
  
  try {
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

// Get travel history for a person
router.get('/:id/travel-history', async (req, res) => {
  const personId = parseInt(req.params.id, 10);
  if (isNaN(personId)) return res.status(400).json({ error: 'Invalid person ID' });
  
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

// Add travel history for a person
router.post('/:id/travel-history', async (req, res) => {
  const personId = parseInt(req.params.id, 10);
  if (isNaN(personId)) return res.status(400).json({ error: 'Invalid person ID' });
  
  const {
    location_type, location_name, address, city, state, country, postal_code,
    latitude, longitude, arrival_date, departure_date, purpose, transportation_mode, notes
  } = req.body;
  
  try {
    const result = await pool.query(
      `INSERT INTO travel_history 
       (person_id, location_type, location_name, address, city, state, country, postal_code,
        latitude, longitude, arrival_date, departure_date, purpose, transportation_mode, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
       RETURNING *`,
      [personId, location_type, location_name, address, city, state, country, postal_code,
       latitude, longitude, arrival_date, departure_date, purpose, transportation_mode, notes]
    );
    
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Error creating travel history:', err);
    res.status(500).json({ error: 'Failed to create travel history' });
  }
});

// Get travel analysis for a person
router.get('/:id/travel-analysis', async (req, res) => {
  const personId = parseInt(req.params.id, 10);
  if (isNaN(personId)) return res.status(400).json({ error: 'Invalid person ID' });
  
  try {
    // Get all travel history
    const travelHistory = await pool.query(
      `SELECT * FROM travel_history 
       WHERE person_id = $1 
       ORDER BY arrival_date ASC`,
      [personId]
    );
    
    // Calculate statistics
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
    
    // Most visited locations
    const frequentLocations = await pool.query(`
      SELECT country, city, COUNT(*) as visit_count
      FROM travel_history
      WHERE person_id = $1 AND country IS NOT NULL
      GROUP BY country, city
      ORDER BY visit_count DESC
      LIMIT 10
    `, [personId]);
    
    // Travel by purpose
    const travelByPurpose = await pool.query(`
      SELECT purpose, COUNT(*) as count
      FROM travel_history
      WHERE person_id = $1 AND purpose IS NOT NULL
      GROUP BY purpose
      ORDER BY count DESC
    `, [personId]);
    
    // Monthly travel frequency
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