const { readOidcConfig } = require('./oidcConfig');
const { usernameBase, uniqueUsername, nameParts, groupsOf, roleFromClaims, displayName } = require('./oidcClaims');

const env = (over = {}) => ({
  OIDC_ENABLED: 'true', OIDC_ISSUER_URL: 'https://id.example.com/realms/ghost/', OIDC_CLIENT_ID: 'ghost',
  OIDC_REDIRECT_URI: 'https://ghost.example.com/api/auth/oidc/callback', ...over,
});

describe('OIDC config (#105)', () => {
  test('off unless asked for, and complete', () => {
    expect(readOidcConfig({}).enabled).toBe(false);
    const c = readOidcConfig(env());
    expect(c).toMatchObject({ enabled: true, issuer: 'https://id.example.com/realms/ghost', scopes: 'openid profile email', displayName: 'SSO', autoProvision: false, localLoginEnabled: true, logout: true });
  });

  test('missing or unsafe settings keep it off and say why', () => {
    expect(readOidcConfig(env({ OIDC_CLIENT_ID: '' })).problems).toContain('OIDC_CLIENT_ID is not set');
    expect(readOidcConfig(env({ OIDC_REDIRECT_URI: 'https://ghost.example.com/callback' })).enabled).toBe(false);
    expect(readOidcConfig(env({ OIDC_ISSUER_URL: 'http://id.example.com' })).enabled).toBe(false);
    expect(readOidcConfig(env({ OIDC_ISSUER_URL: 'http://localhost:8180/realms/ghost', OIDC_ALLOW_HTTP: 'true' })).enabled).toBe(true);
  });

  test('openid is always requested; switches parse', () => {
    expect(readOidcConfig(env({ OIDC_SCOPES: 'profile,email groups' })).scopes).toBe('openid profile email groups');
    expect(readOidcConfig(env({ LOCAL_LOGIN_ENABLED: 'false', OIDC_AUTO_PROVISION: 'yes' }))).toMatchObject({ localLoginEnabled: false, autoProvision: true });
  });
});

describe('OIDC claims (#105)', () => {
  test('usernames come from the preferred username or email, cleaned and unique', () => {
    expect(usernameBase({ preferred_username: 'frodo.baggins' })).toBe('frodo.baggins');
    expect(usernameBase({ email: 'sam@shire.example' })).toBe('sam');
    expect(usernameBase({ preferred_username: 'Éowyn of Rohan!' })).toBe('EowynofRohan');
    expect(usernameBase({ preferred_username: 'a' })).toBe('user-a');
    expect(uniqueUsername('frodo', ['Frodo', 'frodo-2'])).toBe('frodo-3');
    expect(uniqueUsername('sam', [])).toBe('sam');
  });

  test('names and display name', () => {
    expect(nameParts({ given_name: 'Bilbo', family_name: 'Baggins' })).toEqual({ first_name: 'Bilbo', last_name: 'Baggins' });
    expect(nameParts({ name: 'Peregrin Took' })).toEqual({ first_name: 'Peregrin', last_name: 'Took' });
    expect(displayName({ preferred_username: 'gandalf' })).toBe('gandalf');
  });

  test('groups: lists, single values, Keycloak paths and nested claims', () => {
    expect(groupsOf({ groups: ['/ghost-admins', 'x'] }, 'groups')).toEqual(['ghost-admins', 'x']);
    expect(groupsOf({ groups: 'ghost-admins' }, 'groups')).toEqual(['ghost-admins']);
    expect(groupsOf({ realm_access: { roles: ['ghost-admins'] } }, 'realm_access.roles')).toEqual(['ghost-admins']);
    expect(groupsOf({}, 'groups')).toEqual([]);
  });

  test('the admin group decides the role only when configured', () => {
    const cfg = { adminGroup: 'ghost-admins', groupsClaim: 'groups' };
    expect(roleFromClaims({ groups: ['/ghost-admins'] }, cfg, 'user')).toBe('admin');
    expect(roleFromClaims({ groups: [] }, cfg, 'admin')).toBe('user');
    expect(roleFromClaims({ groups: [] }, { adminGroup: '' }, 'admin')).toBe('admin');
    expect(roleFromClaims({}, { adminGroup: '' })).toBe('user');
  });
});

