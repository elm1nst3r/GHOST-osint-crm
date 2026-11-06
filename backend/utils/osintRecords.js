// Saved records (issue #96): helpers shared by the integration results
// mapping and the /api/records routes.
//
// A record is one result exactly as the provider returned it. Two records are
// the same when their content is the same, whatever order the provider wrote
// the keys in, so the hash is taken over JSON with sorted keys.
const crypto = require('crypto');

// One record; a leaked-database row is usually well under 5 KB.
const MAX_RECORD_BYTES = 100_000;
// Nesting deeper than this is almost certainly not a record but a dump.
const MAX_RECORD_DEPTH = 32;

function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((k) => `${JSON.stringify(k)}:${canonicalJson(value[k])}`).join(',')}}`;
  }
  return JSON.stringify(value === undefined ? null : value);
}

const recordHash = (data) => crypto.createHash('sha256').update(canonicalJson(data)).digest('hex');

const recordBytes = (data) => Buffer.byteLength(JSON.stringify(data) ?? 'null', 'utf8');

function depthOf(value, limit) {
  let max = 0;
  const walk = (v, d) => {
    if (d > max) max = d;
    if (max > limit) return;
    if (v && typeof v === 'object') for (const x of Object.values(v)) walk(x, d + 1);
  };
  walk(value, 0);
  return max;
}

// Why a value can't be saved as a record, or null if it can.
function recordProblem(data) {
  if (data === null || data === undefined) return 'The record is empty';
  if (typeof data !== 'object') return 'A record must be a JSON object or list';
  if (recordBytes(data) > MAX_RECORD_BYTES) return `The record is larger than ${Math.round(MAX_RECORD_BYTES / 1000)} KB`;
  if (depthOf(data, MAX_RECORD_DEPTH) > MAX_RECORD_DEPTH) return 'The record is nested too deeply';
  return null;
}

module.exports = { canonicalJson, recordHash, recordBytes, recordProblem, MAX_RECORD_BYTES, MAX_RECORD_DEPTH };
