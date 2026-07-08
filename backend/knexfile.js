// File: backend/knexfile.js
// Knex is used for schema migrations only (issue #48); application queries
// keep using the pg pool in config/database.js. Connection settings mirror
// that pool so both always point at the same database.

module.exports = {
  client: 'pg',
  connection: {
    user: process.env.DB_USER || 'postgres',
    host: process.env.DB_HOST || 'db',
    database: process.env.DB_NAME || 'osint_crm_db',
    password: process.env.DB_PASSWORD,
    port: parseInt(process.env.DB_PORT || '5432', 10),
  },
  pool: { min: 0, max: 2 },
  migrations: {
    directory: './migrations',
    tableName: 'knex_migrations',
  },
};
