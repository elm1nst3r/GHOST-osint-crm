// File: backend/migrations/20261101000001_files.js
//
// Uploaded files (issue #97): documents attached to a person or to a project
// as a whole. The bytes live on disk (services/fileStorage.js); this table
// holds what the UI shows and what access checks need.
//
// Named `files`, not `attachments`, because people.attachments is an older
// JSONB column the UI never fills in. The two have nothing to do with each
// other.
//
// person_id is ON DELETE SET NULL on purpose: deleting a person keeps their
// files as project-level files rather than silently destroying evidence.
// project_id is NO ACTION like every other project-scoped table, so
// deleteProjectCascade has to clear it (and does: it's in
// PROJECT_SCOPED_TABLES).

exports.up = async function up(knex) {
  await knex.raw(`
    CREATE TABLE IF NOT EXISTS files (
      id SERIAL PRIMARY KEY,
      project_id INTEGER NOT NULL REFERENCES projects(id),
      person_id INTEGER REFERENCES people(id) ON DELETE SET NULL,
      original_name VARCHAR(255) NOT NULL,
      stored_name VARCHAR(64) NOT NULL UNIQUE,
      mime_type VARCHAR(255),
      size_bytes BIGINT NOT NULL,
      sha256 CHAR(64) NOT NULL,
      description TEXT,
      uploaded_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
      created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
    );
  `);
  await knex.raw(`
    DROP TRIGGER IF EXISTS set_timestamp ON files;
    CREATE TRIGGER set_timestamp
    BEFORE UPDATE ON files
    FOR EACH ROW
    EXECUTE PROCEDURE trigger_set_timestamp();
  `);
  await knex.raw(`CREATE INDEX IF NOT EXISTS idx_files_project ON files(project_id)`);
  await knex.raw(`CREATE INDEX IF NOT EXISTS idx_files_person ON files(person_id)`);
  await knex.raw(`CREATE INDEX IF NOT EXISTS idx_files_sha256 ON files(sha256)`);
};

exports.down = async function down(knex) {
  await knex.raw(`DROP TABLE IF EXISTS files`);
};