describe('OIDC sign-in state cookie (#105)', () => {
  beforeAll(() => { process.env.SESSION_SECRET = process.env.SESSION_SECRET || 'test-secret-for-oidc-state-1234567890'; });
  test('seals, opens, and rejects tampering and age', () => {
    const { sealState, openState, readCookie } = require('./oidcState');
    const sealed = sealState({ state: 's', nonce: 'n', verifier: 'v' });
    expect(openState(sealed)).toMatchObject({ state: 's', nonce: 'n', verifier: 'v' });
    expect(openState(`${sealed.slice(0, -4)}AAAA`)).toBeNull();
    expect(openState(null)).toBeNull();
    const realNow = Date.now;
    Date.now = () => realNow() + 11 * 60 * 1000;
    expect(openState(sealed)).toBeNull();
    Date.now = realNow;
    expect(readCookie({ headers: { cookie: 'a=1; ghost_oidc=v1%3Axyz; b=2' } }, 'ghost_oidc')).toBe('v1:xyz');
  });
});

describe('SSO sessions end with the provider (#105)', () => {
  const { checkLogoutClaims, sessionCheckDue, sessionEndedError, BACKCHANNEL_EVENT } = require('./oidcLogout');
  const events = { [BACKCHANNEL_EVENT]: {} };

  test('session check interval: 5 minutes by default, 0 turns it off', () => {
    expect(readOidcConfig(env()).sessionCheckMinutes).toBe(5);
    expect(readOidcConfig(env({ OIDC_SESSION_CHECK_MINUTES: '0' })).sessionCheckMinutes).toBe(0);
    expect(readOidcConfig(env({ OIDC_SESSION_CHECK_MINUTES: '15' })).sessionCheckMinutes).toBe(15);
    expect(readOidcConfig(env({ OIDC_SESSION_CHECK_MINUTES: 'often' })).sessionCheckMinutes).toBe(0);
    expect(readOidcConfig(env({ OIDC_SESSION_CHECK_MINUTES: '0.2' })).sessionCheckMinutes).toBe(1);
  });

  test('a logout token names a session (sid) or a user (sub)', () => {
    expect(checkLogoutClaims({ events, sid: 's1', sub: 'u1' })).toEqual({ sid: 's1', sub: 'u1' });
    expect(checkLogoutClaims({ events, sub: 'u1' })).toEqual({ sid: null, sub: 'u1' });
    expect(checkLogoutClaims({ events, sid: 's1' })).toEqual({ sid: 's1', sub: null });
  });

  test('anything else is not a logout token', () => {
    expect(() => checkLogoutClaims({ sid: 's1' })).toThrow(/event/);
    expect(() => checkLogoutClaims({ events: { other: {} }, sid: 's1' })).toThrow(/event/);
    expect(() => checkLogoutClaims({ events: { [BACKCHANNEL_EVENT]: 'yes' }, sid: 's1' })).toThrow(/event/);
    expect(() => checkLogoutClaims({ events, sid: 's1', nonce: 'n' })).toThrow(/nonce/); // an ID token passed off as a logout token
    expect(() => checkLogoutClaims({ events })).toThrow(/sid or sub/);
    expect(() => checkLogoutClaims(null)).toThrow();
  });

  test('a session is due for a check after the interval, counted from the last check', () => {
    const min = 60 * 1000;
    expect(sessionCheckDue({ refresh: 'x', at: 0 }, 5 * min, 5)).toBe(true);
    expect(sessionCheckDue({ refresh: 'x', at: 0 }, 4 * min, 5)).toBe(false);
    expect(sessionCheckDue({ refresh: 'x', at: 0, checkedAt: 3 * min }, 5 * min, 5)).toBe(false);
    expect(sessionCheckDue({ at: 0 }, 60 * min, 5)).toBe(false); // no refresh token: nothing to check with
    expect(sessionCheckDue({ refresh: 'x', at: 0 }, 60 * min, 0)).toBe(false); // checks off
    expect(sessionCheckDue({ refresh: 'x', at: 0, checkedAt: 4 * min, recheck: true }, 5 * min, 5)).toBe(true); // another session of the user was signed out
    expect(sessionCheckDue({ refresh: 'x', at: 0, recheck: true }, 1, 0)).toBe(true); // even with periodic checks off
  });

  test('only a refused refresh means the session ended', () => {
    expect(sessionEndedError({ error: 'invalid_grant' })).toBe(true);
    expect(sessionEndedError({ error: 'invalid_client' })).toBe(false);
    expect(sessionEndedError(new TypeError('fetch failed'))).toBe(false);
  });
});

