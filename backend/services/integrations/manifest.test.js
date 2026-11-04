const fs = require('fs');
const path = require('path');
const {
  normalizeInput, inputKindForOsint, renderTemplate, validateManifest, buildRequest, getPath, mapResults, publicSummary,
} = require('./manifest');

const base = (extra = {}) => ({
  schema: 'ghost-integration/v1',
  id: 'example',
  name: 'Example',
  baseUrl: 'https://api.example.com/v1',
  auth: { type: 'header', name: 'x-key' },
  operations: [{
    id: 'lookup', label: 'Lookup', input: 'email', path: '/lookup/{{input}}',
    results: { fields: [{ label: 'Name', path: 'name' }] },
  }],
  ...extra,
});

describe('built-in manifests', () => {
  const dir = path.join(__dirname, '..', '..', 'integrations');
  for (const file of fs.readdirSync(dir).filter((f) => f.endsWith('.json'))) {
    test(`${file} is valid and its id matches the file name`, () => {
      const r = validateManifest(JSON.parse(fs.readFileSync(path.join(dir, file), 'utf8')));
      expect(r.errors).toBeUndefined();
      expect(`${r.manifest.id}.json`).toBe(file);
    });
  }
});

// Community contributions in the repo's top-level integrations/community
// folder: a pull request with an invalid file fails CI. Not present inside
// the Docker image (only backend/ is), hence the existence check.
describe('community manifests', () => {
  const dir = path.join(__dirname, '..', '..', '..', 'integrations', 'community');
  const files = fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => f.endsWith('.json')) : [];
  const builtinIds = fs.readdirSync(path.join(__dirname, '..', '..', 'integrations')).map((f) => f.replace(/\.json$/, ''));
  test.each(files.length ? files : ['(none)'])('%s is valid and does not reuse a built-in id', (file) => {
    if (file === '(none)') return;
    const r = validateManifest(JSON.parse(fs.readFileSync(path.join(dir, file), 'utf8')));
    expect(r.errors).toBeUndefined();
    expect(builtinIds).not.toContain(r.manifest.id);
  });
});

describe('validateManifest', () => {
  test('accepts a minimal manifest and defaults auth to none', () => {
    const { manifest } = validateManifest({ ...base(), auth: undefined });
    expect(manifest.auth).toEqual({ type: 'none' });
  });

  test.each([
    ['http base URL', { baseUrl: 'http://api.example.com' }],
    ['base URL with a query', { baseUrl: 'https://api.example.com/?a=1' }],
    ['base URL with credentials', { baseUrl: 'https://u:p@api.example.com' }],
    ['Authorization as header auth', { auth: { type: 'header', name: 'Authorization' } }],
    ['forbidden static header', { headers: { Host: 'evil.example' } }],
    ['header auth without a name', { auth: { type: 'header' } }],
    ['bad id', { id: 'Bad ID!' }],
  ])('rejects %s', (_, extra) => {
    expect(validateManifest(base(extra)).errors).toBeDefined();
  });

  test.each([
    ['path outside /', 'lookup/{{input}}'],
    ['.. in path', '/../{{input}}'],
    ['unknown variable', '/x/{{secret}}'],
    ['unknown filter', '/x/{{input|exec}}'],
  ])('rejects an operation with %s', (_, p) => {
    const m = base();
    m.operations[0].path = p;
    expect(validateManifest(m).errors).toBeDefined();
  });

  test('rejects duplicate operation ids', () => {
    const m = base();
    m.operations.push({ ...m.operations[0] });
    expect(validateManifest(m).errors.join()).toMatch(/duplicate operation id/);
  });
});

