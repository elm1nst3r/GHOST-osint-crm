#!/usr/bin/env node
// Turns off two-step verification for one account (issue #90): removes its
// authenticator app, passkeys and recovery codes and signs it out everywhere.
// For an admin who lost their phone and has no other admin to reset it from
// Settings → Users. The user then signs in with their password alone (or, if
// "require two-step" is on, goes straight to the setup screen).
//
//   docker exec -it osint-crm-backend node scripts/resetTwoFactor.js <username>
const { Pool } = require('pg');
const { resetMfa } = require('../services/accountSecurity');
const { revokeSessionsForUser } = require('../utils/sessions');

const username = process.argv[2];
if (!username) {
  console.error('Usage: node scripts/resetTwoFactor.js <username>');
  process.exit(1);
}

const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'osint_crm_db',
  password: process.env.DB_PASSWORD || 'changeme',
  port: parseInt(process.env.DB_PORT || '5432', 10),
});

(async () => {
  try {
    const { rows } = await pool.query('SELECT id, username FROM users WHERE username = $1', [username]);
    if (!rows.length) {
      console.error(`No user named "${username}".`);
      process.exitCode = 1;
      return;
    }
    const user = rows[0];
    await resetMfa(pool, user.id);
    await revokeSessionsForUser(pool, user.id);
    await pool.query(
      `INSERT INTO audit_logs (entity_type, entity_id, action, user_id, field_name, new_value)
       VALUES ('user', $1, 'update', NULL, 'two_factor', 'reset_from_command_line')`,
      [user.id]
    );
    console.log(`Two-step verification is off for ${user.username}. They can now sign in with their password.`);
  } catch (err) {
    console.error('Reset failed:', err.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
})();
