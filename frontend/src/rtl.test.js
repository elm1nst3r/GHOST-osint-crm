// Right-to-left support (issue #99).
//
// There are no component tests in this codebase, so the layout guarantee is
// kept by a source scan: UI code uses logical Tailwind utilities (ms-/pe-/
// start-/text-start/border-s…), which compute to the same CSS as the physical
// ones in LTR and mirror in RTL. A physical one (ml-/pr-/left-/text-right…)
// silently stays put in Persian or Arabic, and nobody testing in English
// would notice. Physical positions that are meant to stay physical are listed
// in ALLOWED with the reason.

import fs from 'fs';
import path from 'path';
import i18n, { applyDocumentLanguage, forwardArrow } from './i18n';
import { screenCorner } from './components/scratchpad/ScratchpadSettingsView';

const SRC = __dirname;

// Exact occurrence counts per file, so a new physical class in one of these
// files is still caught.
const ALLOWED = {
  // left-1/2 + -translate-x-1/2 centers; the translate is physical, so
  // start-1/2 would push it off-center in RTL.
  'components/visualization/ObsidianGraph.js': { 'left-1/2': 1 },
  // The corner picker draws each corner where it lands on screen; it maps the
  // stored corner through screenCorner() itself.
  'components/scratchpad/ScratchpadSettingsView.js': { 'left-1': 1, 'right-1': 1 },
  // Map and diagram overlays sit around Leaflet's and React Flow's own
  // controls, which are placed physically and don't mirror.
  'components/GlobalMap.js': { 'right-4': 1 },
  'components/WirelessNetworkMap.js': { 'left-4': 1 },
  'components/map/MapLegend.js': { 'right-4': 1 },
  'components/map/MapStats.js': { 'left-4': 1 },
  'components/RelationshipDiagram.js': { 'left-4': 2, 'right-4': 1 },
};

// A class token starts after whitespace, a quote, a backtick, `{`, or a
// variant colon / important bang.
const TOKEN = /(?<=^|[\s"'`{:!])(-?(?:ml|mr|pl|pr|left|right)-[\w.[\]/%-]+|text-(?:left|right)(?![\w-])|border-[lr](?![\w])|border-[lr]-[\w-]+|rounded-[lr](?![\w])|rounded-(?:[lr]|[tb][lr])-[\w-]+|rounded-[tb][lr](?![\w])|float-(?:left|right))/g;
// Plain CSS: physical box properties and alignment.
const CSS_PROPERTY = /\b(?:(?:margin|padding|border)-(?:left|right)|text-align:\s*(?:left|right))\b/g;

const sourceFiles = (dir) =>
  fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) return e.name === 'locales' ? [] : sourceFiles(p);
    return /\.(js|css)$/.test(e.name) && !/\.test\.js$/.test(e.name) ? [p] : [];
  });

const strip = (src, isCss) => {
  // Comments describe directions in prose ("bottom-right corner"); only code counts.
  const noBlock = src.replace(/\/\*[\s\S]*?\*\//g, '');
  return isCss ? noBlock : noBlock.replace(/(^|[^:])\/\/.*$/gm, '$1');
};

describe('layout uses logical directions (RTL guard)', () => {
  const found = {};
  for (const file of sourceFiles(SRC)) {
    const rel = path.relative(SRC, file).split(path.sep).join('/');
    const isCss = file.endsWith('.css');
    const code = strip(fs.readFileSync(file, 'utf8'), isCss);
    const hits = isCss
      ? [...(code.match(CSS_PROPERTY) || []), ...[...code.matchAll(/@apply[^;]*;/g)].flatMap((m) => m[0].match(TOKEN) || [])]
      : code.match(TOKEN) || [];
    for (const h of hits) {
      const token = h.replace(/^[^\w-]+/, '').replace(/^.*:/, '');
      (found[rel] ||= {})[token] = (found[rel][token] || 0) + 1;
    }
  }

  test('no physical left/right utilities outside the allowlist', () => {
    const unexpected = [];
    for (const [file, tokens] of Object.entries(found)) {
      for (const [token, count] of Object.entries(tokens)) {
        const allowed = ALLOWED[file]?.[token] || 0;
        if (count > allowed) unexpected.push(`${file}: ${token} (×${count - allowed})`);
      }
    }
    // Use the logical twin: ml→ms, mr→me, pl→ps, pr→pe, left→start,
    // right→end, text-left→text-start, border-l→border-s, rounded-l→rounded-s.
    expect(unexpected).toEqual([]);
  });

  test('the allowlist has no stale entries', () => {
    const stale = [];
    for (const [file, tokens] of Object.entries(ALLOWED)) {
      for (const [token, count] of Object.entries(tokens)) {
        if ((found[file]?.[token] || 0) < count) stale.push(`${file}: ${token}`);
      }
    }
    expect(stale).toEqual([]);
  });
});

describe('document direction follows the language', () => {
  beforeAll(() => {
    i18n.addResourceBundle('ar', 'translation', { rtlTest: { go: 'التالي →' } });
  });
  afterEach(() => i18n.changeLanguage('en'));

  test('an RTL language sets <html dir="rtl"> and lang', async () => {
    await i18n.changeLanguage('ar');
    expect(document.documentElement.dir).toBe('rtl');
    expect(document.documentElement.lang).toBe('ar');
    await i18n.changeLanguage('en');
    expect(document.documentElement.dir).toBe('ltr');
    expect(document.documentElement.lang).toBe('en');
  });

  test('a language with no catalog renders English left-to-right', async () => {
    // e.g. a stored "he" from an instance that once had Hebrew
    await i18n.changeLanguage('he');
    applyDocumentLanguage();
    expect(document.documentElement.dir).toBe('ltr');
    expect(document.documentElement.lang).toBe('en');
  });

  test('"→" in a translation points the reading direction', async () => {
    await i18n.changeLanguage('ar');
    expect(i18n.t('rtlTest.go')).toBe('التالي ←');
    expect(forwardArrow()).toBe('←');
    await i18n.changeLanguage('en');
    expect(forwardArrow()).toBe('→');
    expect(i18n.t('rtlTest.go', { lng: 'en', defaultValue: 'Next →' })).toBe('Next →');
  });
});

describe('scratchpad corners mirror with the page', () => {
  test('left and right swap in RTL, top and bottom stay', () => {
    expect(screenCorner('bottom-right', 'rtl')).toBe('bottom-left');
    expect(screenCorner('top-left', 'rtl')).toBe('top-right');
    expect(screenCorner('bottom-right', 'ltr')).toBe('bottom-right');
  });
});
