// File: backend/utils/transaction.js
// Runs `work(client)` inside BEGIN/COMMIT on one pooled connection, rolling
// back if it throws (the error is rethrown for the route to handle).
const { pool } = require('../config/database');

async function inTransaction(work) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await work(client);
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
