import {
  inputKindForOsint, operationsFor, operationsForInput, runnableTools, accepts, customSearchTypes, noInputOperations,
} from './integrations';

test.each([
  ['Email', 'a@b.co', 'email'],
  ['Other', 'a@b.co', 'email'],
  ['Phone', '+79001112233', 'phone'],
  ['Телефон', '89001112233', 'phone'],
  ['IP Address', '1.1.1.1', 'ip'],
  ['Other', '2001:4860:4860::8888', 'ip'],
  ['Website', 'example.com', 'domain'],
  ['Website', 'https://example.com/profile/x', 'url'],
  ['Social Media', 'ivan', 'username'],
  ['Vehicle', 'A123BC', null],
])('%s / %s → %s', (type, value, kind) => {
  expect(inputKindForOsint(type, value)).toBe(kind);
});

const tool = (id, status, ops) => ({
  id, kind: 'integration', connection_status: status,
  integration: { operations: ops.map(([opId, input]) => ({ id: opId, input })) },
});

test('only connected integrations are runnable', () => {
  const tools = [tool(1, 'connected', []), tool(2, 'needs_key', []), { id: 3, kind: 'link', connection_status: 'link' }];
  expect(runnableTools(tools).map((t) => t.id)).toEqual([1]);
});

test('operationsFor matches input kinds, and domain/url stand in for each other', () => {
  const tools = [tool(1, 'connected', [['a', 'email'], ['b', 'domain']]), tool(2, 'connected', [['c', 'url']])];
  expect(operationsFor(tools, 'email').map((x) => x.op.id)).toEqual(['a']);
  expect(operationsFor(tools, 'domain').map((x) => x.op.id)).toEqual(['b', 'c']);
  expect(operationsFor(tools, null)).toEqual([]);
});

test('within one tool an exact kind match wins over a stand-in', () => {
  const wayback = tool(1, 'connected', [['closest', 'url'], ['closest-domain', 'domain']]);
  expect(operationsFor([wayback], 'domain').map((x) => x.op.id)).toEqual(['closest-domain']);
  expect(operationsFor([wayback], 'url').map((x) => x.op.id)).toEqual(['closest']);
});

// ── Custom and no-input searches (issue #96 feedback) ──────────────────────

const custom = (opId, label, types) => ({ id: opId, input: 'text', input_label: label, osint_types: types });
const withOps = (id, ops) => ({ id, kind: 'integration', connection_status: 'connected', integration: { operations: ops } });

test('a custom search type matches person entries by OSINT type, any case', () => {
  const op = custom('plate', 'Vehicle registration', ['Vehicle']);
  expect(accepts(op, { type: 'vehicle', value: 'A123BC', kind: null })).toBe(true);
  expect(accepts(op, { type: 'Email', value: 'a@b.co', kind: 'email' })).toBe(false);
  expect(accepts(op, { custom: 'Vehicle registration' })).toBe(true);
  expect(accepts(op, { kind: 'email' })).toBe(false);
});

test('a typed-in custom value never runs identifier searches', () => {
  expect(accepts({ id: 'e', input: 'email' }, { custom: 'Tax ID' })).toBe(false);
});

test('operationsForInput combines identifier and custom searches', () => {
  const tools = [withOps(1, [{ id: 'e', input: 'email' }, custom('reg', 'Company register', ['Email'])])];
  expect(operationsForInput(tools, { type: 'Email', value: 'a@b.co', kind: 'email' }).map((x) => x.op.id)).toEqual(['e', 'reg']);
  expect(operationsForInput(tools, { type: 'Vehicle', value: 'x', kind: null })).toEqual([]);
});

test('custom search types and no-input searches are listed for the run dialog', () => {
  const tools = [withOps(1, [custom('a', 'Tax ID', []), custom('b', 'Tax ID', []), { id: 'bal', input: 'none' }])];
  expect(customSearchTypes(tools)).toEqual(['Tax ID']);
  expect(noInputOperations(tools).map((x) => x.op.id)).toEqual(['bal']);
  expect(operationsFor(tools, 'email')).toEqual([]);
});
