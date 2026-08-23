// File: backend/utils/projectAccess.js
// Project membership enforcement (issue #84). Admin bypasses membership
// entirely (matches pre-#84 behavior); everyone else must hold a
// project_members row to touch that project's data at all, and a
// 'manager' row specifically to edit project settings or membership.
//
// Checks are always a live query, never cached on the session -- unlike
// requireRole's trust of req.session.userRole (fine for a global role that
// changes rarely), membership can change on a much shorter timescale (a
// manager adding/removing a teammate mid-day), so there's nothing safe to
// cache. The "is this session admin" fast-path still trusts
// req.session.userRole, the same trust boundary requireRole already
// relies on elsewhere.
const { pool } = require('../config/database');

async function getUserProjectRole(userId, projectId) {
  const { rows } = await pool.query(
    'SELECT project_role FROM project_members WHERE user_id = $1 AND project_id = $2',
    [userId, projectId]
  );
  return rows[0]?.project_role || null;
}

// Returns null if the session user may access projectId at all (admin, or
// any membership role); otherwise an error message safe to return to the
// client alongside a 403.
async function requireProjectMember(req, projectId) {
  if (req.session.userRole === 'admin') return null;
  if (projectId == null) return 'project_id is required';
  const role = await getUserProjectRole(req.session.userId, projectId);
  if (!role) return `You are not a member of project ${projectId}`;
  return null;
}

// Returns null if the session user may manage projectId's settings/
// membership (admin, or a 'manager' row); otherwise an error message.
async function requireProjectManager(req, projectId) {
  if (req.session.userRole === 'admin') return null;
  if (projectId == null) return 'project_id is required';
  const role = await getUserProjectRole(req.session.userId, projectId);
  if (role !== 'manager') return `Manager access is required for project ${projectId}`;
  return null;
}

// List-endpoint scoping. Mutates `where`/`params` in place (matching the
// incremental where.push/params.push convention every route already uses)
// and returns an error string if the request should be rejected (asked
// for a project_id the caller isn't a member of), otherwise null.
//
// Admin: behaves exactly as before #84 -- filters to req.query.project_id
// if given, otherwise unfiltered (admin's cross-project view).
// Non-admin: filters to req.query.project_id after confirming membership,
// or -- when project_id is omitted entirely -- constrains to every project
// the caller belongs to. This second case is the part a simple permission
// check wouldn't cover: omitting project_id today returns every project's
// rows, so scoping has to happen even when the client asks for nothing in
// particular.
async function applyProjectScope(req, alias, where, params) {
  const { userId, userRole } = req.session;
  const requestedId = req.query.project_id ? parseInt(req.query.project_id, 10) : null;

  if (userRole === 'admin') {
    if (requestedId != null) {
      params.push(requestedId);
      where.push(`${alias}.project_id = $${params.length}`);
    }
    return null;
  }

  if (requestedId != null) {
    const role = await getUserProjectRole(userId, requestedId);
    if (!role) return `You are not a member of project ${requestedId}`;
    params.push(requestedId);
    where.push(`${alias}.project_id = $${params.length}`);
    return null;
  }

  params.push(userId);
  where.push(`${alias}.project_id IN (SELECT project_id FROM project_members WHERE user_id = $${params.length})`);
  return null;
}

module.exports = {
  getUserProjectRole,
  requireProjectMember,
  requireProjectManager,
  applyProjectScope,
};
