// File: backend/server.js
const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const { exec } = require('child_process');
const util = require('util');

// Add this with the other requires at the top
let geocodingService;
let improvedGeocodingService;
const ImprovedGeocodingService = require('./services/improvedGeocodingService');
try {
  geocodingService = require('./services/geocodingService');
  console.log('Geocoding services loaded successfully');
} catch (err) {
  console.error('Failed to load geocoding service:', err);
  // Create dummy functions if service fails to load
  geocodingService = {
    geocodeAddress: async () => null,
    batchGeocode: async (locations) => locations
  };
}
const { geocodeAddress, batchGeocode } = geocodingService;
const execPromise = util.promisify(exec);

const app = express();
const PORT = process.env.PORT || 3001;

// --- Multer Configuration for Logo Uploads ---
const LOGO_UPLOAD_DIR = path.join(__dirname, 'public', 'uploads', 'logos');
if (!fs.existsSync(LOGO_UPLOAD_DIR)) {
  fs.mkdirSync(LOGO_UPLOAD_DIR, { recursive: true });
  console.log(`Created logo upload directory: ${LOGO_UPLOAD_DIR}`);
}

const logoStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, LOGO_UPLOAD_DIR);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'app-logo-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const logoUpload = multer({
  storage: logoStorage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: function (req, file, cb) {
    checkFileType(file, /jpeg|jpg|png|gif|svg/, cb);
  }
});

function checkFileType(file, filetypes, cb) {
  const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = filetypes.test(file.mimetype);
  if (mimetype && extname) {
    return cb(null, true);
  } else {
    cb('Error: Images Only (jpeg, jpg, png, gif, svg)!');
  }
}

const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'db',
  database: process.env.DB_NAME || 'osint_crm_db',
  password: process.env.DB_PASSWORD || 'changeme',
  port: parseInt(process.env.DB_PORT || '5432', 10),
});

const createUpdatedAtTriggerFunction = `
  CREATE OR REPLACE FUNCTION trigger_set_timestamp()
  RETURNS TRIGGER AS $$
  BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
  END;
  $$ LANGUAGE plpgsql;
`;

const applyUpdatedAtTrigger = async (client, tableName) => {
  await client.query(`
    DROP TRIGGER IF EXISTS set_timestamp ON ${tableName};
    CREATE TRIGGER set_timestamp
    BEFORE UPDATE ON ${tableName}
    FOR EACH ROW
    EXECUTE PROCEDURE trigger_set_timestamp();
  `);
  console.log(`Applied "updated_at" trigger to "${tableName}" table.`);
};

