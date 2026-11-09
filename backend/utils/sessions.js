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

// Ends the single sign-on sessions a provider's logout token names (issue
// #105): the provider's session (sid), or every session of the user (sub)
// when there is no sid. Sessions from before sid was stored (3.1.0/3.1.1)
// have none; they end on any logout for their user.
//
// The user's other sessions are checked with the provider on their next
// request: Keycloak's "sign out" for a whole user sends a single token
// naming one sid, while signing out one session must leave the others on.
// Returns the GHOST user id of each ended session.
async function endSsoSessions(pool, { issuer, sid = null, sub = null }) {
  const { rows } = await pool.query(
    `DELETE FROM user_sessions
     WHERE sess::jsonb->'sso'->>'issuer' = $1
       AND (
         ($2::text IS NOT NULL AND sess::jsonb->'sso'->>'sid' = $2::text)
         OR (($2::text IS NULL OR sess::jsonb->'sso'->>'sid' IS NULL)
             AND (sess::jsonb->>'userId')::int IN (SELECT user_id FROM user_identities WHERE issuer = $1 AND subject = $3::text))
       )
     RETURNING (sess::jsonb->>'userId')::int AS user_id`,
    [issuer, sid, sub]
  );
  if (sid && sub) {
    await pool.query(
      `UPDATE user_sessions SET sess = jsonb_set(sess::jsonb, '{sso,recheck}', 'true')::json
       WHERE sess::jsonb->'sso'->>'issuer' = $1 AND sess::jsonb->'sso' ? 'refresh'
         AND (sess::jsonb->>'userId')::int IN (SELECT user_id FROM user_identities WHERE issuer = $1 AND subject = $2)`,
      [issuer, sub]
    );
  }
  return rows.map((r) => r.user_id);
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

module.exports = { revokeSessionsForUser, endSsoSessions, regenerateSession, saveSession, establishSession };
