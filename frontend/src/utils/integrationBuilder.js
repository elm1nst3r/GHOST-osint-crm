// File: frontend/src/utils/integrationBuilder.js
//
// The logic behind the integration builder: turn plain answers into a
// ghost-integration/v1 manifest and back. Kept free of React so it's tested
// directly; the server validates the result again before installing.

export const slugify = (name) => String(name || '')
  .toLowerCase()
  .normalize('NFKD').replace(/[̀-ͯ]/g, '')
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '')
  .slice(0, 60) || 'integration';

// "first_name" → "First name", "DataClasses" → "Data classes"
export const humanizeKey = (key) => {
  const s = String(key ?? '')
    .replace(/\[\]|\[\d+\]/g, '')
    .split('.').filter(Boolean).pop() || '';
  const words = s.replace(/[_-]+/g, ' ').replace(/([a-z0-9])([A-Z])/g, '$1 $2').trim().toLowerCase();
  return words ? words[0].toUpperCase() + words.slice(1) : 'Value';
};

const safeDecode = (s) => { try { return decodeURIComponent(s); } catch { return s; } };

// From an example request copied out of an API's documentation, plus the
// sample value used in it, work out the request template. A key passed in the
// URL (for "key in the web address" auth) is removed, since GHOST adds it.
// Returns { baseUrl, path, query, found, removedKey } or { error }.
export function templateFromExample(exampleUrl, sample, { authType, authName } = {}) {
  let url;
  try { url = new URL(String(exampleUrl).trim()); } catch { return { error: 'notUrl' }; }
  if (url.protocol !== 'https:') return { error: 'notHttps' };
  const value = String(sample || '').trim();

  let found = false;
  const segments = url.pathname.split('/').map((seg) => {
    const decoded = safeDecode(seg);
    if (value && decoded.includes(value)) { found = true; return decoded.split(value).join('{{input}}'); }
    return decoded;
  });
  const path = segments.join('/') || '/';

  const query = {};
  let removedKey = false;
  for (const [k, v] of url.searchParams.entries()) {
    if (authType === 'query' && authName && k === authName) { removedKey = true; continue; }
    if (value && v.includes(value)) { found = true; query[k] = v.split(value).join('{{input}}'); } else query[k] = v;
  }
  return { baseUrl: url.origin, path, query, found, removedKey };
}

// The request as one readable line, e.g. https://api.x.com/v1/lookup?email={{input}}
export function requestLine(baseUrl, path, query) {
  const q = Object.entries(query || {}).map(([k, v]) => `${k}=${v}`).join('&');
  return `${(baseUrl || '').replace(/\/$/, '')}${path || ''}${q ? `?${q}` : ''}`;
}

