import {
  slugify, humanizeKey, templateFromExample, requestLine, parseRequestLine, interpretClick, parsePath, segmentsToPath, buildManifest, stateFromManifest, emptyState, emptyOperation, operationIds, usesKeyPlaceholder, recordLists, recordSourceCandidates,
} from './integrationBuilder';

test('slugify and humanizeKey', () => {
  expect(slugify('Have I Been Pwned!')).toBe('have-i-been-pwned');
  expect(slugify('Почта')).toBe('integration');
  expect(humanizeKey('first_name')).toBe('First name');
  expect(humanizeKey('DataClasses')).toBe('Data classes');
  expect(humanizeKey('data.emails[].linkedin')).toBe('Linkedin');
});

describe('templateFromExample', () => {
  test('finds the sample in the path, even when encoded', () => {
    const r = templateFromExample('https://api.example.com/v1/lookup/test%40example.com?full=true', 'test@example.com');
    expect(r).toMatchObject({ baseUrl: 'https://api.example.com', path: '/v1/lookup/{{input}}', query: { full: 'true' }, found: true });
  });

  test('finds it in the query and removes a key passed in the URL', () => {
    const r = templateFromExample('https://api.hunter.io/v2/domain-search?domain=stripe.com&api_key=SECRET', 'stripe.com',
      { authType: 'query', authName: 'api_key' });
    expect(r.query).toEqual({ domain: '{{input}}' });
    expect(r.removedKey).toBe(true);
  });

  test('reports a sample it cannot find, and bad URLs', () => {
    expect(templateFromExample('https://api.example.com/x', 'nothere').found).toBe(false);
    expect(templateFromExample('not a url', 'x').error).toBe('notUrl');
    expect(templateFromExample('http://api.example.com/x', 'x').error).toBe('notHttps');
  });
});

test('requestLine and parseRequestLine round-trip', () => {
  const line = requestLine('https://api.example.com', '/v1/{{input}}', { q: '{{input}}', size: '50' });
  expect(line).toBe('https://api.example.com/v1/{{input}}?q={{input}}&size=50');
  expect(parseRequestLine(line)).toEqual({ baseUrl: 'https://api.example.com', path: '/v1/{{input}}', query: { q: '{{input}}', size: '50' }, found: true });
  expect(parseRequestLine('http://x.com').error).toBe('notHttps');
});

describe('interpretClick', () => {
  test('a value outside any list is a plain field of a single result', () => {
    expect(interpretClick(['data', 'name'], undefined)).toEqual({ field: 'data.name', root: '' });
  });

  test('a value in a list offers per-item or collected', () => {
    const r = interpretClick(['data', 'emails', 2, 'sources', 0, 'uri'], undefined);
    expect(r.perItem).toEqual({ root: 'data.emails', field: 'sources[].uri' });
    expect(r.collected).toEqual({ root: '', field: 'data.emails[].sources[].uri' });
  });

  test('once a list is chosen, clicks inside it are relative to an item', () => {
    expect(interpretClick(['data', 'emails', 4, 'value'], 'data.emails')).toEqual({ field: 'value' });
    expect(interpretClick(['meta', 'total'], 'data.emails')).toEqual({ error: 'outsideRoot' });
  });

  test('with the whole response as one result, list indexes become []', () => {
    expect(interpretClick(['verified_accounts', 1, 'url'], '')).toEqual({ field: 'verified_accounts[].url' });
  });

  test('top-level list responses', () => {
    expect(interpretClick([3, 'name_value'], undefined).perItem).toEqual({ root: '', field: 'name_value' });
  });
});

test('parsePath / segmentsToPath', () => {
  expect(parsePath('data.emails[0].value')).toEqual(['data', 'emails', 0, 'value']);
  expect(segmentsToPath(['a', '[]', 'b'])).toBe('a[].b');
});

test('buildManifest produces a manifest that stateFromManifest reads back', () => {
  const state = {
    ...emptyState(), name: 'Example Service', baseUrl: 'https://api.example.com', authType: 'query', authName: 'key',
    operations: [{
      id: '', label: 'Emails at a domain', input: 'domain', cost: 'quota', path: '/search', query: { domain: '{{input}}' },
      root: 'data', title: 'value', link: '', fields: [{ label: '', path: 'value', osintType: 'Email', split: '' }],
    }],
  };
  const m = buildManifest(state);
  expect(m).toMatchObject({
    id: 'example-service', auth: { type: 'query', name: 'key' },
    operations: [{ id: 'emails-at-a-domain', results: { root: 'data', title: 'value', fields: [{ label: 'Value', path: 'value', osintType: 'Email' }] } }],
  });
  expect(buildManifest(stateFromManifest(m))).toEqual(m);
});

