/* global console */
// Writes themes.css from themes.js: `npm run themes`. themes.test.js fails
// when the file is out of date.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { THEMES } from './themes.js';
import { themesCss } from './palette.js';

const out = path.join(path.dirname(fileURLToPath(import.meta.url)), 'themes.css');
fs.writeFileSync(out, themesCss(THEMES));
console.log(`themes.css: ${THEMES.filter((t) => t.light || t.dark).length} themes`);
