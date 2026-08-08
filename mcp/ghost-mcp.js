#!/usr/bin/env node
// GHOST OSINT CRM MCP server.
// Exposes the GHOST REST API as MCP tools over stdio. Tool definitions are
// generated at startup from the API's own OpenAPI document
// (GET /api/openapi.json), so they can never drift from actual behaviour.
//
// Auth + duplicate-detection patterns adapted from @zbyte64's ghost-mcp.js
// (https://github.com/elm1nst3r/GHOST-osint-crm/issues/44).
//
// Env: GHOST_API_URL (default http://localhost:3001/api)
//      GHOST_USERNAME, GHOST_PASSWORD (required)
//      GHOST_MCP_CACHE=off      disable the on-disk session/spec cache
//      GHOST_MCP_SPEC_TTL=600   seconds before a cached OpenAPI spec is refetched

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

const API_URL = process.env.GHOST_API_URL || 'http://localhost:3001/api';
const USERNAME = process.env.GHOST_USERNAME;
const PASSWORD = process.env.GHOST_PASSWORD;

if (!USERNAME || !PASSWORD) {
  console.error('GHOST MCP: set GHOST_USERNAME and GHOST_PASSWORD');
  process.exit(1);
}

// ── On-disk session/spec cache (issue #44) ────────────────────────────────────
// Some MCP clients spawn a fresh server process per tool call. Without a cache
// that means one login + one OpenAPI fetch per call (~0.4s each in zbyte64's
// 94-call batch). The session cookie and spec are cached under ~/.ghost-mcp
// (file mode 0600), keyed per server+user, so respawns start instantly. A
// stale cookie self-corrects through the existing re-login-on-401 path.

const CACHE_ENABLED = process.env.GHOST_MCP_CACHE !== 'off';
const SPEC_TTL_MS = (Number(process.env.GHOST_MCP_SPEC_TTL) || 600) * 1000;
const CACHE_DIR = path.join(os.homedir(), '.ghost-mcp');
const cacheKey = crypto.createHash('sha256').update(`${API_URL}|${USERNAME}`).digest('hex').slice(0, 16);
const CACHE_FILE = path.join(CACHE_DIR, `cache-${cacheKey}.json`);

function loadCache() {
  if (!CACHE_ENABLED) return {};
  try {
    return JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8'));
  } catch {
    return {};
  }
}

function saveCache(patch) {
  if (!CACHE_ENABLED) return;
  try {
    fs.mkdirSync(CACHE_DIR, { recursive: true, mode: 0o700 });
    const merged = { ...loadCache(), ...patch };
    fs.writeFileSync(CACHE_FILE, JSON.stringify(merged), { mode: 0o600 });
  } catch (err) {
    console.error(`GHOST MCP: cache write failed (${err.message}) — continuing without cache`);
  }
}

// ── Session handling ──────────────────────────────────────────────────────────

let sessionCookie = loadCache().cookie || null;
if (sessionCookie) console.error('GHOST MCP: reusing cached session');

