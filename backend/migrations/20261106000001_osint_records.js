// File: backend/migrations/20261106000001_osint_records.js
//
// Saved records (issue #96): a result an integration returned, kept on a
// person exactly as the provider sent it (nested objects, arrays, fields only
// some records have). Mapping values into OSINT data is an extra step on
// top, so nothing the field mapping didn't foresee is lost.
//
// A record belongs to a person and goes with them (ON DELETE CASCADE), like
// the person's OSINT data. There is no project_id: the project is the
// person's, so moving or deleting a person can't leave records behind in
// the wrong project.
//
// One row per person, integration and content (data_hash = SHA-256 of the
// record with sorted keys). Finding the same record again refreshes
// retrieved_at, query and occurrences instead of adding a copy. Records
// saved by hand or imported have integration_id ''.

exports.up = async function up(knex) {
  await knex.raw(`
    CREATE TABLE IF NOT EXISTS osint_records (
      id SERIAL PRIMARY KEY,
      person_id INTEGER NOT NULL REFERENCES people(id) ON DELETE CASCADE,
      data JSONB NOT NULL,
      data_hash CHAR(64) NOT NULL,
      record_source TEXT,
      occurrences INTEGER NOT NULL DEFAULT 1,
      tool_id INTEGER REFERENCES tools(id) ON DELETE SET NULL,
      tool_name VARCHAR(255),
      integration_id VARCHAR(64) NOT NULL DEFAULT '',
      operation VARCHAR(100),
      query TEXT,
      retrieved_at TIMESTAMPTZ,
      created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
      created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT osint_records_unique UNIQUE (person_id, integration_id, data_hash)
    );
  `);
  await knex.raw(`
    DROP TRIGGER IF EXISTS set_timestamp ON osint_records;
    CREATE TRIGGER set_timestamp
    BEFORE UPDATE ON osint_records
    FOR EACH ROW
    EXECUTE PROCEDURE trigger_set_timestamp();
  `);
  await knex.raw('CREATE INDEX IF NOT EXISTS idx_osint_records_person ON osint_records(person_id)');
};

exports.down = async function down(knex) {
  await knex.raw('DROP TABLE IF EXISTS osint_records');
};
