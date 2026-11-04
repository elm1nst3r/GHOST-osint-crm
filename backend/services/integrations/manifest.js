// File: backend/services/integrations/manifest.js
//
// Integration manifests (issue #96): the JSON files that turn an OSINT tool
// into something GHOST can call. A manifest is data, not code: it names one
// fixed HTTPS host, how the API key is sent, which kind of input each
// operation takes, the request path, and where the useful values sit in the
// JSON response. Sharing a manifest therefore can't run code on anyone's
// server; the worst a bad one can do is send the investigator's query to the
// host it declares, which the admin sees before installing it.
//
// Everything here is pure (no I/O) so it's unit-tested directly. The HTTP
// call itself is in httpClient.js.
const net = require('net');
const crypto = require('crypto');
const { z } = require('zod');

const SCHEMA_ID = 'ghost-integration/v1';

// ── Input kinds ──────────────────────────────────────────────────────────────
// What an operation accepts. Each is normalised and validated before it goes
// anywhere near a URL. Besides the identifier kinds there are two more:
//   text  a search type the admin names (inputLabel), e.g. "Vehicle
//         registration number"; osintTypes says which of a person's OSINT
//         entries it can search
//   none  no input at all: account balance, service status. Also used as the
//         connection test when the manifest has no `test`.

const IDENTIFIER_KINDS = ['email', 'domain', 'ip', 'username', 'phone', 'url'];
const INPUT_KINDS = [...IDENTIFIER_KINDS, 'text', 'none'];

const HOSTNAME_RE = /^(?=.{1,253}$)(?!-)[a-z0-9-]{1,63}(?<!-)(\.(?!-)[a-z0-9-]{1,63}(?<!-))+$/;

