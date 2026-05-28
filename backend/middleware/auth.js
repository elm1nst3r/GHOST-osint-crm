// Authentication middleware
const requireAuth = (req, res, next) => {
  if (!req.session || !req.session.userId) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  next();
};

// Role-based authorization middleware
const requireRole = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.session || !req.session.userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

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
  if (!req.session || !req.session.userId) {
    return res.status(401).json({ error: 'Authentication required' });
  }

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
  requireRole,
  requireAdmin
};
