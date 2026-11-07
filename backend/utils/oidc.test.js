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
