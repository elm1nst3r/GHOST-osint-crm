// Guard test (#116): every route must check who may see what it returns.
//
// Project data is protected per route (requireProjectMember on the record's
// project, applyProjectScope on lists). Nothing tied a new route to that, so
// the ledger routes shipped in 2.7 and kept answering for every project after
// project membership arrived in 2.15. This makes a route without a check a CI
// failure. A route that serves no project data goes in NO_PROJECT_DATA below,
// with the reason.

const fs = require('fs');
const path = require('path');

const BACKEND_DIR = path.join(__dirname, '..');
const ROUTE_RE = /(?:router|app)\.(get|post|put|patch|delete)\(\s*['"`]([^'"`]*)['"`]/g;

// Any of these in the handler counts as an access check.
const CHECKS = [
  'requireProjectMember', 'requireProjectManager', 'requireAdmin', 'applyProjectScope',
  'openEntity', // ledger.js: membership of the entity's project
  'canManageTool', 'loadVisibleTool', 'visibilityCondition', // utils/toolAccess.js
  'project_members',
];

// Whole files whose routes serve no project data.
const FILES_WITHOUT_PROJECT_DATA = {
  'account.js': "the caller's own sign-in settings, scoped to req.session.userId",
  'auth.js': 'signing in and out, the caller\'s own profile',
  'oidc.js': 'single sign-on flow',
  'scratchpad.js': "the caller's private notes, every query filters by req.session.userId",
  'apiDocs.js': 'API documentation page',
};

// Single routes that serve no project data.
const NO_PROJECT_DATA = {
  'geocoding.js GET /': 'looks up an address typed by the caller',
  'geocoding.js GET /suggestions': 'address suggestions for text typed by the caller',
  'geocoding.js POST /address': 'geocodes an address typed by the caller',
  'geocoding.js GET /stats': 'cache counters, no addresses',
  'integrations.js GET /': 'installed integration manifests (instance configuration)',
  'integrations.js GET /:integrationId': 'one integration manifest',
  'settings.js GET /branding': 'instance branding, shown on the sign-in page',
  'settings.js GET /custom-fields': 'instance field definitions',
  'settings.js GET /tools': 'whether users may add tools',
  'settings.js GET /modules': 'which modules are switched on',
  'settings.js GET /model-options': 'dropdown options (instance data model)',
  'tools.js POST /': "creates a tool owned by the caller; sharing it is limited to the caller's projects (resolveSharing)",
  'tools.js POST /bulk-import': 'creates private link tools owned by the caller',
  'users.js GET /directory': 'active usernames for the member picker, no project data',
  'server.js GET /api/openapi.json': 'API description',
  'server.js GET /api': 'banner',
  'server.js GET /api/version': 'version; release details only for admins',
  'server.js GET /api/health': 'health probe',
};

// The handler's own code: from its declaration to the first line that closes
// it ("});" at the start of a line).
function routesIn(file) {
  const src = fs.readFileSync(file, 'utf8');
  return [...src.matchAll(ROUTE_RE)].map((m) => {
    const end = src.indexOf('\n});', m.index);
    return {
      key: `${path.basename(file)} ${m[1].toUpperCase()} ${m[2]}`,
      source: src.slice(m.index, end === -1 ? src.length : end),
    };
  });
}

const files = [
  ...fs.readdirSync(path.join(BACKEND_DIR, 'routes')).filter((f) => f.endsWith('.js')).map((f) => path.join(BACKEND_DIR, 'routes', f)),
  path.join(BACKEND_DIR, 'server.js'),
];
const routes = files.flatMap(routesIn);

describe('project access on every route (#116)', () => {
  test('the scan finds the routes', () => {
    expect(routes.length).toBeGreaterThan(150);
    expect(routes.map((r) => r.key)).toContain('ledger.js GET /:entityType/:id/ledger');
  });

  test('every route checks access, or is listed as serving no project data', () => {
    const missing = routes
      .filter((r) => !FILES_WITHOUT_PROJECT_DATA[r.key.split(' ')[0]])
      .filter((r) => !NO_PROJECT_DATA[r.key])
      .filter((r) => !CHECKS.some((c) => r.source.includes(c)))
      .map((r) => r.key);
    expect(missing).toEqual([]);
  });

  test('the exception list has no stale entries', () => {
    const keys = new Set(routes.map((r) => r.key));
    expect(Object.keys(NO_PROJECT_DATA).filter((k) => !keys.has(k))).toEqual([]);
  });
});
