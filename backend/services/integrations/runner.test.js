// Runner behaviour for searches without input (issue #96 feedback), with the
// HTTP client mocked: no network, no database.
jest.mock('./httpClient', () => ({ getJson: jest.fn() }));
// Stored keys are encrypted; the suite needs a server secret to do that.
process.env.SECRETS_KEY = process.env.SECRETS_KEY || 'jest-only-secrets-key';
const { getJson } = require('./httpClient');
const { validateManifest } = require('./manifest');
const { runOperation, testConnection } = require('./runner');

const db = { query: async () => ({ rows: [] }) };
const tool = { id: 1, name: 'Example', credential_mode: 'shared' };
const { manifest } = validateManifest({
  schema: 'ghost-integration/v1',
  id: 'example',
  name: 'Example',
  baseUrl: 'https://api.example.com',
  operations: [
    { id: 'lookup', label: 'Lookup', input: 'email', path: '/lookup/{{input}}', results: { fields: [{ label: 'Name', path: 'name' }] } },
    { id: 'balance', label: 'Balance', input: 'none', path: '/account/balance', results: { fields: [{ label: 'Credits', path: 'credits' }] } },
  ],
});

beforeEach(() => getJson.mockReset());

test('a no-input search runs without a value', async () => {
  getJson.mockResolvedValue({ status: 200, json: { credits: 42 }, text: '' });
  const result = await runOperation(db, { tool, manifest, operationId: 'balance', rawInput: undefined, userId: 1 });
  expect(getJson.mock.calls[0][0]).toBe('https://api.example.com/account/balance');
  expect(result.query).toBe('');
  expect(result.items[0].fields[0]).toMatchObject({ label: 'Credits', values: ['42'] });
});

test('without a manifest test, the free no-input search checks the connection', async () => {
  getJson.mockResolvedValue({ status: 200, json: {}, text: '' });
  const r = await testConnection(db, { tool, manifest, userId: 1 });
  expect(r).toMatchObject({ ok: true, tested: true });
  expect(getJson.mock.calls[0][0]).toBe('https://api.example.com/account/balance');
});

test('a key the provider echoes back never reaches the results', async () => {
  const keyed = validateManifest({
    schema: 'ghost-integration/v1', id: 'echo', name: 'Echo', baseUrl: 'https://api.example.com', auth: { type: 'url' },
    operations: [{ id: 'echo', label: 'Echo', input: 'none', path: '/{{api_key}}/echo', results: { fields: [{ label: 'URL', path: 'url' }] } }],
  }).manifest;
  const keyDb = { query: async () => ({ rows: [{ secret: require('../../utils/secretBox').encryptAtRest('S3CRET') }] }) };
  getJson.mockResolvedValue({ status: 200, json: { url: 'https://api.example.com/S3CRET/echo' }, text: '' });
  const result = await runOperation(keyDb, { tool, manifest: keyed, operationId: 'echo', userId: 1 });
  expect(getJson.mock.calls[0][0]).toBe('https://api.example.com/S3CRET/echo');
  expect(JSON.stringify(result.items)).not.toContain('S3CRET');
  expect(result.items[0].fields[0].values).toEqual(['https://api.example.com/***/echo']);
});
