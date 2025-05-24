// File: backend/server.js
const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const { exec } = require('child_process');
const util = require('util');
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

  } catch (err) {
    console.error('Error during database initialization:', err.stack);
    process.exit(1);
  } finally {
    if (client) {
      client.release();
    }
  }
};

initializeDatabase();

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
    JSON.stringify(locations || []),
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
      JSON.stringify(locations || []),
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
    if (oldPerson.crm_status !== crmStatus) changes.crm_status = { oldValue: oldPerson.crm_status, newValue: crmStatus };
    if (oldPerson.case_name !== caseName) changes.case_name = { oldValue: oldPerson.case_name, newValue: caseName };
    if (oldPerson.notes !== notes) changes.notes = { oldValue: oldPerson.notes, newValue: notes };
    
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

// Get all locations for map view
app.get('/api/locations', async (req, res) => {
  try {
    const query = `
      SELECT 
        p.id,
        p.first_name,
        p.last_name,
        p.case_name,
        p.category,
        p.locations,
        p.connections
      FROM people p
      WHERE p.locations IS NOT NULL AND p.locations != '[]'::jsonb
    `;
    
    const result = await pool.query(query);
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching locations:', err);
    res.status(500).json({ error: 'Failed to fetch locations' });
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
    const [people, tools, todos, customFields, modelOptions, cases] = await Promise.all([
      pool.query('SELECT * FROM people'),
      pool.query('SELECT * FROM tools'),
      pool.query('SELECT * FROM todos'),
      pool.query('SELECT * FROM custom_person_fields'),
      pool.query('SELECT * FROM model_options'),
      pool.query('SELECT * FROM cases')
    ]);
    
    const exportData = {
      version: '1.0',
      exportDate: new Date().toISOString(),
      data: {
        people: people.rows,
        tools: tools.rows,
        todos: todos.rows,
        customFields: customFields.rows,
        modelOptions: modelOptions.rows,
        cases: cases.rows
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
  const { data } = req.body;
  if (!data || !data.version) {
    return res.status(400).json({ error: 'Invalid import data format' });
  }
  
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    // Import in order to respect foreign key constraints
    if (data.data.cases) {
      for (const caseItem of data.data.cases) {
        await client.query(
          `INSERT INTO cases (case_name, description, status) 
           VALUES ($1, $2, $3) 
           ON CONFLICT (case_name) DO UPDATE 
           SET description = EXCLUDED.description, status = EXCLUDED.status`,
          [caseItem.case_name, caseItem.description, caseItem.status]
        );
      }
    }
    
    if (data.data.customFields) {
      for (const field of data.data.customFields) {
        await client.query(
          `INSERT INTO custom_person_fields (field_name, field_label, field_type, options, is_active)
           VALUES ($1, $2, $3, $4, $5)
           ON CONFLICT (field_name) DO UPDATE
           SET field_label = EXCLUDED.field_label, field_type = EXCLUDED.field_type, 
               options = EXCLUDED.options, is_active = EXCLUDED.is_active`,
          [field.field_name, field.field_label, field.field_type, field.options, field.is_active]
        );
      }
    }
    
    if (data.data.modelOptions) {
      for (const option of data.data.modelOptions) {
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
    
    if (data.data.people) {
      for (const person of data.data.people) {
        await client.query(
          `INSERT INTO people (first_name, last_name, aliases, date_of_birth, category, status, 
                               crm_status, case_name, profile_picture_url, notes, osint_data, 
                               attachments, connections, locations, custom_fields)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)`,
          [person.first_name, person.last_name, person.aliases, person.date_of_birth, 
           person.category, person.status, person.crm_status, person.case_name, 
           person.profile_picture_url, person.notes, person.osint_data, person.attachments, 
           person.connections, person.locations, person.custom_fields]
        );
      }
    }
    
    if (data.data.tools) {
      for (const tool of data.data.tools) {
        await client.query(
          `INSERT INTO tools (name, link, description, category, status, tags, notes)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [tool.name, tool.link, tool.description, tool.category, tool.status, tool.tags, tool.notes]
        );
      }
    }
    
    if (data.data.todos) {
      for (const todo of data.data.todos) {
        await client.query(
          `INSERT INTO todos (text, status, last_update_comment)
           VALUES ($1, $2, $3)`,
          [todo.text, todo.status, todo.last_update_comment]
        );
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

app.listen(PORT, () => {
  console.log(`Backend server is running on http://localhost:${PORT}`);
});