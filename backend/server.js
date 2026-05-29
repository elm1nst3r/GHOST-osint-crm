// File: backend/server.js
const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const xml2js = require('xml2js');
const { exec } = require('child_process');
const util = require('util');
const session = require('express-session');
const pgSession = require('connect-pg-simple')(session);

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
    checkFileType(file, /jpeg|jpg|png|gif/, cb);
  }
});

function checkFileType(file, filetypes, cb) {
  const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = filetypes.test(file.mimetype);
  if (mimetype && extname) {
    return cb(null, true);
  } else {
    cb('Error: Images Only (jpeg, jpg, png, gif)!');
  }
}

// Validate critical environment variables — required in all environments
const requiredEnvVars = ['SESSION_SECRET'];
const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
if (missingVars.length > 0) {
  console.error('CRITICAL ERROR: Missing required environment variables:');
  missingVars.forEach(varName => console.error(`  - ${varName}`));
  process.exit(1);
}

if (process.env.SESSION_SECRET.length < 32) {
  console.error('CRITICAL ERROR: SESSION_SECRET must be at least 32 characters long.');
  process.exit(1);
}

// Additional production hardening checks
if (process.env.NODE_ENV === 'production') {
  if (!process.env.DB_PASSWORD) {
    console.error('CRITICAL ERROR: DB_PASSWORD is required in production.');
    process.exit(1);
  }

  const weakPasswords = ['changeme', 'password', 'admin', 'postgres', '12345678'];
  if (weakPasswords.includes(process.env.DB_PASSWORD.toLowerCase())) {
    console.error('CRITICAL ERROR: DB_PASSWORD is too weak for production use.');
    process.exit(1);
  }
}

if (process.env.NODE_ENV !== 'production') {
  if (!process.env.DB_PASSWORD || process.env.DB_PASSWORD === 'changeme') {
    console.warn('WARNING: Using default database password. Do NOT use in production.');
  }
}

const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'db',
  database: process.env.DB_NAME || 'osint_crm_db',
  password: process.env.DB_PASSWORD,
  port: parseInt(process.env.DB_PORT || '5432', 10),
});

