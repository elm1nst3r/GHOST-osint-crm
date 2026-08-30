// File: backend/migrations/20260830000001_project_archived_at.js
//
// Records when a project entered the 'closed' (archived) state, so the
// optional archived-project retention policy (issue #88) has a clock to
// count from. Maintained by routes/projects.js on status transitions:
// set when status becomes 'closed', cleared when it leaves.
//
// Existing 'closed' projects are backfilled to their updated_at — the best
// available approximation of when they were archived — so a freshly
// configured retention policy doesn't immediately delete long-closed
// projects with no recorded archive date (it would still respect the
// configured window from that timestamp).

exports.up = async function up(knex) {
  await knex.raw(`ALTER TABLE projects ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ`);
  await knex.raw(`UPDATE projects SET archived_at = updated_at WHERE status = 'closed' AND archived_at IS NULL`);
};

exports.down = async function down(knex) {
  await knex.raw(`ALTER TABLE projects DROP COLUMN IF EXISTS archived_at`);
};
