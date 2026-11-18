#!/usr/bin/env node
// Sets a new password for an account and signs it out everywhere. The
// password is typed at a hidden prompt (or read from the first line of stdin
// when piped) and must meet the same policy as the app.
//
//   docker exec -it osint-crm-backend node scripts/resetPassword.js [username]
const bcrypt = require('bcryptjs');
const { validatePasswordStrength } = require('../utils/passwordPolicy');
const { createPool, readNewPassword, ask, signOutEverywhere } = require('./lib/cli');

async function main() {
  const pool = createPool();
  try {
    let username = process.argv[2];
    if (!username) {
      const users = await pool.query('SELECT id, username, role FROM users ORDER BY id');
      if (!users.rows.length) {
        console.log('There are no users yet. Create one with scripts/createAdminSimple.js.');
        return;
      }
      console.log('Users:');
      users.rows.forEach((u) => console.log(`  [${u.id}] ${u.username} (${u.role})`));
      username = await ask('Username to reset: ');
    }

    const { rows } = await pool.query('SELECT id, username FROM users WHERE username = $1', [username]);
    if (!rows.length) {
      console.error(`No user named "${username}".`);
      process.exitCode = 1;
      return;
    }
    const user = rows[0];

    const password = await readNewPassword((pw) => validatePasswordStrength(pw, { username: user.username }));
    const passwordHash = await bcrypt.hash(password, 10);
    await pool.query('UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2', [passwordHash, user.id]);
    await signOutEverywhere(pool, user.id);
    await pool.query(
      `INSERT INTO audit_logs (entity_type, entity_id, action, user_id, field_name, new_value)
       VALUES ('user', $1, 'update', NULL, 'password', 'reset_from_command_line')`,
      [user.id]
    );
    console.log(`Password changed for ${user.username}; their existing sessions were signed out.`);
  } catch (err) {
    console.error('Reset failed:', err.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

main();
