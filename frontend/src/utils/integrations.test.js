import { inputKindForOsint, operationsFor, runnableTools } from './integrations';

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
