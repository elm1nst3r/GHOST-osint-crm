// Searching saved records across the CRM (issue #120): which fields of a
// record matched the search, and where in a value to highlight it.
import { flattenRecord } from './recordNormalize';

// MIRRORS phonePattern in backend/utils/osintRecords.js (the server finds the
// records, this shows why each one matched); keep the two the same.
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
export function phonePattern(text) {
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

const escapeRegExp = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// One regular expression for both kinds of search, or null for empty text.
export function searchRegExp(query) {
  const text = String(query ?? '').trim();
  if (!text) return null;
  const phone = phonePattern(text);
  return new RegExp(phone ? `${escapeRegExp(text)}|${phone}` : escapeRegExp(text), 'gi');
}

// → [{ path, value }] for every field whose name or value contains the search.
export function matchedFields(data, query) {
  const re = searchRegExp(query);
  if (!re) return [];
  const test = (s) => { re.lastIndex = 0; return re.test(s); };
  return flattenRecord(data)
    .filter(([path, value]) => test(value) || test(path))
    .map(([path, value]) => ({ path, value }));
}

// → [{ text, hit }] pieces of `text`, the matching ones marked.
export function highlightParts(text, query) {
  const value = String(text ?? '');
  const re = searchRegExp(query);
  if (!re) return [{ text: value, hit: false }];
  const parts = [];
  let last = 0;
  for (const m of value.matchAll(re)) {
    if (!m[0]) break;
    if (m.index > last) parts.push({ text: value.slice(last, m.index), hit: false });
    parts.push({ text: m[0], hit: true });
    last = m.index + m[0].length;
  }
  if (last < value.length) parts.push({ text: value.slice(last), hit: false });
  return parts.length ? parts : [{ text: value, hit: false }];
}
