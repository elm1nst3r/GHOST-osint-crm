// File: backend/services/integrations/runner.js
//
// Runs an integration tool (issue #96): picks the API key, paces requests to
// the provider's limit, makes the call through httpClient and maps the
// response. Errors come back as RunError with a message fit for the user;
// the API key never appears in one.
const { normalizeInput, buildRequest, mapResults, requiresKey, connectionTestOperation } = require('./manifest');
const { getJson } = require('./httpClient');
const { decryptAtRest } = require('../../utils/secretBox');

class RunError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

// Which key a run uses: the tool's shared key, or the caller's own when the
// tool is set to per-user keys.
async function resolveSecret(db, tool, manifest, userId) {
  if (manifest.auth.type === 'none') return { secret: null, keySource: null, needsKey: false, unreadable: false };
  const perUser = tool.credential_mode === 'per_user';
  const { rows } = perUser
    ? await db.query('SELECT secret FROM tool_credentials WHERE tool_id = $1 AND user_id = $2', [tool.id, userId])
    : await db.query('SELECT secret FROM tool_credentials WHERE tool_id = $1 AND user_id IS NULL', [tool.id]);
  const stored = rows[0]?.secret;
  const secret = stored ? decryptAtRest(stored) : null;
  return {
    secret,
    keySource: secret ? (perUser ? 'mine' : 'shared') : null,
    needsKey: requiresKey(manifest) && !secret,
    unreadable: Boolean(stored) && !secret,
  };
}

// Requests to one provider through one tool are spaced by minIntervalMs.
const lastCall = new Map();
const MAX_WAIT_MS = 20000;

async function pace(key, minIntervalMs) {
  if (!minIntervalMs) return;
  const now = Date.now();
  const next = Math.max(now, (lastCall.get(key) || 0) + minIntervalMs);
  if (next - now > MAX_WAIT_MS) throw new RunError(429, 'Too many searches with this tool right now. Try again in a moment.');
  lastCall.set(key, next);
  if (next > now) await new Promise((r) => setTimeout(r, next - now));
}

const scrub = (text, secret) => (secret ? String(text).split(secret).join('***') : String(text));

function providerMessage(json, text) {
  const m = json && (json.message || json.error?.message || json.error || json.errors?.[0]?.message || json.detail);
  return typeof m === 'string' ? m.slice(0, 200) : (text || '').slice(0, 200);
}

async function call(manifest, request, secret, notFoundStatuses = [404]) {
  let response;
  try {
    response = await getJson(request.url, { headers: request.headers, timeoutMs: manifest.timeoutMs || 15000 });
  } catch (err) {
    const status = err.kind === 'timeout' ? 504 : err.kind === 'blocked' ? 400 : 502;
    throw new RunError(status, scrub(err.message, secret));
  }
  const { status, json, text } = response;
  if (status >= 200 && status < 300) return { notFound: false, json };
  if (notFoundStatuses.includes(status)) return { notFound: true, json: null };
  const detail = scrub(providerMessage(json, text), secret);
  if (status === 401 || status === 403) {
    throw new RunError(502, `${manifest.name} rejected the request (HTTP ${status}). Check the API key and plan.${detail ? ` ${detail}` : ''}`);
  }
  if (status === 429) throw new RunError(429, `${manifest.name} rate limit reached. Try again later.${detail ? ` ${detail}` : ''}`);
  if (status >= 500) throw new RunError(502, `${manifest.name} had an error (HTTP ${status}). Try again later.`);
  throw new RunError(502, `${manifest.name} returned HTTP ${status}.${detail ? ` ${detail}` : ''}`);
}

async function runOperation(db, { tool, manifest, operationId, rawInput, userId }) {
  const op = manifest.operations.find((o) => o.id === operationId);
  if (!op) throw new RunError(400, 'Unknown operation');

  let input;
  try { input = normalizeInput(op.input, rawInput); } catch (err) { throw new RunError(400, err.message); }

  const { secret, needsKey, unreadable } = await resolveSecret(db, tool, manifest, userId);
  if (needsKey) {
    throw new RunError(409, unreadable
      ? 'The stored API key can no longer be read (the server secret changed). Enter the key again.'
      : tool.credential_mode === 'per_user' ? 'Add your API key for this tool first.' : 'This tool has no API key yet. An admin needs to add one.');
  }

  const request = buildRequest(manifest, op, input, secret);
  await pace(`${manifest.id}:${tool.id}`, manifest.minIntervalMs);
  const { notFound, json } = await call(manifest, request, secret, op.notFound || [404]);
  // A provider that echoes the request back would otherwise hand the key to
  // whoever ran the search, including a shared key to non-admins.
  const mapped = notFound
    ? { items: [], total: 0, truncated: false }
    : JSON.parse(scrub(JSON.stringify(mapResults(op.results, json)), secret));

  return {
    tool_id: tool.id,
    tool_name: tool.name,
    integration_id: manifest.id,
    operation: op.id,
    operation_label: op.label,
    input_kind: op.input,
    query: input,
    retrieved_at: new Date().toISOString(),
    not_found: notFound,
    ...mapped,
    redactedUrl: request.redactedUrl,
  };
}

async function testConnection(db, { tool, manifest, userId }) {
  const { secret, needsKey, unreadable } = await resolveSecret(db, tool, manifest, userId);
  if (needsKey) return { ok: false, message: unreadable ? 'The stored API key can no longer be read. Enter it again.' : 'No API key has been added.' };
  // The manifest's own test, else a free search that needs no input.
  const probe = manifest.test ? { path: manifest.test.path } : connectionTestOperation(manifest);
  if (!probe) {
    return { ok: true, tested: false, message: manifest.auth.type === 'none' ? 'No key needed.' : 'Key stored. This integration has no connection test; run a search to check it.' };
  }
  const request = buildRequest(manifest, probe, '', secret);
  try {
    await pace(`${manifest.id}:${tool.id}`, manifest.minIntervalMs);
    await call(manifest, request, secret, []);
    return { ok: true, tested: true, message: `Connected to ${manifest.name}.` };
  } catch (err) {
    return { ok: false, tested: true, message: err.message };
  }
}

module.exports = { RunError, resolveSecret, runOperation, testConnection };
