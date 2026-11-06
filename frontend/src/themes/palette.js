// Turns a theme variant (themes.js) into GHOST's colour variables: the
// slate/gray ramps, the 15 colour families at 50-950, white/black, the accent
// and the status colours. Shades GHOST uses for text and for buttons with
// light text are pushed until they meet WCAG contrast, so a theme can't make
// a label unreadable. Used by generate.mjs (writes themes.css) and the tests;
// nothing here runs in the browser.
import { mix, ensureContrast, toTriplet } from './color.js';

export const STEPS = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950];
export const HUES = ['red', 'orange', 'amber', 'yellow', 'green', 'emerald', 'teal', 'cyan', 'sky', 'blue', 'indigo', 'violet', 'purple', 'pink', 'rose'];

// Minimum contrast for the shades GHOST uses as text: light variants put
// 500+ text on white, dark variants put 300-400 text on 900 cards.
function neutralRamp(v) {
  const n = [...v.neutral];
  if (v.dark) {
    // Against the 800 shade (inputs, hovered rows), the lightest dark surface.
    const surface = n[8];
    n[5] = ensureContrast(n[5], surface, 4.5, v.white);  // 500: low-emphasis text, headings
    n[4] = ensureContrast(n[4], surface, 5.5, v.white);  // 400: secondary text
    n[3] = ensureContrast(n[3], surface, 7.5, v.white);  // 300
    n[1] = ensureContrast(n[1], surface, 11, v.white);   // 100: text
  } else {
    // Against the 100 shade (page, segmented controls), the darkest light surface.
    const surface = n[1];
    n[5] = ensureContrast(n[5], surface, 4.5, n[9]);  // 500: secondary text
    n[6] = ensureContrast(n[6], surface, 6.5, n[9]);  // 600
    n[7] = ensureContrast(n[7], surface, 9, n[10]);   // 700: text
  }
  return n;
}

function hueRamp(c, v, n) {
  if (!v.dark) {
    const w = v.white; const ink = n[9];
    return [
      mix(c, w, 0.10), mix(c, w, 0.18), mix(c, w, 0.32), mix(c, w, 0.5), mix(c, w, 0.75), c,
      ensureContrast(c, w, 4.5, ink),            // 600: buttons with white text, links
      ensureContrast(ensureContrast(mix(c, ink, 0.85), w, 6, ink), n[1], 4.5, ink),
      ensureContrast(mix(c, ink, 0.7), w, 8, ink), // 800: badge text on 100
      ensureContrast(mix(c, ink, 0.55), w, 10.5, ink),
      ensureContrast(mix(c, ink, 0.4), w, 13, ink),
    ];
  }
  const card = n[9]; const w = v.white;
  return [
    ensureContrast(mix(c, w, 0.4), card, 12, w),
    ensureContrast(mix(c, w, 0.55), card, 10, w),
    ensureContrast(mix(c, w, 0.7), card, 8.5, w),
    ensureContrast(mix(c, w, 0.85), card, 6.5, w),  // 300: text on dark
    ensureContrast(c, n[8], 4.5, w),                // 400: text and icons on dark
    ensureContrast(mix(c, card, 0.9), card, 3, w),
    ensureContrast(mix(c, card, 0.75), w, 4.5, card), // 600: buttons with light text
    ensureContrast(mix(c, card, 0.6), w, 4.5, card),
    mix(c, card, 0.38), mix(c, card, 0.26), mix(c, card, 0.16),
  ];
}

// The accent as a background behind light text, and as text on the page.
// The accent as a background behind light text, and as text on the page,
// including on its own 10% tint (the active menu item).
export function accentPair(color, v) {
  const n = v.neutral;
  if (!v.dark) {
    const bg = ensureContrast(color, v.white, 4.5, n[9]);
    const ink = ensureContrast(bg, mix(bg, n[1], 0.12), 4.5, n[10]);
    return { bg, hover: mix(bg, n[10], 0.85), ink };
  }
  const bg = ensureContrast(mix(color, n[9], 0.8), v.white, 4.5, n[9]);
  const ink = ensureContrast(color, mix(color, n[8], 0.12), 4.5, v.white);
  return { bg, hover: mix(bg, n[10], 0.85), ink };
}

