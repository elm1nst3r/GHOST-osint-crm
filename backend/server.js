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
// Ensure upload directory exists
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
    // Use a consistent filename for the logo, e.g., app-logo-[timestamp].ext
    // Or, always overwrite 'app-logo.png' if you only want one active logo.
    // For simplicity, let's use a timestamped unique name.
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

// Helper function to check file type
function checkFileType(file, filetypes, cb) {
  const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = filetypes.test(file.mimetype);
  if (mimetype && extname) {
    return cb(null, true);
  } else {
    cb('Error: Images Only (jpeg, jpg, png, gif, svg)!');
  }
}


// --- Database Configuration ---
const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'db',
  database: process.env.DB_NAME || 'osint_crm_db',
  password: process.env.DB_PASSWORD || 'changeme', // IMPORTANT: Use env var in production
  port: parseInt(process.env.DB_PORT || '5432', 10),
});

// Function to create/update the updated_at column automatically
const createUpdatedAtTriggerFunction = `
  CREATE OR REPLACE FUNCTION trigger_set_timestamp()
  RETURNS TRIGGER AS $$
  BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
  END;
  $$ LANGUAGE plpgsql;
`;

// Function to apply the trigger to a table
const applyUpdatedAtTrigger = async (client, tableName) => {
  // Ensure the function exists before trying to apply the trigger
  // This is now called once in initializeDatabase before any table creations
  await client.query(`
    DROP TRIGGER IF EXISTS set_timestamp ON ${tableName};
    CREATE TRIGGER set_timestamp
    BEFORE UPDATE ON ${tableName}
    FOR EACH ROW
    EXECUTE PROCEDURE trigger_set_timestamp();
  `);
  console.log(`Applied "updated_at" trigger to "${tableName}" table.`);
};