const initializeDatabase = async () => {
  let client;
  try {
    client = await pool.connect();
    console.log('Successfully connected to the PostgreSQL database.');
    await client.query(createUpdatedAtTriggerFunction);
    console.log('Ensured "trigger_set_timestamp" function exists.');

    // Check if we need to migrate name to first_name and last_name
    const nameColumnExists = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'people' AND column_name = 'name'
    `);

    if (nameColumnExists.rows.length > 0) {
      console.log('Migrating name column to first_name and last_name...');
      
      // Add new columns if they don't exist
      await client.query(`
        ALTER TABLE people 
        ADD COLUMN IF NOT EXISTS first_name VARCHAR(255),
        ADD COLUMN IF NOT EXISTS last_name VARCHAR(255)
      `);
      
      // Migrate existing data
      await client.query(`
        UPDATE people 
        SET 
          first_name = SPLIT_PART(name, ' ', 1),
          last_name = CASE 
            WHEN ARRAY_LENGTH(STRING_TO_ARRAY(name, ' '), 1) > 1 
            THEN SUBSTRING(name FROM POSITION(' ' IN name) + 1)
            ELSE ''
          END
        WHERE first_name IS NULL OR last_name IS NULL
      `);
      
      // Drop the old name column
      await client.query(`ALTER TABLE people DROP COLUMN IF EXISTS name`);
      console.log('Migration completed successfully.');
    }

    await client.query(`
      CREATE TABLE IF NOT EXISTS people (
        id SERIAL PRIMARY KEY,
        first_name VARCHAR(255) NOT NULL,
        last_name VARCHAR(255),
        aliases TEXT[],
        date_of_birth DATE,
        category VARCHAR(100),
        status VARCHAR(100),
        crm_status VARCHAR(100),
        case_name VARCHAR(255),
        profile_picture_url TEXT,
        notes TEXT,
        osint_data JSONB DEFAULT '[]'::jsonb,
        attachments JSONB DEFAULT '[]'::jsonb,
        connections JSONB DEFAULT '[]'::jsonb,
        locations JSONB DEFAULT '[]'::jsonb,
        custom_fields JSONB DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('Checked/created "people" table.');
    await applyUpdatedAtTrigger(client, 'people');

    await client.query(`
      CREATE TABLE IF NOT EXISTS tools (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        link TEXT,
        description TEXT,
        category VARCHAR(100),
        status VARCHAR(50),
        tags TEXT[],
        notes TEXT,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('Checked/created "tools" table.');
    await applyUpdatedAtTrigger(client, 'tools');

    await client.query(`
      CREATE TABLE IF NOT EXISTS todos (
        id SERIAL PRIMARY KEY,
        text TEXT NOT NULL,
        status VARCHAR(50) DEFAULT 'open',
        last_update_comment TEXT,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('Checked/created "todos" table.');
    await applyUpdatedAtTrigger(client, 'todos');

    await client.query(`
      CREATE TABLE IF NOT EXISTS custom_person_fields (
        id SERIAL PRIMARY KEY,
        field_name VARCHAR(100) NOT NULL UNIQUE,
        field_label VARCHAR(255) NOT NULL,
        field_type VARCHAR(50) NOT NULL,
        options JSONB,
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('Checked/created "custom_person_fields" table.');
    await applyUpdatedAtTrigger(client, 'custom_person_fields');

    await client.query(`
      CREATE TABLE IF NOT EXISTS model_options (
        id SERIAL PRIMARY KEY,
        model_type VARCHAR(50) NOT NULL,
        option_value VARCHAR(255) NOT NULL,
        option_label VARCHAR(255),
        is_active BOOLEAN DEFAULT TRUE,
        display_order INTEGER DEFAULT 0,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(model_type, option_value)
      );
    `);
    console.log('Checked/created "model_options" table.');
    await applyUpdatedAtTrigger(client, 'model_options');

    // Insert default model options if they don't exist
    const defaultOptions = [
      // Categories
      { model_type: 'person_category', option_value: 'Person of Interest', option_label: 'Person of Interest', display_order: 1 },
      { model_type: 'person_category', option_value: 'Client', option_label: 'Client', display_order: 2 },
      { model_type: 'person_category', option_value: 'Witness', option_label: 'Witness', display_order: 3 },
      { model_type: 'person_category', option_value: 'Victim', option_label: 'Victim', display_order: 4 },
      { model_type: 'person_category', option_value: 'Suspect', option_label: 'Suspect', display_order: 5 },
      { model_type: 'person_category', option_value: 'Related to Person of Interest', option_label: 'Related to Person of Interest', display_order: 6 },
      { model_type: 'person_category', option_value: 'Other', option_label: 'Other', display_order: 7 },
      
      // Statuses
      { model_type: 'person_status', option_value: 'Open', option_label: 'Open', display_order: 1 },
      { model_type: 'person_status', option_value: 'Being Investigated', option_label: 'Being Investigated', display_order: 2 },
      { model_type: 'person_status', option_value: 'Closed', option_label: 'Closed', display_order: 3 },
      { model_type: 'person_status', option_value: 'On Hold', option_label: 'On Hold', display_order: 4 },
      
      // CRM Statuses
      { model_type: 'crm_status', option_value: 'new_lead', option_label: 'New Lead', display_order: 1 },
      { model_type: 'crm_status', option_value: 'attempted_engage', option_label: 'Attempted to Engage', display_order: 2 },
      { model_type: 'crm_status', option_value: 'engaged', option_label: 'Engaged', display_order: 3 },
      { model_type: 'crm_status', option_value: 'qualified', option_label: 'Qualified', display_order: 4 },
      { model_type: 'crm_status', option_value: 'follow_up', option_label: 'Follow Up', display_order: 5 },
      { model_type: 'crm_status', option_value: 'archived', option_label: 'Archived', display_order: 6 },
      { model_type: 'crm_status', option_value: 'active', option_label: 'Active', display_order: 7 },
      { model_type: 'crm_status', option_value: 'awaiting_response', option_label: 'Awaiting Response', display_order: 8 },
      
      // Task Statuses
      { model_type: 'task_status', option_value: 'open', option_label: 'Open', display_order: 1 },
      { model_type: 'task_status', option_value: 'in_progress', option_label: 'In Progress', display_order: 2 },
      { model_type: 'task_status', option_value: 'on_hold', option_label: 'On Hold', display_order: 3 },
      { model_type: 'task_status', option_value: 'attention', option_label: 'Attention / Issue', display_order: 4 },
      { model_type: 'task_status', option_value: 'done', option_label: 'Done', display_order: 5 },
      { model_type: 'task_status', option_value: 'cancelled', option_label: 'Cancelled', display_order: 6 },
      
      // Connection Types
      { model_type: 'connection_type', option_value: 'family', option_label: 'Family', display_order: 1 },
      { model_type: 'connection_type', option_value: 'friend', option_label: 'Friend', display_order: 2 },
      { model_type: 'connection_type', option_value: 'enemy', option_label: 'Enemy', display_order: 3 },
      { model_type: 'connection_type', option_value: 'associate', option_label: 'Associate', display_order: 4 },
      { model_type: 'connection_type', option_value: 'employer', option_label: 'Employer/Employee', display_order: 5 },
      { model_type: 'connection_type', option_value: 'suspect', option_label: 'Suspect Connection', display_order: 6 },
      { model_type: 'connection_type', option_value: 'witness', option_label: 'Witness', display_order: 7 },
      { model_type: 'connection_type', option_value: 'victim', option_label: 'Victim', display_order: 8 },
      { model_type: 'connection_type', option_value: 'other', option_label: 'Other', display_order: 9 },
      
      // Location Types
      { model_type: 'location_type', option_value: 'primary_residence', option_label: 'Primary Residence', display_order: 1 },
      { model_type: 'location_type', option_value: 'holiday_home', option_label: 'Holiday Home', display_order: 2 },
      { model_type: 'location_type', option_value: 'work', option_label: 'Work', display_order: 3 },
      { model_type: 'location_type', option_value: 'favorite_hotel', option_label: 'Favorite Hotel', display_order: 4 },
      { model_type: 'location_type', option_value: 'yacht_location', option_label: 'Yacht Location', display_order: 5 },
      { model_type: 'location_type', option_value: 'other', option_label: 'Other', display_order: 6 }
    ];

    for (const option of defaultOptions) {
      await client.query(`
        INSERT INTO model_options (model_type, option_value, option_label, display_order)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (model_type, option_value) DO NOTHING
      `, [option.model_type, option.option_value, option.option_label, option.display_order]);
    }
    console.log('Ensured default model options exist.');

    await client.query(`
      CREATE TABLE IF NOT EXISTS audit_logs (
        id SERIAL PRIMARY KEY,
        entity_type VARCHAR(50) NOT NULL,
        entity_id INTEGER NOT NULL,
        field_name VARCHAR(100),
        old_value TEXT,
        new_value TEXT,
        action VARCHAR(50) NOT NULL,
        user_id INTEGER,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('Checked/created "audit_logs" table.');

    await client.query(`
      CREATE TABLE IF NOT EXISTS cases (
        id SERIAL PRIMARY KEY,
        case_name VARCHAR(255) NOT NULL UNIQUE,
        description TEXT,
        status VARCHAR(50) DEFAULT 'active',
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('Checked/created "cases" table.');
    await applyUpdatedAtTrigger(client, 'cases');

    // Create travel_history table for detailed travel tracking
    await client.query(`
      CREATE TABLE IF NOT EXISTS travel_history (
        id SERIAL PRIMARY KEY,
        person_id INTEGER NOT NULL REFERENCES people(id) ON DELETE CASCADE,
        location_type VARCHAR(50),
        location_name VARCHAR(255),
        address TEXT,
        city VARCHAR(100),
        state VARCHAR(100),
        country VARCHAR(100),
        postal_code VARCHAR(20),
        latitude DECIMAL(10, 8),
        longitude DECIMAL(11, 8),
        arrival_date TIMESTAMPTZ,
        departure_date TIMESTAMPTZ,
        purpose VARCHAR(100),
        transportation_mode VARCHAR(50),
        notes TEXT,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('Checked/created "travel_history" table.');
    await applyUpdatedAtTrigger(client, 'travel_history');

    // Add indexes for better query performance
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_travel_history_person_id ON travel_history(person_id);
      CREATE INDEX IF NOT EXISTS idx_travel_history_dates ON travel_history(arrival_date, departure_date);
      CREATE INDEX IF NOT EXISTS idx_travel_history_location ON travel_history(country, city);
    `);

  } catch (err) {
    console.error('Error during database initialization:', err.stack);
    process.exit(1);
  } finally {
    if (client) {
      client.release();
    }
  }
};

initializeDatabase().then(() => {
  // Initialize improved geocoding service after database is ready
  improvedGeocodingService = new ImprovedGeocodingService(pool);
  console.log('Improved geocoding service initialized');
});

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use('/public', express.static(path.join(__dirname, 'public')));

// Audit logging middleware
const logAudit = async (entityType, entityId, action, changes = {}) => {
  try {
    const client = await pool.connect();
    
    for (const [fieldName, { oldValue, newValue }] of Object.entries(changes)) {
      await client.query(`
        INSERT INTO audit_logs (entity_type, entity_id, field_name, old_value, new_value, action)
        VALUES ($1, $2, $3, $4, $5, $6)
      `, [entityType, entityId, fieldName, oldValue?.toString() || null, newValue?.toString() || null, action]);
    }
    
    client.release();
  } catch (err) {
    console.error('Error logging audit:', err);
  }
};

app.get('/api', (req, res) => {
  res.json({ message: "Hello from the OSINT CRM Backend!" });
});

app.post('/api/upload/logo', logoUpload.single('appLogo'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded or file type incorrect.' });
  }
  const logoUrl = `/public/uploads/logos/${req.file.filename}`;
  res.json({ message: 'Logo uploaded successfully!', logoUrl: logoUrl });
});

// Universal search endpoint
app.get('/api/search', async (req, res) => {
  const { q } = req.query;
  if (!q || q.length < 2) {
    return res.json({ people: [], tools: [] });
  }

  try {
    const searchTerm = `%${q.toLowerCase()}%`;
    
    const peopleQuery = `
      SELECT id, first_name, last_name, category, case_name 
      FROM people 
      WHERE LOWER(first_name) LIKE $1 
         OR LOWER(last_name) LIKE $1 
         OR LOWER(CONCAT(first_name, ' ', last_name)) LIKE $1
         OR EXISTS (SELECT 1 FROM unnest(aliases) AS alias WHERE LOWER(alias) LIKE $1)
         OR LOWER(case_name) LIKE $1
      LIMIT 10
    `;
    
    const toolsQuery = `
      SELECT id, name, category, description 
      FROM tools 
      WHERE LOWER(name) LIKE $1 
         OR LOWER(description) LIKE $1
         OR EXISTS (SELECT 1 FROM unnest(tags) AS tag WHERE LOWER(tag) LIKE $1)
      LIMIT 10
    `;
    
    const [peopleResult, toolsResult] = await Promise.all([
      pool.query(peopleQuery, [searchTerm]),
      pool.query(toolsQuery, [searchTerm])
    ]);
    
    res.json({
      people: peopleResult.rows,
      tools: toolsResult.rows
    });
  } catch (err) {
    console.error('Error in universal search:', err);
    res.status(500).json({ error: 'Search failed' });
  }
});

// Advanced search endpoint
app.get('/api/search/advanced', async (req, res) => {
  try {
    let query = 'SELECT * FROM people WHERE 1=1';
    const queryParams = [];
    let paramCount = 0;

    // Text search
    if (req.query.searchText) {
      const searchConditions = [];
      const searchFields = req.query['searchIn[]'] || ['name'];
      
      if (searchFields.includes('name')) {
        searchConditions.push(`(LOWER(first_name) LIKE $${++paramCount} OR LOWER(last_name) LIKE $${paramCount} OR LOWER(CONCAT(first_name, ' ', last_name)) LIKE $${paramCount})`);
        queryParams.push(`%${req.query.searchText.toLowerCase()}%`);
      }
      
      if (searchFields.includes('aliases')) {
        searchConditions.push(`EXISTS (SELECT 1 FROM unnest(aliases) AS alias WHERE LOWER(alias) LIKE $${++paramCount})`);
        queryParams.push(`%${req.query.searchText.toLowerCase()}%`);
      }
      
      if (searchFields.includes('notes')) {
        searchConditions.push(`LOWER(notes) LIKE $${++paramCount}`);
        queryParams.push(`%${req.query.searchText.toLowerCase()}%`);
      }
      
      if (searchConditions.length > 0) {
        query += ` AND (${searchConditions.join(' OR ')})`;
      }
    }

    // Category filter
    if (req.query['categories[]']) {
      const categories = Array.isArray(req.query['categories[]']) 
        ? req.query['categories[]'] 
        : [req.query['categories[]']];
      
      const placeholders = categories.map(() => `$${++paramCount}`).join(',');
      query += ` AND category IN (${placeholders})`;
      queryParams.push(...categories);
    }

    // Status filter
    if (req.query['statuses[]']) {
      const statuses = Array.isArray(req.query['statuses[]']) 
        ? req.query['statuses[]'] 
        : [req.query['statuses[]']];
      
      const placeholders = statuses.map(() => `$${++paramCount}`).join(',');
      query += ` AND status IN (${placeholders})`;
      queryParams.push(...statuses);
    }

    // Date filters
    if (req.query.dateFrom && req.query.dateFilter !== 'all') {
      const dateField = req.query.dateFilter === 'created' ? 'created_at' : 'updated_at';
      query += ` AND ${dateField} >= $${++paramCount}`;
      queryParams.push(req.query.dateFrom);
    }
    
    if (req.query.dateTo && req.query.dateFilter !== 'all') {
      const dateField = req.query.dateFilter === 'created' ? 'created_at' : 'updated_at';
      query += ` AND ${dateField} <= $${++paramCount}`;
      queryParams.push(req.query.dateTo);
    }

    // Sorting
    const sortBy = req.query.sortBy || 'updated_at';
    const sortOrder = req.query.sortOrder === 'asc' ? 'ASC' : 'DESC';
    query += ` ORDER BY ${sortBy} ${sortOrder}`;

    const result = await pool.query(query, queryParams);
    res.json(result.rows);
  } catch (error) {
    console.error('Error in advanced search:', error);
    res.status(500).json({ error: 'Search failed' });
  }
});

// Cases endpoints
app.get('/api/cases', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM cases ORDER BY case_name ASC');
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching cases:', err);
    res.status(500).json({ error: 'Failed to fetch cases' });
  }
});

app.post('/api/cases', async (req, res) => {
  const { case_name, description } = req.body;
  if (!case_name) return res.status(400).json({ error: 'Case name is required' });
  
  try {
    const result = await pool.query(
      'INSERT INTO cases (case_name, description) VALUES ($1, $2) RETURNING *',
      [case_name, description || null]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Case name already exists' });
    }
    console.error('Error creating case:', err);
    res.status(500).json({ error: 'Failed to create case' });
  }
});

// Update case endpoint
app.put('/api/cases/:id', async (req, res) => {
  const caseId = parseInt(req.params.id, 10);
  const { case_name, description, status } = req.body;
  
  if (isNaN(caseId)) return res.status(400).json({ error: 'Invalid case ID' });
  
  try {
    const result = await pool.query(
      'UPDATE cases SET case_name = $1, description = $2, status = $3 WHERE id = $4 RETURNING *',
      [case_name, description, status, caseId]
    );
    
    if (result.rows.length === 0) return res.status(404).json({ error: 'Case not found' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error updating case:', err);
    res.status(500).json({ error: 'Failed to update case' });
  }
});

// Delete case endpoint
app.delete('/api/cases/:id', async (req, res) => {
  const caseId = parseInt(req.params.id, 10);
  if (isNaN(caseId)) return res.status(400).json({ error: 'Invalid case ID' });
  
  try {
    const result = await pool.query('DELETE FROM cases WHERE id = $1 RETURNING *', [caseId]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Case not found' });
    res.json({ message: 'Case deleted successfully', deletedCase: result.rows[0] });
  } catch (err) {
    console.error('Error deleting case:', err);
    res.status(500).json({ error: 'Failed to delete case' });
  }
});

// People endpoints with audit logging
app.get('/api/people', async (req, res) => {
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

app.post('/api/people', async (req, res) => {
  const { firstName, lastName, aliases, dateOfBirth, category, status, crmStatus, caseName, profilePictureUrl, notes, osintData, attachments, connections, locations, custom_fields } = req.body;
  if (!firstName) return res.status(400).json({ error: 'First name is required' });
  
  // Geocode locations before saving using improved service if available
  let geocodedLocations = locations || [];
  if (geocodedLocations.length > 0) {
    const locationsToGeocode = geocodedLocations.filter(
      loc => (!loc.latitude || !loc.longitude) && (loc.address || loc.city || loc.country)
    );
    
    if (locationsToGeocode.length > 0) {
      console.log(`Geocoding ${locationsToGeocode.length} locations for new person`);
      
      // Use improved geocoding service if available, fallback to original
      if (improvedGeocodingService) {
        const geocoded = await improvedGeocodingService.batchGeocode(locationsToGeocode, {
          minConfidence: 30,
          maxConcurrent: 3
        });
        geocodedLocations = geocoded;
      } else {
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
    JSON.stringify(geocodedLocations), // Use geocoded locations
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

app.put('/api/people/:id', async (req, res) => {
  const personId = parseInt(req.params.id, 10);
  const { firstName, lastName, aliases, dateOfBirth, category, status, crmStatus, caseName, profilePictureUrl, notes, osintData, attachments, connections, locations, custom_fields } = req.body;
  
  if (isNaN(personId)) return res.status(400).json({ error: 'Invalid person ID' });
  if (!firstName) return res.status(400).json({ error: 'First name is required for update' });
  
  try {
    // Get old values for audit
    const oldResult = await pool.query('SELECT * FROM people WHERE id = $1', [personId]);
    if (oldResult.rows.length === 0) return res.status(404).json({ error: 'Person not found' });
    const oldPerson = oldResult.rows[0];
    
    // Geocode any locations that don't have coordinates using improved service if available
    let geocodedLocations = locations || [];
    if (geocodedLocations.length > 0) {
      const locationsToGeocode = geocodedLocations.filter(
        loc => (!loc.latitude || !loc.longitude) && (loc.address || loc.city || loc.country)
      );
      
      if (locationsToGeocode.length > 0) {
        console.log(`Geocoding ${locationsToGeocode.length} locations for person ${personId}`);
        
        // Use improved geocoding service if available, fallback to original
        if (improvedGeocodingService) {
          const geocoded = await improvedGeocodingService.batchGeocode(locationsToGeocode, {
            minConfidence: 30,
            maxConcurrent: 3
          });
          geocodedLocations = geocoded;
        } else {
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
      JSON.stringify(geocodedLocations), // Use geocoded locations
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

app.delete('/api/people/:id', async (req, res) => {
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

// Get all locations for map view with progressive loading and optimizations
app.get('/api/locations', async (req, res) => {
  try {
    const { 
      limit = 100, 
      offset = 0, 
      bbox, // bounding box: "minLng,minLat,maxLng,maxLat"
      confidence = 30, // minimum geocoding confidence
      includeUngeocoded = false 
    } = req.query;
    
    let query = `
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
      WHERE p.locations IS NOT NULL AND p.locations != '[]'::jsonb
    `;
    
    const params = [];
    let paramIndex = 1;
    
    // Add bounding box filter if provided
    if (bbox) {
      const [minLng, minLat, maxLng, maxLat] = bbox.split(',').map(Number);
      query += ` AND EXISTS (
        SELECT 1 FROM jsonb_array_elements(p.locations) AS loc
        WHERE (loc->>'latitude')::float BETWEEN $${paramIndex++} AND $${paramIndex++}
        AND (loc->>'longitude')::float BETWEEN $${paramIndex++} AND $${paramIndex++}
      )`;
      params.push(minLat, maxLat, minLng, maxLng);
    }
    
    // Filter by geocoding confidence if specified
    if (!includeUngeocoded && confidence > 0) {
      query += ` AND EXISTS (
        SELECT 1 FROM jsonb_array_elements(p.locations) AS loc
        WHERE (loc->>'latitude') IS NOT NULL 
        AND (loc->>'longitude') IS NOT NULL
        AND COALESCE((loc->>'geocode_confidence')::int, 0) >= $${paramIndex++}
      )`;
      params.push(confidence);
    }
    
    // Add ordering and pagination
    query += ` ORDER BY p.updated_at DESC`;
    query += ` LIMIT $${paramIndex++} OFFSET $${paramIndex++}`;
    params.push(parseInt(limit), parseInt(offset));
    
    const result = await pool.query(query, params);
    
    // Process locations to add enhanced geocoding metadata
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
    
    // Get total count for pagination
    const countQuery = `
      SELECT COUNT(*) as total
      FROM people p
      WHERE p.locations IS NOT NULL AND p.locations != '[]'::jsonb
    `;
    const countResult = await pool.query(countQuery);
    
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

// Travel History endpoints
app.get('/api/people/:id/travel-history', async (req, res) => {
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

app.post('/api/people/:id/travel-history', async (req, res) => {
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

// Batch geocode all locations missing coordinates
app.post('/api/geocode/batch', async (req, res) => {
  try {
    // Get all people with locations
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
      
      if (needsGeocoding) {
        console.log(`Geocoding locations for person ${person.id}`);
        const geocodedLocations = await batchGeocode(locations);
        
        // Count successes
        const geocodedCount = geocodedLocations.filter(
          loc => loc.latitude && loc.longitude
        ).length - locations.filter(
          loc => loc.latitude && loc.longitude
        ).length;
        
        totalGeocoded += geocodedCount;
        
        // Update the person's locations
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

// Improved geocoding endpoints

// Get address suggestions for autocomplete
app.get('/api/geocode/suggestions', async (req, res) => {
  const { q, limit = 5 } = req.query;
  
  if (!q || q.length < 3) {
    return res.json([]);
  }
  
  try {
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
app.post('/api/geocode/address', async (req, res) => {
  const { address, minConfidence = 30 } = req.body;
  
  if (!address) {
    return res.status(400).json({ error: 'Address is required' });
  }
  
  try {
    if (!improvedGeocodingService) {
      return res.status(503).json({ error: 'Geocoding service not initialized' });
    }
    
    const result = await improvedGeocodingService.geocodeAddress(address, { minConfidence });
    
    if (result) {
      res.json({
        success: true,
        result: result,
        cached: result.cached || false
      });
    } else {
      res.json({
        success: false,
        message: 'No results found or confidence too low'
      });
    }
  } catch (err) {
    console.error('Error geocoding address:', err);
    res.status(500).json({ error: 'Failed to geocode address' });
  }
});

// Enhanced batch geocoding with improved service
app.post('/api/geocode/batch-enhanced', async (req, res) => {
  const { locations, minConfidence = 30, maxConcurrent = 3 } = req.body;
  
  if (!locations || !Array.isArray(locations)) {
    return res.status(400).json({ error: 'Locations array is required' });
  }
  
  try {
    if (!improvedGeocodingService) {
      return res.status(503).json({ error: 'Geocoding service not initialized' });
    }
    
    const results = await improvedGeocodingService.batchGeocode(locations, {
      minConfidence,
      maxConcurrent
    });
    
    const summary = {
      total: results.length,
      geocoded: results.filter(r => r.latitude && r.longitude).length,
      cached: results.filter(r => r.geocoded_at && r.geocode_confidence > 0).length
    };
    
    res.json({
      results: results,
      summary: summary
    });
  } catch (err) {
    console.error('Error in enhanced batch geocoding:', err);
    res.status(500).json({ error: 'Enhanced batch geocoding failed' });
  }
});

// Get geocoding cache statistics
app.get('/api/geocode/stats', async (req, res) => {
  try {
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

app.put('/api/travel-history/:id', async (req, res) => {
  const travelId = parseInt(req.params.id, 10);
  if (isNaN(travelId)) return res.status(400).json({ error: 'Invalid travel ID' });
  
  const {
    location_type, location_name, address, city, state, country, postal_code,
    latitude, longitude, arrival_date, departure_date, purpose, transportation_mode, notes
  } = req.body;
  
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
       latitude, longitude, arrival_date, departure_date, purpose, transportation_mode, notes, travelId]
    );
    
    if (result.rows.length === 0) return res.status(404).json({ error: 'Travel record not found' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error updating travel history:', err);
    res.status(500).json({ error: 'Failed to update travel history' });
  }
});

app.delete('/api/travel-history/:id', async (req, res) => {
  const travelId = parseInt(req.params.id, 10);
  if (isNaN(travelId)) return res.status(400).json({ error: 'Invalid travel ID' });
  
  try {
    const result = await pool.query('DELETE FROM travel_history WHERE id = $1 RETURNING *', [travelId]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Travel record not found' });
    res.json({ message: 'Travel record deleted successfully' });
  } catch (err) {
    console.error('Error deleting travel history:', err);
    res.status(500).json({ error: 'Failed to delete travel history' });
  }
});

// Travel pattern analysis endpoint
app.get('/api/people/:id/travel-analysis', async (req, res) => {
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

// Tools endpoints
app.get('/api/tools', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM tools ORDER BY name ASC');
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching tools:', err.message);
    res.status(500).json({ error: 'Failed to fetch tools' });
  }
});

app.post('/api/tools', async (req, res) => {
  const { name, link, description, category, status, tags, notes } = req.body;
  if (!name) return res.status(400).json({ error: 'Tool name is required' });
  
  const query = `INSERT INTO tools (name, link, description, category, status, tags, notes) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *;`;
  const values = [name, link || null, description || null, category || null, status || null, tags || [], notes || null];
  
  try {
    const result = await pool.query(query, values);
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Error creating tool:', err.message);
    res.status(500).json({ error: 'Failed to create tool' });
  }
});

app.put('/api/tools/:id', async (req, res) => {
  const toolId = parseInt(req.params.id, 10);
  const { name, link, description, category, status, tags, notes } = req.body;
  
  if (isNaN(toolId)) return res.status(400).json({ error: 'Invalid tool ID' });
  if (!name) return res.status(400).json({ error: 'Tool name is required for update' });
  
  const query = `UPDATE tools SET name = $1, link = $2, description = $3, category = $4, status = $5, tags = $6, notes = $7 WHERE id = $8 RETURNING *;`;
  const values = [name, link || null, description || null, category || null, status || null, tags || [], notes || null, toolId];
  
  try {
    const result = await pool.query(query, values);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Tool not found' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error updating tool:', err.message);
    res.status(500).json({ error: 'Failed to update tool' });
  }
});

app.delete('/api/tools/:id', async (req, res) => {
  const toolId = parseInt(req.params.id, 10);
  if (isNaN(toolId)) return res.status(400).json({ error: 'Invalid tool ID' });
  
  try {
    const result = await pool.query('DELETE FROM tools WHERE id = $1 RETURNING *;', [toolId]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Tool not found' });
    res.status(200).json({ message: 'Tool deleted successfully', deletedTool: result.rows[0] });
  } catch (err) {
    console.error('Error deleting tool:', err.message);
    res.status(500).json({ error: 'Failed to delete tool' });
  }
});

// Todos endpoints
app.get('/api/todos', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM todos ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching todos:', err.message);
    res.status(500).json({ error: 'Failed to fetch todos' });
  }
});

app.post('/api/todos', async (req, res) => {
  const { text, status, last_update_comment } = req.body;
  if (!text) return res.status(400).json({ error: 'Todo text is required' });
  
  const query = `INSERT INTO todos (text, status, last_update_comment) VALUES ($1, $2, $3) RETURNING *;`;
  const values = [text, status || 'open', last_update_comment || null];
  
  try {
    const result = await pool.query(query, values);
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Error creating todo:', err.message);
    res.status(500).json({ error: 'Failed to create todo' });
  }
});

app.put('/api/todos/:id', async (req, res) => {
  const todoId = parseInt(req.params.id, 10);
  const { text, status, last_update_comment } = req.body;
  
  if (isNaN(todoId)) return res.status(400).json({ error: 'Invalid todo ID' });
  if (!text && status === undefined) return res.status(400).json({ error: 'Text or status is required for update' });
  
  const query = `UPDATE todos SET text = COALESCE($1, text), status = COALESCE($2, status), last_update_comment = $3 WHERE id = $4 RETURNING *;`;
  const values = [text, status, last_update_comment, todoId];
  
  try {
    const result = await pool.query(query, values);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Todo not found' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error updating todo:', err.message);
    res.status(500).json({ error: 'Failed to update todo' });
  }
});

app.delete('/api/todos/:id', async (req, res) => {
  const todoId = parseInt(req.params.id, 10);
  if (isNaN(todoId)) return res.status(400).json({ error: 'Invalid todo ID' });
  
  try {
    const result = await pool.query('DELETE FROM todos WHERE id = $1 RETURNING *;', [todoId]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Todo not found' });
    res.status(200).json({ message: 'Todo deleted successfully', deletedTodo: result.rows[0] });
  } catch (err) {
    console.error('Error deleting todo:', err.message);
    res.status(500).json({ error: 'Failed to delete todo' });
  }
});

// Custom fields endpoints
app.get('/api/settings/custom-fields', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM custom_person_fields ORDER BY field_label ASC');
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching custom fields definitions:', err.message, err.stack);
    res.status(500).json({ error: 'Failed to fetch custom fields definitions' });
  }
});

app.post('/api/settings/custom-fields', async (req, res) => {
  const { field_name, field_label, field_type, options, is_active } = req.body;
  if (!field_name || !field_label || !field_type) {
    return res.status(400).json({ error: 'field_name, field_label, and field_type are required' });
  }
  if (!/^[a-zA-Z0-9_]+$/.test(field_name)) {
    return res.status(400).json({ error: 'field_name can only contain alphanumeric characters and underscores.' });
  }
  
  const query = `INSERT INTO custom_person_fields (field_name, field_label, field_type, options, is_active) VALUES ($1, $2, $3, $4, $5) RETURNING *;`;
  const values = [field_name, field_label, field_type, JSON.stringify(options || []), is_active !== undefined ? is_active : true];
  
  try {
    const result = await pool.query(query, values);
    res.status(201).json(result.rows[0]);
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: `Custom field with name "${field_name}" already exists.` });
    }
    console.error('Error creating custom field definition:', err.message, err.stack);
    res.status(500).json({ error: 'Failed to create custom field definition' });
  }
});

app.put('/api/settings/custom-fields/:id', async (req, res) => {
  const fieldId = parseInt(req.params.id, 10);
  const { field_label, field_type, options, is_active } = req.body;
  
  if (isNaN(fieldId)) return res.status(400).json({ error: 'Invalid field ID' });
  if (!field_label || !field_type) {
    return res.status(400).json({ error: 'field_label and field_type are required for update' });
  }
  
  const query = `UPDATE custom_person_fields SET field_label = $1, field_type = $2, options = $3, is_active = $4 WHERE id = $5 RETURNING *;`;
  const values = [field_label, field_type, JSON.stringify(options || []), is_active !== undefined ? is_active : true, fieldId];
  
  try {
    const result = await pool.query(query, values);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Custom field definition not found' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error updating custom field definition:', err.message, err.stack);
    res.status(500).json({ error: 'Failed to update custom field definition' });
  }
});

app.delete('/api/settings/custom-fields/:id', async (req, res) => {
  const fieldId = parseInt(req.params.id, 10);
  if (isNaN(fieldId)) return res.status(400).json({ error: 'Invalid field ID' });
  
  try {
    const result = await pool.query('DELETE FROM custom_person_fields WHERE id = $1 RETURNING *;', [fieldId]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Custom field definition not found' });
    res.status(200).json({ message: 'Custom field definition deleted successfully', deletedField: result.rows[0] });
  } catch (err) {
    console.error('Error deleting custom field definition:', err.message, err.stack);
    res.status(500).json({ error: 'Failed to delete custom field definition' });
  }
});

// Model options endpoints
app.get('/api/settings/model-options', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM model_options ORDER BY model_type, display_order ASC');
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching model options:', err);
    res.status(500).json({ error: 'Failed to fetch model options' });
  }
});

app.post('/api/settings/model-options', async (req, res) => {
  const { model_type, option_value, option_label, display_order } = req.body;
  
  if (!model_type || !option_value || !option_label) {
    return res.status(400).json({ error: 'model_type, option_value, and option_label are required' });
  }
  
  try {
    const result = await pool.query(
      `INSERT INTO model_options (model_type, option_value, option_label, display_order) 
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [model_type, option_value, option_label, display_order || 999]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Option already exists' });
    }
    console.error('Error creating model option:', err);
    res.status(500).json({ error: 'Failed to create model option' });
  }
});

app.put('/api/settings/model-options/:id', async (req, res) => {
  const optionId = parseInt(req.params.id, 10);
  const { option_label, is_active, display_order } = req.body;
  
  if (isNaN(optionId)) return res.status(400).json({ error: 'Invalid option ID' });
  
  try {
    const result = await pool.query(
      `UPDATE model_options 
       SET option_label = COALESCE($1, option_label), 
           is_active = COALESCE($2, is_active),
           display_order = COALESCE($3, display_order)
       WHERE id = $4 RETURNING *`,
      [option_label, is_active, display_order, optionId]
    );
    
    if (result.rows.length === 0) return res.status(404).json({ error: 'Option not found' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error updating model option:', err);
    res.status(500).json({ error: 'Failed to update model option' });
  }
});

app.delete('/api/settings/model-options/:id', async (req, res) => {
  const optionId = parseInt(req.params.id, 10);
  if (isNaN(optionId)) return res.status(400).json({ error: 'Invalid option ID' });
  
  try {
    const result = await pool.query('DELETE FROM model_options WHERE id = $1 RETURNING *', [optionId]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Option not found' });
    res.json({ message: 'Option deleted successfully', deletedOption: result.rows[0] });
  } catch (err) {
    console.error('Error deleting model option:', err);
    res.status(500).json({ error: 'Failed to delete model option' });
  }
});

// Audit log endpoints
app.get('/api/audit-logs', async (req, res) => {
  const { entity_type, entity_id, limit = 100, offset = 0 } = req.query;
  
  try {
    let query = 'SELECT * FROM audit_logs WHERE 1=1';
    const params = [];
    let paramCount = 0;
    
    if (entity_type) {
      query += ` AND entity_type = $${++paramCount}`;
      params.push(entity_type);
    }
    
    if (entity_id) {
      query += ` AND entity_id = $${++paramCount}`;
      params.push(parseInt(entity_id));
    }
    
    query += ` ORDER BY created_at DESC LIMIT $${++paramCount} OFFSET $${++paramCount}`;
    params.push(parseInt(limit), parseInt(offset));
    
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching audit logs:', err);
    res.status(500).json({ error: 'Failed to fetch audit logs' });
  }
});

// Export/Import endpoints
app.get('/api/export', async (req, res) => {
  try {
    const [people, tools, todos, customFields, modelOptions, cases, travelHistory] = await Promise.all([
      pool.query('SELECT * FROM people'),
      pool.query('SELECT * FROM tools'),
      pool.query('SELECT * FROM todos'),
      pool.query('SELECT * FROM custom_person_fields'),
      pool.query('SELECT * FROM model_options'),
      pool.query('SELECT * FROM cases'),
      pool.query('SELECT * FROM travel_history')
    ]);
    
    const exportData = {
      version: '1.1',
      exportDate: new Date().toISOString(),
      data: {
        people: people.rows,
        tools: tools.rows,
        todos: todos.rows,
        customFields: customFields.rows,
        modelOptions: modelOptions.rows,
        cases: cases.rows,
        travelHistory: travelHistory.rows
      }
    };
    
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="osint-crm-export-${Date.now()}.json"`);
    res.json(exportData);
  } catch (err) {
    console.error('Error exporting data:', err);
    res.status(500).json({ error: 'Failed to export data' });
  }
});

app.post('/api/import', async (req, res) => {
  const importData = req.body;
  
  if (!importData || !importData.version || !importData.data) {
    return res.status(400).json({ error: 'Invalid import data format' });
  }
  
  const client = await pool.connect();
  
  // Helper function to ensure proper JSON formatting
  const ensureJSON = (data) => {
    if (data === null || data === undefined) return null;
    if (typeof data === 'string') {
      try {
        return JSON.parse(data);
      } catch (e) {
        return data;
      }
    }
    return data;
  };
  
  // Helper function to ensure proper JSON string for JSONB fields
  const toJSONString = (data) => {
    if (data === null || data === undefined) return '[]';
    if (typeof data === 'string') {
      try {
        JSON.parse(data);
        return data;
      } catch (e) {
        return JSON.stringify(data);
      }
    }
    return JSON.stringify(data);
  };
  
  try {
    await client.query('BEGIN');
    
    // Create a mapping for person IDs (old ID -> new ID)
    const personIdMapping = {};
    
    // Import in order to respect foreign key constraints
    if (importData.data.cases) {
      for (const caseItem of importData.data.cases) {
        await client.query(
          `INSERT INTO cases (case_name, description, status) 
           VALUES ($1, $2, $3) 
           ON CONFLICT (case_name) DO UPDATE 
           SET description = EXCLUDED.description, status = EXCLUDED.status`,
          [caseItem.case_name, caseItem.description, caseItem.status]
        );
      }
    }
    
    if (importData.data.customFields) {
      for (const field of importData.data.customFields) {
        // Ensure options is properly formatted JSON
        const optionsJSON = field.options ? toJSONString(field.options) : '[]';
        
        await client.query(
          `INSERT INTO custom_person_fields (field_name, field_label, field_type, options, is_active)
           VALUES ($1, $2, $3, $4::jsonb, $5)
           ON CONFLICT (field_name) DO UPDATE
           SET field_label = EXCLUDED.field_label, field_type = EXCLUDED.field_type, 
               options = EXCLUDED.options, is_active = EXCLUDED.is_active`,
          [field.field_name, field.field_label, field.field_type, optionsJSON, field.is_active]
        );
      }
    }
    
    if (importData.data.modelOptions) {
      for (const option of importData.data.modelOptions) {
        await client.query(
          `INSERT INTO model_options (model_type, option_value, option_label, is_active, display_order)
           VALUES ($1, $2, $3, $4, $5)
           ON CONFLICT (model_type, option_value) DO UPDATE
           SET option_label = EXCLUDED.option_label, is_active = EXCLUDED.is_active, 
               display_order = EXCLUDED.display_order`,
          [option.model_type, option.option_value, option.option_label, option.is_active, option.display_order]
        );
      }
    }
    
    if (importData.data.people) {
      for (const person of importData.data.people) {
        // Ensure all JSON fields are properly formatted
        const osintDataJSON = person.osint_data ? toJSONString(person.osint_data) : '[]';
        const attachmentsJSON = person.attachments ? toJSONString(person.attachments) : '[]';
        const connectionsJSON = person.connections ? toJSONString(person.connections) : '[]';
        const locationsJSON = person.locations ? toJSONString(person.locations) : '[]';
        const customFieldsJSON = person.custom_fields ? toJSONString(person.custom_fields) : '{}';
        
        const result = await client.query(
          `INSERT INTO people (first_name, last_name, aliases, date_of_birth, category, status, 
                               crm_status, case_name, profile_picture_url, notes, osint_data, 
                               attachments, connections, locations, custom_fields)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::jsonb, $12::jsonb, $13::jsonb, $14::jsonb, $15::jsonb)
           RETURNING id`,
          [person.first_name, person.last_name, person.aliases, person.date_of_birth, 
           person.category, person.status, person.crm_status, person.case_name, 
           person.profile_picture_url, person.notes, osintDataJSON, attachmentsJSON, 
           connectionsJSON, locationsJSON, customFieldsJSON]
        );
        
        // Map old ID to new ID
        if (person.id && result.rows[0]) {
          personIdMapping[person.id] = result.rows[0].id;
        }
      }
    }
    
    if (importData.data.tools) {
      for (const tool of importData.data.tools) {
        await client.query(
          `INSERT INTO tools (name, link, description, category, status, tags, notes)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [tool.name, tool.link, tool.description, tool.category, tool.status, tool.tags, tool.notes]
        );
      }
    }
    
    if (importData.data.todos) {
      for (const todo of importData.data.todos) {
        await client.query(
          `INSERT INTO todos (text, status, last_update_comment)
           VALUES ($1, $2, $3)`,
          [todo.text, todo.status, todo.last_update_comment]
        );
      }
    }
    
    if (importData.data.travelHistory) {
      for (const travel of importData.data.travelHistory) {
        // Map the old person_id to the new one
        const newPersonId = personIdMapping[travel.person_id];
        
        if (newPersonId) {
          await client.query(
            `INSERT INTO travel_history 
             (person_id, location_type, location_name, address, city, state, country, postal_code,
              latitude, longitude, arrival_date, departure_date, purpose, transportation_mode, notes)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)`,
            [newPersonId, travel.location_type, travel.location_name, travel.address, 
             travel.city, travel.state, travel.country, travel.postal_code,
             travel.latitude, travel.longitude, travel.arrival_date, travel.departure_date, 
             travel.purpose, travel.transportation_mode, travel.notes]
          );
        } else {
          console.warn(`Skipping travel history record with person_id ${travel.person_id} - person not found`);
        }
      }
    }
    
    // Now update the connections with the new person IDs
    if (importData.data.people) {
      for (const person of importData.data.people) {
        if (person.connections && person.connections.length > 0) {
          const newPersonId = personIdMapping[person.id];
          if (newPersonId) {
            // Update connections with new IDs
            const updatedConnections = person.connections.map(conn => ({
              ...conn,
              person_id: personIdMapping[conn.person_id] || conn.person_id
            }));
            
            await client.query(
              `UPDATE people SET connections = $1::jsonb WHERE id = $2`,
              [JSON.stringify(updatedConnections), newPersonId]
            );
          }
        }
      }
    }
    
    await client.query('COMMIT');
    res.json({ message: 'Data imported successfully' });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error importing data:', err);
    res.status(500).json({ error: 'Failed to import data: ' + err.message });
  } finally {
    client.release();
  }
});

// Docker control endpoints
let dockerLogs = [];
const MAX_LOG_ENTRIES = 1000;

app.get('/api/docker/status', async (req, res) => {
  try {
    const { stdout } = await execPromise('docker-compose ps --format json');
    const containers = stdout.split('\n').filter(line => line).map(line => JSON.parse(line));
    res.json({ status: 'running', containers });
  } catch (err) {
    res.json({ status: 'error', error: err.message });
  }
});

app.post('/api/docker/restart', async (req, res) => {
  try {
    await execPromise('docker-compose restart');
    dockerLogs.push({
      timestamp: new Date().toISOString(),
      level: 'info',
      message: 'Docker containers restarted'
    });
    res.json({ message: 'Containers restarted successfully' });
  } catch (err) {
    console.error('Error restarting containers:', err);
    res.status(500).json({ error: 'Failed to restart containers' });
  }
});

app.post('/api/docker/stop', async (req, res) => {
  try {
    await execPromise('docker-compose stop');
    dockerLogs.push({
      timestamp: new Date().toISOString(),
      level: 'info',
      message: 'Docker containers stopped'
    });
    res.json({ message: 'Containers stopped successfully' });
  } catch (err) {
    console.error('Error stopping containers:', err);
    res.status(500).json({ error: 'Failed to stop containers' });
  }
});

app.get('/api/docker/logs', async (req, res) => {
  try {
    const { stdout } = await execPromise('docker-compose logs --tail=100 --no-color');
    const logs = stdout.split('\n').map(line => ({
      timestamp: new Date().toISOString(),
      message: line
    }));
    res.json(logs);
  } catch (err) {
    res.json([]);
  }
});

// Businesses endpoints
app.get('/api/businesses', async (req, res) => {
  try {
    // For now, return empty array - businesses feature needs to be implemented
    res.json([]);
  } catch (err) {
    console.error('Error fetching businesses:', err);
    res.status(500).json({ error: 'Failed to fetch businesses' });
  }
});

app.post('/api/businesses', async (req, res) => {
  try {
    // Placeholder for business creation
    res.status(501).json({ error: 'Business creation not yet implemented' });
  } catch (err) {
    console.error('Error creating business:', err);
    res.status(500).json({ error: 'Failed to create business' });
  }
});

// Entity relationships endpoints
app.get('/api/entity-relationships', async (req, res) => {
  try {
    // Extract relationships from people connections
    const peopleResult = await pool.query(`
      SELECT id, first_name, last_name, connections 
      FROM people 
      WHERE connections IS NOT NULL AND connections != '[]'::jsonb
    `);
    
    const relationships = [];
    
    peopleResult.rows.forEach(person => {
      const connections = person.connections || [];
      connections.forEach(connection => {
        relationships.push({
          id: `${person.id}-${connection.person_id}-${connection.type}`,
          source_type: 'person',
          source_id: person.id,
          target_type: 'person',
          target_id: connection.person_id,
          relationship_type: connection.type,
          note: connection.note,
          confidence_score: 90 // Default confidence
        });
      });
    });
    
    res.json(relationships);
  } catch (err) {
    console.error('Error fetching entity relationships:', err);
    res.status(500).json({ error: 'Failed to fetch entity relationships' });
  }
});

app.post('/api/entity-relationships', async (req, res) => {
  try {
    const { source_type, source_id, target_type, target_id, relationship_type, note } = req.body;
    
    if (source_type === 'person' && target_type === 'person') {
      // Get the source person
      const sourceResult = await pool.query('SELECT * FROM people WHERE id = $1', [source_id]);
      if (sourceResult.rows.length === 0) {
        return res.status(404).json({ error: 'Source person not found' });
      }
      
      const sourcePerson = sourceResult.rows[0];
      const connections = sourcePerson.connections || [];
      
      // Check if connection already exists
      const existingIndex = connections.findIndex(c => c.person_id === target_id);
      
      if (existingIndex >= 0) {
        // Update existing connection
        connections[existingIndex] = { person_id: target_id, type: relationship_type, note };
      } else {
        // Add new connection
        connections.push({ person_id: target_id, type: relationship_type, note });
      }
      
      // Update the person's connections
      await pool.query(
        'UPDATE people SET connections = $1 WHERE id = $2',
        [JSON.stringify(connections), source_id]
      );
      
      res.status(201).json({ message: 'Relationship created successfully' });
    } else {
      res.status(501).json({ error: 'Only person-to-person relationships are currently supported' });
    }
  } catch (err) {
    console.error('Error creating entity relationship:', err);
    res.status(500).json({ error: 'Failed to create entity relationship' });
  }
});

app.delete('/api/entity-relationships/:id', async (req, res) => {
  try {
    // Parse the relationship ID to extract source_id, target_id, and type
    const parts = req.params.id.split('-');
    if (parts.length < 3) {
      return res.status(400).json({ error: 'Invalid relationship ID format' });
    }
    
    const source_id = parseInt(parts[0]);
    const target_id = parseInt(parts[1]);
    const relationship_type = parts.slice(2).join('-');
    
    // Get the source person
    const sourceResult = await pool.query('SELECT * FROM people WHERE id = $1', [source_id]);
    if (sourceResult.rows.length === 0) {
      return res.status(404).json({ error: 'Source person not found' });
    }
    
    const sourcePerson = sourceResult.rows[0];
    const connections = sourcePerson.connections || [];
    
    // Remove the connection
    const updatedConnections = connections.filter(c => 
      !(c.person_id === target_id && c.type === relationship_type)
    );
    
    // Update the person's connections
    await pool.query(
      'UPDATE people SET connections = $1 WHERE id = $2',
      [JSON.stringify(updatedConnections), source_id]
    );
    
    res.json({ message: 'Relationship deleted successfully' });
  } catch (err) {
    console.error('Error deleting entity relationship:', err);
    res.status(500).json({ error: 'Failed to delete entity relationship' });
  }
});

// Relationship types endpoint
app.get('/api/relationship-types', async (req, res) => {
  try {
    // Get relationship types from model_options
    const result = await pool.query(`
      SELECT option_value as value, option_label as label
      FROM model_options 
      WHERE model_type = 'connection_type' AND is_active = true
      ORDER BY display_order
    `);
    
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching relationship types:', err);
    res.status(500).json({ error: 'Failed to fetch relationship types' });
  }
});

// Entity network endpoint - builds a network graph from people and their connections
app.get('/api/entity-network', async (req, res) => {
  try {
    const { entity_type, entity_id } = req.query;
    
    // Get all people with their connections
    const peopleQuery = `
      SELECT id, first_name, last_name, category, status, case_name, 
             profile_picture_url, connections, locations, created_at
      FROM people 
      ORDER BY created_at DESC
    `;
    
    const peopleResult = await pool.query(peopleQuery);
    const people = peopleResult.rows;
    
    const nodes = [];
    const edges = [];
    const nodeMap = new Map();
    
    // Create nodes for each person
    people.forEach(person => {
      const nodeId = `person-${person.id}`;
      const fullName = `${person.first_name} ${person.last_name || ''}`.trim();
      
      const node = {
        id: nodeId,
        type: 'person',
        data: {
          id: person.id,
          label: fullName,
          category: person.category,
          status: person.status,
          case_name: person.case_name,
          profile_picture_url: person.profile_picture_url,
          entity_type: 'person',
          entity_id: person.id
        },
        position: { x: 0, y: 0 }
      };
      
      nodes.push(node);
      nodeMap.set(nodeId, node);
    });
    
    // Create location nodes from person locations
    people.forEach(person => {
      const locations = person.locations || [];
      locations.forEach((location, index) => {
        if (location.city || location.country) {
          const locationId = `location-${person.id}-${index}`;
          const locationName = [location.city, location.country].filter(Boolean).join(', ');
          
          const locationNode = {
            id: locationId,
            type: 'location',
            data: {
              label: locationName,
              location_type: location.type,
              address: location.address,
              entity_type: 'location',
              latitude: location.latitude,
              longitude: location.longitude
            },
            position: { x: 0, y: 0 }
          };
          
          nodes.push(locationNode);
          
          // Create edge from person to location
          edges.push({
            id: `edge-person-${person.id}-to-${locationId}`,
            source: `person-${person.id}`,
            target: locationId,
            type: 'location',
            data: {
              relationship_type: 'located_at',
              confidence_score: 85
            }
          });
        }
      });
    });
    
    // Create edges from person connections
    people.forEach(person => {
      const connections = person.connections || [];
      connections.forEach(connection => {
        const targetNodeId = `person-${connection.person_id}`;
        
        // Only create edge if target node exists
        if (nodeMap.has(targetNodeId)) {
          const edgeId = `edge-person-${person.id}-to-person-${connection.person_id}`;
          
          edges.push({
            id: edgeId,
            source: `person-${person.id}`,
            target: targetNodeId,
            type: connection.type || 'associate',
            label: connection.note || connection.type,
            data: {
              relationship_type: connection.type,
              note: connection.note,
              confidence_score: 90
            }
          });
        }
      });
    });
    
    // If filtering by specific entity, return a subset focused on that entity
    if (entity_type && entity_id) {
      const focusNodeId = `${entity_type}-${entity_id}`;
      const focusNode = nodeMap.get(focusNodeId);
      
      if (focusNode) {
        // Get directly connected nodes
        const connectedNodeIds = new Set([focusNodeId]);
        
        edges.forEach(edge => {
          if (edge.source === focusNodeId) {
            connectedNodeIds.add(edge.target);
          } else if (edge.target === focusNodeId) {
            connectedNodeIds.add(edge.source);
          }
        });
        
        // Filter nodes and edges
        const filteredNodes = nodes.filter(node => connectedNodeIds.has(node.id));
        const filteredEdges = edges.filter(edge => 
          connectedNodeIds.has(edge.source) && connectedNodeIds.has(edge.target)
        );
        
        return res.json({ nodes: filteredNodes, edges: filteredEdges });
      }
    }
    
    res.json({ nodes, edges });
  } catch (err) {
    console.error('Error building entity network:', err);
    res.status(500).json({ error: 'Failed to build entity network' });
  }
});

app.listen(PORT, () => {
  console.log(`Backend server is running on http://localhost:${PORT}`);
});