// File: backend/migrations/20261104000002_rate_limits.js
//
// Counters for the security-relevant rate limits (login, second sign-in
// step, integrated tool searches). Kept in Postgres instead of process
// memory so a restart doesn't hand an attacker a fresh set of attempts, and
// several backend instances share one count. See middleware/rateLimitStore.js.
exports.up = async function up(knex) {
  await knex.raw(`
    CREATE TABLE IF NOT EXISTS rate_limits (
      key VARCHAR(255) PRIMARY KEY,
      hits INTEGER NOT NULL,
      reset_at TIMESTAMPTZ NOT NULL
    )
  `);
  await knex.raw('CREATE INDEX IF NOT EXISTS idx_rate_limits_reset_at ON rate_limits(reset_at)');
};

exports.down = async function down(knex) {
  await knex.raw('DROP TABLE IF EXISTS rate_limits');
};