function normalizeInput(kind, raw) {
  if (kind === 'none') return '';
  let v = String(raw ?? '').trim();
  if (!v) throw new Error('Enter a value to search for');
  switch (kind) {
    case 'email':
      v = v.toLowerCase();
      if (v.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) throw new Error('Not a valid email address');
      return v;
    case 'domain': {
      v = v.toLowerCase().replace(/^[a-z]+:\/\//, '').split(/[/?#]/)[0].replace(/:\d+$/, '').replace(/^www\./, '');
      if (!HOSTNAME_RE.test(v)) throw new Error('Not a valid domain');
      return v;
    }
    case 'ip':
      if (!net.isIP(v)) throw new Error('Not a valid IP address');
      return v;
    case 'username':
      v = v.replace(/^@/, '');
      if (!/^[\p{L}\p{N}._-]{1,64}$/u.test(v)) throw new Error('Not a valid username');
      return v;
    case 'phone': {
      const digits = v.replace(/[\s().-]/g, '');
      if (!/^\+?\d{6,20}$/.test(digits)) throw new Error('Not a valid phone number');
      return digits;
    }
    case 'url': {
      let u;
      try { u = new URL(/^[a-z]+:\/\//i.test(v) ? v : `https://${v}`); } catch { throw new Error('Not a valid URL'); }
      if (!['http:', 'https:'].includes(u.protocol)) throw new Error('Only http and https URLs can be searched');
      return u.toString();
    }
    case 'text':
      if (v.length > 200) throw new Error('The value is too long');
      if (/[\u0000-\u001f\u007f]/.test(v)) throw new Error('The value contains control characters');
      return v;
    default:
      throw new Error(`Unknown input kind: ${kind}`);
  }
}

// Which input kind a person's OSINT data entry most likely is. The types are
// user-editable model options, so this goes by the label, and a value that
// plainly is an email/IP wins over the label.
function inputKindForOsint(type, value) {
  const t = String(type || '').toLowerCase();
  const v = String(value || '').trim();
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) return 'email';
  if (net.isIP(v)) return 'ip';
  if (/e-?mail|почт/.test(t)) return 'email';
  if (/phone|tel|mobile|телеф/.test(t)) return 'phone';
  if (/\bip\b|ip address/.test(t)) return 'ip';
  if (/domain|website|web site|site|url|сайт|домен/.test(t)) {
    return /^[a-z]+:\/\//i.test(v) && /\/[^/]/.test(v.replace(/^[a-z]+:\/\/[^/]+/i, '')) ? 'url' : 'domain';
  }
  if (/user|social|telegram|twitter|instagram|github|vk|nick|login|ник/.test(t)) return 'username';
  return null;
}

// ── Templates ────────────────────────────────────────────────────────────────
// Two variables: {{input}}, optionally piped through filters
// ({{input|lower|sha256}}), and {{api_key}}, which marks where the stored key
// goes for "url" auth (issue #96: services that take the key as a path
// segment, e.g. /api/{{api_key}}/lookup). Rendered values are always
// URL-encoded.

const FILTERS = {
  lower: (s) => s.toLowerCase(),
  upper: (s) => s.toUpperCase(),
  trim: (s) => s.trim(),
  md5: (s) => crypto.createHash('md5').update(s).digest('hex'),
  sha1: (s) => crypto.createHash('sha1').update(s).digest('hex'),
  sha256: (s) => crypto.createHash('sha256').update(s).digest('hex'),
  digits: (s) => s.replace(/\D/g, ''),
};

const TEMPLATE_RE = /\{\{\s*input((?:\s*\|\s*[a-z0-9]+)*)\s*\}\}/g;
const KEY_RE = /\{\{\s*api_key\s*\}\}/g;
const hasInput = (s) => /\{\{\s*input[\s|}]/.test(s || '');
const hasKey = (s) => /\{\{\s*api_key\s*\}\}/.test(s || '');

function templateErrors(template) {
  const errors = [];
  const stripped = template.replace(TEMPLATE_RE, (m, filters) => {
    filters.split('|').map((f) => f.trim()).filter(Boolean).forEach((f) => {
      if (!FILTERS[f]) errors.push(`unknown filter "${f}"`);
    });
    return '';
  }).replace(KEY_RE, '');
  if (/\{\{|\}\}/.test(stripped)) errors.push('only {{input}} and {{api_key}} may be used in templates');
  return errors;
}

// One pass over both variables, so a substituted value is never scanned again
// (a searched-for "{{api_key}}" stays text and never becomes the key).
const VARIABLE_RE = /\{\{\s*(?:input((?:\s*\|\s*[a-z0-9]+)*)|api_key)\s*\}\}/g;

function renderTemplate(template, input, encode = encodeURIComponent, key = '') {
  return template.replace(VARIABLE_RE, (m, filters) => {
    if (filters === undefined) return encode(key || '');
    let v = input;
    filters.split('|').map((f) => f.trim()).filter(Boolean).forEach((f) => { v = FILTERS[f](v); });
    return encode(v);
  });
}

// ── Schema ───────────────────────────────────────────────────────────────────

const httpsUrl = z.string().max(500).refine((v) => {
  try { return new URL(v).protocol === 'https:'; } catch { return false; }
}, 'must be an https:// URL');

const headerName = z.string().regex(/^[A-Za-z0-9-]{1,64}$/, 'invalid header name');
const FORBIDDEN_HEADERS = ['host', 'cookie', 'authorization', 'content-length', 'connection', 'transfer-encoding', 'proxy-authorization'];

const authSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('none') }),
  z.object({
    type: z.enum(['header', 'query', 'bearer', 'url']),
    name: z.string().max(64).optional(),
    prefix: z.string().max(32).optional(),
    optional: z.boolean().optional(),
    label: z.string().max(80).optional(),
    help: z.string().max(500).optional(),
    signupUrl: httpsUrl.optional(),
  }),
]);

const pathString = z.string().max(200).regex(/^[A-Za-z0-9_$][A-Za-z0-9_$.[\]-]*$|^$/, 'invalid result path');

const fieldSchema = z.object({
  label: z.string().min(1).max(80),
  path: pathString,
  osintType: z.string().max(100).optional(),
  split: z.string().max(5).optional(),
  stripHtml: z.boolean().optional(),
});

