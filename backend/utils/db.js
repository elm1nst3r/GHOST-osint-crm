// One database transaction: fn(client) runs between BEGIN and COMMIT; any
// error rolls everything back and is rethrown, so a half-finished save (a
// person updated but their connections deleted and not re-added) can't stay
// behind.
const { pool } = require('../config/database');

async function inTransaction(fn, db = pool) {
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

module.exports = { inTransaction };