describe('normalizeInput', () => {
  test.each([
    ['email', ' Ivan@Example.COM ', 'ivan@example.com'],
    ['domain', 'https://www.Example.com/path?x=1', 'example.com'],
    ['domain', 'sub.example.co.uk:443', 'sub.example.co.uk'],
    ['ip', '8.8.8.8', '8.8.8.8'],
    ['ip', '2001:4860:4860::8888', '2001:4860:4860::8888'],
    ['username', '@ivan_ivanov', 'ivan_ivanov'],
    ['username', 'иван.петров', 'иван.петров'],
    ['phone', '+7 (900) 111-22-33', '+79001112233'],
    ['url', 'example.com/page', 'https://example.com/page'],
  ])('%s %s → %s', (kind, raw, out) => {
    expect(normalizeInput(kind, raw)).toBe(out);
  });

  test.each([
    ['email', 'not-an-email'], ['domain', 'nope'], ['domain', 'a b.com'], ['ip', '999.1.1.1'],
    ['username', 'has space'], ['username', 'a/b'], ['phone', '12'], ['url', 'javascript:alert(1)'], ['email', ''],
  ])('rejects %s %s', (kind, raw) => {
    expect(() => normalizeInput(kind, raw)).toThrow();
  });
});

describe('inputKindForOsint', () => {
  test.each([
    ['Email', 'a@b.co', 'email'],
    ['Other', 'a@b.co', 'email'],
    ['Phone', '+79001112233', 'phone'],
    ['Телефон', '89001112233', 'phone'],
    ['IP Address', '1.1.1.1', 'ip'],
    ['Website', 'example.com', 'domain'],
    ['Website', 'https://example.com/profile/x', 'url'],
    ['Social Media', 'ivan', 'username'],
    ['Username', 'ivan', 'username'],
    ['Vehicle', 'A123BC', null],
  ])('%s / %s → %s', (type, value, kind) => {
    expect(inputKindForOsint(type, value)).toBe(kind);
  });
});

describe('renderTemplate', () => {
  test('encodes the input and applies filters', () => {
    expect(renderTemplate('/x/{{input}}', 'a b/c?d')).toBe('/x/a%20b%2Fc%3Fd');
    const expected = require('crypto').createHash('sha256').update('a@b.co').digest('hex');
    expect(renderTemplate('/h/{{ input | lower | sha256 }}', 'A@B.CO')).toBe(`/h/${expected}`);
    expect(renderTemplate('{{input|digits}}', '+7 900')).toBe('7900');
  });
});

describe('buildRequest', () => {
  const { manifest } = validateManifest(base({ headers: { 'User-Agent': 'Custom' } }));
  const op = manifest.operations[0];

  test('puts the key where the manifest says and redacts it', () => {
    const r = buildRequest(manifest, op, 'a@b.co', 's3cret');
    expect(r.url).toBe('https://api.example.com/v1/lookup/a%40b.co');
    expect(r.headers['x-key']).toBe('s3cret');
    expect(r.headers['User-Agent']).toBe('Custom');
    expect(r.redactedUrl).not.toContain('s3cret');
  });

  test('query auth is redacted from the logged URL', () => {
    const m = validateManifest(base({ auth: { type: 'query', name: 'api_key' } })).manifest;
    const r = buildRequest(m, { ...op, query: { q: '{{input}}' } }, 'a@b.co', 'k/+=y');
    expect(new URL(r.url).searchParams.get('api_key')).toBe('k/+=y');
    expect(new URL(r.url).searchParams.get('q')).toBe('a@b.co');
    expect(r.redactedUrl).not.toMatch(/k%2F|k\/\+/);
  });

  test('bearer auth', () => {
    const m = validateManifest(base({ auth: { type: 'bearer' } })).manifest;
    expect(buildRequest(m, op, 'a@b.co', 'tok').headers.Authorization).toBe('Bearer tok');
  });

  test('refuses to run without a required key', () => {
    expect(() => buildRequest(manifest, op, 'a@b.co', null)).toThrow(/API key/);
  });

  test('optional auth runs without a key', () => {
    const m = validateManifest(base({ auth: { type: 'bearer', optional: true } })).manifest;
    expect(buildRequest(m, op, 'a@b.co', null).headers.Authorization).toBeUndefined();
  });

  test('an input cannot climb out of the base path', () => {
    const m = validateManifest(base({ auth: { type: 'none' } })).manifest;
    expect(() => buildRequest(m, { path: '/{{input}}' }, '..', null)).toThrow(/leave/);
  });
});