const templateString = (max) => z.string().max(max).superRefine((v, ctx) => {
  templateErrors(v).forEach((message) => ctx.addIssue({ code: 'custom', message }));
});

const operationSchema = z.object({
  id: z.string().regex(/^[a-z0-9][a-z0-9_-]{0,40}$/),
  label: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  input: z.enum(INPUT_KINDS),
  inputLabel: z.string().min(1).max(60).optional(),
  osintTypes: z.array(z.string().min(1).max(100)).max(10).optional(),
  path: templateString(300).refine((p) => p.startsWith('/') && !p.includes('..'), 'path must start with / and not contain ..'),
  query: z.record(z.string().regex(/^[A-Za-z0-9_.[\]-]{1,64}$/), templateString(300)).optional(),
  cost: z.enum(['free', 'quota', 'paid']).optional(),
  notFound: z.array(z.number().int().min(400).max(499)).max(5).optional(),
  results: z.object({
    root: pathString.optional(),
    title: pathString.optional(),
    link: pathString.optional(),
    distinctBy: pathString.optional(),
    fields: z.array(fieldSchema).min(1).max(30),
  }),
});

const manifestSchema = z.object({
  schema: z.literal(SCHEMA_ID),
  id: z.string().regex(/^[a-z0-9][a-z0-9-]{1,62}$/, 'id must be lowercase letters, digits and dashes'),
  name: z.string().min(1).max(100),
  version: z.string().max(20).optional(),
  description: z.string().max(1000).optional(),
  category: z.string().max(100).optional(),
  homepage: httpsUrl.optional(),
  terms: httpsUrl.optional(),
  baseUrl: httpsUrl,
  auth: authSchema.default({ type: 'none' }),
  headers: z.record(headerName, z.string().max(300).regex(/^[^\r\n]*$/)).optional(),
  minIntervalMs: z.number().int().min(0).max(60000).optional(),
  timeoutMs: z.number().int().min(1000).max(60000).optional(),
  test: z.object({ path: templateString(300).refine((p) => p.startsWith('/') && !hasInput(p), 'test path must be fixed') }).optional(),
  operations: z.array(operationSchema).min(1).max(20),
}).superRefine((m, ctx) => {
  const u = (() => { try { return new URL(m.baseUrl); } catch { return null; } })();
  if (u && (u.search || u.hash || u.username || u.password)) {
    ctx.addIssue({ code: 'custom', path: ['baseUrl'], message: 'baseUrl must not contain a query, fragment or credentials' });
  }
  if ((m.auth.type === 'header' || m.auth.type === 'query') && !m.auth.name) {
    ctx.addIssue({ code: 'custom', path: ['auth', 'name'], message: `auth.name is required for "${m.auth.type}" auth` });
  }
  if (m.auth.type === 'header' && m.auth.name && FORBIDDEN_HEADERS.includes(m.auth.name.toLowerCase())) {
    ctx.addIssue({ code: 'custom', path: ['auth', 'name'], message: `"${m.auth.name}" cannot be used; use "bearer" auth for Authorization` });
  }
  Object.keys(m.headers || {}).forEach((h) => {
    if (FORBIDDEN_HEADERS.includes(h.toLowerCase())) {
      ctx.addIssue({ code: 'custom', path: ['headers', h], message: `header "${h}" is not allowed` });
    }
  });
  const ids = new Set();
  const usesKey = (op) => hasKey(op.path) || Object.values(op.query || {}).some(hasKey);
  m.operations.forEach((op, i) => {
    if (ids.has(op.id)) ctx.addIssue({ code: 'custom', path: ['operations', i, 'id'], message: `duplicate operation id "${op.id}"` });
    ids.add(op.id);
    // "url" auth: the key goes exactly where {{api_key}} is, so every request
    // needs one; any other auth sends the key itself and must not place it.
    if (m.auth.type === 'url' && !usesKey(op)) {
      ctx.addIssue({ code: 'custom', path: ['operations', i, 'path'], message: 'mark where the API key goes with {{api_key}}' });
    }
    if (m.auth.type !== 'url' && usesKey(op)) {
      ctx.addIssue({ code: 'custom', path: ['operations', i, 'path'], message: '{{api_key}} needs "url" auth' });
    }
    if (op.input === 'none' && (hasInput(op.path) || Object.values(op.query || {}).some(hasInput))) {
      ctx.addIssue({ code: 'custom', path: ['operations', i, 'path'], message: 'a search without input cannot use {{input}}' });
    }
    if (op.input === 'text' && !op.inputLabel) {
      ctx.addIssue({ code: 'custom', path: ['operations', i, 'inputLabel'], message: 'name the search type (inputLabel)' });
    }
  });
  if (m.test) {
    if (m.auth.type === 'url' && !hasKey(m.test.path)) {
      ctx.addIssue({ code: 'custom', path: ['test', 'path'], message: 'mark where the API key goes with {{api_key}}' });
    }
    if (m.auth.type !== 'url' && hasKey(m.test.path)) {
      ctx.addIssue({ code: 'custom', path: ['test', 'path'], message: '{{api_key}} needs "url" auth' });
    }
  }
});

