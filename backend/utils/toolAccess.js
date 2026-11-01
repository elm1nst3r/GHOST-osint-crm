// File: backend/utils/toolAccess.js
//
// Who sees and manages which OSINT tool (issue #96).
//
//   Central tools (owner_user_id NULL) are managed by admins only.
//     visibility 'all'      every user, every project
//     visibility 'projects' members of the projects in tool_projects
//   A user's own tools are managed by that user (and admins).
//     visibility 'private'  only the owner
//     visibility 'projects' also members of the chosen projects (the
//                           "share with project" option)
//   Disabled tools are hidden from everyone but admins and their owner.
//
// Admins see every tool when they ask for the full list (all=true), which is
// what the management view uses. In a project context they see what an
// ordinary member of that project would, plus their own.

const ALLOW_USER_TOOLS_KEY = 'tools_allow_user_tools';

// SQL condition on alias `t` for the tools the session user may use.
// Appends to `params`. projectId (optional) narrows 'projects' tools to that
// project; membership of it must have been checked by the caller.
function visibilityCondition({ userId, isAdmin }, { projectId = null, all = false } = {}, params) {
  if (isAdmin && all) return 'TRUE';
  params.push(userId);
  const uid = `$${params.length}`;

  let projectMatch;
  if (projectId != null) {
    params.push(projectId);
    projectMatch = `EXISTS (SELECT 1 FROM tool_projects tp WHERE tp.tool_id = t.id AND tp.project_id = $${params.length})`;
  } else if (isAdmin) {
    projectMatch = 'TRUE';
  } else {
    projectMatch = `EXISTS (SELECT 1 FROM tool_projects tp JOIN project_members pm
                              ON pm.project_id = tp.project_id AND pm.user_id = ${uid}
                            WHERE tp.tool_id = t.id)`;
  }

  const visible = `(t.owner_user_id = ${uid}
    OR (t.owner_user_id IS NULL AND t.visibility = 'all')
    OR (t.visibility = 'projects' AND ${projectMatch}))`;
  return isAdmin ? visible : `(${visible} AND (t.enabled OR t.owner_user_id = ${uid}))`;
}

function canManageTool({ userId, isAdmin }, tool) {
  if (isAdmin) return true;
  return tool.owner_user_id != null && Number(tool.owner_user_id) === Number(userId);
}

// Visibility values a caller may set on a tool they manage.
function allowedVisibilities(tool) {
  return tool.owner_user_id == null ? ['all', 'projects'] : ['private', 'projects'];
}

async function allowUserTools(db) {
  const { rows } = await db.query('SELECT value FROM app_settings WHERE key = $1', [ALLOW_USER_TOOLS_KEY]);
  // Default on: before #96 every user could add tools.
  return rows.length === 0 ? true : rows[0].value !== 'false';
}

const sessionUser = (req) => ({ userId: req.session.userId, isAdmin: req.session.userRole === 'admin' });

module.exports = {
  ALLOW_USER_TOOLS_KEY, visibilityCondition, canManageTool, allowedVisibilities, allowUserTools, sessionUser,
};
