// File: backend/migrations/20261102000001_tool_integrations.js
//
// OSINT Tools become two kinds (issue #96):
//   - 'link'        a bookmark, as every tool was before
//   - 'integration' a tool backed by an integration manifest
//                   (backend/integrations/*.json, or one an admin imported)
//                   that GHOST calls server-side
//
// Ownership and visibility:
//   owner_user_id NULL  -> a central tool, managed by admins
//   owner_user_id set   -> a user's own tool
//   visibility 'all'      every user, every project (central tools only)
//              'projects' only in the projects listed in tool_projects
//              'private'  only its owner (user tools only)
// Every existing tool becomes a central 'all' link, so nobody loses a tool.
//
// API keys live in tool_credentials, encrypted (utils/secretBox.js). A row
// with user_id NULL is the tool's shared key; a row with a user_id is that
// user's own key, used when the tool's credential_mode is 'per_user'.

exports.up = async function up(knex) {
  await knex.raw(`
    CREATE TABLE IF NOT EXISTS integration_manifests (
      id VARCHAR(64) PRIMARY KEY,
      manifest JSONB NOT NULL,
      source VARCHAR(20) NOT NULL CHECK (source IN ('builtin', 'imported')),
      installed_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
      created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
    );
  `);

  await knex.raw(`
    ALTER TABLE tools
      ADD COLUMN IF NOT EXISTS kind VARCHAR(20) NOT NULL DEFAULT 'link',
      ADD COLUMN IF NOT EXISTS integration_id VARCHAR(64) REFERENCES integration_manifests(id) ON DELETE SET NULL,
      ADD COLUMN IF NOT EXISTS owner_user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      ADD COLUMN IF NOT EXISTS visibility VARCHAR(20) NOT NULL DEFAULT 'all',
      ADD COLUMN IF NOT EXISTS enabled BOOLEAN NOT NULL DEFAULT true,
      ADD COLUMN IF NOT EXISTS credential_mode VARCHAR(20) NOT NULL DEFAULT 'shared';
  `);
  await knex.raw(`
    ALTER TABLE tools
      DROP CONSTRAINT IF EXISTS tools_kind_check,
      ADD CONSTRAINT tools_kind_check CHECK (kind IN ('link', 'integration')),
      DROP CONSTRAINT IF EXISTS tools_visibility_check,
      ADD CONSTRAINT tools_visibility_check CHECK (visibility IN ('all', 'projects', 'private')),
      DROP CONSTRAINT IF EXISTS tools_credential_mode_check,
      ADD CONSTRAINT tools_credential_mode_check CHECK (credential_mode IN ('shared', 'per_user'));
  `);
  await knex.raw(`CREATE INDEX IF NOT EXISTS idx_tools_owner ON tools(owner_user_id)`);

  await knex.raw(`
    CREATE TABLE IF NOT EXISTS tool_projects (
      tool_id INTEGER NOT NULL REFERENCES tools(id) ON DELETE CASCADE,
      project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      PRIMARY KEY (tool_id, project_id)
    );
  `);
  await knex.raw(`CREATE INDEX IF NOT EXISTS idx_tool_projects_project ON tool_projects(project_id)`);

  await knex.raw(`
    CREATE TABLE IF NOT EXISTS tool_credentials (
      id SERIAL PRIMARY KEY,
      tool_id INTEGER NOT NULL REFERENCES tools(id) ON DELETE CASCADE,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      secret TEXT NOT NULL,
      updated_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
      updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
    );
  `);
  // NULLs are distinct in a plain UNIQUE, so the shared key needs its own index.
  await knex.raw(`CREATE UNIQUE INDEX IF NOT EXISTS uq_tool_credentials_shared ON tool_credentials(tool_id) WHERE user_id IS NULL`);
  await knex.raw(`CREATE UNIQUE INDEX IF NOT EXISTS uq_tool_credentials_user ON tool_credentials(tool_id, user_id) WHERE user_id IS NOT NULL`);
};

exports.down = async function down(knex) {
  await knex.raw(`DROP TABLE IF EXISTS tool_credentials`);
  await knex.raw(`DROP TABLE IF EXISTS tool_projects`);
  await knex.raw(`
    ALTER TABLE tools
      DROP CONSTRAINT IF EXISTS tools_kind_check,
      DROP CONSTRAINT IF EXISTS tools_visibility_check,
      DROP CONSTRAINT IF EXISTS tools_credential_mode_check,
      DROP COLUMN IF EXISTS credential_mode,
      DROP COLUMN IF EXISTS enabled,
      DROP COLUMN IF EXISTS visibility,
      DROP COLUMN IF EXISTS owner_user_id,
      DROP COLUMN IF EXISTS integration_id,
      DROP COLUMN IF EXISTS kind
  `);
  await knex.raw(`DROP TABLE IF EXISTS integration_manifests`);
};
