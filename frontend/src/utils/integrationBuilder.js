// File: frontend/src/utils/integrationBuilder.js
//
// The logic behind the integration builder: turn plain answers into a
// ghost-integration/v1 manifest and back. Kept free of React so it's tested
// directly; the server validates the result again before installing.

// Only Latin letters and digits survive, so a Russian or Persian name comes
// out empty and gets the fallback.
export const slugify = (name, fallback = 'integration') => String(name || '')
  .toLowerCase()
  .normalize('NFKD').replace(/[̀-ͯ]/g, '')
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '')
  .slice(0, 60) || fallback;

export const KEY_PLACEHOLDER = '{{api_key}}';
export const usesKeyPlaceholder = (op) =>
  [op.path, ...Object.values(op.query || {})].some((v) => String(v || '').includes(KEY_PLACEHOLDER));

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
// sample value used in it, work out the request template. A key passed as a
// query parameter ("key in a query parameter" auth) is removed, since GHOST
// adds it; for "key inside the web address" auth, the test key found in the
// example is replaced with {{api_key}}, so it never ends up in the file.
// Returns { baseUrl, path, query, found, removedKey, keyMarked } or { error }.
export function templateFromExample(exampleUrl, sample, { authType, authName, secret } = {}) {
  let url;
  try { url = new URL(String(exampleUrl).trim()); } catch { return { error: 'notUrl' }; }
  if (url.protocol !== 'https:') return { error: 'notHttps' };
  const value = String(sample || '').trim();
  const key = authType === 'url' ? String(secret || '').trim() : '';

  let found = false;
  let keyMarked = false;
  const fill = (text) => {
    let out = text;
    if (key && out.includes(key)) { keyMarked = true; out = out.split(key).join(KEY_PLACEHOLDER); }
    if (value && out.includes(value)) { found = true; out = out.split(value).join('{{input}}'); }
    return out;
  };
  const path = url.pathname.split('/').map((seg) => fill(safeDecode(seg))).join('/') || '/';

  const query = {};
  let removedKey = false;
  for (const [k, v] of url.searchParams.entries()) {
    if (authType === 'query' && authName && k === authName) { removedKey = true; continue; }
    query[k] = fill(v);
  }
  return { baseUrl: url.origin, path, query, found, removedKey, keyMarked };
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
  id: '', label: '', input: 'email', inputLabel: '', osintTypes: [], cost: 'free', path: '/', query: {},
  root: undefined, fields: [], title: '', link: '',
});

export const emptyState = () => ({
  name: '', id: '', idTouched: false, description: '', category: '', homepage: '', terms: '',
  baseUrl: '', authType: 'none', authName: '', authOptional: false, authLabel: '', signupUrl: '',
  operations: [emptyOperation()],
});

// Search ids must be unique within the file. Existing ones are kept (findings
// added to people record the search they came from); a new search's id comes
// from its label, or is search-N when the label has no Latin letters. Before
// this, two searches with Russian labels both became "integration", so a test
// of the second ran the first and the file couldn't be installed (issue #96).
export function operationIds(operations) {
  const used = new Set(operations.map((op) => op.id).filter(Boolean));
  return operations.map((op, i) => {
    if (op.id) return op.id;
    const base = slugify(op.label, '').slice(0, 36) || `search-${i + 1}`;
    let id = base;
    for (let n = 2; used.has(id); n += 1) id = `${base}-${n}`;
    used.add(id);
    return id;
  });
}

export function buildManifest(state) {
  const auth = state.authType === 'none'
    ? { type: 'none' }
    : {
      type: state.authType,
      ...(['header', 'query'].includes(state.authType) ? { name: state.authName.trim() } : {}),
      ...(state.authOptional ? { optional: true } : {}),
      ...(state.authLabel.trim() ? { label: state.authLabel.trim() } : {}),
      ...(state.signupUrl.trim() ? { signupUrl: state.signupUrl.trim() } : {}),
    };
  const ids = operationIds(state.operations);
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
      id: ids[i],
      label: op.label.trim() || `Search ${i + 1}`,
      input: op.input,
      ...(op.input === 'text' ? {
        inputLabel: (op.inputLabel || '').trim(),
        ...((op.osintTypes || []).length ? { osintTypes: op.osintTypes } : {}),
      } : {}),
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
      inputLabel: op.inputLabel || '', osintTypes: op.osintTypes || [],
      path: op.path || '/', query: op.query || {},
      root: op.results?.root ?? '', title: op.results?.title || '', link: op.results?.link || '',
      fields: (op.results?.fields || []).map((f) => ({ label: f.label, path: f.path, osintType: f.osintType || '', split: f.split || '' })),
    })),
  };
}