// Expose pool on app.locals so middleware can access it without circular requires
app.locals.pool = pool;

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

    // Create indexes for people table
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_people_first_name ON people(first_name);
      CREATE INDEX IF NOT EXISTS idx_people_last_name ON people(last_name);
      CREATE INDEX IF NOT EXISTS idx_people_full_name ON people(first_name, last_name);
      CREATE INDEX IF NOT EXISTS idx_people_category ON people(category);
      CREATE INDEX IF NOT EXISTS idx_people_status ON people(status);
      CREATE INDEX IF NOT EXISTS idx_people_case_name ON people(case_name);
      CREATE INDEX IF NOT EXISTS idx_people_dob ON people(date_of_birth);
    `);
    console.log('Created indexes for "people" table.');

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

    // Create indexes for audit_logs table
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON audit_logs(entity_type, entity_id);
      CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
      CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
    `);
    console.log('Created indexes for "audit_logs" table.');

    // Create users table for authentication
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(100) NOT NULL UNIQUE,
        email VARCHAR(255) UNIQUE,
        password_hash VARCHAR(255) NOT NULL,
        first_name VARCHAR(100),
        last_name VARCHAR(100),
        role VARCHAR(20) NOT NULL DEFAULT 'user' CHECK (role IN ('admin', 'user')),
        is_active BOOLEAN DEFAULT TRUE,
        last_login TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('Checked/created "users" table.');
    await applyUpdatedAtTrigger(client, 'users');

    // Make email nullable for existing databases
    await client.query(`
      ALTER TABLE users ALTER COLUMN email DROP NOT NULL;
    `);
    console.log('Ensured email column is nullable in "users" table.');

    // Create indexes for users table
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
      CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
      CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
    `);
    console.log('Created indexes for "users" table.');

    // Add foreign key constraint to audit_logs after users table exists
    await client.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.table_constraints
          WHERE constraint_name = 'fk_audit_logs_user'
        ) THEN
          ALTER TABLE audit_logs
            ADD CONSTRAINT fk_audit_logs_user
            FOREIGN KEY (user_id)
            REFERENCES users(id)
            ON DELETE SET NULL;
        END IF;
      END $$;
    `);
    console.log('Added foreign key constraint from audit_logs to users.');

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

    // Create businesses table
    await client.query(`
      CREATE TABLE IF NOT EXISTS businesses (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        type VARCHAR(100),
        industry VARCHAR(100),
        address TEXT,
        city VARCHAR(100),
        state VARCHAR(100),
        country VARCHAR(100),
        postal_code VARCHAR(20),
        latitude DECIMAL(10, 8),
        longitude DECIMAL(11, 8),
        phone VARCHAR(50),
        email VARCHAR(255),
        website TEXT,
        owner_person_id INTEGER REFERENCES people(id) ON DELETE SET NULL,
        registration_number VARCHAR(100),
        registration_date DATE,
        status VARCHAR(50) DEFAULT 'active',
        employees JSONB DEFAULT '[]'::jsonb,
        notes TEXT,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('Checked/created "businesses" table.');
    await applyUpdatedAtTrigger(client, 'businesses');

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

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_travel_history_person_id ON travel_history(person_id);
      CREATE INDEX IF NOT EXISTS idx_travel_history_dates ON travel_history(arrival_date, departure_date);
      CREATE INDEX IF NOT EXISTS idx_travel_history_location ON travel_history(country, city);
    `);

    // Create wireless_networks table
    await client.query(`
      CREATE TABLE IF NOT EXISTS wireless_networks (
        id SERIAL PRIMARY KEY,
        ssid VARCHAR(255) NOT NULL,
        bssid VARCHAR(17),
        latitude DOUBLE PRECISION,
        longitude DOUBLE PRECISION,
        accuracy DOUBLE PRECISION,
        encryption VARCHAR(50),
        signal_strength INTEGER,
        frequency VARCHAR(20),
        channel INTEGER,
        network_type VARCHAR(20) DEFAULT 'WIFI',
        confidence_level VARCHAR(20),
        first_seen TIMESTAMP,
        last_seen TIMESTAMP,
        scan_date TIMESTAMP,
        person_id INTEGER REFERENCES people(id) ON DELETE SET NULL,
        association_note TEXT,
        association_confidence VARCHAR(20),
        import_source VARCHAR(255),
        import_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        notes TEXT,
        tags TEXT[],
        area_name VARCHAR(255),
        password VARCHAR(255),
        associated_person_ids INTEGER[],
        associated_business_ids INTEGER[],
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('Checked/created "wireless_networks" table.');
    await applyUpdatedAtTrigger(client, 'wireless_networks');

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_wireless_ssid ON wireless_networks(ssid);
      CREATE INDEX IF NOT EXISTS idx_wireless_location ON wireless_networks(latitude, longitude);
      CREATE INDEX IF NOT EXISTS idx_wireless_person ON wireless_networks(person_id);
    `);

    // Backfill associated_person_ids array from singular person_id (issue #41 migration).
    // Idempotent: only copies when the array is empty/null.
    // Note: wireless_networks has no singular business_id column, so no business backfill needed.
    await client.query(`
      UPDATE wireless_networks
      SET associated_person_ids = ARRAY[person_id]
      WHERE person_id IS NOT NULL
        AND (associated_person_ids IS NULL OR cardinality(associated_person_ids) = 0);
    `);
    console.log('Backfilled wireless_networks.associated_person_ids from person_id.');

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
  app.locals.improvedGeocodingService = improvedGeocodingService;
  console.log('Improved geocoding service initialized');
});

// Trust first proxy (nginx, docker network) so express-rate-limit reads real client IP
app.set('trust proxy', 1);

app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use('/public', express.static(path.join(__dirname, 'public')));

// Session configuration
app.use(session({
  store: new pgSession({
    pool: pool,
    tableName: 'user_sessions',
    createTableIfMissing: true
  }),
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    sameSite: 'strict',
    maxAge: 30 * 24 * 60 * 60 * 1000 // 30 days
  }
}));

// Import audit logging middleware
const { auditMiddleware } = require('./middleware/auditLog');
const { requireAuth, requireAdmin } = require('./middleware/auth');
const { geocodingLimiter } = require('./middleware/rateLimiters');
app.use(auditMiddleware);

