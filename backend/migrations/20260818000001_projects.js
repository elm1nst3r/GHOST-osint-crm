// File: backend/migrations/20260818000001_projects.js
//
// First step of project-based data isolation (issue #83). A Project is the
// hard investigation boundary ("almost a fresh database" per investigation —
// e.g. a journalist's two unrelated stories); the existing `cases` table
// becomes a lighter grouping nested inside a project in a later migration.
//
// `allow_cross_linking` is added now even though the enforcement logic lands
// in a later migration/route (relationships table) — cheaper to ship the
// column with the table than as a follow-up ALTER.
//
// A "Default Project" row is seeded so the backfill migrations that follow
// (project_id on every entity table) have somewhere to point existing data.

exports.up = async function up(knex) {
  await knex.raw(`
    CREATE TABLE IF NOT EXISTS projects (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) NOT NULL UNIQUE,
      description TEXT,
      status VARCHAR(50) DEFAULT 'active',
      allow_cross_linking BOOLEAN NOT NULL DEFAULT false,
      created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // trigger_set_timestamp() is created by the baseline migration; reuse it.
  await knex.raw(`
    DROP TRIGGER IF EXISTS set_timestamp ON projects;
    CREATE TRIGGER set_timestamp
    BEFORE UPDATE ON projects
    FOR EACH ROW
    EXECUTE PROCEDURE trigger_set_timestamp();
  `);

  await knex.raw(`
    INSERT INTO projects (name, description)
    VALUES ('Default Project', 'Auto-created during upgrade to project-based data isolation')
    ON CONFLICT (name) DO NOTHING
  `);
};

exports.down = async function down(knex) {
  await knex.raw(`DROP TRIGGER IF EXISTS set_timestamp ON projects`);
  await knex.raw(`DROP TABLE IF EXISTS projects`);
};
