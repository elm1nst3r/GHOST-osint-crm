// Signs in once and keeps the session for every test, so the run doesn't
// hit the login rate limit. Remembers the account's language and theme so
// global-teardown can restore them.
import { request } from '@playwright/test';
import fs from 'node:fs';

export default async function globalSetup(config) {
  const baseURL = config.projects[0].use.baseURL;
  const { E2E_USER: username, E2E_PASS: password } = process.env;
  if (!username || !password) throw new Error('Set E2E_USER and E2E_PASS (an admin account on the stack under test).');

  const api = await request.newContext({ baseURL });
  const login = await api.post('/api/auth/login', { data: { username, password } });
  if (!login.ok()) throw new Error(`Sign-in failed (${login.status()}): ${await login.text()}`);
  if ((await login.json()).mfa_required) throw new Error('Use an account without two-step verification for screenshot tests.');

  // GHOST keeps the chosen project in the browser; without it every page
  // opens on the "Select a project" screen. E2E_PROJECT names it (default:
  // the first project).
  const projects = await (await api.get('/api/projects')).json();
  const list = Array.isArray(projects) ? projects : projects.data;
  const project = process.env.E2E_PROJECT ? list.find((p) => p.name === process.env.E2E_PROJECT) : list[0];
  if (!project) throw new Error(`Project not found: ${process.env.E2E_PROJECT || '(none exist)'}`);

  const me = await (await api.get('/api/auth/me')).json();
  fs.writeFileSync('e2e/.prefs.json', JSON.stringify({ language: me.language ?? null, theme_mode: me.theme_mode ?? null }));
  const state = await api.storageState();
  state.origins = [{ origin: new URL(baseURL).origin, localStorage: [{ name: 'ghost-active-project', value: JSON.stringify(project.id) }] }];
  fs.writeFileSync('e2e/.auth.json', JSON.stringify(state));
  await api.dispose();
}
