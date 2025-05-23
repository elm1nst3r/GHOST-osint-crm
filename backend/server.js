// File: backend/server.js
const express = require('express');
const cors = require('cors');
const { Pool } = require('pg'); // PostgreSQL client
const path = require('path'); // For working with file paths
const fs = require('fs'); // For working with the file system
const multer = require('multer'); // For handling file uploads

const app = express();
const PORT = process.env.PORT || 3001;

// --- Multer Configuration for Logo Uploads ---
const LOGO_UPLOAD_DIR = path.join(__dirname, 'public', 'uploads', 'logos');
if (!fs.existsSync(LOGO_UPLOAD_DIR)) {
  fs.mkdirSync(LOGO_UPLOAD_DIR, { recursive: true });
  console.log(`Created logo upload directory: ${LOGO_UPLOAD_DIR}`);
} else {
  console.log(`Logo upload directory already exists: ${LOGO_UPLOAD_DIR}`);
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

    await client.query(`
      CREATE TABLE IF NOT EXISTS people (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
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

app.get('/api/people', async (req, res) => { try { const result = await pool.query('SELECT * FROM people ORDER BY created_at DESC'); res.json(result.rows); } catch (err) { console.error('Error fetching people:', err.message); res.status(500).json({ error: 'Failed to fetch people' }); }});
app.post('/api/people', async (req, res) => {
  const { name, aliases, dateOfBirth, category, status, crmStatus, caseName, profilePictureUrl, notes, osintData, attachments, connections, custom_fields } = req.body;
  if (!name) return res.status(400).json({ error: 'Name is required' });
  const query = `INSERT INTO people (name, aliases, date_of_birth, category, status, crm_status, case_name, profile_picture_url, notes, osint_data, attachments, connections, custom_fields) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13) RETURNING *;`;
  const values = [name, aliases || [], dateOfBirth || null, category || null, status || null, crmStatus || null, caseName || null, profilePictureUrl || null, notes || null, JSON.stringify(osintData || []), JSON.stringify(attachments || []), JSON.stringify(connections || []), JSON.stringify(custom_fields || {})];
  try {
    const result = await pool.query(query, values);
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Error creating person:', err.message, err.stack);
    res.status(500).json({ error: 'Failed to create person' });
  }
});
app.put('/api/people/:id', async (req, res) => {
  const personId = parseInt(req.params.id, 10);
  const { name, aliases, dateOfBirth, category, status, crmStatus, caseName, profilePictureUrl, notes, osintData, attachments, connections, custom_fields } = req.body;
  if (isNaN(personId)) return res.status(400).json({ error: 'Invalid person ID' });
  if (!name) return res.status(400).json({ error: 'Name is required for update' });
  const query = `UPDATE people SET name = $1, aliases = $2, date_of_birth = $3, category = $4, status = $5, crm_status = $6, case_name = $7, profile_picture_url = $8, notes = $9, osint_data = $10, attachments = $11, connections = $12, custom_fields = $13 WHERE id = $14 RETURNING *;`;
  const values = [name, aliases || [], dateOfBirth || null, category || null, status || null, crmStatus || null, caseName || null, profilePictureUrl || null, notes || null, JSON.stringify(osintData || []), JSON.stringify(attachments || []), JSON.stringify(connections || []), JSON.stringify(custom_fields || {}), personId];
  try {
    const result = await pool.query(query, values);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Person not found' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error updating person:', err.message, err.stack);
    res.status(500).json({ error: 'Failed to update person' });
  }
});
app.delete('/api/people/:id', async (req, res) => { const personId = parseInt(req.params.id, 10); if (isNaN(personId)) return res.status(400).json({ error: 'Invalid person ID' }); try { const result = await pool.query('DELETE FROM people WHERE id = $1 RETURNING *;', [personId]); if (result.rows.length === 0) return res.status(404).json({ error: 'Person not found' }); res.status(200).json({ message: 'Person deleted successfully', deletedPerson: result.rows[0] }); } catch (err) { console.error('Error deleting person:', err.message); res.status(500).json({ error: 'Failed to delete person' }); }});

// --- REMOVED People Map Data Endpoint ---
// app.get('/api/people/map-data', async (req, res) => { ... });
// --- END REMOVED ---

app.get('/api/tools', async (req, res) => { try { const result = await pool.query('SELECT * FROM tools ORDER BY name ASC'); res.json(result.rows); } catch (err) { console.error('Error fetching tools:', err.message); res.status(500).json({ error: 'Failed to fetch tools' }); }});
app.post('/api/tools', async (req, res) => { const { name, link, description, category, status, tags, notes } = req.body; if (!name) return res.status(400).json({ error: 'Tool name is required' }); const query = `INSERT INTO tools (name, link, description, category, status, tags, notes) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *;`; const values = [name, link || null, description || null, category || null, status || null, tags || [], notes || null]; try { const result = await pool.query(query, values); res.status(201).json(result.rows[0]); } catch (err) { console.error('Error creating tool:', err.message); res.status(500).json({ error: 'Failed to create tool' }); }});
app.put('/api/tools/:id', async (req, res) => { const toolId = parseInt(req.params.id, 10); const { name, link, description, category, status, tags, notes } = req.body; if (isNaN(toolId)) return res.status(400).json({ error: 'Invalid tool ID' }); if (!name) return res.status(400).json({ error: 'Tool name is required for update' }); const query = `UPDATE tools SET name = $1, link = $2, description = $3, category = $4, status = $5, tags = $6, notes = $7 WHERE id = $8 RETURNING *;`; const values = [name, link || null, description || null, category || null, status || null, tags || [], notes || null, toolId]; try { const result = await pool.query(query, values); if (result.rows.length === 0) return res.status(404).json({ error: 'Tool not found' }); res.json(result.rows[0]); } catch (err) { console.error('Error updating tool:', err.message); res.status(500).json({ error: 'Failed to update tool' }); }});
app.delete('/api/tools/:id', async (req, res) => { const toolId = parseInt(req.params.id, 10); if (isNaN(toolId)) return res.status(400).json({ error: 'Invalid tool ID' }); try { const result = await pool.query('DELETE FROM tools WHERE id = $1 RETURNING *;', [toolId]); if (result.rows.length === 0) return res.status(404).json({ error: 'Tool not found' }); res.status(200).json({ message: 'Tool deleted successfully', deletedTool: result.rows[0] }); } catch (err) { console.error('Error deleting tool:', err.message); res.status(500).json({ error: 'Failed to delete tool' }); }});

app.get('/api/todos', async (req, res) => { try { const result = await pool.query('SELECT * FROM todos ORDER BY created_at DESC'); res.json(result.rows); } catch (err) { console.error('Error fetching todos:', err.message); res.status(500).json({ error: 'Failed to fetch todos' }); }});
app.post('/api/todos', async (req, res) => { const { text, status, last_update_comment } = req.body; if (!text) return res.status(400).json({ error: 'Todo text is required' }); const query = `INSERT INTO todos (text, status, last_update_comment) VALUES ($1, $2, $3) RETURNING *;`; const values = [text, status || 'open', last_update_comment || null]; try { const result = await pool.query(query, values); res.status(201).json(result.rows[0]); } catch (err) { console.error('Error creating todo:', err.message); res.status(500).json({ error: 'Failed to create todo' }); }});
app.put('/api/todos/:id', async (req, res) => { const todoId = parseInt(req.params.id, 10); const { text, status, last_update_comment } = req.body; if (isNaN(todoId)) return res.status(400).json({ error: 'Invalid todo ID' }); if (!text && status === undefined) return res.status(400).json({ error: 'Text or status is required for update' }); const query = `UPDATE todos SET text = COALESCE($1, text), status = COALESCE($2, status), last_update_comment = $3 WHERE id = $4 RETURNING *;`; const values = [text, status, last_update_comment, todoId]; try { const result = await pool.query(query, values); if (result.rows.length === 0) return res.status(404).json({ error: 'Todo not found' }); res.json(result.rows[0]); } catch (err) { console.error('Error updating todo:', err.message); res.status(500).json({ error: 'Failed to update todo' }); }});
app.delete('/api/todos/:id', async (req, res) => { const todoId = parseInt(req.params.id, 10); if (isNaN(todoId)) return res.status(400).json({ error: 'Invalid todo ID' }); try { const result = await pool.query('DELETE FROM todos WHERE id = $1 RETURNING *;', [todoId]); if (result.rows.length === 0) return res.status(404).json({ error: 'Todo not found' }); res.status(200).json({ message: 'Todo deleted successfully', deletedTodo: result.rows[0] }); } catch (err) { console.error('Error deleting todo:', err.message); res.status(500).json({ error: 'Failed to delete todo' }); }});

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

app.listen(PORT, () => {
  console.log(`Backend server is running on http://localhost:${PORT}`);
});