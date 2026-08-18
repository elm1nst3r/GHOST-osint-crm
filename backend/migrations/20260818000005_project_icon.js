// File: backend/migrations/20260818000005_project_icon.js
//
// A short symbol/emoji for a project (issue #83 follow-up): the top-bar
// selector shows several projects at once and a plain name list gets hard
// to scan quickly. Free text rather than a fixed icon set -- same reasoning
// as connection_type's free-text role field: an investigator's own
// shorthand, not a managed taxonomy.

exports.up = async function up(knex) {
  await knex.raw(`ALTER TABLE projects ADD COLUMN IF NOT EXISTS icon VARCHAR(8)`);
};

exports.down = async function down(knex) {
  await knex.raw(`ALTER TABLE projects DROP COLUMN IF EXISTS icon`);
};