async function login() {
  const res = await fetch(`${API_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: USERNAME, password: PASSWORD }),
    redirect: 'manual',
  });
  if (!res.ok) {
    throw new Error(`GHOST login failed (${res.status}): ${await res.text()}`);
  }
  const setCookie = res.headers.get('set-cookie') || '';
  const match = setCookie.match(/connect\.sid=([^;]+)/);
  if (!match) throw new Error('GHOST login returned no connect.sid cookie');
  sessionCookie = `connect.sid=${match[1]}`;
  saveCache({ cookie: sessionCookie });
  console.error(`GHOST MCP: logged in as ${USERNAME}`);
}

// Authenticated fetch with transparent re-login on 401.
async function api(path, options = {}) {
  if (!sessionCookie) await login();
  const headers = { ...options.headers, Cookie: sessionCookie };
  if (options.body) headers['Content-Type'] = 'application/json';

  let res = await fetch(`${API_URL}${path}`, { ...options, headers });
  if (res.status === 401) {
    await login();
    headers.Cookie = sessionCookie;
    res = await fetch(`${API_URL}${path}`, { ...options, headers });
  }
  return res;
}

// ── Tool generation from the OpenAPI document ─────────────────────────────────

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

function toolName(method, path) {
  const segments = path.split('/').filter(Boolean).filter((s) => !s.startsWith('{'));
  let name = `ghost_${VERB[method]}_${segments.join('_').replace(/-/g, '_')}`;
  if (method === 'get' && path.endsWith('}')) name += '_by_id';
  return name;
}

function buildTools(spec) {
  const registry = new Map(); // name → { method, pathTemplate, pathParams, queryParams, hasBody }
  const tools = [];

  for (const [path, ops] of Object.entries(spec.paths)) {
    if (path.startsWith('/auth/')) continue; // session is managed by this server

    for (const [method, operation] of Object.entries(ops)) {
      if (!VERB[method]) continue;

      const name = toolName(method, path);
      const properties = {};
      const required = [];
      const pathParams = [];
      const queryParams = [];

      for (const p of operation.parameters || []) {
        properties[p.name] = { ...p.schema, description: p.description || `${p.in} parameter` };
        if (p.in === 'path') {
          pathParams.push(p.name);
          required.push(p.name);
        } else {
          queryParams.push(p.name);
        }
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

  return { tools, registry };
}

// ── Duplicate detection (zbyte64's pattern) ───────────────────────────────────
// LLMs don't always search before creating; refuse creates that look like
// existing records unless ignorePossibleDuplicates is set.

async function findDuplicatePeople(args) {
  const res = await api('/people?limit=1000');
  if (!res.ok) return [];
  // GET /people returns a plain array (meta in headers, issue #40); newer list
  // endpoints return { data, meta }. Handle both.
  const json = await res.json();
  const people = Array.isArray(json) ? json : json.data || [];
  // Include the patronymic: two people sharing a given and family name but
  // differing in patronymic are different people, so ignoring it here would
  // block legitimate creates as false-positive duplicates (issue #61).
  const joinName = (...parts) => parts.filter(Boolean).join(' ').trim().toLowerCase();
  const names = new Set(
    [joinName(args.firstName, args.patronymic, args.lastName), ...(args.aliases || [])]
      .map((s) => String(s).toLowerCase())
  );
  return people.filter((p) => {
    const full = joinName(p.first_name, p.patronymic, p.last_name);
    const aliases = (p.aliases || []).map((a) => a.toLowerCase());
    return [...names].some((n) => n === full || aliases.includes(n));
  }).map((p) => ({ id: p.id, first_name: p.first_name, patronymic: p.patronymic, last_name: p.last_name }));
}

async function findDuplicateBusinesses(args) {
  const res = await api('/businesses');
  if (!res.ok) return [];
  const list = await res.json();
  const name = String(args.name || '').toLowerCase();
  return (Array.isArray(list) ? list : [])
    .filter((b) => (b.name || '').toLowerCase() === name)
    .map((b) => ({ id: b.id, name: b.name }));
}

// A transaction is a likely duplicate when type, date, both parties and value
// all match an existing row — conservative enough for repeated Form 700-style
// imports without flagging genuinely recurring events with different values.
const TX_PARTY_KEYS = [
  'from_person_id', 'from_business_id', 'from_external',
  'to_person_id', 'to_business_id', 'to_external',
];
const normParty = (v) =>
  v === undefined || v === null || v === '' ? null
    : typeof v === 'string' ? v.trim().toLowerCase() : Number(v);
const normDate = (v) => (v ? String(v).slice(0, 10) : null);
const normValue = (v) => (v === undefined || v === null || v === '' ? null : Number(v));

async function findDuplicateTransactions(args) {
  const res = await api('/transactions?limit=1000');
  if (!res.ok) return [];
  const json = await res.json();
  const list = Array.isArray(json) ? json : json.data || [];
  return list
    .filter((t) =>
      t.transaction_type === args.transaction_type &&
      normDate(t.occurred_on) === normDate(args.occurred_on) &&
      normValue(t.value) === normValue(args.value) &&
      TX_PARTY_KEYS.every((k) => normParty(t[k]) === normParty(args[k]))
    )
    .map((t) => ({
      id: t.id,
      transaction_type: t.transaction_type,
      occurred_on: t.occurred_on,
      value: t.value,
      item_label: t.item_label,
    }));
}

const DEDUP_CHECKS = {
  ghost_create_people: findDuplicatePeople,
  ghost_create_businesses: findDuplicateBusinesses,
  ghost_create_transactions: findDuplicateTransactions,
};

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  // Use the cached spec when fresh — combined with the cached session cookie
  // this makes a respawned process ready without any network round trips.
  const cached = loadCache();
  let spec = cached.spec && Date.now() - (cached.specAt || 0) < SPEC_TTL_MS ? cached.spec : null;

  if (!spec) {
    const specRes = await api('/openapi.json');
    if (!specRes.ok) {
      throw new Error(
        `Could not fetch OpenAPI spec (${specRes.status}) — is GHOST >= v2.8 running at ${API_URL}?`
      );
    }
    spec = await specRes.json();
    saveCache({ spec, specAt: Date.now() });
  } else {
    console.error('GHOST MCP: using cached OpenAPI spec');
  }

  const { tools, registry } = buildTools(spec);

  // Inject the dedup escape hatch into the create tools it applies to.
  for (const tool of tools) {
    if (DEDUP_CHECKS[tool.name]) {
      tool.inputSchema.properties.ignorePossibleDuplicates = {
        type: 'boolean',
        description: 'Skip duplicate detection. Default false.',
      };
      tool.description += ' Refuses if a matching record already exists (same name; for transactions: same type, date, parties and value) unless ignorePossibleDuplicates is true.';
    }
  }

  console.error(`GHOST MCP: ${tools.length} tools generated from ${spec.info.title} v${spec.info.version}`);

  const server = new Server(
    { name: 'ghost-osint', version: spec.info.version },
    { capabilities: { tools: {} } }
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args = {} } = request.params;
    const entry = registry.get(name);
    if (!entry) {
      return { content: [{ type: 'text', text: `Unknown tool: ${name}` }], isError: true };
    }

    try {
      const dedupCheck = DEDUP_CHECKS[name];
      if (dedupCheck && !args.ignorePossibleDuplicates) {
        const duplicates = await dedupCheck(args);
        if (duplicates.length > 0) {
          return {
            content: [{
              type: 'text',
              text:
                `Possible duplicates found — not created. Review these, or retry with ` +
                `ignorePossibleDuplicates: true if this is genuinely a new record:\n` +
                JSON.stringify(duplicates, null, 2),
            }],
            isError: true,
          };
        }
      }

      // Split flat args back into path params, query params, and body.
      let path = entry.pathTemplate;
      for (const p of entry.pathParams) {
        path = path.replace(`{${p}}`, encodeURIComponent(args[p]));
      }
      const query = new URLSearchParams();
      for (const q of entry.queryParams) {
        if (args[q] !== undefined && args[q] !== null && args[q] !== '') query.set(q, args[q]);
      }
      if (query.size > 0) path += `?${query}`;

      const options = { method: entry.method.toUpperCase() };
      if (entry.hasBody) {
        const body = { ...args };
        for (const k of [...entry.pathParams, ...entry.queryParams, 'ignorePossibleDuplicates']) {
          delete body[k];
        }
        options.body = JSON.stringify(body);
      }

      const res = await api(path, options);
      const text = await res.text();
      let pretty = text;
      try { pretty = JSON.stringify(JSON.parse(text), null, 2); } catch { /* not JSON */ }

      if (!res.ok) {
        return {
          content: [{ type: 'text', text: `Error (${res.status}): ${pretty}` }],
          isError: true,
        };
      }
      return { content: [{ type: 'text', text: pretty }] };
    } catch (err) {
      return { content: [{ type: 'text', text: `Error: ${err.message}` }], isError: true };
    }
  });

  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('GHOST MCP: ready on stdio');
}

main().catch((err) => {
  console.error(`GHOST MCP: fatal — ${err.message}`);
  process.exit(1);
});
