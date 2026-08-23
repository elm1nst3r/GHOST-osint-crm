// File: backend/migrations/20260823000001_project_members.js
//
// User-to-project membership (issue #84, follow-up to #83). Today
// GET/POST/PUT/DELETE /api/projects only check requireAuth -- any
// authenticated user can list/edit/delete any project, and every
// project-scoped list endpoint treats project_id as an optional filter
// (omit it and the query returns every project's rows unfiltered). This is
// the missing primitive that closes that gap: a per-(user, project)
// membership row carrying a project-scoped role.
//
// project_role is intentionally NOT on `users` -- hunterghoul1's own use
// case has one user be a 'manager' on one project and just an
// 'investigator' on another, so the role has to live on the membership
// row, not globally. `users.role` ('admin'/'user') is untouched; admin
// still bypasses membership entirely and sees everything, matching current
// behavior.
//
// Backfill: every existing 'user'-role user gets an 'investigator' row on
// every existing project, so the upgrade doesn't silently lock anyone out
// of data they could already see yesterday -- an admin tightens membership
// afterward if they want to (same reasoning #83 used backfilling
// project_id onto a Default Project rather than leaving rows orphaned).

exports.up = async function up(knex) {
  await knex.raw(`
    CREATE TABLE IF NOT EXISTS project_members (
      id SERIAL PRIMARY KEY,
      project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      project_role VARCHAR(20) NOT NULL CHECK (project_role IN ('manager', 'investigator')),
      created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
      UNIQUE (project_id, user_id)
    );
  `);
  await knex.raw(`
    DROP TRIGGER IF EXISTS set_timestamp ON project_members;
    CREATE TRIGGER set_timestamp
    BEFORE UPDATE ON project_members
    FOR EACH ROW
    EXECUTE PROCEDURE trigger_set_timestamp();
  `);
  await knex.raw(`CREATE INDEX IF NOT EXISTS idx_project_members_project ON project_members(project_id)`);
  await knex.raw(`CREATE INDEX IF NOT EXISTS idx_project_members_user ON project_members(user_id)`);

  await knex.raw(`
    INSERT INTO project_members (project_id, user_id, project_role)
    SELECT p.id, u.id, 'investigator'
    FROM projects p
    CROSS JOIN users u
    WHERE u.role = 'user'
    ON CONFLICT (project_id, user_id) DO NOTHING
  `);
};

exports.down = async function down(knex) {
  await knex.raw(`DROP TABLE IF EXISTS project_members`);
};
