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

// Admin-only middleware
const requireAdmin = requireRole('admin');

module.exports = {
  requireAuth,
  requireRole,
  requireAdmin
};
