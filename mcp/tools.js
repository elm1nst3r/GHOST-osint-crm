// Tool generation from the OpenAPI document. Pure — no network, no MCP SDK —
// so the API catalogue build (backend/scripts/build-api-docs.js) can import it
// to label each endpoint with the tool it becomes.

function resolveRef(spec, schema) {
  if (schema && schema.$ref) {
    const name = schema.$ref.split('/').pop();
    return spec.components.schemas[name] || { type: 'object' };
  }
  return schema;
}

// ghost_ + verb + path segments (params dropped, hyphens → underscores).
// GET /people → ghost_get_people; GET /people/{id} → ghost_get_people_by_id;
// POST /transactions → ghost_create_transactions.
const VERB = { get: 'get', post: 'create', put: 'update', delete: 'delete' };

export function toolName(method, path) {
  const segments = path.split('/').filter(Boolean).filter((s) => !s.startsWith('{'));
  let name = `ghost_${VERB[method]}_${segments.join('_').replace(/-/g, '_')}`;
  if (method === 'get' && path.endsWith('}')) name += '_by_id';
  return name;
}

// Whether an operation becomes a tool. Skipped: auth (the session is managed
// by this server), anything the API marks x-mcp-exclude (instance settings,
// whole-database export/import, health probes), and bodies that aren't JSON
// (file uploads can't be expressed as tool arguments).
export function isToolOperation(path, method, operation) {
  if (!VERB[method]) return false;
  if (path.startsWith('/auth/')) return false;
  if (operation['x-mcp-exclude']) return false;
  if (operation.requestBody && !operation.requestBody.content?.['application/json']) return false;
  return true;
}

// MCP clients reject a whole tool list if one argument name falls outside
// [a-zA-Z0-9_.-], and the API has array filters named like `searchIn[]`. The
// tool argument drops the brackets; the request still uses the real name.
export const argName = (paramName) => paramName.replace(/\[\]$/, '');

export function buildTools(spec) {
  // name → { method, pathTemplate, pathParams, queryParams: [{ arg, name }], hasBody }
  const registry = new Map();
  const tools = [];
  const collisions = [];

  for (const [path, ops] of Object.entries(spec.paths)) {
    for (const [method, operation] of Object.entries(ops)) {
      if (!isToolOperation(path, method, operation)) continue;

      const name = toolName(method, path);
      if (registry.has(name)) {
        // Two endpoints mapping to one name: keep the first and report the
        // other. The API's own checks fail on this before a release; at
        // runtime, losing one tool beats refusing to start.
        const first = registry.get(name);
        collisions.push(
          `${name}: ${method.toUpperCase()} ${path} skipped, already used by ` +
          `${first.method.toUpperCase()} ${first.pathTemplate}`
        );
        continue;
      }

      const properties = {};
      const required = [];
      const pathParams = [];
      const queryParams = [];

      for (const p of operation.parameters || []) {
        const arg = argName(p.name);
        properties[arg] = { ...p.schema, description: p.description || `${p.in} parameter` };
        if (p.in === 'path') pathParams.push(p.name);
        else queryParams.push({ arg, name: p.name });
        if (p.in === 'path' || p.required) required.push(arg);
      }

      let hasBody = false;
      if (operation.requestBody) {
        hasBody = true;
        const bodySchema = resolveRef(spec, operation.requestBody.content['application/json'].schema);
        Object.assign(properties, bodySchema.properties || {});
        for (const r of bodySchema.required || []) {
          if (!required.includes(r)) required.push(r);
        }
      }

      let description = operation.summary || `${method.toUpperCase()} ${path}`;
      if (operation.description) description += `. ${operation.description}`;
      if (operation['x-requires-admin']) description += ' (admin only)';

      registry.set(name, { method, pathTemplate: path, pathParams, queryParams, hasBody });
      tools.push({
        name,
        description,
        inputSchema: { type: 'object', properties, ...(required.length && { required }) },
      });
    }
  }

  return { tools, registry, collisions };
}
