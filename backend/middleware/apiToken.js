// File: backend/middleware/apiToken.js
//
// Personal API tokens (issue #90). A request carrying
// "Authorization: Bearer ghost_…" is signed in as the token's owner without a
// session cookie; the MCP server and scripts use this, since an account with
// two-factor can't sign in with a password alone.
//
// Runs before express-session. For a token request it sets req.session to a
// plain object with the same fields a signed-in session has, so every route
// and permission check works unchanged, and nothing is written to the session
// store. A header with a wrong or expired ghost_ token is refused outright
// rather than falling back to the cookie.
const { bearerToken } = require('../utils/twoFactor');
const { userForToken, touchToken } = require('../services/accountSecurity');

const done = (cb) => { if (typeof cb === 'function') cb(); };

function tokenSession(user) {
  return {
    userId: user.id,
    username: user.username,
    userRole: user.role,
    regenerate: done,
    save: done,
    destroy: done,
    reload: done,
    touch() {},
  };
}

function apiTokenAuth(pool) {
  return async (req, res, next) => {
    const token = bearerToken(req.headers.authorization);
    if (!token) return next();
    try {
      const user = await userForToken(pool, token);
      if (!user) return res.status(401).json({ error: 'Invalid or expired API token' });
      req.apiToken = { id: user.token_id };
      req.session = tokenSession(user);
      req.sessionID = null;
      touchToken(pool, user.token_id).catch((err) => console.error('API token last-used update failed:', err.message));
      next();
    } catch (err) {
      next(err);
    }
  };
}

module.exports = { apiTokenAuth };