// Returns { manifest } or { errors: [string] }.
function validateManifest(input) {
  const result = manifestSchema.safeParse(input);
  if (result.success) return { manifest: result.data };
  return {
    errors: result.error.issues.map((i) => `${i.path.length ? `${i.path.join('.')}: ` : ''}${i.message}`),
  };
}

// ── Requests ─────────────────────────────────────────────────────────────────

const requiresKey = (manifest) => manifest.auth.type !== 'none' && !manifest.auth.optional;

// Builds the request for one operation. `secret` may be null when the auth is
// optional. The returned `redactedUrl` is safe to log or show.
function buildRequest(manifest, { path, query }, input, secret) {
  const base = new URL(manifest.baseUrl);
  const basePath = base.pathname.replace(/\/$/, '');
  const inUrl = manifest.auth.type === 'url';
  const assemble = (key) => {
    const u = new URL(base.origin);
    u.pathname = basePath + renderTemplate(path, input, encodeURIComponent, key);
    Object.entries(query || {}).forEach(([k, v]) => u.searchParams.set(k, renderTemplate(v, input, (s) => s, key)));
    return u;
  };
  const url = assemble(inUrl ? secret : '');

  // Input and key are encoded, so they can't change the host; check anyway,
  // and that the path didn't climb out of the base path.
  if (url.origin !== base.origin || !url.pathname.startsWith(basePath || '/')) {
    throw new Error('Request would leave the integration\'s host');
  }

  const headers = { Accept: 'application/json', 'User-Agent': 'GHOST-OSINT-CRM', ...(manifest.headers || {}) };
  if (secret) {
    const { type, name, prefix = '' } = manifest.auth;
    if (type === 'header') headers[name] = `${prefix}${secret}`;
    if (type === 'bearer') headers.Authorization = `Bearer ${secret}`;
    if (type === 'query') url.searchParams.set(name, secret);
  } else if (requiresKey(manifest)) {
    throw new Error('This integration needs an API key');
  }

  // A key placed in the URL is redacted by building the URL again with a
  // stand-in, so no encoding difference can leave a piece of it visible.
  let redactedUrl = (inUrl && secret ? assemble('***') : url).toString();
  if (secret) redactedUrl = redactedUrl.split(encodeURIComponent(secret)).join('***').split(secret).join('***');
  return { url: url.toString(), redactedUrl, headers };
}

// ── Results ──────────────────────────────────────────────────────────────────

const MAX_ITEMS = 200;
const MAX_VALUES = 50;
const MAX_VALUE_LENGTH = 1000;

