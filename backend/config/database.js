// File: backend/config/database.js
const { Pool } = require('pg');

// Database connection pool
const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'db',
  database: process.env.DB_NAME || 'osint_crm_db',
  password: process.env.DB_PASSWORD || 'changeme',
  port: parseInt(process.env.DB_PORT || '5432', 10),
});

// Trigger function for updating timestamps
const createUpdatedAtTriggerFunction = `
  CREATE OR REPLACE FUNCTION trigger_set_timestamp()
  RETURNS TRIGGER AS $$
  BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
  END;
  $$ LANGUAGE plpgsql;
`;

// Apply updated_at trigger to a table
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

module.exports = {
  pool,
  createUpdatedAtTriggerFunction,
  applyUpdatedAtTrigger
};