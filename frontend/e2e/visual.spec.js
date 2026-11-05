// Screenshot comparison of the whole app (see playwright.config.js for how
// to run it). Each section and dialog is captured in four variants: light /
// dark × English / Persian (right-to-left), on desktop and phone.
//
// Anything marked data-volatile in the app (live server stats, the
// force-directed graph, the audit log) and the map tiles are masked: they
// change between runs on their own.
import { test, expect } from '@playwright/test';
import fs from 'node:fs';

const catalogs = Object.fromEntries(['en', 'fa'].map((l) => [l, JSON.parse(fs.readFileSync(`src/locales/${l}/translation.json`, 'utf8'))]));
const t = (lng, key) => key.split('.').reduce((o, k) => o?.[k], catalogs[lng]) ?? key.split('.').reduce((o, k) => o?.[k], catalogs.en);

const SECTIONS = ['dashboard', 'cases', 'people', 'businesses', 'properties', 'assets', 'crypto-wallets',
  'transactions', 'files', 'tools', 'relationships', 'map', 'wireless', 'settings'];
const SETTINGS_TABS = ['appearance', 'profile', 'security', 'data-model', 'import-export', 'tools', 'users', 'audit-logs'];
const VARIANTS = [['en', 'light'], ['en', 'dark'], ['fa', 'light'], ['fa', 'dark']];

// The API allows 300 requests a minute per address (middleware/rateLimiters.js)
// and every full page load makes about 20. A 429 on the session check shows
// the sign-in screen, so stay well under: count our own API requests and wait
// before each test while the last minute is busy. The log lives in a file so
// it survives Playwright restarting the worker after a failed test.
const CALLS_FILE = 'e2e/.api-calls.json';
const LIMIT = 180;
const WINDOW = 61_000;
const readCalls = () => {
  try { return JSON.parse(fs.readFileSync(CALLS_FILE, 'utf8')).filter((t) => t > Date.now() - WINDOW); } catch { return []; }
};
const logCall = () => fs.writeFileSync(CALLS_FILE, JSON.stringify([...readCalls(), Date.now()]));

test.beforeEach(async ({ page }) => {
  page.on('request', (req) => { if (new URL(req.url()).pathname.startsWith('/api/')) logCall(); });
  for (let calls = readCalls(); calls.length >= LIMIT; calls = readCalls()) {
    await new Promise((r) => setTimeout(r, calls[0] + WINDOW - Date.now() + 100));
  }
});

async function settle(page, lng, theme) {
  await page.waitForLoadState('networkidle');
  // The app itself, not the sign-in or project-selection screen.
  await expect(page.locator('[data-scroll-root]')).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('lang', lng);
  if (theme === 'dark') await expect(page.locator('html')).toHaveClass(/\bdark\b/);
  else await expect(page.locator('html')).not.toHaveClass(/\bdark\b/);
  await expect(page.getByText(t(lng, 'common.loading'), { exact: true })).toHaveCount(0);
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(400); // transitions and late layout
}

// Volatile parts are hidden rather than masked: a mask follows the element's
// size (the health widget's width changes with its figures) and is painted
// even where a dialog covers the element.
const shot = (page, name) => expect(page).toHaveScreenshot(`${name}.png`, {
  stylePath: 'e2e/screenshot.css',
  mask: [page.locator('.leaflet-tile-pane')],
});

for (const [lng, theme] of VARIANTS) {
  test.describe(`${lng} ${theme}`, () => {
    test.beforeAll(async ({ request }) => {
      const res = await request.put('/api/auth/me', { data: { language: lng, theme_mode: theme } });
      expect(res.ok()).toBe(true);
    });

    for (const section of SECTIONS) {
      test(section, async ({ page }) => {
        await page.goto(`/${section}`);
        await settle(page, lng, theme);
        await shot(page, `${lng}-${theme}-${section}`);
      });
    }

    test('settings tabs', async ({ page }) => {
      await page.goto('/settings');
      await settle(page, lng, theme);
      const tabs = page.locator('nav[aria-label="Tabs"] button');
      for (const [i, tab] of SETTINGS_TABS.entries()) {
        await tabs.nth(i + 1).click();
        await settle(page, lng, theme);
        await shot(page, `${lng}-${theme}-settings-${tab}`);
      }
    });

    test('person detail', async ({ page, request }) => {
      const people = await (await request.get('/api/people?limit=1')).json();
      const id = (Array.isArray(people) ? people : people.data)[0].id;
      await page.goto(`/people/${id}`);
      await settle(page, lng, theme);
      await expect(page.getByRole('button', { name: t(lng, 'personDetailModal.generateReportTitle') })).toBeVisible();
      await shot(page, `${lng}-${theme}-person-detail`);
    });

    test('add person form', async ({ page }) => {
      await page.goto('/people');
      await settle(page, lng, theme);
      await page.getByRole('button', { name: t(lng, 'peopleList.addPerson') }).first().click();
      await settle(page, lng, theme);
      await shot(page, `${lng}-${theme}-add-person`);
    });

    test('navigation and advanced search', async ({ page }, testInfo) => {
      await page.goto('/dashboard');
      await settle(page, lng, theme);
      if (testInfo.project.name === 'phone') {
        await page.getByRole('button', { name: t(lng, 'app.openNavigation') }).click();
        await page.waitForTimeout(400);
        await shot(page, `${lng}-${theme}-nav-drawer`);
      }
      await page.getByRole('button', { name: t(lng, 'searchFilters.advancedSearch') }).click();
      await settle(page, lng, theme);
      await shot(page, `${lng}-${theme}-advanced-search`);
    });
  });
}

test.describe('signed out', () => {
  test.use({ storageState: { cookies: [], origins: [] } });
  test('login screen', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#password')).toBeVisible();
    await page.waitForTimeout(400);
    await shot(page, 'login');
  });
});
