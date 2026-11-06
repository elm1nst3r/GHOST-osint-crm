// Sign-in screen, rendered in a real Chromium (Vitest browser mode).
//
// The backend is replaced by a fake fetch; everything else is the real app
// code: AuthContext, the auth API helper, i18n and the Tailwind CSS. The RTL
// test measures the laid-out page, which a jsdom test can't do.
import { render } from 'vitest-browser-react';
import { vi, beforeEach, afterEach, test, expect } from 'vitest';
import '../index.css';
import i18n from '../i18n';
import Login from './Login';
import { ThemeProvider } from '../contexts/ThemeContext';
import { AuthProvider, useAuth } from '../contexts/AuthContext';

let calls;

// routes: { 'POST /api/auth/login': [status, body] | (body) => [status, body] }
function fakeServer(routes) {
  calls = [];
  vi.spyOn(window, 'fetch').mockImplementation(async (input, init = {}) => {
    const method = init.method || 'GET';
    const path = new URL(String(input), window.location.origin).pathname;
    const body = init.body ? JSON.parse(init.body) : undefined;
    calls.push({ method, path, body });
    const route = routes[`${method} ${path}`];
    const [status, data] = typeof route === 'function' ? route(body) : (route || [404, { error: 'not found' }]);
    return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
  });
}

const signedOut = { 'GET /api/auth/session': [200, { authenticated: false }] };
const user = { id: 7, username: 'inv1', role: 'user' };

// The app shows Login until AuthContext says the user may use the app.
function Harness() {
  const { authenticated, currentUser, handleLogin } = useAuth();
  return authenticated ? <p>signed in as {currentUser.username}</p> : <Login onLogin={handleLogin} />;
}

const renderLogin = () => render(<ThemeProvider><AuthProvider><Harness /></AuthProvider></ThemeProvider>);

async function enterPassword(screen) {
  await screen.getByLabelText(i18n.t('login.username')).fill('inv1');
  await screen.getByLabelText(i18n.t('login.password')).fill('correct horse');
  await screen.getByRole('button', { name: i18n.t('login.signIn') }).click();
}

beforeEach(() => i18n.changeLanguage('en'));
afterEach(() => vi.restoreAllMocks());

test('password, then a code from the authenticator app', async () => {
  fakeServer({
    ...signedOut,
    'POST /api/auth/login': [200, { mfa_required: true, methods: { totp: true, passkey: false } }],
    'POST /api/auth/mfa/verify': [200, { user }],
  });
  const screen = await renderLogin();
  await enterPassword(screen);

  await expect.element(screen.getByText(i18n.t('login.mfa.title'))).toBeVisible();
  expect(screen.getByLabelText(i18n.t('login.password')).query()).toBeNull();

  await screen.getByLabelText(i18n.t('login.mfa.codeLabel')).fill('123456');
  await screen.getByRole('button', { name: i18n.t('login.mfa.verify') }).click();

  await expect.element(screen.getByText('signed in as inv1')).toBeVisible();
  expect(calls.find((c) => c.path === '/api/auth/login').body).toEqual({ username: 'inv1', password: 'correct horse' });
  expect(calls.find((c) => c.path === '/api/auth/mfa/verify').body).toEqual({ code: '123456' });
});

test('a wrong code shows the error and keeps the second step open', async () => {
  fakeServer({
    ...signedOut,
    'POST /api/auth/login': [200, { mfa_required: true, methods: { totp: true, passkey: false } }],
    'POST /api/auth/mfa/verify': [401, { error: 'Invalid code', code: 'mfa_invalid' }],
  });
  const screen = await renderLogin();
  await enterPassword(screen);
  await screen.getByLabelText(i18n.t('login.mfa.codeLabel')).fill('000000');
  await screen.getByRole('button', { name: i18n.t('login.mfa.verify') }).click();

  await expect.element(screen.getByRole('alert')).toHaveTextContent(i18n.t('security.errors.codeInvalid'));
  await expect.element(screen.getByLabelText(i18n.t('login.mfa.codeLabel'))).toBeVisible();
});

test('a recovery code is sent as recovery_code', async () => {
  fakeServer({
    ...signedOut,
    'POST /api/auth/login': [200, { mfa_required: true, methods: { totp: true, passkey: false } }],
    'POST /api/auth/mfa/verify': (body) => (body.recovery_code ? [200, { user }] : [401, { code: 'mfa_invalid' }]),
  });
  const screen = await renderLogin();
  await enterPassword(screen);
  await screen.getByRole('button', { name: i18n.t('login.mfa.useRecovery') }).click();
  await screen.getByLabelText(i18n.t('login.mfa.recoveryLabel')).fill('abcde-fghjk');
  await screen.getByRole('button', { name: i18n.t('login.mfa.verify') }).click();

  await expect.element(screen.getByText('signed in as inv1')).toBeVisible();
  expect(calls.find((c) => c.path === '/api/auth/mfa/verify').body).toEqual({ recovery_code: 'abcde-fghjk' });
});

test('"Back" ends the half-finished sign-in on the server', async () => {
  fakeServer({
    ...signedOut,
    'POST /api/auth/login': [200, { mfa_required: true, methods: { totp: true, passkey: false } }],
    'POST /api/auth/logout': [200, { ok: true }],
  });
  const screen = await renderLogin();
  await enterPassword(screen);
  await screen.getByRole('button', { name: i18n.t('login.mfa.back') }).click();

  await expect.element(screen.getByLabelText(i18n.t('login.password'))).toBeVisible();
  expect(calls.some((c) => c.method === 'POST' && c.path === '/api/auth/logout')).toBe(true);
});

test('a rate-limited session check is retried, not treated as signed out', async () => {
  let sessionCalls = 0;
  calls = [];
  vi.spyOn(window, 'fetch').mockImplementation(async (input) => {
    const path = new URL(String(input), window.location.origin).pathname;
    calls.push({ path });
    if (path !== '/api/auth/session') return new Response('{}', { status: 404 });
    sessionCalls += 1;
    return sessionCalls === 1
      ? new Response(JSON.stringify({ error: 'Too many requests' }), { status: 429, headers: { 'Retry-After': '0' } })
      : new Response(JSON.stringify({ authenticated: true, user }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  });
  const screen = await renderLogin();
  await expect.element(screen.getByText('signed in as inv1')).toBeVisible();
  expect(sessionCalls).toBe(2);
});

// Logical utilities (ms-3 etc., issue #99) must actually mirror: in Persian
// the error icon sits to the right of the message, in English to the left.
test.each([
  ['en', 'ltr', (icon, text) => icon.right <= text.left],
  ['fa', 'rtl', (icon, text) => icon.left >= text.right],
])('error box layout in %s', async (lng, dir, iconBeforeText) => {
  await i18n.changeLanguage(lng);
  fakeServer({ ...signedOut, 'POST /api/auth/login': [401, { error: 'Invalid username or password' }] });
  const screen = await renderLogin();
  await enterPassword(screen);

  const alert = screen.getByRole('alert');
  await expect.element(alert).toBeVisible();
  expect(document.documentElement.dir).toBe(dir);
  const icon = alert.element().querySelector('svg').getBoundingClientRect();
  const text = alert.element().querySelector('p').getBoundingClientRect();
  expect(iconBeforeText(icon, text)).toBe(true);
});
