// Full-text search (search-and-command-palette plan): turning what someone
// typed into the pieces routes/search.js matches search_index with, and the
// snippet shown under a result. Pure, so it's tested without a database.
//
// A record matches when every word is in it, either as the start of a word
// (full text, ranked) or anywhere inside a longer one (ILIKE, so "rezaei"
// finds "ali.rezaei@example.com", and scripts without spaces work). A phone
// number matches however it was written (the same rule as saved records).
const { phonePattern } = require('./osintRecords');

const MAX_TERMS = 8;
const MAX_TERM_LENGTH = 64;

// Characters with a meaning in to_tsquery's syntax.
const TSQUERY_SPECIAL = /[&|!():*<>'\\]/g;

function terms(text) {
  return String(text ?? '')
    .normalize('NFC')
    .split(/\s+/)
    .map((t) => t.trim().slice(0, MAX_TERM_LENGTH))
    .filter(Boolean)
    .slice(0, MAX_TERMS);
}

const escapeLike = (s) => s.replace(/[\\%_]/g, '\\$&');

// → { terms, tsquery, likes, phone } or null when there's nothing to search.
//   tsquery  input for to_tsquery('simple', …): every word as a prefix, ANDed
//   likes    ['%word%', …] for ILIKE ALL
//   phone    a POSIX regular expression, or null
function buildSearch(text) {
  const list = terms(text);
  if (!list.length) return null;
  const lexemes = list
    .map((t) => t.replace(TSQUERY_SPECIAL, ' ').trim())
    .filter(Boolean)
    .flatMap((t) => t.split(/\s+/))
    .map((t) => `'${t}':*`);
  return {
    terms: list,
    tsquery: lexemes.length ? lexemes.join(' & ') : null,
    likes: list.map((t) => `%${escapeLike(t)}%`),
    phone: phonePattern(String(text).trim()),
  };
}

const escapeRegExp = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// A piece of `body` around the first match (any word, or the phone number),
// about `width` characters, with "…" where it was cut. '' when nothing in the
// body matched (the title or subtitle did).
function snippet(body, search, width = 160) {
  const text = String(body ?? '').replace(/\s+/g, ' ').trim();
  if (!text || !search) return '';
  const patterns = search.terms.map(escapeRegExp);
  if (search.phone) patterns.push(search.phone);
  let first = -1;
  let length = 0;
  for (const p of patterns) {
    const m = new RegExp(p, 'i').exec(text);
    if (m && (first < 0 || m.index < first)) { first = m.index; length = m[0].length; }
  }
  if (first < 0) return '';
  const lead = Math.max(0, Math.floor((width - length) / 3));
  let start = Math.max(0, first - lead);
  let end = Math.min(text.length, start + width);
  start = Math.max(0, Math.min(start, end - width));
  // Don't cut a word in half at either end.
  if (start > 0) { const sp = text.indexOf(' ', start); if (sp > 0 && sp < first) start = sp + 1; }
  if (end < text.length) { const sp = text.lastIndexOf(' ', end); if (sp > first + length) end = sp; }
  return `${start > 0 ? '…' : ''}${text.slice(start, end)}${end < text.length ? '…' : ''}`;
}

module.exports = { buildSearch, snippet, terms, MAX_TERMS };
