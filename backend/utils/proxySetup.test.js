// Running behind a reverse proxy (#115): which proxies name the client's
// address, and the log hint when a sign-in arrives over plain HTTP.
const { readTrustProxy } = require('./trustProxy');
const { insecureCookieHint } = require('../middleware/insecureCookieHint');

describe('TRUST_PROXY (#115)', () => {
  test('default is one proxy (GHOST\'s nginx); numbers count proxies, 0 is none', () => {
    expect(readTrustProxy(undefined)).toEqual({ value: 1 });
    expect(readTrustProxy('')).toEqual({ value: 1 });
    expect(readTrustProxy('2')).toEqual({ value: 2 });
    expect(readTrustProxy(' 0 ')).toEqual({ value: false });
  });

  test('addresses and subnets of the proxies', () => {
    expect(readTrustProxy('loopback, 172.16.0.0/12,10.0.0.5, fd00::/8').value)
      .toEqual(['loopback', '172.16.0.0/12', '10.0.0.5', 'fd00::/8']);
  });

  test('"trust everything" and nonsense fall back to one proxy, with a warning', () => {
    for (const raw of ['true', 'ON', '*', '11', 'proxy.example.com', '10.0.0.0/33', '10.0.0.1/8/1']) {
      const r = readTrustProxy(raw);
      expect(r.value).toBe(1);
      expect(r.warning).toMatch(/not understood/);
    }
  });
});

describe('plain-HTTP sign-in hint (#115)', () => {
  const run = (mw, req) => new Promise((resolve) => mw({ get: () => undefined, ...req }, {}, resolve));

  test('warns once, only for sign-ins over HTTP with a Secure cookie', async () => {
    const log = jest.fn();
    const mw = insecureCookieHint({ secureCookie: true, log });
    await run(mw, { secure: true, path: '/api/auth/login' });
    await run(mw, { secure: false, path: '/api/people' });
    expect(log).not.toHaveBeenCalled();
    await run(mw, { secure: false, path: '/api/auth/oidc/callback', get: () => 'http' });
    await run(mw, { secure: false, path: '/api/auth/login' });
    expect(log).toHaveBeenCalledTimes(1);
    expect(log.mock.calls[0][0]).toMatch(/X-Forwarded-Proto "http"/);
  });

  test('silent when the cookie is not Secure (NODE_ENV other than production)', async () => {
    const log = jest.fn();
    await run(insecureCookieHint({ secureCookie: false, log }), { secure: false, path: '/api/auth/login' });
    expect(log).not.toHaveBeenCalled();
  });
});
