// Session revocation helper — deletes rows from the user_sessions table (connect-pg-simple).
// The serialised session JSON is stored in the `sess` JSONB column; userId is a top-level key.
async function revokeSessionsForUser(pool, userId, { keepSessionId } = {}) {
  const params = [String(userId)];
  let where = "(sess::jsonb->>'userId')::int = $1";
  if (keepSessionId) {
    params.push(keepSessionId);
    where += ' AND sid <> $2';
  }
  await pool.query(`DELETE FROM user_sessions WHERE ${where}`, params);
}

module.exports = { revokeSessionsForUser };