describe('getPath / mapResults', () => {
  const doc = { data: { emails: [{ value: 'a@x.co', src: [{ uri: 'u1' }, { uri: 'u2' }] }, { value: 'b@x.co', src: [] }] } };

  test('getPath', () => {
    expect(getPath(doc, 'data.emails[1].value')).toBe('b@x.co');
    expect(getPath(doc, 'data.emails[].value')).toEqual(['a@x.co', 'b@x.co']);
    expect(getPath(doc, 'data.emails[].src[].uri')).toEqual(['u1', 'u2']);
    expect(getPath(doc, 'missing.path')).toBeUndefined();
    expect(getPath(doc, '')).toBe(doc);
  });

  test('maps a list, splits, strips HTML and keeps osint types', () => {
    const json = [
      { name: 'a.example.com\nb.example.com', html: '<b>Big</b> &amp; bad', n: 3 },
      { name: 'a.example.com\nb.example.com', html: 'dup', n: 4 },
      { name: 'c.example.com', html: null, n: 0 },
    ];
    const r = mapResults({
      distinctBy: 'name',
      title: 'n',
      fields: [
        { label: 'Hosts', path: 'name', split: '\n', osintType: 'Website' },
        { label: 'Desc', path: 'html', stripHtml: true },
      ],
    }, json);
    expect(r.total).toBe(2);
    expect(r.items[0].fields[0]).toEqual({ label: 'Hosts', osintType: 'Website', values: ['a.example.com', 'b.example.com'] });
    expect(r.items[0].fields[1].values).toEqual(['Big & bad']);
    expect(r.items[1].title).toBe('0');
  });

  test('a single object becomes one item, a missing root none', () => {
    expect(mapResults({ fields: [{ label: 'IP', path: 'ip' }] }, { ip: '1.1.1.1' }).items).toHaveLength(1);
    expect(mapResults({ root: 'nope', fields: [{ label: 'IP', path: 'ip' }] }, { ip: '1.1.1.1' }).items).toHaveLength(0);
  });

  test('only http(s) links are kept', () => {
    const r = mapResults({ link: 'u', fields: [{ label: 'x', path: 'x' }] }, [{ u: 'javascript:alert(1)', x: 1 }, { u: 'https://ok', x: 2 }]);
    expect(r.items[0].link).toBeUndefined();
    expect(r.items[1].link).toBe('https://ok');
  });

  test('caps the number of items', () => {
    const r = mapResults({ fields: [{ label: 'x', path: 'x' }] }, Array.from({ length: 250 }, (_, i) => ({ x: i })));
    expect(r.items).toHaveLength(200);
    expect(r.truncated).toBe(true);
  });
});

test('publicSummary exposes the host and operations, not request details', () => {
  const s = publicSummary(validateManifest(base()).manifest, 'builtin');
  expect(s.host).toBe('api.example.com');
  expect(s.auth).toMatchObject({ type: 'header', required: true });
  expect(s.operations[0]).toMatchObject({ id: 'lookup', input: 'email', cost: 'free' });
  expect(JSON.stringify(s)).not.toContain('/lookup/');
});

// ── Issue #96 feedback: key in the URL, custom and no-input searches ─────────

