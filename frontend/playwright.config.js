// Tests against the running app: screenshots (e2e/visual.spec.js) and the
// requests a page load makes (e2e/requests.spec.js).
//
// They compare every section and the main dialogs, in light and dark mode,
// left-to-right and right-to-left, on desktop and phone, against screenshots
// taken earlier on the same machine and data. Use them around a change that
// can move pixels (a CSS framework upgrade, a theme change):
//
//   GHOST_URL=http://localhost:8080 E2E_USER=… E2E_PASS=… npm run test:e2e -- --update-snapshots   # before
//   GHOST_URL=http://localhost:8080 E2E_USER=… E2E_PASS=… npm run test:e2e                         # after
//
// The account should be an admin (to see every tab); E2E_PROJECT names the
// project to show (default: the first one). The tests switch its
// language and theme and set them back afterwards. Screenshots depend on
// the local data and fonts, so they are kept out of git (e2e/__screenshots__).
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: 'e2e',
  snapshotPathTemplate: '{testDir}/__screenshots__/{projectName}/{arg}{ext}',
  outputDir: 'e2e/.results',
  // One worker: the variants change the account's saved language and theme.
  workers: 1,
  fullyParallel: false,
  timeout: 120_000, // includes waiting for the API rate limit window
  reporter: [['list'], ['html', { outputFolder: 'e2e/.report', open: 'never' }]],
  globalSetup: './e2e/global-setup.js',
  globalTeardown: './e2e/global-teardown.js',
  use: {
    baseURL: process.env.GHOST_URL || 'http://localhost:8080',
    storageState: 'e2e/.auth.json',
    colorScheme: 'light',
    locale: 'en-US',
    timezoneId: 'UTC',
  },
  expect: {
    toHaveScreenshot: { animations: 'disabled', caret: 'hide', scale: 'css' },
  },
  projects: [
    { name: 'desktop', use: { viewport: { width: 1440, height: 900 } } },
    { name: 'phone', use: { viewport: { width: 390, height: 844 }, hasTouch: true } },
  ],
});
