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

// All geocoding goes through ImprovedGeocodingService (Nominatim-throttled,
// DB-cached). The legacy services/geocodingService.js was removed — its
// exports were required but never called, and it bypassed the throttle.
let improvedGeocodingService;
const ImprovedGeocodingService = require('./services/improvedGeocodingService');
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

// ── Database bootstrap ────────────────────────────────────────────────────────
// Schema lives in Knex migrations (backend/migrations/, issue #48). On boot:
// run pending migrations, then ensure default model options (seeding re-runs
// every start so upgrades can introduce new defaults). Schema changes go in
// NEW migration files — never back into this file.
const { seedDefaults } = require('./config/seedDefaults');

const initializeDatabase = async () => {
  const knex = require('knex')(require('./knexfile'));
  try {
    const [batchNo, applied] = await knex.migrate.latest();
    console.log(applied.length
      ? `Applied ${applied.length} database migration(s) in batch ${batchNo}: ${applied.join(', ')}`
      : 'Database schema is up to date.');
  } finally {
    await knex.destroy();
  }
  await seedDefaults(pool);
};

initializeDatabase().then(() => {
  // Initialize improved geocoding service after database is ready
  improvedGeocodingService = new ImprovedGeocodingService(pool);
  app.locals.improvedGeocodingService = improvedGeocodingService;
  console.log('Improved geocoding service initialized');

  // Update availability check — reads the public releases API, downloads
  // nothing, and can be disabled entirely in Settings.
  const { UpdateCheckService } = require('./services/updateCheckService');
  app.locals.updateCheckService = new UpdateCheckService(pool, APP_VERSION);
}).catch((err) => {
  console.error('Error during database initialization:', err.stack);
  process.exit(1);
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
// Single source of truth for the running version — surfaced by /api/version
// and used to decide whether a newer release exists.
const APP_VERSION = require('./package.json').version;

const settingsRoutes = require('./routes/settings');
const todosRoutes = require('./routes/todos');
const toolsRoutes = require('./routes/tools');
const travelHistoryRoutes = require('./routes/travelHistory');
const wirelessNetworksRoutes = require('./routes/wirelessNetworks');
const propertiesRoutes = require('./routes/properties');
const assetsRoutes = require('./routes/assets');
const transactionsRoutes = require('./routes/transactions');
const ledgerRoutes = require('./routes/ledger');
const openapiSpec = require('./utils/openapiSpec');

// Machine-readable API description generated from the Zod schemas (issue #44).
// Mounted before the generic /api routers so no catch-all pattern shadows it.
app.get('/api/openapi.json', requireAuth, (req, res) => {
  res.json(openapiSpec);
});

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
app.use('/api/properties', propertiesRoutes);
app.use('/api/assets', assetsRoutes);
app.use('/api/transactions', transactionsRoutes);
app.use('/api', ledgerRoutes);

app.get('/api', (req, res) => {
  res.json({ message: "Hello from the OSINT CRM Backend!" });
});

// Health check endpoint for Docker healthcheck and monitoring
app.get('/api/version', requireAuth, async (req, res) => {
  const service = req.app.locals.updateCheckService;
  if (!service) return res.json({ currentVersion: APP_VERSION, checkEnabled: false, updateAvailable: false });
  try {
    res.json(await service.getStatus({ force: req.query.force === '1' }));
  } catch (err) {
    console.error('Error checking for updates:', err.message);
    res.json({ currentVersion: APP_VERSION, checkEnabled: true, updateAvailable: false, checkFailed: true });
  }
});

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
    // "Export All Data" has to mean all of it — assets, transactions,
    // properties and wireless networks were silently absent, which made the
    // file unusable for backup or migration (issue #74).
    const [
      people, tools, todos, customFields, modelOptions, cases, travelHistory,
      businesses, properties, assets, transactions, wirelessNetworks,
    ] = await Promise.all([
      pool.query('SELECT * FROM people'),
      pool.query('SELECT * FROM tools'),
      pool.query('SELECT * FROM todos'),
      pool.query('SELECT * FROM custom_person_fields'),
      pool.query('SELECT * FROM model_options'),
      pool.query('SELECT * FROM cases'),
      pool.query('SELECT * FROM travel_history'),
      pool.query('SELECT * FROM businesses'),
      pool.query('SELECT * FROM properties'),
      pool.query('SELECT * FROM assets'),
      pool.query('SELECT * FROM transactions'),
      pool.query('SELECT * FROM wireless_networks'),
    ]);

    const exportData = {
      version: '1.3',
      exportDate: new Date().toISOString(),
      data: {
        people: people.rows,
        businesses: businesses.rows,
        properties: properties.rows,
        assets: assets.rows,
        transactions: transactions.rows,
        wirelessNetworks: wirelessNetworks.rows,
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
      console.warn('Import warning:', label, err.message);
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
            `INSERT INTO people (first_name, last_name, patronymic, aliases, date_of_birth, category, status,
                                 crm_status, case_name, profile_picture_url, notes, osint_data,
                                 attachments, connections, locations, custom_fields)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12::jsonb, $13::jsonb, $14::jsonb, $15::jsonb, $16::jsonb)
             RETURNING id`,
            [person.first_name, person.last_name, person.patronymic || null, person.aliases,
             person.date_of_birth, person.category, person.status, person.crm_status, person.case_name,
             person.profile_picture_url, person.notes, osintDataJSON, attachmentsJSON,
             connectionsJSON, locationsJSON, customFieldsJSON]
          );
          if (person.id && result.rows[0]) {
            personIdMapping[person.id] = result.rows[0].id;
          }
        } catch (err) {
          console.warn('Import warning: person', person.first_name, person.last_name, err.message);
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

    // ── Entities absent from the old export/import entirely (issue #74) ──────
    // Imported after people and businesses so their owner/party references can
    // be remapped onto the newly-inserted ids. Cases are matched by name, since
    // case_id is not stable across installs.
    const caseIdByName = {};
    {
      const rows = await client.query('SELECT id, case_name FROM cases');
      rows.rows.forEach(r => { caseIdByName[r.case_name] = r.id; });
    }
    const remapCase = (row) => {
      if (row.case_name && caseIdByName[row.case_name]) return caseIdByName[row.case_name];
      return null;
    };

    const propertyIdMapping = {};
    if (importData.data.properties) {
      for (const prop of importData.data.properties) {
        await tryInsert(`property:${prop.name}`, async () => {
          const result = await client.query(
            `INSERT INTO properties (name, property_type, description, address, city, state, country,
                                     postal_code, latitude, longitude, owner_person_id, case_id, notes)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13) RETURNING id`,
            [prop.name, prop.property_type, prop.description, prop.address, prop.city, prop.state,
             prop.country, prop.postal_code, prop.latitude, prop.longitude,
             prop.owner_person_id ? (personIdMapping[prop.owner_person_id] || null) : null,
             remapCase(prop), prop.notes]
          );
          if (prop.id && result.rows[0]) propertyIdMapping[prop.id] = result.rows[0].id;
        });
      }
    }

    const assetIdMapping = {};
    if (importData.data.assets) {
      for (const asset of importData.data.assets) {
        await tryInsert(`asset:${asset.name}`, async () => {
          const result = await client.query(
            `INSERT INTO assets (name, category, identifier, description, notes, estimated_value,
                                 currency, status, location_mode, location_person_id, location_ref,
                                 location_name, address, city, state, country, postal_code,
                                 latitude, longitude, case_id)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20)
             RETURNING id`,
            [asset.name, asset.category, asset.identifier, asset.description, asset.notes,
             asset.estimated_value, asset.currency, asset.status, asset.location_mode,
             asset.location_person_id ? (personIdMapping[asset.location_person_id] || null) : null,
             asset.location_ref, asset.location_name, asset.address, asset.city, asset.state,
             asset.country, asset.postal_code, asset.latitude, asset.longitude, remapCase(asset)]
          );
          if (asset.id && result.rows[0]) assetIdMapping[asset.id] = result.rows[0].id;
        });
      }
    }

    if (importData.data.transactions) {
      for (const tx of importData.data.transactions) {
        await tryInsert(`transaction:${tx.item_label || tx.transaction_type}`, () => client.query(
          `INSERT INTO transactions (transaction_type, item_label, item_category, subject_asset_id,
                                     subject_business_id, subject_property_id, from_person_id,
                                     from_business_id, from_external, to_person_id, to_business_id,
                                     to_external, value, currency, occurred_on, location_business_id,
                                     location_property_id, location_name, address, city, state,
                                     country, postal_code, latitude, longitude, case_id, notes, tags)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18,
                   $19, $20, $21, $22, $23, $24, $25, $26, $27, $28)`,
          [tx.transaction_type, tx.item_label, tx.item_category,
           tx.subject_asset_id ? (assetIdMapping[tx.subject_asset_id] || null) : null,
           tx.subject_business_id ? (businessIdMapping[tx.subject_business_id] || null) : null,
           tx.subject_property_id ? (propertyIdMapping[tx.subject_property_id] || null) : null,
           tx.from_person_id ? (personIdMapping[tx.from_person_id] || null) : null,
           tx.from_business_id ? (businessIdMapping[tx.from_business_id] || null) : null,
           tx.from_external,
           tx.to_person_id ? (personIdMapping[tx.to_person_id] || null) : null,
           tx.to_business_id ? (businessIdMapping[tx.to_business_id] || null) : null,
           tx.to_external, tx.value, tx.currency, tx.occurred_on,
           tx.location_business_id ? (businessIdMapping[tx.location_business_id] || null) : null,
           tx.location_property_id ? (propertyIdMapping[tx.location_property_id] || null) : null,
           tx.location_name, tx.address, tx.city, tx.state, tx.country, tx.postal_code,
           tx.latitude, tx.longitude, remapCase(tx), tx.notes, tx.tags || []]
        ));
      }
    }

    if (importData.data.wirelessNetworks) {
      for (const net of importData.data.wirelessNetworks) {
        await tryInsert(`wirelessNetwork:${net.ssid || net.bssid}`, () => client.query(
          `INSERT INTO wireless_networks (ssid, bssid, latitude, longitude, accuracy, encryption,
                                          signal_strength, frequency, channel, network_type,
                                          confidence_level, first_seen, last_seen, scan_date,
                                          person_id, association_note, association_confidence,
                                          import_source, notes, tags, area_name, password,
                                          associated_person_ids, associated_business_ids)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18,
                   $19, $20, $21, $22, $23, $24)`,
          [net.ssid, net.bssid, net.latitude, net.longitude, net.accuracy, net.encryption,
           net.signal_strength, net.frequency, net.channel, net.network_type, net.confidence_level,
           net.first_seen, net.last_seen, net.scan_date,
           net.person_id ? (personIdMapping[net.person_id] || null) : null,
           net.association_note, net.association_confidence, net.import_source, net.notes,
           net.tags || [], net.area_name, net.password,
           (net.associated_person_ids || []).map(id => personIdMapping[id] || id),
           (net.associated_business_ids || []).map(id => businessIdMapping[id] || id)]
        ));
      }
    }

    // owner_business_id is a self-reference, so it can only be resolved once
    // every business exists (issue #65).
    if (importData.data.businesses) {
      for (const business of importData.data.businesses) {
        const newId = businessIdMapping[business.id];
        const newOwnerId = business.owner_business_id ? businessIdMapping[business.owner_business_id] : null;
        if (newId && newOwnerId) {
          await tryInsert(`businessOwner:${business.name}`, () => client.query(
            'UPDATE businesses SET owner_business_id = $1 WHERE id = $2', [newOwnerId, newId]
          ));
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