// Dotted path with array support: "a.b[0].c", and "list[].name" maps over a
// list. An empty path is the value itself.
function getPath(obj, path) {
  if (!path) return obj;
  const segments = path.match(/[^.[\]]+|\[\d*\]/g) || [];
  let current = [obj];
  let mapped = false;
  for (const seg of segments) {
    const next = [];
    for (const value of current) {
      if (value === null || value === undefined) continue;
      if (seg === '[]') {
        if (Array.isArray(value)) next.push(...value);
        mapped = true;
      } else if (/^\[\d+\]$/.test(seg)) {
        if (Array.isArray(value)) next.push(value[Number(seg.slice(1, -1))]);
      } else if (typeof value === 'object' && Object.prototype.hasOwnProperty.call(value, seg)) {
        next.push(value[seg]);
      }
    }
    current = next;
  }
  if (mapped) return current;
  return current[0];
}

const stripTags = (s) => s.replace(/<[^>]*>/g, '').replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>');

function toValues(raw, field) {
  const list = Array.isArray(raw) ? raw.flat(2) : [raw];
  const out = [];
  for (const item of list) {
    if (item === null || item === undefined || item === '') continue;
    let s = typeof item === 'object' ? JSON.stringify(item) : String(item);
    if (field.stripHtml) s = stripTags(s);
    const parts = field.split ? s.split(field.split) : [s];
    for (const p of parts) {
      const v = p.trim().slice(0, MAX_VALUE_LENGTH);
      if (v && !out.includes(v)) out.push(v);
      if (out.length >= MAX_VALUES) return out;
    }
  }
  return out;
}

// Turns a JSON response into display rows:
//   { items: [{ title, link, fields: [{ label, values, osintType }] }], total, truncated }
function mapResults(results, json) {
  let root = getPath(json, results.root || '');
  if (root === null || root === undefined) root = [];
  let list = Array.isArray(root) ? root : [root];
  list = list.filter((x) => x !== null && x !== undefined);

  if (results.distinctBy) {
    const seen = new Set();
    list = list.filter((item) => {
      const key = JSON.stringify(getPath(item, results.distinctBy));
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  const total = list.length;
  const items = list.slice(0, MAX_ITEMS).map((item) => {
    const title = results.title ? toValues(getPath(item, results.title), {})[0] : undefined;
    const linkValue = results.link ? toValues(getPath(item, results.link), {})[0] : undefined;
    const link = linkValue && /^https?:\/\//i.test(linkValue) ? linkValue : undefined;
    const fields = results.fields
      .map((f) => ({ label: f.label, osintType: f.osintType, values: toValues(getPath(item, f.path), f) }))
      .filter((f) => f.values.length > 0);
    return { title, link, fields };
  }).filter((it) => it.fields.length > 0 || it.title);

  return { items, total, truncated: total > MAX_ITEMS };
}

// With no `test` in the manifest, a free search that needs no input checks
// the connection instead.
const connectionTestOperation = (manifest) =>
  manifest.operations.find((op) => op.input === 'none' && (op.cost || 'free') === 'free') || null;

// What the browser needs to know about an integration: never the request
// details beyond the host.
function publicSummary(manifest, source) {
  const { auth } = manifest;
  return {
    id: manifest.id,
    name: manifest.name,
    version: manifest.version || null,
    description: manifest.description || null,
    category: manifest.category || null,
    homepage: manifest.homepage || null,
    terms: manifest.terms || null,
    host: new URL(manifest.baseUrl).host,
    source,
    auth: auth.type === 'none'
      ? { type: 'none', required: false }
      : { type: auth.type, required: !auth.optional, label: auth.label || null, help: auth.help || null, signupUrl: auth.signupUrl || null },
    has_test: Boolean(manifest.test || connectionTestOperation(manifest)),
    operations: manifest.operations.map((op) => ({
      id: op.id, label: op.label, description: op.description || null, input: op.input, cost: op.cost || 'free',
      ...(op.input === 'text' ? { input_label: op.inputLabel, osint_types: op.osintTypes || [] } : {}),
    })),
  };
}

module.exports = {
  SCHEMA_ID,
  INPUT_KINDS,
  IDENTIFIER_KINDS,
  normalizeInput,
  inputKindForOsint,
  renderTemplate,
  validateManifest,
  requiresKey,
  buildRequest,
  connectionTestOperation,
  getPath,
  mapResults,
  publicSummary,
};
