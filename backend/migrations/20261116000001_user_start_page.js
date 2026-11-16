// File: backend/migrations/20261116000001_user_start_page.js
//
// Start page per user (graph plan, phase 4): the section GHOST opens on
// after sign-in (Dashboard, Entity Network, People…). NULL = the dashboard.
// A section id as the frontend names it; one that's switched off or gone
// falls back to the dashboard there.

exports.up = async function up(knex) {
  await knex.raw('ALTER TABLE users ADD COLUMN IF NOT EXISTS start_page VARCHAR(40)');
};

exports.down = async function down(knex) {
  await knex.raw('ALTER TABLE users DROP COLUMN IF EXISTS start_page');
};