test('merging identical results: on for new searches, kept when editing, only with a results list', () => {
  expect(emptyOperation().mergeDuplicates).toBe(true);
  const op = { ...emptyOperation(), label: 'Breaches', input: 'email', path: '/b/{{input}}', root: 'result', fields: [{ label: 'Email', path: 'email', osintType: 'Email', split: '' }] };
  const m = buildManifest({ ...emptyState(), name: 'X', baseUrl: 'https://x.example', operations: [op] });
  expect(m.operations[0].results.mergeDuplicates).toBe(true);
  expect(buildManifest(stateFromManifest(m))).toEqual(m);
  // An integration saved before this option keeps showing every item.
  const old = { ...m, operations: [{ ...m.operations[0], results: { root: 'result', fields: m.operations[0].results.fields } }] };
  expect(stateFromManifest(old).operations[0].mergeDuplicates).toBe(false);
  expect(buildManifest(stateFromManifest(old)).operations[0].results.mergeDuplicates).toBeUndefined();
  // Collecting from every item (no results list) has nothing to merge.
  const collected = buildManifest({ ...emptyState(), name: 'X', baseUrl: 'https://x.example', operations: [{ ...op, root: '' }] });
  expect(collected.operations[0].results.mergeDuplicates).toBeUndefined();
});

// ── Issue #96 feedback ──────────────────────────────────────────────────────

describe('search ids', () => {
  const op = (id, label) => ({ ...emptyOperation(), id, label });

  test('labels without Latin letters still give unique ids', () => {
    expect(operationIds([op('', 'Поиск по URL'), op('', 'Поиск по телефону'), op('', 'جستجوی تلفن')]))
      .toEqual(['url', 'search-2', 'search-3']);
  });

  test('existing ids are kept and a new search never takes one', () => {
    expect(operationIds([op('integration', 'Поиск'), op('', 'Поиск 2'), op('', 'Phone')]))
      .toEqual(['integration', '2', 'phone']);
    expect(operationIds([op('phone', 'Phone'), op('', 'Phone')])).toEqual(['phone', 'phone-2']);
  });

  test('a built manifest has distinct ids for same-named searches', () => {
    const state = { ...emptyState(), name: 'X', baseUrl: 'https://api.x.com', operations: [op('', 'Lookup'), op('', 'Lookup')] };
    expect(buildManifest(state).operations.map((o) => o.id)).toEqual(['lookup', 'lookup-2']);
  });
});

describe('key inside the web address', () => {
  test('the test key in a pasted example becomes {{api_key}}', () => {
    const r = templateFromExample('https://api.x.org/api/s3cret/phone/79001112233?full=1', '79001112233', { authType: 'url', secret: 's3cret' });
    expect(r).toMatchObject({ path: '/api/{{api_key}}/phone/{{input}}', query: { full: '1' }, found: true, keyMarked: true });
    expect(usesKeyPlaceholder(r)).toBe(true);
  });

  test('the file names no parameter for it', () => {
    const m = buildManifest({ ...emptyState(), name: 'X', baseUrl: 'https://api.x.com', authType: 'url', authName: 'leftover', operations: [emptyOperation()] });
    expect(m.auth).toEqual({ type: 'url' });
  });

  test('other auth types leave the example alone', () => {
    const r = templateFromExample('https://api.x.org/api/s3cret/x', 'x', { authType: 'header', secret: 's3cret' });
    expect(r.keyMarked).toBe(false);
    expect(r.path).toBe('/api/s3cret/{{input}}');
  });
});

test('custom search types round-trip through the file', () => {
  const state = {
    ...emptyState(), name: 'Plates', baseUrl: 'https://api.x.com',
    operations: [{ ...emptyOperation(), label: 'Plate', input: 'text', inputLabel: ' Vehicle registration ', osintTypes: ['Vehicle'], fields: [{ label: 'Owner', path: 'owner' }] }],
  };
  const m = buildManifest(state);
  expect(m.operations[0]).toMatchObject({ input: 'text', inputLabel: 'Vehicle registration', osintTypes: ['Vehicle'] });
  expect(stateFromManifest(m).operations[0]).toMatchObject({ inputLabel: 'Vehicle registration', osintTypes: ['Vehicle'] });
  const email = buildManifest({ ...state, operations: [{ ...state.operations[0], input: 'email' }] }).operations[0];
  expect(email.inputLabel).toBeUndefined();
});

describe('full records in the builder (#96)', () => {
  const sample = { meta: { n: 2 }, result: [{ PHONE: '1', database: 'A' }, { PHONE: '1', EMAIL: 'x@y.co', database: 'B', nested: { list: [{ a: 1 }] } }] };

  test('finds the lists of records in a response', () => {
    expect(recordLists(sample).map((l) => l.path)).toEqual(['result']);
    expect(recordLists([{ a: 1 }])).toEqual([{ path: '', count: 1 }]);
    expect(recordLists({ data: { items: [{ a: 1 }] }, tags: ['x'] }).map((l) => l.path)).toEqual(['data.items']);
  });

  test('suggests text fields as record sources', () => {
    expect(recordSourceCandidates(sample, 'result')).toEqual(['PHONE', 'database', 'EMAIL']);
  });

  test('keepRecords and recordSource round-trip, and records need no fields', () => {
    const state = { ...emptyState(), name: 'Leaks', id: 'leaks', baseUrl: 'https://api.example.com',
      operations: [{ ...emptyOperation(), label: 'By phone', input: 'phone', path: '/q/{{input}}', root: 'result', recordSource: 'database' }] };
    const m = buildManifest(state);
    expect(m.operations[0].results).toMatchObject({ root: 'result', keepRecords: true, recordSource: 'database', fields: [] });
    const back = stateFromManifest(m).operations[0];
    expect(back).toMatchObject({ keepRecords: true, recordSource: 'database', root: 'result' });
  });
});
