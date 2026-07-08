// File: backend/migrations/20260708000001_baseline.js
// Baseline schema migration (issue #48). This is the former server.js
// initializeDatabase() moved verbatim into Knex: every statement is
// idempotent (IF NOT EXISTS / OR REPLACE / conditional patches), so on an
// existing database this migration is a no-op that just records the baseline
// in knex_migrations. Fresh databases get the full v2.8 schema.
//
// Rules going forward:
// - NEVER edit this file after release — add a new migration file instead.
// - Default model_options seeding is NOT schema and runs on every boot from
//   config/seedDefaults.js (so upgrades can introduce new default options).

const applyUpdatedAtTrigger = async (knex, tableName) => {
  await knex.raw(`
    DROP TRIGGER IF EXISTS set_timestamp ON ${tableName};
    CREATE TRIGGER set_timestamp
    BEFORE UPDATE ON ${tableName}
    FOR EACH ROW
    EXECUTE PROCEDURE trigger_set_timestamp();
  `);
};

exports.up = async function up(knex) {
  await knex.raw(`
    CREATE OR REPLACE FUNCTION trigger_set_timestamp()
    RETURNS TRIGGER AS $$
    BEGIN
      NEW.updated_at = NOW();
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;
  `);

  // Legacy migration: split people.name into first_name/last_name (pre-v2 DBs)
  const nameColumnExists = await knex.raw(`
    SELECT column_name
    FROM information_schema.columns
    WHERE table_name = 'people' AND column_name = 'name'
  `);
  if (nameColumnExists.rows.length > 0) {
    await knex.raw(`
      ALTER TABLE people
      ADD COLUMN IF NOT EXISTS first_name VARCHAR(255),
      ADD COLUMN IF NOT EXISTS last_name VARCHAR(255)
    `);
    await knex.raw(`
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
    await knex.raw(`ALTER TABLE people DROP COLUMN IF EXISTS name`);
  }

  await knex.raw(`
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
  await applyUpdatedAtTrigger(knex, 'people');
  await knex.raw(`
    CREATE INDEX IF NOT EXISTS idx_people_first_name ON people(first_name);
    CREATE INDEX IF NOT EXISTS idx_people_last_name ON people(last_name);
    CREATE INDEX IF NOT EXISTS idx_people_full_name ON people(first_name, last_name);
    CREATE INDEX IF NOT EXISTS idx_people_category ON people(category);
    CREATE INDEX IF NOT EXISTS idx_people_status ON people(status);
    CREATE INDEX IF NOT EXISTS idx_people_case_name ON people(case_name);
    CREATE INDEX IF NOT EXISTS idx_people_dob ON people(date_of_birth);
  `);

  await knex.raw(`
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
  await applyUpdatedAtTrigger(knex, 'tools');

  await knex.raw(`
    CREATE TABLE IF NOT EXISTS todos (
      id SERIAL PRIMARY KEY,
      text TEXT NOT NULL,
      status VARCHAR(50) DEFAULT 'open',
      last_update_comment TEXT,
      created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
    );
  `);
  await applyUpdatedAtTrigger(knex, 'todos');

  await knex.raw(`
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
  await applyUpdatedAtTrigger(knex, 'custom_person_fields');

  await knex.raw(`
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
  await applyUpdatedAtTrigger(knex, 'model_options');

  await knex.raw(`
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
  await knex.raw(`
    CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON audit_logs(entity_type, entity_id);
    CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
    CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
  `);

  await knex.raw(`
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
  await applyUpdatedAtTrigger(knex, 'users');
  // Patch for pre-existing databases where email was NOT NULL
  await knex.raw(`ALTER TABLE users ALTER COLUMN email DROP NOT NULL;`);
  await knex.raw(`
    CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
    CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
    CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
  `);

  await knex.raw(`
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

  await knex.raw(`
    CREATE TABLE IF NOT EXISTS cases (
      id SERIAL PRIMARY KEY,
      case_name VARCHAR(255) NOT NULL UNIQUE,
      description TEXT,
      status VARCHAR(50) DEFAULT 'active',
      created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
    );
  `);
  await applyUpdatedAtTrigger(knex, 'cases');

  await knex.raw(`
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
  await applyUpdatedAtTrigger(knex, 'businesses');

  await knex.raw(`
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
  await applyUpdatedAtTrigger(knex, 'travel_history');
  await knex.raw(`
    CREATE INDEX IF NOT EXISTS idx_travel_history_person_id ON travel_history(person_id);
    CREATE INDEX IF NOT EXISTS idx_travel_history_dates ON travel_history(arrival_date, departure_date);
    CREATE INDEX IF NOT EXISTS idx_travel_history_location ON travel_history(country, city);
  `);

  await knex.raw(`
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
  await applyUpdatedAtTrigger(knex, 'wireless_networks');
  await knex.raw(`
    CREATE INDEX IF NOT EXISTS idx_wireless_ssid ON wireless_networks(ssid);
    CREATE INDEX IF NOT EXISTS idx_wireless_location ON wireless_networks(latitude, longitude);
    CREATE INDEX IF NOT EXISTS idx_wireless_person ON wireless_networks(person_id);
  `);
  // Backfill associated_person_ids array from singular person_id (issue #41)
  await knex.raw(`
    UPDATE wireless_networks
    SET associated_person_ids = ARRAY[person_id]
    WHERE person_id IS NOT NULL
      AND (associated_person_ids IS NULL OR cardinality(associated_person_ids) = 0);
  `);

  // ── Transaction tracking (issue #43): properties → assets → transactions ──
  await knex.raw(`
    CREATE TABLE IF NOT EXISTS properties (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      property_type VARCHAR(100),
      description TEXT,
      address TEXT,
      city VARCHAR(100),
      state VARCHAR(100),
      country VARCHAR(100),
      postal_code VARCHAR(20),
      latitude DECIMAL(10, 8),
      longitude DECIMAL(11, 8),
      geocode_confidence INTEGER,
      geocode_provider VARCHAR(50),
      geocoded_at TIMESTAMPTZ,
      owner_person_id INTEGER REFERENCES people(id) ON DELETE SET NULL,
      case_id INTEGER REFERENCES cases(id) ON DELETE SET NULL,
      notes TEXT,
      created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
    );
  `);
  await applyUpdatedAtTrigger(knex, 'properties');
  await knex.raw(`
    CREATE INDEX IF NOT EXISTS idx_properties_owner ON properties(owner_person_id);
    CREATE INDEX IF NOT EXISTS idx_properties_case ON properties(case_id);
    CREATE INDEX IF NOT EXISTS idx_properties_location ON properties(latitude, longitude);
    CREATE INDEX IF NOT EXISTS idx_properties_country_city ON properties(country, city);
  `);

  await knex.raw(`
    CREATE TABLE IF NOT EXISTS assets (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      category VARCHAR(100),
      identifier VARCHAR(255),
      description TEXT,
      notes TEXT,
      estimated_value DECIMAL(14, 2),
      currency VARCHAR(10),
      status VARCHAR(50) DEFAULT 'active',
      location_mode VARCHAR(20) DEFAULT 'with_holder',
      location_person_id INTEGER REFERENCES people(id) ON DELETE SET NULL,
      location_ref VARCHAR(255),
      location_name VARCHAR(255),
      address TEXT,
      city VARCHAR(100),
      state VARCHAR(100),
      country VARCHAR(100),
      postal_code VARCHAR(20),
      latitude DECIMAL(10, 8),
      longitude DECIMAL(11, 8),
      geocode_confidence INTEGER,
      geocode_provider VARCHAR(50),
      geocoded_at TIMESTAMPTZ,
      case_id INTEGER REFERENCES cases(id) ON DELETE SET NULL,
      created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
    );
  `);
  await applyUpdatedAtTrigger(knex, 'assets');
  await knex.raw(`
    CREATE INDEX IF NOT EXISTS idx_assets_category ON assets(category);
    CREATE INDEX IF NOT EXISTS idx_assets_status ON assets(status);
    CREATE INDEX IF NOT EXISTS idx_assets_case ON assets(case_id);
    CREATE INDEX IF NOT EXISTS idx_assets_location_person ON assets(location_person_id);
    CREATE INDEX IF NOT EXISTS idx_assets_coords ON assets(latitude, longitude);
  `);

  await knex.raw(`
    CREATE TABLE IF NOT EXISTS transactions (
      id SERIAL PRIMARY KEY,
      transaction_type VARCHAR(50) NOT NULL,
      item_label VARCHAR(255),
      item_category VARCHAR(100),
      subject_asset_id INTEGER REFERENCES assets(id) ON DELETE SET NULL,
      subject_business_id INTEGER REFERENCES businesses(id) ON DELETE SET NULL,
      subject_property_id INTEGER REFERENCES properties(id) ON DELETE SET NULL,
      from_person_id INTEGER REFERENCES people(id) ON DELETE SET NULL,
      from_business_id INTEGER REFERENCES businesses(id) ON DELETE SET NULL,
      from_external VARCHAR(255),
      to_person_id INTEGER REFERENCES people(id) ON DELETE SET NULL,
      to_business_id INTEGER REFERENCES businesses(id) ON DELETE SET NULL,
      to_external VARCHAR(255),
      value DECIMAL(14, 2),
      currency VARCHAR(10),
      occurred_on DATE,
      location_business_id INTEGER REFERENCES businesses(id) ON DELETE SET NULL,
      location_property_id INTEGER REFERENCES properties(id) ON DELETE SET NULL,
      location_name VARCHAR(255),
      address TEXT,
      city VARCHAR(100),
      state VARCHAR(100),
      country VARCHAR(100),
      postal_code VARCHAR(20),
      latitude DECIMAL(10, 8),
      longitude DECIMAL(11, 8),
      geocode_confidence INTEGER,
      geocode_provider VARCHAR(50),
      geocoded_at TIMESTAMPTZ,
      case_id INTEGER REFERENCES cases(id) ON DELETE SET NULL,
      notes TEXT,
      created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
    );
  `);
  await applyUpdatedAtTrigger(knex, 'transactions');
  await knex.raw(`
    CREATE INDEX IF NOT EXISTS idx_transactions_type ON transactions(transaction_type);
    CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(occurred_on);
    CREATE INDEX IF NOT EXISTS idx_transactions_from_person ON transactions(from_person_id);
    CREATE INDEX IF NOT EXISTS idx_transactions_to_person ON transactions(to_person_id);
    CREATE INDEX IF NOT EXISTS idx_transactions_from_business ON transactions(from_business_id);
    CREATE INDEX IF NOT EXISTS idx_transactions_to_business ON transactions(to_business_id);
    CREATE INDEX IF NOT EXISTS idx_transactions_subject_asset ON transactions(subject_asset_id);
    CREATE INDEX IF NOT EXISTS idx_transactions_subject_business ON transactions(subject_business_id);
    CREATE INDEX IF NOT EXISTS idx_transactions_subject_property ON transactions(subject_property_id);
    CREATE INDEX IF NOT EXISTS idx_transactions_location_business ON transactions(location_business_id);
    CREATE INDEX IF NOT EXISTS idx_transactions_location_property ON transactions(location_property_id);
    CREATE INDEX IF NOT EXISTS idx_transactions_case ON transactions(case_id);
    CREATE INDEX IF NOT EXISTS idx_transactions_coords ON transactions(latitude, longitude);
  `);
};

// The baseline never rolls back — it represents the pre-Knex schema and
// dropping user data on a down-migration would be catastrophic.
exports.down = async function down() {};
