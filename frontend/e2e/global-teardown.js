// Puts the account's language and theme back the way global-setup found them.
import { request } from '@playwright/test';
import fs from 'node:fs';

export default async function globalTeardown(config) {
  if (!fs.existsSync('e2e/.prefs.json')) return;
  const api = await request.newContext({ baseURL: config.projects[0].use.baseURL, storageState: 'e2e/.auth.json' });
  await api.put('/api/auth/me', { data: JSON.parse(fs.readFileSync('e2e/.prefs.json', 'utf8')) });
  await api.dispose();
  fs.rmSync('e2e/.prefs.json');
}
