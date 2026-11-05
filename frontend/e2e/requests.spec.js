// What the running app asks the server for on a page load (run with the
// screenshot tests: `npm run test:e2e`, same setup).
//
// - Before a project is chosen, nothing project-scoped is loaded. The app
//   used to load every list unfiltered (for an admin: all projects' data)
//   behind the "Select a project" screen, then all of it again.
// - With a project chosen, each list is requested once, for that project.
import { test, expect } from '@playwright/test';
import fs from 'node:fs';

const en = JSON.parse(fs.readFileSync('src/locales/en/translation.json', 'utf8'));
const t = (key) => key.split('.').reduce((o, k) => o?.[k], en);

const SCOPED = ['/api/people', '/api/businesses', '/api/tools', '/api/todos', '/api/properties', '/api/assets',
  '/api/crypto-wallets', '/api/transactions', '/api/cases', '/api/relationships'];
const isScoped = (url) => SCOPED.some((p) => url.pathname === p || url.pathname.startsWith(`${p}/`));

async function apiRequests(page, path) {
  const urls = [];
  page.on('request', (r) => { const u = new URL(r.url()); if (u.pathname.startsWith('/api/')) urls.push(u); });
  await page.goto(path);
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(500);
  return urls;
}

test('before a project is chosen, the picker loads no project data', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'once is enough');
  await page.addInitScript(() => localStorage.removeItem('ghost-active-project'));
  const urls = await apiRequests(page, '/dashboard');
  await expect(page.getByText(t('projectGate.titlePick'), { exact: true })).toBeVisible();
  expect(urls.filter(isScoped).map((u) => u.pathname + u.search)).toEqual([]);
});

test('with a project chosen, each list is loaded once and for that project', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'once is enough');
  const urls = await apiRequests(page, '/businesses');
  const scoped = urls.filter(isScoped);
  expect(scoped.length).toBeGreaterThan(0);
  const projectIds = new Set(scoped.map((u) => u.searchParams.get('project_id')));
  expect([...projectIds].length, `project_id values: ${[...projectIds]}`).toBe(1);
  expect([...projectIds][0]).not.toBeNull();
  const keys = scoped.map((u) => u.pathname + u.search);
  expect(keys.filter((k, i) => keys.indexOf(k) !== i), 'requested more than once').toEqual([]);
});