// Import and mount routes
const authRoutes = require('./routes/auth');
const usersRoutes = require('./routes/users');
const auditLogsRoutes = require('./routes/auditLogs');
const entityNetworkRoutes = require('./routes/entityNetwork');
const businessesRoutes = require('./routes/businesses');
const casesRoutes = require('./routes/cases');
const geocodingRoutes = require('./routes/geocoding');
const locationsRoutes = require('./routes/locations');
const peopleRoutes = require('./routes/people');
const searchRoutes = require('./routes/search');
const settingsRoutes = require('./routes/settings');
const todosRoutes = require('./routes/todos');
const toolsRoutes = require('./routes/tools');
const travelHistoryRoutes = require('./routes/travelHistory');
const wirelessNetworksRoutes = require('./routes/wirelessNetworks');

app.use('/api/auth', authRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/audit-logs', auditLogsRoutes);
app.use('/api', entityNetworkRoutes);
app.use('/api/businesses', businessesRoutes);
app.use('/api/cases', casesRoutes);
app.use('/api/geocode', geocodingRoutes);
app.use('/api/locations', locationsRoutes);
app.use('/api/people', peopleRoutes);
app.use('/api/search', searchRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/todos', todosRoutes);
app.use('/api/tools', toolsRoutes);
app.use('/api', travelHistoryRoutes);
app.use('/api/wireless-networks', wirelessNetworksRoutes);

app.get('/api', (req, res) => {
  res.json({ message: "Hello from the OSINT CRM Backend!" });
});

// Health check endpoint for Docker healthcheck and monitoring
app.get('/api/health', async (req, res) => {
  try {
    // Check database connectivity
    await pool.query('SELECT 1');
    res.status(200).json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      database: 'connected'
    });
  } catch (error) {
    console.error('Health check failed:', error.message);
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      database: 'disconnected'
    });
  }
});

app.post('/api/upload/logo', requireAdmin, logoUpload.single('appLogo'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded or file type incorrect.' });
  }
  const logoUrl = `/public/uploads/logos/${req.file.filename}`;
  res.json({ message: 'Logo uploaded successfully!', logoUrl: logoUrl });
});


