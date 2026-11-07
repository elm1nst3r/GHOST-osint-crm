// File: backend/migrations/20261107000001_sso.js
//
// Single sign-on through OpenID Connect (issue #105).
//
// - user_identities ties a GHOST user to an identity at an identity provider,
//   by the provider's issuer and its permanent subject id, never by email or
//   username (those can change or be reused). One user can have several.
// - sso_pending holds sign-ins that matched no linked identity: an admin
//   links them to an existing user or creates a user for them (Users).
// - users.password_hash becomes optional: a user created from a single
//   sign-on identity has no GHOST password and can't use the password login.

exports.up = async function up(knex) {
  await knex.raw('ALTER TABLE users ALTER COLUMN password_hash DROP NOT NULL');
  await knex.raw(`
    CREATE TABLE IF NOT EXISTS user_identities (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      issuer TEXT NOT NULL,
      subject TEXT NOT NULL,
      email TEXT,
      display_name TEXT,
      linked_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
      created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
      last_login_at TIMESTAMPTZ,
      CONSTRAINT user_identities_unique UNIQUE (issuer, subject)
    )
  `);
  await knex.raw('CREATE INDEX IF NOT EXISTS idx_user_identities_user ON user_identities(user_id)');
  await knex.raw(`
    CREATE TABLE IF NOT EXISTS sso_pending (
      id SERIAL PRIMARY KEY,
      issuer TEXT NOT NULL,
      subject TEXT NOT NULL,
      email TEXT,
      email_verified BOOLEAN,
      display_name TEXT,
      preferred_username TEXT,
      reason TEXT,
      attempts INTEGER NOT NULL DEFAULT 1,
      first_attempt_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
      last_attempt_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT sso_pending_unique UNIQUE (issuer, subject)
    )
  `);
};

exports.down = async function down(knex) {
  await knex.raw('DROP TABLE IF EXISTS sso_pending');
  await knex.raw('DROP TABLE IF EXISTS user_identities');
  // Users without a password would block NOT NULL; give them an unusable hash first.
  await knex.raw("UPDATE users SET password_hash = '!' WHERE password_hash IS NULL");
  await knex.raw('ALTER TABLE users ALTER COLUMN password_hash SET NOT NULL');
};
