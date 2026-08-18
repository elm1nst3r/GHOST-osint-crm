// File: backend/migrations/20260818000002_project_id_backfill.js
//
// Second step of project-based data isolation (issue #83). Adds the required
// project_id FK to every case-scoped table, backfilling existing rows onto
// the Default Project seeded by 20260818000001_projects.js so nothing is
// orphaned on upgrade.
//
// Also adds case_id (nullable — cases are an optional grouping *inside* a
// project, not required) to the five entity tables that didn't already have
// it: people, businesses, wireless_networks, travel_history, todos.
// properties/assets/transactions already have case_id from issue #43.
//
// Cross-consistency (a case's project must match the entity's project) is
// enforced at the application layer, not a DB constraint — Postgres CHECK
// can't reference another table, and a trigger is disproportionate migration
// risk for this stage.

const PROJECT_ONLY_TABLES = ['properties', 'assets', 'transactions'];
const PROJECT_AND_CASE_TABLES = ['people', 'businesses', 'wireless_networks', 'travel_history', 'todos'];

exports.up = async function up(knex) {
  const { rows } = await knex.raw(`SELECT id FROM projects WHERE name = 'Default Project'`);
  const defaultProjectId = rows[0].id;

  // cases first: everything else's case_id references it, and the spec
  // requires cases.project_id NOT NULL as part of this same schema layer.
  await knex.raw(`ALTER TABLE cases ADD COLUMN IF NOT EXISTS project_id INTEGER REFERENCES projects(id)`);
  await knex.raw(`UPDATE cases SET project_id = ? WHERE project_id IS NULL`, [defaultProjectId]);
  await knex.raw(`ALTER TABLE cases ALTER COLUMN project_id SET NOT NULL`);
  await knex.raw(`CREATE INDEX IF NOT EXISTS idx_cases_project ON cases(project_id)`);

  for (const table of [...PROJECT_ONLY_TABLES, ...PROJECT_AND_CASE_TABLES]) {
    await knex.raw(`ALTER TABLE ${table} ADD COLUMN IF NOT EXISTS project_id INTEGER REFERENCES projects(id)`);
    await knex.raw(`UPDATE ${table} SET project_id = ? WHERE project_id IS NULL`, [defaultProjectId]);
    await knex.raw(`ALTER TABLE ${table} ALTER COLUMN project_id SET NOT NULL`);
    await knex.raw(`CREATE INDEX IF NOT EXISTS idx_${table}_project ON ${table}(project_id)`);
  }

  for (const table of PROJECT_AND_CASE_TABLES) {
    await knex.raw(`ALTER TABLE ${table} ADD COLUMN IF NOT EXISTS case_id INTEGER REFERENCES cases(id)`);
    await knex.raw(`CREATE INDEX IF NOT EXISTS idx_${table}_case ON ${table}(case_id)`);
  }
};

exports.down = async function down(knex) {
  for (const table of PROJECT_AND_CASE_TABLES) {
    await knex.raw(`DROP INDEX IF EXISTS idx_${table}_case`);
    await knex.raw(`ALTER TABLE ${table} DROP COLUMN IF EXISTS case_id`);
  }

  for (const table of [...PROJECT_ONLY_TABLES, ...PROJECT_AND_CASE_TABLES]) {
    await knex.raw(`DROP INDEX IF EXISTS idx_${table}_project`);
    await knex.raw(`ALTER TABLE ${table} DROP COLUMN IF EXISTS project_id`);
  }

  await knex.raw(`DROP INDEX IF EXISTS idx_cases_project`);
  await knex.raw(`ALTER TABLE cases DROP COLUMN IF EXISTS project_id`);
};