// Export/Import endpoints
app.get('/api/export', requireAdmin, async (req, res) => {
  try {
    const [people, tools, todos, customFields, modelOptions, cases, travelHistory, businesses] = await Promise.all([
      pool.query('SELECT * FROM people'),
      pool.query('SELECT * FROM tools'),
      pool.query('SELECT * FROM todos'),
      pool.query('SELECT * FROM custom_person_fields'),
      pool.query('SELECT * FROM model_options'),
      pool.query('SELECT * FROM cases'),
      pool.query('SELECT * FROM travel_history'),
      pool.query('SELECT * FROM businesses')
    ]);

    const exportData = {
      version: '1.2',
      exportDate: new Date().toISOString(),
      data: {
        people: people.rows,
        businesses: businesses.rows,
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

app.post('/api/import', requireAdmin, async (req, res) => {
  const importData = req.body;

  if (!importData || !importData.version || !importData.data) {
    return res.status(400).json({ error: 'Invalid import data format' });
  }

  // ?strict=1 — roll back on any record failure instead of best-effort partial import
  const strictMode = req.query.strict === '1';

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
  
  const importErrors = [];

  const tryInsert = async (label, fn) => {
    try {
      await fn();
    } catch (err) {
      console.warn(`Import warning [${label}]:`, err.message);
      importErrors.push({ record: label, error: err.message });
      // In strict mode, re-throw so the transaction rolls back
      if (strictMode) throw err;
    }
  };

  try {
    await client.query('BEGIN');

    // Create a mapping for person IDs (old ID -> new ID)
    const personIdMapping = {};

    // Import in order to respect foreign key constraints
    if (importData.data.cases) {
      for (const caseItem of importData.data.cases) {
        await tryInsert(`case:${caseItem.case_name}`, () => client.query(
          `INSERT INTO cases (case_name, description, status)
           VALUES ($1, $2, $3)
           ON CONFLICT (case_name) DO UPDATE
           SET description = EXCLUDED.description, status = EXCLUDED.status`,
          [caseItem.case_name, caseItem.description, caseItem.status]
        ));
      }
    }

    if (importData.data.customFields) {
      for (const field of importData.data.customFields) {
        const optionsJSON = field.options ? toJSONString(field.options) : '[]';
        await tryInsert(`customField:${field.field_name}`, () => client.query(
          `INSERT INTO custom_person_fields (field_name, field_label, field_type, options, is_active)
           VALUES ($1, $2, $3, $4::jsonb, $5)
           ON CONFLICT (field_name) DO UPDATE
           SET field_label = EXCLUDED.field_label, field_type = EXCLUDED.field_type,
               options = EXCLUDED.options, is_active = EXCLUDED.is_active`,
          [field.field_name, field.field_label, field.field_type, optionsJSON, field.is_active]
        ));
      }
    }

    if (importData.data.modelOptions) {
      for (const option of importData.data.modelOptions) {
        await tryInsert(`modelOption:${option.model_type}/${option.option_value}`, () => client.query(
          `INSERT INTO model_options (model_type, option_value, option_label, is_active, display_order)
           VALUES ($1, $2, $3, $4, $5)
           ON CONFLICT (model_type, option_value) DO UPDATE
           SET option_label = EXCLUDED.option_label, is_active = EXCLUDED.is_active,
               display_order = EXCLUDED.display_order`,
          [option.model_type, option.option_value, option.option_label, option.is_active, option.display_order]
        ));
      }
    }

    if (importData.data.people) {
      for (const person of importData.data.people) {
        const osintDataJSON = person.osint_data ? toJSONString(person.osint_data) : '[]';
        const attachmentsJSON = person.attachments ? toJSONString(person.attachments) : '[]';
        const connectionsJSON = person.connections ? toJSONString(person.connections) : '[]';
        const locationsJSON = person.locations ? toJSONString(person.locations) : '[]';
        const customFieldsJSON = person.custom_fields ? toJSONString(person.custom_fields) : '{}';

        try {
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
          if (person.id && result.rows[0]) {
            personIdMapping[person.id] = result.rows[0].id;
          }
        } catch (err) {
          console.warn(`Import warning [person:${person.first_name} ${person.last_name}]:`, err.message);
          importErrors.push({ record: `person:${person.first_name} ${person.last_name}`, error: err.message });
        }
      }
    }

    if (importData.data.tools) {
      for (const tool of importData.data.tools) {
        await tryInsert(`tool:${tool.name}`, () => client.query(
          `INSERT INTO tools (name, link, description, category, status, tags, notes)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [tool.name, tool.link, tool.description, tool.category, tool.status, tool.tags, tool.notes]
        ));
      }
    }

    if (importData.data.todos) {
      for (const todo of importData.data.todos) {
        await tryInsert(`todo:${todo.text?.slice(0, 30)}`, () => client.query(
          `INSERT INTO todos (text, status, last_update_comment)
           VALUES ($1, $2, $3)`,
          [todo.text, todo.status, todo.last_update_comment]
        ));
      }
    }

    if (importData.data.travelHistory) {
      for (const travel of importData.data.travelHistory) {
        const newPersonId = personIdMapping[travel.person_id];
        if (newPersonId) {
          await tryInsert(`travel:person${travel.person_id}`, () => client.query(
            `INSERT INTO travel_history
             (person_id, location_type, location_name, address, city, state, country, postal_code,
              latitude, longitude, arrival_date, departure_date, purpose, transportation_mode, notes)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)`,
            [newPersonId, travel.location_type, travel.location_name, travel.address,
             travel.city, travel.state, travel.country, travel.postal_code,
             travel.latitude, travel.longitude, travel.arrival_date, travel.departure_date,
             travel.purpose, travel.transportation_mode, travel.notes]
          ));
        } else {
          importErrors.push({ record: `travel:person${travel.person_id}`, error: 'Person not found in import' });
        }
      }
    }

    // Import businesses after people so owner_person_id can be remapped
    const businessIdMapping = {};
    if (importData.data.businesses) {
      for (const business of importData.data.businesses) {
        const employeesJSON = business.employees ? toJSONString(business.employees) : '[]';
        const remappedOwnerId = business.owner_person_id
          ? (personIdMapping[business.owner_person_id] || null)
          : null;

        const result = await client.query(
          `INSERT INTO businesses (name, type, industry, address, city, state, country, postal_code,
                                   latitude, longitude, phone, email, website, owner_person_id,
                                   registration_number, registration_date, status, employees, notes)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18::jsonb, $19)
           RETURNING id`,
          [business.name, business.type, business.industry, business.address, business.city,
           business.state, business.country, business.postal_code, business.latitude, business.longitude,
           business.phone, business.email, business.website, remappedOwnerId,
           business.registration_number, business.registration_date, business.status,
           employeesJSON, business.notes]
        );

        if (business.id && result.rows[0]) {
          businessIdMapping[business.id] = result.rows[0].id;
        }
      }
    }

    // Update connections with the new person IDs
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
    if (importErrors.length > 0) {
      // 207 Multi-Status: transaction committed but some records were skipped (issue #37)
      return res.status(207).json({
        partial: true,
        message: 'Data imported with some errors',
        errors: importErrors
      });
    }
    res.json({ partial: false, message: 'Data imported successfully' });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error importing data:', err);
    if (strictMode) {
      return res.status(400).json({ error: 'Import rolled back due to record failure', details: err.message });
    }
    res.status(500).json({ error: 'Failed to import data: ' + err.message });
  } finally {
    client.release();
  }
});

// Docker control endpoints removed — shell-backed container management must not be exposed via the application API.


// System Health endpoint
app.get('/api/system/health', requireAuth, requireAdmin, async (req, res) => {
  try {
    const health = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: Math.floor(process.uptime()),
      memory: {
        used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024), // MB
        total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024), // MB
        rss: Math.round(process.memoryUsage().rss / 1024 / 1024), // MB
        external: Math.round(process.memoryUsage().external / 1024 / 1024) // MB
      },
      cpu: {
        usage: process.cpuUsage()
      },
      database: {
        status: 'connected',
        connections: pool.totalCount || 0,
        idle: pool.idleCount || 0,
        waiting: pool.waitingCount || 0
      },
      counts: {}
    };

    // Get data counts
    try {
      const peopleResult = await pool.query('SELECT COUNT(*) as count FROM people');
      health.counts.people = parseInt(peopleResult.rows[0].count);

      const businessesResult = await pool.query('SELECT COUNT(*) as count FROM businesses');
      health.counts.businesses = parseInt(businessesResult.rows[0].count);

      const toolsResult = await pool.query('SELECT COUNT(*) as count FROM tools');
      health.counts.tools = parseInt(toolsResult.rows[0].count);

      const todosResult = await pool.query('SELECT COUNT(*) as count FROM todos WHERE status != \'done\' AND status != \'cancelled\'');
      health.counts.activeTodos = parseInt(todosResult.rows[0].count);

      // Get recent activity
      const recentActivityResult = await pool.query(`
        SELECT COUNT(*) as count 
        FROM audit_logs 
        WHERE created_at > NOW() - INTERVAL '24 hours'
      `);
      health.counts.recentActivity = parseInt(recentActivityResult.rows[0].count);

    } catch (dbError) {
      console.error('Error fetching database counts:', dbError);
      health.database.status = 'error';
      health.status = 'degraded';
    }

    res.json(health);
  } catch (err) {
    console.error('Error getting system health:', err);
    res.status(500).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString()
    });
  }
});


const errorHandler = require('./middleware/errorHandler');
app.use(errorHandler);

const server = app.listen(PORT, () => {
  console.log(`Backend server is running on http://localhost:${PORT}`);
});

// Graceful shutdown handler
const gracefulShutdown = async (signal) => {
  console.log(`\n${signal} received. Starting graceful shutdown...`);

  // Stop accepting new connections
  server.close(async () => {
    console.log('HTTP server closed.');

    try {
      // Close database pool
      await pool.end();
      console.log('Database pool closed.');
      process.exit(0);
    } catch (err) {
      console.error('Error during graceful shutdown:', err);
      process.exit(1);
    }
  });

  // Force shutdown after 10 seconds
  setTimeout(() => {
    console.error('Forced shutdown after timeout');
    process.exit(1);
  }, 10000);
};

// Handle shutdown signals
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
  gracefulShutdown('UNCAUGHT_EXCEPTION');
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  gracefulShutdown('UNHANDLED_REJECTION');
});