describe('"url" auth: the key goes where {{api_key}} is', () => {
  const urlAuth = (opExtra = {}, extra = {}) => base({
    auth: { type: 'url' },
    operations: [{
      id: 'lookup', label: 'Lookup', input: 'email', path: '/api/{{api_key}}/lookup/{{input}}',
      results: { fields: [{ label: 'Name', path: 'name' }] }, ...opExtra,
    }],
    ...extra,
  });

  test('a path segment carries the key, encoded, and the logged URL hides it', () => {
    const { manifest, errors } = validateManifest(urlAuth());
    expect(errors).toBeUndefined();
    const req = buildRequest(manifest, manifest.operations[0], 'a@b.co', 'k3y/+?');
    expect(req.url).toBe('https://api.example.com/v1/api/k3y%2F%2B%3F/lookup/a%40b.co');
    expect(req.redactedUrl).toBe('https://api.example.com/v1/api/***/lookup/a%40b.co');
    expect(req.redactedUrl).not.toMatch(/k3y/);
  });

  test('it can sit in a query value too', () => {
    const { manifest } = validateManifest(urlAuth({ path: '/lookup', query: { q: '{{input}}', token: 'v1-{{api_key}}' } }));
    const req = buildRequest(manifest, manifest.operations[0], 'a@b.co', 'SECRET');
    expect(req.url).toContain('token=v1-SECRET');
    expect(req.redactedUrl).not.toContain('SECRET');
  });

  test('every search must place the key, and no other auth may', () => {
    expect(validateManifest(urlAuth({ path: '/lookup/{{input}}' })).errors.join()).toMatch(/\{\{api_key\}\}/);
    expect(validateManifest(base({
      operations: [{ id: 'x', label: 'X', input: 'email', path: '/{{api_key}}/{{input}}', results: { fields: [{ label: 'N', path: 'n' }] } }],
    })).errors.join()).toMatch(/needs "url" auth/);
    expect(validateManifest(urlAuth({}, { test: { path: '/status' } })).errors.join()).toMatch(/test\.path/);
    expect(validateManifest(urlAuth({}, { test: { path: '/{{api_key}}/status' } })).errors).toBeUndefined();
  });

  test('a required key is still required', () => {
    const { manifest } = validateManifest(urlAuth());
    expect(() => buildRequest(manifest, manifest.operations[0], 'a@b.co', null)).toThrow(/needs an API key/);
  });

  test('a searched-for "{{api_key}}" stays text', () => {
    expect(renderTemplate('{{input}}', '{{api_key}}', (s) => s, 'SECRET')).toBe('{{api_key}}');
  });
});

describe('custom ("text") and no-input ("none") searches', () => {
  const op = (extra) => ({ id: 'op', label: 'Op', path: '/x/{{input}}', results: { fields: [{ label: 'N', path: 'n' }] }, ...extra });

  test('a custom search type needs a name and may list OSINT types', () => {
    expect(validateManifest(base({ operations: [op({ input: 'text' })] })).errors.join()).toMatch(/inputLabel/);
    const { manifest, errors } = validateManifest(base({
      operations: [op({ input: 'text', inputLabel: 'Vehicle registration', osintTypes: ['Vehicle'] })],
    }));
    expect(errors).toBeUndefined();
    expect(publicSummary(manifest, 'imported').operations[0]).toMatchObject({
      input: 'text', input_label: 'Vehicle registration', osint_types: ['Vehicle'],
    });
  });

  test('custom values are trimmed, and long or control-character values refused', () => {
    expect(normalizeInput('text', '  AB 123 CD ')).toBe('AB 123 CD');
    expect(() => normalizeInput('text', 'x'.repeat(201))).toThrow();
    expect(() => normalizeInput('text', 'a\nb')).toThrow();
    expect(() => normalizeInput('text', '  ')).toThrow(/Enter a value/);
  });

  test('a no-input search takes no value and cannot use {{input}}', () => {
    expect(normalizeInput('none', undefined)).toBe('');
    expect(validateManifest(base({ operations: [op({ input: 'none' })] })).errors.join()).toMatch(/without input/);
    const { manifest, errors } = validateManifest(base({ operations: [op({ input: 'none', path: '/account/balance' })] }));
    expect(errors).toBeUndefined();
    expect(buildRequest(manifest, manifest.operations[0], '', 'k').url).toBe('https://api.example.com/v1/account/balance');
  });

  test('a free no-input search doubles as the connection test', () => {
    const { manifest } = validateManifest(base({
      operations: [op({ input: 'email' }), op({ id: 'balance', input: 'none', path: '/balance' })],
    }));
    expect(publicSummary(manifest, 'imported').has_test).toBe(true);
    const paid = validateManifest(base({ operations: [op({ input: 'none', path: '/balance', cost: 'paid' })] })).manifest;
    expect(publicSummary(paid, 'imported').has_test).toBe(false);
  });
});
