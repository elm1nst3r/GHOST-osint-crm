const { isPrivateAddress, getJson } = require('./httpClient');

test.each([
  '127.0.0.1', '10.1.2.3', '172.16.0.1', '172.31.255.255', '192.168.1.1', '169.254.169.254', '100.64.0.1',
  '0.0.0.0', '::1', '::', 'fd00::1', 'fe80::1', '::ffff:127.0.0.1', '::ffff:10.0.0.1', 'not-an-ip',
])('%s is private', (ip) => expect(isPrivateAddress(ip)).toBe(true));

test.each(['8.8.8.8', '1.1.1.1', '172.32.0.1', '91.199.212.73', '2a0e:ac00:c7:d449::5bc7:d449', '2001:4860:4860::8888'])(
  '%s is public', (ip) => expect(isPrivateAddress(ip)).toBe(false)
);

test('refuses non-HTTPS and private literal addresses without touching the network', async () => {
  await expect(getJson('http://example.com/')).rejects.toMatchObject({ kind: 'invalid' });
  await expect(getJson('https://127.0.0.1/')).rejects.toMatchObject({ kind: 'blocked' });
  await expect(getJson('https://[::1]/')).rejects.toMatchObject({ kind: 'blocked' });
});

test('refuses a hostname that resolves to a private address', async () => {
  await expect(getJson('https://localhost/')).rejects.toMatchObject({ kind: 'blocked' });
});
