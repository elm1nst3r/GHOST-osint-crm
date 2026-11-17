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

// Phone numbers are written every which way: "+44 (20) 7946-0958",
// "020.7946.0958", "442079460958". When the search text looks like one (only
// digits and the usual separators, at least 6 digits), its digits are matched
// in order with up to three separators between each pair, so any spelling
// finds the others. The separators don't include quotes, commas or colons, so
// digits from two different fields never join up. National and international
// forms find each other too: a leading trunk 0 is dropped ("020…" → "20…",
// which "+44 20…" contains), and a number starting with + or 00 also tries
// the national form for a 1, 2 or 3 digit country code ("+44 20…" → "020…").
// → a regular expression (the same in PostgreSQL and JavaScript), or null
// when the text isn't phone-like (issue #120).
const PHONE_LIKE = /^[\d\s().+/-]+$/;
const PHONE_SEPARATORS = '[ ().+/-]{0,3}';
function phonePattern(text) {
  const value = String(text ?? '').trim();
  if (!PHONE_LIKE.test(value)) return null;
  const digits = value.replace(/\D/g, '');
  if (digits.length < 6) return null;
  const forms = [];
  if (/^(\+|00)/.test(value)) {
    const international = value.startsWith('+') ? digits : digits.slice(2);
    forms.push(international);
    for (const cc of [1, 2, 3]) if (international.length - cc >= 7) forms.push(`0${international.slice(cc)}`);
  } else {
    const national = digits.replace(/^0+/, '');
    forms.push(national.length >= 6 ? national : digits);
  }
  const alternatives = [...new Set(forms)].map((f) => f.split('').join(PHONE_SEPARATORS));
  return alternatives.length === 1 ? alternatives[0] : `(?:${alternatives.join('|')})`;
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

module.exports = { canonicalJson, recordHash, recordBytes, recordProblem, phonePattern, MAX_RECORD_BYTES, MAX_RECORD_DEPTH };
