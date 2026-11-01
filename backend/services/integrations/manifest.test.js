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
