// Guard test: every Express route must appear in the OpenAPI document, and
// every documented operation must have a route behind it.
//
// The spec's paths are hand-listed in openapiSpec.js, so nothing ties them to
// the routers. That let ~30 endpoints ship undocumented — all of crypto
// wallets, project membership, import/export — which also hid them from the
// MCP server and the published API catalogue, both generated from the spec.
// This makes a missing entry a CI failure. A route that genuinely shouldn't be
// documented goes in UNDOCUMENTED below, with the reason.

const fs = require('fs');
const path = require('path');
const spec = require('./openapiSpec');

const BACKEND_DIR = path.join(__dirname, '..');
const METHODS = 'get|post|put|patch|delete';

const UNDOCUMENTED = new Set([
  'GET /', // bare "hello" banner at /api
]);

// Path params are compared by position, not name: /people/:id ≡ /people/{id}.
const normalise = (method, routePath) =>
  `${method.toUpperCase()} ${routePath.replace(/\/$/, '').replace(/:\w+|\{\w+\}/g, '{}') || '/'}`;

function expressRoutes() {
  const server = fs.readFileSync(path.join(BACKEND_DIR, 'server.js'), 'utf8');
  const routes = new Set();

  // const peopleRoutes = require('./routes/people')  →  { peopleRoutes: 'people' }
  const routerFiles = {};
  for (const m of server.matchAll(/const (\w+) = require\('\.\/routes\/(\w+)'\)/g)) {
    routerFiles[m[1]] = m[2];
  }

  // app.use('/api/people', peopleRoutes)
  for (const mount of server.matchAll(/app\.use\('\/api([^']*)', (\w+)\)/g)) {
    const file = routerFiles[mount[2]];
    if (!file) continue;
    const src = fs.readFileSync(path.join(BACKEND_DIR, 'routes', `${file}.js`), 'utf8');
    const routeRe = new RegExp(`router\\.(${METHODS})\\(\\s*['"\`]([^'"\`]*)['"\`]`, 'g');
    for (const r of src.matchAll(routeRe)) routes.add(normalise(r[1], mount[1] + r[2]));
  }

  // Routes declared directly on the app: app.get('/api/version', …)
  const appRe = new RegExp(`^app\\.(${METHODS})\\(\\s*'/api([^']*)'`, 'gm');
  for (const r of server.matchAll(appRe)) routes.add(normalise(r[1], r[2]));

  return routes;
}

function documentedOperations() {
  const ops = new Set();
  for (const [routePath, operations] of Object.entries(spec.paths)) {
    for (const method of Object.keys(operations)) ops.add(normalise(method, routePath));
  }
  return ops;
}

describe('OpenAPI coverage', () => {
  const routes = expressRoutes();
  const documented = documentedOperations();

  test('the route scan finds the API (guards against the regexes going stale)', () => {
    expect(routes.size).toBeGreaterThan(100);
    expect(routes.has('GET /people/{}')).toBe(true);
    expect(routes.has('GET /version')).toBe(true);
  });

  test('every route is documented', () => {
    const missing = [...routes].filter((r) => !documented.has(r) && !UNDOCUMENTED.has(r));
    expect(missing).toEqual([]);
  });

  test('every documented operation has a route', () => {
    const stale = [...documented].filter((d) => !routes.has(d));
    expect(stale).toEqual([]);
  });

  test('the ignore list has no dead entries', () => {
    const dead = [...UNDOCUMENTED].filter((r) => !routes.has(r));
    expect(dead).toEqual([]);
  });
});
