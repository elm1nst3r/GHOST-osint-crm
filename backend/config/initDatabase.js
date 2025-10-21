// File: backend/config/initDatabase.js
const { pool, createUpdatedAtTriggerFunction, applyUpdatedAtTrigger } = require('./database');

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
      { model_type: 'location_type', option_value: 'other', option_label: 'Other', display_order: 6 },
      
      // OSINT Data Types
      { model_type: 'osint_data_type', option_value: 'Email', option_label: 'Email', display_order: 1 },
      { model_type: 'osint_data_type', option_value: 'Phone', option_label: 'Phone', display_order: 2 },
      { model_type: 'osint_data_type', option_value: 'Social Media', option_label: 'Social Media', display_order: 3 },
      { model_type: 'osint_data_type', option_value: 'Website', option_label: 'Website', display_order: 4 },
      { model_type: 'osint_data_type', option_value: 'Username', option_label: 'Username', display_order: 5 },
      { model_type: 'osint_data_type', option_value: 'IP Address', option_label: 'IP Address', display_order: 6 },
      { model_type: 'osint_data_type', option_value: 'Vehicle', option_label: 'Vehicle', display_order: 7 },
      { model_type: 'osint_data_type', option_value: 'Financial', option_label: 'Financial', display_order: 8 },
      { model_type: 'osint_data_type', option_value: 'Document ID', option_label: 'Document ID', display_order: 9 },
      { model_type: 'osint_data_type', option_value: 'Other', option_label: 'Other', display_order: 10 }
    ];

    for (const option of defaultOptions) {
      await client.query(`
        INSERT INTO model_options (model_type, option_value, option_label, display_order)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (model_type, option_value) DO NOTHING
      `, [option.model_type, option.option_value, option.option_label, option.display_order]);
    }
    console.log('Ensured default model options exist.');

    // Create users table for authentication
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(100) NOT NULL UNIQUE,
        email VARCHAR(255),
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

    // Create indexes on users table
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
      CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
      CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
    `);

    // Create partial unique index for email (only enforce uniqueness on non-null emails)
    await client.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS users_email_unique_key ON users(email) WHERE email IS NOT NULL;
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS audit_logs (
        id SERIAL PRIMARY KEY,
        entity_type VARCHAR(50) NOT NULL,
        entity_id INTEGER NOT NULL,
        field_name VARCHAR(100),
        old_value TEXT,
        new_value TEXT,
        action VARCHAR(50) NOT NULL,
        user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('Checked/created "audit_logs" table.');

    // Create indexes on audit_logs
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON audit_logs(entity_type, entity_id);
      CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON audit_logs(user_id);
      CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON audit_logs(created_at DESC);
    `);

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

module.exports = initializeDatabase;