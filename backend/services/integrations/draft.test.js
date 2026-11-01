const { completeDraft, pruneForPreview, previewMapping, testDraft } = require('./draft');

const draft = {
  name: 'Example', baseUrl: 'https://api.example.com', auth: { type: 'query', name: 'key' },
  operations: [{ id: 'lookup', label: 'Lookup', input: 'email', path: '/v1/{{input}}' }],
};

test('completeDraft fills in what an unfinished draft lacks', () => {
  const { manifest, op } = completeDraft({ ...draft, operations: [{ ...draft.operations[0], id: undefined }] });
  expect(manifest.id).toBe('draft');
  expect(op.results.fields).toHaveLength(1);
});

test('completeDraft reports validation errors', () => {
  expect(completeDraft({ ...draft, baseUrl: 'http://x.com' }).errors[0]).toMatch(/https/);
  expect(completeDraft({ ...draft, operations: [] }).errors).toEqual(['Add a search first']);
});

test('pruneForPreview trims long lists and strings', () => {
  const { json, truncated } = pruneForPreview({ a: Array.from({ length: 40 }, (_, i) => i), s: 'x'.repeat(3000) });
  expect(json.a).toHaveLength(25);
  expect(json.s.length).toBe(2001);
  expect(truncated).toBe(true);
  expect(pruneForPreview({ a: [1] }).truncated).toBe(false);
});

test('previewMapping uses the real mapping rules', () => {
  const r = previewMapping({ root: 'data', fields: [{ label: 'Email', path: 'value', osintType: 'Email' }] },
    { data: [{ value: 'a@b.co' }, { value: 'c@d.co' }] });
  expect(r.items.map((i) => i.fields[0].values[0])).toEqual(['a@b.co', 'c@d.co']);
  expect(previewMapping({ fields: [{ label: '', path: 'x' }] }, {}).errors).toBeDefined();
});

test('testDraft refuses a bad input, a missing key and private hosts without fetching', async () => {
  expect((await testDraft({ draft, input: 'nope' })).message).toMatch(/email/);
  expect((await testDraft({ draft, input: 'a@b.co' })).message).toMatch(/API key/);
  const local = { ...draft, baseUrl: 'https://127.0.0.1', auth: { type: 'none' } };
  expect((await testDraft({ draft: local, input: 'a@b.co' })).message).toMatch(/private/i);
});