// The relationship graph is always a dark canvas (ObsidianGraph.jsx reads
// these with its own colours as fallbacks). Light themes draw it in their
// darkest ink; nodes and edges use the bright 400 shades either way.
function graphVars(v, n, hues) {
  const bright = (h, i = 4) => hues[h][i];
  const canvas = n[10];
  return {
    '--graph-bg': canvas,
    '--graph-grid': v.dark ? n[7] : mix(n[10], n[8], 0.5),
    '--graph-text': v.dark ? n[1] : n[0],
    '--graph-ring': v.dark ? n[1] : n[0],
    '--graph-badge': bright('blue'),
    '--graph-node-default': bright('indigo'), '--graph-node-person': bright('blue'), '--graph-node-business': bright('green'),
    '--graph-node-wallet': bright('purple'), '--graph-node-selected': bright('amber'), '--graph-node-hover': bright('rose'),
    '--graph-node-text': v.dark ? n[1] : n[0],
    '--graph-edge-family': bright('emerald'), '--graph-edge-friend': bright('blue'), '--graph-edge-enemy': bright('red'),
    '--graph-edge-associate': v.dark ? n[4] : n[3], '--graph-edge-employer': bright('violet'), '--graph-edge-employee': bright('violet', 3),
    '--graph-edge-suspect': bright('red'), '--graph-edge-witness': bright('amber'), '--graph-edge-victim': bright('pink'),
    '--graph-edge-owner': bright('green'), '--graph-edge-owns-business': bright('green', 5), '--graph-edge-board-member': bright('purple', 5),
    '--graph-edge-transaction': bright('cyan'), '--graph-edge-other': v.dark ? n[5] : n[4],
    '--graph-cat-poi': bright('red'), '--graph-cat-client': bright('emerald'), '--graph-cat-witness': bright('amber'),
    '--graph-cat-victim': bright('pink'), '--graph-cat-suspect': bright('red', 5),
  };
}

export function variantVars(v) {
  const n = neutralRamp(v);
  const vars = {};
  STEPS.forEach((s, i) => { vars[`--color-slate-${s}`] = n[i]; });
  const hues = {};
  for (const h of HUES) {
    hues[h] = hueRamp(v.hues[h], v, n);
    STEPS.forEach((s, i) => { vars[`--color-${h}-${s}`] = hues[h][i]; });
  }
  vars['--color-white'] = v.white;
  vars['--color-black'] = n[10];
  const a = accentPair(v.accent, v);
  vars['--accent'] = toTriplet(a.bg);
  vars['--accent-hover'] = toTriplet(a.hover);
  vars['--accent-ink'] = toTriplet(a.ink);
  vars['--color-accent-secondary'] = hues.cyan[6];
  vars['--color-accent-tertiary'] = hues.violet[6];
  vars['--color-accent-success'] = hues.emerald[6];
  vars['--color-accent-warning'] = hues.amber[6];
  vars['--color-accent-danger'] = hues.red[6];
  vars['--default-ring-color'] = `color-mix(in oklab, ${a.ink} 50%, transparent)`;
  Object.assign(vars, graphVars(v, n, hues));
  // Scratchpad note backgrounds (dark mode only): a hint of the note colour.
  for (const h of ['amber', 'emerald', 'sky', 'violet', 'rose']) vars[`--color-note-${h}`] = mix(v.hues[h], n[9], v.dark ? 0.16 : 0.08);
  return vars;
}

const block = (selector, vars, extra = []) =>
  `${selector} {\n${[...Object.entries(vars).map(([k, val]) => `  ${k}: ${val};`), ...extra.map((e) => `  ${e}`)].join('\n')}\n}\n`;

// The whole themes.css. Selectors sit on <html>: data-theme picks the theme,
// the .dark class the variant, data-flavour a Catppuccin dark flavour.
export function themesCss(themes) {
  const out = ['/* GENERATED by src/themes/generate.mjs from themes.js — do not edit; run `npm run themes`. */\n'];
  // GHOST uses gray and slate alike; a theme has one neutral ramp.
  out.push(block(':root[data-theme]:not([data-theme="ghost"])', Object.fromEntries(STEPS.map((st) => [`--color-gray-${st}`, `var(--color-slate-${st})`]))));
  for (const th of themes) {
    if (!th.light && !th.dark) continue;
    const t = `:root[data-theme="${th.id}"]`;
    const font = th.font ? [`--font-sans: ${th.font};`] : [];
    if (th.light) out.push(block(`${t}:not(.dark)`, variantVars({ ...th.light, dark: false }), [...font, 'color-scheme: light;']));
    if (th.darkNames) {
      // The default flavour also applies when none is set.
      out.push(block(`${t}.dark`, variantVars(th.dark[th.defaultDark]), [...font, 'color-scheme: dark;']));
      for (const f of Object.keys(th.darkNames)) {
        if (f !== th.defaultDark) out.push(block(`${t}.dark[data-flavour="${f}"]`, variantVars(th.dark[f])));
      }
    } else if (th.dark) {
      const sel = th.darkOnly ? t : `${t}.dark`;
      out.push(block(sel, variantVars({ ...th.dark, dark: true }), [...font, 'color-scheme: dark;']));
    }
  }
  return out.join('\n');
}