// Initialize Database: Create tables if they don't exist
const initializeDatabase = async () => {
  let client; // Declare client outside try block
  try {
    client = await pool.connect();
    console.log('Successfully connected to the PostgreSQL database.');

    // Create the trigger function once
    await client.query(createUpdatedAtTriggerFunction);
    console.log('Ensured "trigger_set_timestamp" function exists.');

    // Create people table
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
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('Checked/created "people" table.');
    await applyUpdatedAtTrigger(client, 'people');

    // Create tools table
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

    // Create todos table
    await client.query(`
      CREATE TABLE IF NOT EXISTS todos (
        id SERIAL PRIMARY KEY,
        text TEXT NOT NULL,
        status VARCHAR(50) DEFAULT 'open', -- 'open', 'done'
        last_update_comment TEXT,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('Checked/created "todos" table.');
    await applyUpdatedAtTrigger(client, 'todos');


  } catch (err) {
    console.error('Error during database initialization:', err.stack);
    process.exit(1); // Exit if DB init fails
  } finally {
    if (client) {
      client.release(); // Release the client back to the pool
    }
  }
};

initializeDatabase();

// --- Middleware ---
app.use(cors());
app.use(express.json({ limit: '10mb' })); // For parsing application/json, increased limit for potential image data later
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Serve static files from the 'public' directory (for uploads)
// This makes files in backend/public accessible via /public URL path
app.use('/public', express.static(path.join(__dirname, 'public')));


// --- API Routes ---
app.get('/api', (req, res) => {
  res.json({ message: "Hello from the OSINT CRM Backend (DB & Uploads Ready)!" });
});

// === Logo Upload Endpoint ===
app.post('/api/upload/logo', logoUpload.single('appLogo'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded or file type incorrect.' });
  }
  // Construct the URL path to the uploaded file
  const logoUrl = `/public/uploads/logos/${req.file.filename}`;
  res.json({ message: 'Logo uploaded successfully!', logoUrl: logoUrl });
});


// === People API Endpoints ===
app.get('/api/people', async (req, res) => { try { const result = await pool.query('SELECT * FROM people ORDER BY created_at DESC'); res.json(result.rows); } catch (err) { console.error('Error fetching people:', err.message); res.status(500).json({ error: 'Failed to fetch people' }); }});
app.post('/api/people', async (req, res) => { const { name, aliases, dateOfBirth, category, status, crmStatus, caseName, profilePictureUrl, notes, osintData, attachments, connections } = req.body; if (!name) return res.status(400).json({ error: 'Name is required' }); const query = `INSERT INTO people (name, aliases, date_of_birth, category, status, crm_status, case_name, profile_picture_url, notes, osint_data, attachments, connections) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) RETURNING *;`; const values = [name, aliases || [], dateOfBirth || null, category || null, status || null, crmStatus || null, caseName || null, profilePictureUrl || null, notes || null, JSON.stringify(osintData || []), JSON.stringify(attachments || []), JSON.stringify(connections || [])]; try { const result = await pool.query(query, values); res.status(201).json(result.rows[0]); } catch (err) { console.error('Error creating person:', err.message); res.status(500).json({ error: 'Failed to create person' }); }});
app.put('/api/people/:id', async (req, res) => { const personId = parseInt(req.params.id, 10); const { name, aliases, dateOfBirth, category, status, crmStatus, caseName, profilePictureUrl, notes, osintData, attachments, connections } = req.body; if (isNaN(personId)) return res.status(400).json({ error: 'Invalid person ID' }); if (!name) return res.status(400).json({ error: 'Name is required for update' }); const query = `UPDATE people SET name = $1, aliases = $2, date_of_birth = $3, category = $4, status = $5, crm_status = $6, case_name = $7, profile_picture_url = $8, notes = $9, osint_data = $10, attachments = $11, connections = $12 WHERE id = $13 RETURNING *;`; const values = [name, aliases || [], dateOfBirth || null, category || null, status || null, crmStatus || null, caseName || null, profilePictureUrl || null, notes || null, JSON.stringify(osintData || []), JSON.stringify(attachments || []), JSON.stringify(connections || []), personId]; try { const result = await pool.query(query, values); if (result.rows.length === 0) return res.status(404).json({ error: 'Person not found' }); res.json(result.rows[0]); } catch (err) { console.error('Error updating person:', err.message); res.status(500).json({ error: 'Failed to update person' }); }});
app.delete('/api/people/:id', async (req, res) => { const personId = parseInt(req.params.id, 10); if (isNaN(personId)) return res.status(400).json({ error: 'Invalid person ID' }); try { const result = await pool.query('DELETE FROM people WHERE id = $1 RETURNING *;', [personId]); if (result.rows.length === 0) return res.status(404).json({ error: 'Person not found' }); res.status(200).json({ message: 'Person deleted successfully', deletedPerson: result.rows[0] }); } catch (err) { console.error('Error deleting person:', err.message); res.status(500).json({ error: 'Failed to delete person' }); }});

// === Tools API Endpoints ===
app.get('/api/tools', async (req, res) => { try { const result = await pool.query('SELECT * FROM tools ORDER BY name ASC'); res.json(result.rows); } catch (err) { console.error('Error fetching tools:', err.message); res.status(500).json({ error: 'Failed to fetch tools' }); }});
app.post('/api/tools', async (req, res) => { const { name, link, description, category, status, tags, notes } = req.body; if (!name) return res.status(400).json({ error: 'Tool name is required' }); const query = `INSERT INTO tools (name, link, description, category, status, tags, notes) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *;`; const values = [name, link || null, description || null, category || null, status || null, tags || [], notes || null]; try { const result = await pool.query(query, values); res.status(201).json(result.rows[0]); } catch (err) { console.error('Error creating tool:', err.message); res.status(500).json({ error: 'Failed to create tool' }); }});
app.put('/api/tools/:id', async (req, res) => { const toolId = parseInt(req.params.id, 10); const { name, link, description, category, status, tags, notes } = req.body; if (isNaN(toolId)) return res.status(400).json({ error: 'Invalid tool ID' }); if (!name) return res.status(400).json({ error: 'Tool name is required for update' }); const query = `UPDATE tools SET name = $1, link = $2, description = $3, category = $4, status = $5, tags = $6, notes = $7 WHERE id = $8 RETURNING *;`; const values = [name, link || null, description || null, category || null, status || null, tags || [], notes || null, toolId]; try { const result = await pool.query(query, values); if (result.rows.length === 0) return res.status(404).json({ error: 'Tool not found' }); res.json(result.rows[0]); } catch (err) { console.error('Error updating tool:', err.message); res.status(500).json({ error: 'Failed to update tool' }); }});
app.delete('/api/tools/:id', async (req, res) => { const toolId = parseInt(req.params.id, 10); if (isNaN(toolId)) return res.status(400).json({ error: 'Invalid tool ID' }); try { const result = await pool.query('DELETE FROM tools WHERE id = $1 RETURNING *;', [toolId]); if (result.rows.length === 0) return res.status(404).json({ error: 'Tool not found' }); res.status(200).json({ message: 'Tool deleted successfully', deletedTool: result.rows[0] }); } catch (err) { console.error('Error deleting tool:', err.message); res.status(500).json({ error: 'Failed to delete tool' }); }});

// === To-Dos API Endpoints ===
app.get('/api/todos', async (req, res) => { try { const result = await pool.query('SELECT * FROM todos ORDER BY created_at DESC'); res.json(result.rows); } catch (err) { console.error('Error fetching todos:', err.message); res.status(500).json({ error: 'Failed to fetch todos' }); }});
app.post('/api/todos', async (req, res) => { const { text, status, last_update_comment } = req.body; if (!text) return res.status(400).json({ error: 'Todo text is required' }); const query = `INSERT INTO todos (text, status, last_update_comment) VALUES ($1, $2, $3) RETURNING *;`; const values = [text, status || 'open', last_update_comment || null]; try { const result = await pool.query(query, values); res.status(201).json(result.rows[0]); } catch (err) { console.error('Error creating todo:', err.message); res.status(500).json({ error: 'Failed to create todo' }); }});
app.put('/api/todos/:id', async (req, res) => { const todoId = parseInt(req.params.id, 10); const { text, status, last_update_comment } = req.body; if (isNaN(todoId)) return res.status(400).json({ error: 'Invalid todo ID' }); if (!text && status === undefined) return res.status(400).json({ error: 'Text or status is required for update' }); const query = `UPDATE todos SET text = COALESCE($1, text), status = COALESCE($2, status), last_update_comment = $3 WHERE id = $4 RETURNING *;`; const values = [text, status, last_update_comment, todoId]; try { const result = await pool.query(query, values); if (result.rows.length === 0) return res.status(404).json({ error: 'Todo not found' }); res.json(result.rows[0]); } catch (err) { console.error('Error updating todo:', err.message); res.status(500).json({ error: 'Failed to update todo' }); }});
app.delete('/api/todos/:id', async (req, res) => { const todoId = parseInt(req.params.id, 10); if (isNaN(todoId)) return res.status(400).json({ error: 'Invalid todo ID' }); try { const result = await pool.query('DELETE FROM todos WHERE id = $1 RETURNING *;', [todoId]); if (result.rows.length === 0) return res.status(404).json({ error: 'Todo not found' }); res.status(200).json({ message: 'Todo deleted successfully', deletedTodo: result.rows[0] }); } catch (err) { console.error('Error deleting todo:', err.message); res.status(500).json({ error: 'Failed to delete todo' }); }});

// --- Start Server ---
app.listen(PORT, () => {
  console.log(`Backend server is running on http://localhost:${PORT}`);
});
