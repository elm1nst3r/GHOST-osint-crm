// Hover colours in dark mode (issue #119).
//
// In dark mode text is light. A hover background from the light palette
// (hover:bg-gray-100, hover:bg-white, hover:bg-blue-50…) or a dark hover
// text colour (hover:text-gray-700) with no dark: counterpart turns the
// element white-on-white or dark-on-dark the moment the pointer is over it.
// There are no component tests, so this is a source scan, like the RTL guard:
// every class string with such a hover must also say what happens in dark
// mode. Exceptions are listed in ALLOWED with the reason.

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const SRC = path.dirname(fileURLToPath(import.meta.url));

const ALLOWED = {
  // The graph's selection bar is black in both modes; a faint white hover is meant.
  'components/graph/GraphActions.jsx': ['hover:bg-white/15'],
};

const COLOURS = 'gray|slate|zinc|neutral|stone|blue|red|green|yellow|amber|orange|purple|indigo|pink|teal|cyan|emerald|sky|violet|rose|lime|fuchsia';
const LIGHT_BG = new RegExp(`(?<![:\\w-])(?:group-)?hover:bg-(?:white|(?:${COLOURS})-(?:50|100|200|300))(?:/\\d+)?(?![\\w-])`, 'g');
const DARK_TEXT = /(?<![:\w-])(?:group-)?hover:text-(?:black|(?:gray|slate|zinc|neutral|stone)-(?:700|800|900|950))(?![\w-])/g;
// Quoted strings on one line, or template literals over several.
const STRINGS = /(["'])((?:\\.|(?!\1)[^\\\n])*?)\1|`((?:\\.|[^\\`])*)`/g;

const sourceFiles = (dir) =>
  fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) return e.name === 'locales' ? [] : sourceFiles(p);
    return /\.jsx?$/.test(e.name) && !/\.test\.jsx?$/.test(e.name) ? [p] : [];
  });

describe('hover colours have a dark-mode counterpart (#119)', () => {
  const problems = [];
  for (const file of sourceFiles(SRC)) {
    const rel = path.relative(SRC, file).split(path.sep).join('/');
    const allowed = ALLOWED[rel] || [];
    const src = fs.readFileSync(file, 'utf8');
    for (const m of src.matchAll(STRINGS)) {
      const s = m[2] ?? m[3];
      if (!s.includes('hover:')) continue;
      const line = src.slice(0, m.index).split('\n').length;
      if (!/dark:(?:group-)?hover:bg-/.test(s)) {
        for (const cls of s.match(LIGHT_BG) || []) if (!allowed.includes(cls)) problems.push(`${rel}:${line} ${cls}`);
      }
      if (!/dark:(?:group-)?hover:text-/.test(s)) {
        for (const cls of s.match(DARK_TEXT) || []) if (!allowed.includes(cls)) problems.push(`${rel}:${line} ${cls}`);
      }
    }
  }

  test('no light hover background or dark hover text without a dark: one', () => {
    expect(problems).toEqual([]);
  });
});
