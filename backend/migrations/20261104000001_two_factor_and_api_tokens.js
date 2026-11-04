// File: backend/migrations/20261104000001_two_factor_and_api_tokens.js
//
// Two-factor sign-in and personal API tokens (issue #90).
//
// - users.totp_*: the authenticator-app secret, encrypted with secretBox
//   (SECRETS_KEY / SESSION_SECRET), plus the last accepted time step so a
//   code can't be replayed inside its 30-second window.
// - user_recovery_codes: one-time codes, stored as SHA-256 hashes.
// - user_passkeys: WebAuthn credentials used as the second step.
// - api_tokens: personal tokens for scripts and the MCP server. Only a
//   SHA-256 hash is stored; the token itself is shown once.

exports.up = async function up(knex) {
  await knex.raw(`
    ALTER TABLE users
      ADD COLUMN IF NOT EXISTS totp_secret TEXT,
      ADD COLUMN IF NOT EXISTS totp_enabled_at TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS totp_last_step BIGINT
  `);

  await knex.raw(`
    CREATE TABLE IF NOT EXISTS user_recovery_codes (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      code_hash VARCHAR(64) NOT NULL,
      used_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await knex.raw('CREATE INDEX IF NOT EXISTS idx_user_recovery_codes_user ON user_recovery_codes(user_id)');

  await knex.raw(`
    CREATE TABLE IF NOT EXISTS user_passkeys (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      credential_id TEXT NOT NULL UNIQUE,
      public_key BYTEA NOT NULL,
      counter BIGINT NOT NULL DEFAULT 0,
      transports TEXT[] NOT NULL DEFAULT '{}',
      rp_id VARCHAR(255) NOT NULL,
      device_type VARCHAR(32),
      backed_up BOOLEAN NOT NULL DEFAULT FALSE,
      name VARCHAR(100) NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      last_used_at TIMESTAMPTZ
    )
  `);
  await knex.raw('CREATE INDEX IF NOT EXISTS idx_user_passkeys_user ON user_passkeys(user_id)');

  await knex.raw(`
    CREATE TABLE IF NOT EXISTS api_tokens (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name VARCHAR(100) NOT NULL,
      token_hash VARCHAR(64) NOT NULL UNIQUE,
      token_hint VARCHAR(16) NOT NULL,
      expires_at TIMESTAMPTZ,
      last_used_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await knex.raw('CREATE INDEX IF NOT EXISTS idx_api_tokens_user ON api_tokens(user_id)');
};

exports.down = async function down(knex) {
  await knex.raw('DROP TABLE IF EXISTS api_tokens');
  await knex.raw('DROP TABLE IF EXISTS user_passkeys');
  await knex.raw('DROP TABLE IF EXISTS user_recovery_codes');
  await knex.raw(`
    ALTER TABLE users
      DROP COLUMN IF EXISTS totp_secret,
      DROP COLUMN IF EXISTS totp_enabled_at,
      DROP COLUMN IF EXISTS totp_last_step
  `);
};
