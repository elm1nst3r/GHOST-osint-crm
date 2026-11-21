// Command palette helpers (search-and-command-palette plan): recently opened
// records per user and browser, and matching menu items and actions as you
// type. Pure apart from localStorage, which may be unavailable.

const RECENT_MAX = 8;
const recentKey = (userId) => `ghost-recent-records:${userId ?? 'anon'}`;

// [{ type, id, title, subtitle, project_id }], newest first.
export function readRecent(userId) {
  try {
    const list = JSON.parse(localStorage.getItem(recentKey(userId)) || '[]');
    return Array.isArray(list) ? list.filter((r) => r && r.type && r.id != null && r.title).slice(0, RECENT_MAX) : [];
  } catch { return []; }
}

export function pushRecent(userId, record) {
  if (!record?.type || record.id == null || !record.title) return readRecent(userId);
  const entry = {
    type: record.type, id: record.id, title: String(record.title).slice(0, 200),
    subtitle: record.subtitle ? String(record.subtitle).slice(0, 200) : null,
    project_id: record.project_id ?? null,
  };
  const next = [entry, ...readRecent(userId).filter((r) => !(r.type === entry.type && r.id === entry.id))].slice(0, RECENT_MAX);
  try { localStorage.setItem(recentKey(userId), JSON.stringify(next)); } catch { /* private mode */ }
  return next;
}

export function forgetRecent(userId, type, id) {
  const next = readRecent(userId).filter((r) => !(r.type === type && r.id === id));
  try { localStorage.setItem(recentKey(userId), JSON.stringify(next)); } catch { /* private mode */ }
  return next;
}

// Case- and accent-insensitive "contains every word", for menu items and
// actions (records are matched by the server).
const fold = (s) => String(s ?? '').normalize('NFKD').replace(/\p{M}/gu, '').toLocaleLowerCase();
export function matchesText(text, query) {
  const words = fold(query).split(/\s+/).filter(Boolean);
  if (!words.length) return true;
  const hay = fold(text);
  return words.every((w) => hay.includes(w));
}

// Items whose label (or keywords) match, the ones that start with the query first.
export function filterItems(items, query) {
  const q = fold(query).trim();
  if (!q) return items;
  return items
    .filter((item) => matchesText(`${item.label} ${item.keywords || ''}`, q))
    .map((item, i) => ({ item, i, starts: fold(item.label).startsWith(q) ? 0 : 1 }))
    .sort((a, b) => a.starts - b.starts || a.i - b.i)
    .map((x) => x.item);
}

// Where a search result opens. 'entity' = its detail dialog; 'file' = the
// file preview; 'route' = a section, with the record picked out by a search
// parameter where the section supports it.
export function resultTarget(type, id) {
  switch (type) {
    case 'person': case 'business': case 'crypto_wallet': case 'asset': case 'property':
      return { kind: 'entity' };
    case 'file': return { kind: 'file' };
    case 'case': return { kind: 'route', path: `/cases?case=${id}` };
    case 'wireless_network': return { kind: 'route', path: `/wireless?network=${id}` };
    case 'todo': return { kind: 'route', path: '/dashboard' };
    default: return null;
  }
}

// The module a result type belongs to (hidden while it's switched off).
export const TYPE_MODULE = {
  crypto_wallet: 'crypto-wallets', asset: 'assets', property: 'properties',
  file: 'files', wireless_network: 'wireless',
};
