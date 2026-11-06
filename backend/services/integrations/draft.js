// File: backend/services/integrations/draft.js
//
// Support for the integration builder (issue #96 follow-up): try an
// operation of a manifest that isn't installed yet, and preview how a
// response maps to results. The test call goes through exactly the same
// validation and guarded client as a normal search.
const { validateManifest, normalizeInput, buildRequest, mapResults } = require('./manifest');
const { getJson } = require('./httpClient');

const PLACEHOLDER_RESULTS = { fields: [{ label: 'Response', path: '' }] };

// A draft is allowed to be unfinished: no id yet, no result fields yet.
// Returns { manifest, op } or { errors }.
function completeDraft(draft, operationId) {
  if (!draft || typeof draft !== 'object') return { errors: ['The integration is empty'] };
  const ops = Array.isArray(draft.operations) ? draft.operations : [];
  const op = ops.find((o) => o && o.id === operationId) || ops[0];
  if (!op) return { errors: ['Add a search first'] };
  const results = op.results && Array.isArray(op.results.fields) && (op.results.fields.length || op.results.keepRecords) ? op.results : PLACEHOLDER_RESULTS;
  const candidate = {
    ...draft,
    schema: 'ghost-integration/v1',
    id: draft.id || 'draft',
    name: draft.name || 'Draft',
    operations: [{ ...op, id: op.id || 'search', label: op.label || 'Search', results }],
  };
  const { manifest, errors } = validateManifest(candidate);
  if (errors) return { errors };
  return { manifest, op: manifest.operations[0] };
}

const MAX_ARRAY = 25;
const MAX_STRING = 2000;
const MAX_DEPTH = 12;

// Trims a response for display in the builder: long lists to their first
// items, long strings shortened, very deep nesting cut off.
function pruneForPreview(value, depth = 0) {
  let truncated = false;
  const walk = (v, d) => {
    if (d > MAX_DEPTH) { truncated = true; return '…'; }
    if (Array.isArray(v)) {
      if (v.length > MAX_ARRAY) truncated = true;
      return v.slice(0, MAX_ARRAY).map((x) => walk(x, d + 1));
    }
    if (v && typeof v === 'object') {
      const out = {};
      for (const [k, x] of Object.entries(v)) out[k] = walk(x, d + 1);
      return out;
    }
    if (typeof v === 'string' && v.length > MAX_STRING) { truncated = true; return `${v.slice(0, MAX_STRING)}…`; }
    return v;
  };
  return { json: walk(value, depth), truncated };
}

// Makes one test request. Never stores the secret. Resolves
// { ok, status, not_found, request, json, truncated, message }.
async function testDraft({ draft, operationId, input, secret }) {
  const { manifest, op, errors } = completeDraft(draft, operationId);
  if (errors) return { ok: false, invalid: true, errors };

  let value;
  try { value = normalizeInput(op.input, input); } catch (err) { return { ok: false, message: err.message }; }

  let request;
  try { request = buildRequest(manifest, op, value, secret || null); } catch (err) { return { ok: false, message: err.message }; }

  const scrub = (s) => (secret ? String(s).split(secret).join('***') : String(s));
  try {
    const res = await getJson(request.url, { headers: request.headers, timeoutMs: manifest.timeoutMs || 15000 });
    const notFound = (op.notFound || [404]).includes(res.status);
    const pruned = res.json === null ? { json: null, truncated: false } : pruneForPreview(res.json);
    const ok = res.status >= 200 && res.status < 300;
    let message = null;
    if (!ok && !notFound) {
      message = res.status === 401 || res.status === 403
        ? `The service refused the request (HTTP ${res.status}). Check the key and how it is sent.`
        : `The service answered HTTP ${res.status}.`;
    }
    return {
      ok, status: res.status, not_found: notFound, request: request.redactedUrl,
      json: pruned.json === null ? null : JSON.parse(scrub(JSON.stringify(pruned.json))),
      text: res.text ? scrub(res.text) : null,
      truncated: pruned.truncated,
      message,
    };
  } catch (err) {
    return { ok: false, request: request.redactedUrl, message: scrub(err.message) };
  }
}

// Previews result mapping on a response the builder already has.
function previewMapping(results, json) {
  const { manifest, errors } = completeDraft({
    baseUrl: 'https://example.invalid',
    operations: [{ id: 'preview', label: 'Preview', input: 'email', path: '/', results }],
  }, 'preview');
  if (errors) return { errors };
  return mapResults(manifest.operations[0].results, json);
}

module.exports = { completeDraft, pruneForPreview, testDraft, previewMapping };
