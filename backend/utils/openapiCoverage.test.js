// Guard test: every Express route must appear in the OpenAPI document, and
// every documented operation must have a route behind it.
//
// The spec's paths are hand-listed in openapiSpec.js, so nothing ties them to
// the routers. That let ~30 endpoints ship undocumented — all of crypto
// wallets, project membership, import/export — which also hid them from the
// MCP server and the published API catalogue, both generated from the spec.
// This makes a missing entry a CI failure. A route that genuinely shouldn't be
// documented goes in UNDOCUMENTED below, with the reason.
//
// It also checks two things per operation that were wrong for a long time
// without anyone noticing: the query parameters (advanced search documented
// `q` while the route read `searchText`, so the MCP tool searched for nothing)
// and the admin-only flag.

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

// Splits a source file into one entry per route declaration. `source` runs to
// the next declaration, so it is the handler plus whatever sits below it.
function handlersIn(src, prefix, routeRe) {
  const matches = [...src.matchAll(routeRe)];
  return matches.map((m, i) => ({
    key: normalise(m[1], prefix + m[2]),
    declaration: src.slice(m.index, src.indexOf('\n', m.index)),
    source: src.slice(m.index, i + 1 < matches.length ? matches[i + 1].index : src.length),
  }));
}

function expressHandlers() {
  const server = fs.readFileSync(path.join(BACKEND_DIR, 'server.js'), 'utf8');
  const handlers = [];

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
    handlers.push(...handlersIn(src, mount[1], routeRe));
  }

  // Routes declared directly on the app: app.get('/api/version', …)
  const appRe = new RegExp(`^app\\.(${METHODS})\\(\\s*'/api([^']*)'`, 'gm');
  handlers.push(...handlersIn(server, '', appRe));

  return handlers;
}

// Query parameter names a handler reads, across the access styles in use:
//   req.query.foo            req.query['foo[]']
//   const { foo, bar = 1 } = req.query
//   const q = req.query; ... q.foo        (transactions.js)
//   applyProjectScope(req, …)             (reads project_id)
function queryParamsRead(source) {
  const names = new Set();
  for (const m of source.matchAll(/req\.query\.(\w+)/g)) names.add(m[1]);
  for (const m of source.matchAll(/req\.query\['([^']+)'\]/g)) names.add(m[1]);
  for (const m of source.matchAll(/(?:const|let)\s*\{([^}]+)\}\s*=\s*req\.query/g)) {
    m[1].split(',').forEach((part) => {
      const name = part.split(/[=:]/)[0].trim();
      if (name) names.add(name);
    });
  }
  const alias = source.match(/(?:const|let)\s+(\w+)\s*=\s*req\.query\s*;/);
  if (alias) {
    for (const m of source.matchAll(new RegExp(`\\b${alias[1]}\\.(\\w+)`, 'g'))) names.add(m[1]);
  }
  if (/applyProjectScope\(req/.test(source)) names.add('project_id');
  return names;
}

function documentedOperations() {
  const ops = new Map();
  for (const [routePath, operations] of Object.entries(spec.paths)) {
    for (const [method, operation] of Object.entries(operations)) {
      ops.set(normalise(method, routePath), operation);
    }
  }
  return ops;
}

describe('OpenAPI coverage', () => {
  const handlers = expressHandlers();
  const routes = new Set(handlers.map((h) => h.key));
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
    const stale = [...documented.keys()].filter((d) => !routes.has(d));
    expect(stale).toEqual([]);
  });

  test('documented query parameters are exactly the ones each handler reads', () => {
    const problems = [];
    for (const { key, source } of handlers) {
      const operation = documented.get(key);
      if (!operation) continue;
      const read = queryParamsRead(source);
      const declared = new Set(
        (operation.parameters || []).filter((p) => p.in === 'query').map((p) => p.name)
      );
      const undocumented = [...read].filter((name) => !declared.has(name));
      const unread = [...declared].filter((name) => !read.has(name));
      if (undocumented.length) problems.push(`${key}: reads ${undocumented.join(', ')} but the spec omits it`);
      if (unread.length) problems.push(`${key}: spec lists ${unread.join(', ')} but the handler never reads it`);
    }
    expect(problems).toEqual([]);
  });

  test('x-requires-admin matches requireAdmin on the route', () => {
    const problems = [];
    for (const { key, declaration } of handlers) {
      const operation = documented.get(key);
      if (!operation) continue;
      const routeIsAdmin = /requireAdmin/.test(declaration);
      const specIsAdmin = Boolean(operation['x-requires-admin']);
      if (routeIsAdmin !== specIsAdmin) {
        problems.push(`${key}: route ${routeIsAdmin ? 'requires' : 'does not require'} admin, spec says otherwise`);
      }
    }
    expect(problems).toEqual([]);
  });

  test('the ignore list has no dead entries', () => {
    const dead = [...UNDOCUMENTED].filter((r) => !routes.has(r));
    expect(dead).toEqual([]);
  });
});