describe('SSO session check middleware (#105)', () => {
  process.env.SESSION_SECRET ||= 'test-session-secret-for-jest';
  const { encryptAtRest, decryptAtRest } = require('./secretBox');
  const { ssoSessionCheck, _checks } = require('../middleware/ssoSessionCheck');
  const MIN = 60 * 1000;
  const cfg = { enabled: true, sessionCheckMinutes: 5 };

  let n = 0;
  const request = (sso) => {
    const req = {
      sessionID: `sid-${++n}`,
      session: { userId: 7, sso },
    };
    req.session.regenerate = (cb) => { req.session = { regenerate: req.session.regenerate }; req.regenerated = true; cb(); };
    return req;
  };
  const run = (mw, req) => new Promise((resolve, reject) => mw(req, {}, (err) => (err ? reject(err) : resolve(req))));
  afterEach(() => _checks.clear());

  test('not due yet: the provider is not asked', async () => {
    const refresh = jest.fn();
    const mw = ssoSessionCheck({ readConfig: () => cfg, refresh, now: () => 2 * MIN });
    const req = await run(mw, request({ refresh: encryptAtRest('r1'), at: 0 }));
    expect(refresh).not.toHaveBeenCalled();
    expect(req.session.userId).toBe(7);
  });

  test('still on: the session stays, with the new refresh token', async () => {
    const refresh = jest.fn().mockResolvedValue({ refreshToken: 'r2', idToken: 'id2' });
    const mw = ssoSessionCheck({ readConfig: () => cfg, refresh, now: () => 6 * MIN });
    const req = await run(mw, request({ refresh: encryptAtRest('r1'), at: 0, idToken: 'id1', recheck: true }));
    expect(refresh).toHaveBeenCalledWith(cfg, 'r1');
    expect(req.session.sso.recheck).toBeUndefined();
    expect(req.session.userId).toBe(7);
    expect(decryptAtRest(req.session.sso.refresh)).toBe('r2');
    expect(req.session.sso).toMatchObject({ idToken: 'id2', checkedAt: 6 * MIN, at: 0 });
  });

  test('ended at the provider: the GHOST session ends', async () => {
    const mw = ssoSessionCheck({ readConfig: () => cfg, refresh: async () => ({ ended: true }), now: () => 6 * MIN });
    const req = await run(mw, request({ refresh: encryptAtRest('r1'), at: 0 }));
    expect(req.regenerated).toBe(true);
    expect(req.session.userId).toBeUndefined();
  });

  test('provider unreachable: the session stays and is checked again a minute later', async () => {
    const mw = ssoSessionCheck({ readConfig: () => cfg, refresh: async () => { throw new Error('connect ECONNREFUSED'); }, now: () => 6 * MIN });
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const req = await run(mw, request({ refresh: encryptAtRest('r1'), at: 0 }));
    warn.mockRestore();
    expect(req.session.userId).toBe(7);
    expect(req.session.sso.checkedAt).toBe(6 * MIN - 5 * MIN + 1 * MIN);
  });

  test('parallel requests share one check (a used refresh token may be refused)', async () => {
    let resolve;
    const refresh = jest.fn(() => new Promise((r) => { resolve = r; }));
    const mw = ssoSessionCheck({ readConfig: () => cfg, refresh, now: () => 6 * MIN });
    const stored = encryptAtRest('r1'); // both requests read the same stored session
    const sso = () => ({ refresh: stored, at: 0 });
    const a = request(sso()); const b = request(sso()); b.sessionID = a.sessionID;
    const both = Promise.all([run(mw, a), run(mw, b)]);
    resolve({ refreshToken: 'r2' });
    await both;
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(decryptAtRest(b.session.sso.refresh)).toBe('r2');
  });

  test('a later check asks again instead of reusing the last answer', async () => {
    const refresh = jest.fn().mockResolvedValueOnce({ refreshToken: 'r2' }).mockResolvedValueOnce({ ended: true });
    let t = 6 * MIN;
    const mw = ssoSessionCheck({ readConfig: () => cfg, refresh, now: () => t });
    const req = await run(mw, request({ refresh: encryptAtRest('r1'), at: 0 }));
    expect(req.session.userId).toBe(7);
    // Seconds later the provider signs the user out and asks for a recheck.
    t += 5000;
    req.session.sso.recheck = true;
    await run(mw, req);
    expect(refresh).toHaveBeenCalledTimes(2);
    expect(refresh).toHaveBeenLastCalledWith(cfg, 'r2');
    expect(req.regenerated).toBe(true);
  });

  test('password sessions, API tokens and checks turned off are left alone', async () => {
    const refresh = jest.fn();
    const mw = ssoSessionCheck({ readConfig: () => cfg, refresh, now: () => 60 * MIN });
    await run(mw, { session: { userId: 1 } });
    await run(mw, { apiToken: true, session: { userId: 1, sso: { refresh: 'x', at: 0 } } });
    const off = ssoSessionCheck({ readConfig: () => ({ ...cfg, sessionCheckMinutes: 0 }), refresh, now: () => 60 * MIN });
    await run(off, request({ refresh: encryptAtRest('r1'), at: 0 }));
    expect(refresh).not.toHaveBeenCalled();
  });
});
