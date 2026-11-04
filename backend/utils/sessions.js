// Session helpers.

// Revocation — deletes rows from the user_sessions table (connect-pg-simple).
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

const regenerateSession = (req) => new Promise((resolve, reject) => {
  req.session.regenerate((err) => (err ? reject(err) : resolve()));
});

const saveSession = (req) => new Promise((resolve, reject) => {
  req.session.save((err) => (err ? reject(err) : resolve()));
});

// Turns the request's session into a signed-in one. A fresh session id every
// time, so an id seen before sign-in is worthless after (issue #29).
// mfaSetupRequired: "require two-factor" is on and this user has none yet.
async function establishSession(req, user, { mfaSetupRequired = false } = {}) {
  await regenerateSession(req);
  req.session.userId = user.id;
  req.session.username = user.username;
  req.session.userRole = user.role;
  if (mfaSetupRequired) req.session.mfaSetupRequired = true;
  await saveSession(req);
}

module.exports = { revokeSessionsForUser, regenerateSession, saveSession, establishSession };
