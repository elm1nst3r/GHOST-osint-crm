// Shared helpers for the operator scripts in backend/scripts.
const { Pool } = require('pg');
const readline = require('readline');

function createPool() {
  return new Pool({
    user: process.env.DB_USER || 'postgres',
    host: process.env.DB_HOST || 'localhost',
    database: process.env.DB_NAME || 'osint_crm_db',
    password: process.env.DB_PASSWORD,
    port: parseInt(process.env.DB_PORT || '5432', 10),
  });
}

// Reads one line from the terminal without echoing it. When stdin is not a
// terminal (e.g. `printf '%s\n' "$PW" | docker exec -i ...`), reads the first
// line of stdin instead, so a password never has to appear in the command.
function readSecret(prompt) {
  return new Promise((resolve, reject) => {
    const input = process.stdin;
    if (!input.isTTY) {
      const rl = readline.createInterface({ input });
      let done = false;
      rl.once('line', (line) => { done = true; rl.close(); resolve(line); });
      rl.once('close', () => { if (!done) resolve(''); });
      rl.once('error', reject);
      return;
    }
    process.stdout.write(prompt);
    input.setRawMode(true);
    input.resume();
    input.setEncoding('utf8');
    let value = '';
    const onData = (chunk) => {
      for (const ch of chunk) {
        if (ch === '\r' || ch === '\n' || ch === '\u0004') {
          input.setRawMode(false);
          input.pause();
          input.removeListener('data', onData);
          process.stdout.write('\n');
          resolve(value);
          return;
        }
        if (ch === '\u0003') { // Ctrl-C
          input.setRawMode(false);
          process.stdout.write('\n');
          process.exit(130);
        }
        if (ch === '\u007f' || ch === '\b') value = value.slice(0, -1);
        else value += ch;
      }
    };
    input.on('data', onData);
  });
}

// Asks for a new password (twice on a terminal) until it meets the policy.
async function readNewPassword(validate) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const password = await readSecret('New password: ');
    const { valid, errors } = validate(password);
    if (!valid) {
      console.error(errors.map((e) => `  - ${e}`).join('\n'));
      if (!process.stdin.isTTY) break;
      continue;
    }
    if (process.stdin.isTTY) {
      const again = await readSecret('Repeat password: ');
      if (again !== password) {
        console.error('  - The passwords do not match.');
        continue;
      }
    }
    return password;
  }
  throw new Error('No valid password given.');
}

// Signs a user out everywhere. The sessions table is created by the server
// on its first start, so before that there is nothing to sign out.
async function signOutEverywhere(pool, userId) {
  const { revokeSessionsForUser } = require('../../utils/sessions');
  try {
    await revokeSessionsForUser(pool, userId);
  } catch (err) {
    if (err.code !== '42P01') throw err; // undefined_table
  }
}

function ask(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => rl.question(question, (answer) => { rl.close(); resolve(answer.trim()); }));
}

module.exports = { createPool, readSecret, readNewPassword, ask, signOutEverywhere };
