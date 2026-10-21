// File: backend/migrations/20261021000001_project_owner_role.js
//
// Adds the 'owner' project role above 'manager' (issue #95). Per-project, like
// the other two: an owner manages one project's settings and its managers and
// investigators, and only an administrator can appoint or remove owners.
//
// No existing row changes. Managers keep their role and the powers they had
// in 2.18.4; nobody becomes an owner until an administrator makes them one.
//
// The CHECK was declared inline in 20260823000001, so Postgres named it
// project_members_project_role_check.

exports.up = async function up(knex) {
  await knex.raw(`
    ALTER TABLE project_members DROP CONSTRAINT IF EXISTS project_members_project_role_check;
    ALTER TABLE project_members ADD CONSTRAINT project_members_project_role_check
      CHECK (project_role IN ('owner', 'manager', 'investigator'));
  `);
};

exports.down = async function down(knex) {
  // Owners fall back to manager, the closest role that existed before.
  await knex.raw(`
    UPDATE project_members SET project_role = 'manager' WHERE project_role = 'owner';
    ALTER TABLE project_members DROP CONSTRAINT IF EXISTS project_members_project_role_check;
    ALTER TABLE project_members ADD CONSTRAINT project_members_project_role_check
      CHECK (project_role IN ('manager', 'investigator'));
  `);
};
