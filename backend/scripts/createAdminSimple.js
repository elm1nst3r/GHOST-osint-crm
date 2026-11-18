#!/usr/bin/env node
// Creates an admin account. The password is typed at a hidden prompt (or read
// from the first line of stdin when piped), never passed as an argument, so it
// doesn't end up in shell history or process listings.
//
//   docker exec -it osint-crm-backend node scripts/createAdminSimple.js <username> [email] [firstName] [lastName]
//
// Pass "-" as the email to skip it but still set a name.
const bcrypt = require('bcryptjs');
const { validatePasswordStrength } = require('../utils/passwordPolicy');
const { createPool, readNewPassword } = require('./lib/cli');

const USAGE = 'Usage: node scripts/createAdminSimple.js <username> [email] [firstName] [lastName]';

async function main() {
  const [username, emailArg, firstName = 'Admin', lastName = 'User'] = process.argv.slice(2);
  if (!username) {
    console.error(USAGE);
    process.exitCode = 1;
    return;
  }
  if (emailArg && emailArg !== '-' && !emailArg.includes('@')) {
    console.error('The second argument is the email address. Passwords are no longer accepted on the');
    console.error('command line: run the command without it and type the password at the prompt.');
    console.error(USAGE);
    process.exitCode = 1;
    return;
  }
  const email = emailArg && emailArg !== '-' ? emailArg : null;

  const pool = createPool();
  try {
    const existing = await pool.query('SELECT 1 FROM users WHERE username = $1', [username]);
    if (existing.rows.length) {
      console.error(`A user named "${username}" already exists. To change its password, run scripts/resetPassword.js.`);
      process.exitCode = 1;
      return;
    }

    console.log(`Creating admin "${username}". The password must have 12+ characters, upper and lower case, and a digit.`);
    const password = await readNewPassword((pw) => validatePasswordStrength(pw, { username }));
    const passwordHash = await bcrypt.hash(password, 10);

    const { rows } = await pool.query(
      `INSERT INTO users (username, email, password_hash, first_name, last_name, role, is_active)
       VALUES ($1, $2, $3, $4, $5, 'admin', true)
       RETURNING id, username, email, first_name, last_name, role`,
      [username, email, passwordHash, firstName, lastName]
    );
    const user = rows[0];
    await pool.query(
      `INSERT INTO audit_logs (entity_type, entity_id, action, user_id, field_name, new_value)
       VALUES ('user', $1, 'create', NULL, 'role', 'admin_created_from_command_line')`,
      [user.id]
    );
    console.log(`Admin created: [${user.id}] ${user.username}${user.email ? ` <${user.email}>` : ''} (${user.first_name} ${user.last_name})`);
  } catch (err) {
    console.error('Could not create the admin:', err.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

main();
