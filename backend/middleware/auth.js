// Authentication middleware

// When "require two-factor" is on, a user without it can sign in but reach
// only the setup screen (issue #90). Their session carries mfaSetupRequired
// until they add an authenticator app or a passkey.
const MFA_SETUP_REQUIRED = { error: 'Set up two-factor authentication to continue', code: 'mfa_setup_required' };

const signedIn = (req) => Boolean(req.session && req.session.userId);

const requireAuth = (req, res, next) => {
  if (!signedIn(req)) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  if (req.session.mfaSetupRequired) return res.status(403).json(MFA_SETUP_REQUIRED);
  next();
};

// For the user's own security settings (two-factor, passkeys, API tokens):
// works while two-factor setup is still pending, and never with an API
// token, so a leaked token can't mint more tokens or turn off two-factor.
const requireAccountSession = (req, res, next) => {
  if (!signedIn(req)) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  if (req.apiToken) {
    return res.status(403).json({ error: 'Security settings cannot be changed with an API token', code: 'session_required' });
  }
  next();
};

// Role-based authorization middleware
const requireRole = (...allowedRoles) => {
  return (req, res, next) => {
    if (!signedIn(req)) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    if (req.session.mfaSetupRequired) return res.status(403).json(MFA_SETUP_REQUIRED);

    if (!allowedRoles.includes(req.session.userRole)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    next();
  };
};

// Admin-only middleware — re-validates the user record on every request so that
// role changes and deactivations take effect immediately (issue #32).
// Requires pool to be available on req.app.locals.pool.
const requireAdmin = async (req, res, next) => {
  if (!signedIn(req)) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  if (req.session.mfaSetupRequired) return res.status(403).json(MFA_SETUP_REQUIRED);

  try {
    const pool = req.app.locals.pool;
    const { rows } = await pool.query(
      'SELECT role, is_active FROM users WHERE id = $1',
      [req.session.userId]
    );

    if (!rows.length || !rows[0].is_active) {
      req.session.destroy(() => {});
      return res.status(401).json({ error: 'Account not found or deactivated' });
    }

    if (rows[0].role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    // Keep session role in sync
    req.session.userRole = rows[0].role;
    next();
  } catch (err) {
    console.error('requireAdmin DB check failed:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

module.exports = {
  requireAuth,
  requireAccountSession,
  requireRole,
  requireAdmin
};