// The reverse, for editing the line by hand. Keeps {{input}} intact.
export function parseRequestLine(line) {
  const text = String(line || '').trim();
  const m = /^(https:\/\/[^/?#]+)([^?#]*)(?:\?([^#]*))?$/i.exec(text);
  if (!m) return { error: 'notHttps' };
  const query = {};
  (m[3] || '').split('&').filter(Boolean).forEach((pair) => {
    const i = pair.indexOf('=');
    const k = i === -1 ? pair : pair.slice(0, i);
    query[safeDecode(k)] = i === -1 ? '' : safeDecode(pair.slice(i + 1));
  });
  return { baseUrl: m[1], path: m[2] || '/', query, found: text.includes('{{input}}') };
}

// ── Picking result fields by clicking the response ───────────────────────────
// A click gives the value's position as segments: ['data', 'emails', 0, 'value'].

export const segmentsToPath = (segs) => segs.reduce((p, s) => {
  if (s === '[]') return `${p}[]`;
  if (typeof s === 'number') return `${p}[${s}]`;
  return p ? `${p}.${s}` : String(s);
}, '');

const generalize = (segs) => segs.map((s) => (typeof s === 'number' ? '[]' : s));

// What a click can mean. When the value sits in a list and no list has been
// chosen as "the results" yet, there are two readings:
//   perItem:   each item of that list is a separate result; the field is the
//              path inside an item
//   collected: one result, the field collects that value from every item
export function interpretClick(segs, root) {
  if (root !== undefined && root !== null) {
    const rootSegs = root === '' ? [] : parsePath(root);
    const under = rootSegs.every((s, i) => s === segs[i]);
    if (!under) return { error: 'outsideRoot' };
    let rest = segs.slice(rootSegs.length);
    if (root !== '' && typeof rest[0] === 'number') rest = rest.slice(1);
    return { field: segmentsToPath(generalize(rest)) };
  }
  const firstIndex = segs.findIndex((s) => typeof s === 'number');
  if (firstIndex === -1) return { field: segmentsToPath(segs), root: '' };
  return {
    perItem: { root: segmentsToPath(segs.slice(0, firstIndex)), field: segmentsToPath(generalize(segs.slice(firstIndex + 1))) },
    collected: { root: '', field: segmentsToPath(generalize(segs)) },
  };
}

// "data.emails[0].value" → ['data', 'emails', 0, 'value'] ("[]" kept as '[]')
export function parsePath(path) {
  return (String(path).match(/[^.[\]]+|\[\d*\]/g) || []).map((s) => {
    if (s === '[]') return '[]';
    if (/^\[\d+\]$/.test(s)) return Number(s.slice(1, -1));
    return s;
  });
}

// ── Manifest assembly ────────────────────────────────────────────────────────

export const emptyOperation = () => ({
  id: '', label: '', input: 'email', cost: 'free', path: '/', query: {}, root: undefined, fields: [], title: '', link: '',
});

export const emptyState = () => ({
  name: '', id: '', idTouched: false, description: '', category: '', homepage: '', terms: '',
  baseUrl: '', authType: 'none', authName: '', authOptional: false, authLabel: '', signupUrl: '',
  operations: [emptyOperation()],
});

const opId = (op, i) => op.id || slugify(op.label || `search-${i + 1}`).slice(0, 40);

export function buildManifest(state) {
  const auth = state.authType === 'none'
    ? { type: 'none' }
    : {
      type: state.authType,
      ...(state.authType !== 'bearer' ? { name: state.authName.trim() } : {}),
      ...(state.authOptional ? { optional: true } : {}),
      ...(state.authLabel.trim() ? { label: state.authLabel.trim() } : {}),
      ...(state.signupUrl.trim() ? { signupUrl: state.signupUrl.trim() } : {}),
    };
  const manifest = {
    schema: 'ghost-integration/v1',
    id: state.id || slugify(state.name),
    name: state.name.trim(),
    version: '1.0.0',
    ...(state.description.trim() ? { description: state.description.trim() } : {}),
    ...(state.category.trim() ? { category: state.category.trim() } : {}),
    ...(state.homepage.trim() ? { homepage: state.homepage.trim() } : {}),
    ...(state.terms.trim() ? { terms: state.terms.trim() } : {}),
    baseUrl: state.baseUrl.trim(),
    auth,
    minIntervalMs: 1000,
    operations: state.operations.map((op, i) => ({
      id: opId(op, i),
      label: op.label.trim() || `Search ${i + 1}`,
      input: op.input,
      cost: op.cost,
      path: op.path || '/',
      ...(Object.keys(op.query || {}).length ? { query: op.query } : {}),
      results: {
        ...(op.root ? { root: op.root } : {}),
        ...(op.title ? { title: op.title } : {}),
        ...(op.link ? { link: op.link } : {}),
        fields: op.fields.map((f) => ({
          label: f.label.trim() || humanizeKey(f.path),
          path: f.path,
          ...(f.osintType ? { osintType: f.osintType } : {}),
          ...(f.split ? { split: f.split } : {}),
        })),
      },
    })),
  };
  return manifest;
}

// For editing an existing integration in the builder.
export function stateFromManifest(m) {
  const auth = m.auth || { type: 'none' };
  return {
    name: m.name || '', id: m.id || '', idTouched: true, description: m.description || '', category: m.category || '',
    homepage: m.homepage || '', terms: m.terms || '',
    baseUrl: m.baseUrl || '', authType: auth.type || 'none', authName: auth.name || '', authOptional: Boolean(auth.optional),
    authLabel: auth.label || '', signupUrl: auth.signupUrl || '',
    operations: (m.operations || []).map((op) => ({
      id: op.id, label: op.label || '', input: op.input || 'email', cost: op.cost || 'free',
      path: op.path || '/', query: op.query || {},
      root: op.results?.root ?? '', title: op.results?.title || '', link: op.results?.link || '',
      fields: (op.results?.fields || []).map((f) => ({ label: f.label, path: f.path, osintType: f.osintType || '', split: f.split || '' })),
    })),
  };
}
