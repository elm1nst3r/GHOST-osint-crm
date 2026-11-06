// The generated themes.css must match themes.js, and every theme must keep
// GHOST's text and button shades readable.
import { describe, expect, test } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { THEMES, themeVariant } from './themes';
import { themesCss, variantVars, STEPS, HUES } from './palette';
import { contrast } from './color';

const variants = THEMES.flatMap((th) => {
  const out = [];
  if (th.light) out.push([`${th.id} light`, { ...th.light, dark: false }]);
  if (th.darkNames) Object.keys(th.darkNames).forEach((f) => out.push([`${th.id} ${f}`, th.dark[f]]));
  else if (th.dark) out.push([`${th.id} dark`, { ...th.dark, dark: true }]);
  return out;
});
const tripletHex = (t) => `#${t.split(' ').map((n) => Number(n).toString(16).padStart(2, '0')).join('')}`;

describe('themes', () => {
  test('themes.css is up to date (run `npm run themes`)', () => {
    const file = fs.readFileSync(path.join(__dirname, 'themes.css'), 'utf8');
    expect(file).toBe(themesCss(THEMES));
  });

  test('every theme defines all colours GHOST uses', () => {
    for (const [, v] of variants) {
      expect(v.neutral).toHaveLength(11);
      for (const h of HUES) expect(v.hues[h], h).toMatch(/^#[0-9a-f]{6}$/i);
    }
  });

  test.each(variants)('%s: text and buttons are readable', (name, v) => {
    const vars = variantVars(v);
    const white = vars['--color-white'];
    const card = v.dark ? vars['--color-slate-900'] : white;
    // Body text and secondary text on cards.
    const text = v.dark ? vars['--color-slate-100'] : vars['--color-slate-700'];
    const secondary = v.dark ? vars['--color-slate-400'] : vars['--color-slate-500'];
    expect(contrast(text, card), 'text').toBeGreaterThanOrEqual(7);
    expect(contrast(secondary, card), 'secondary text').toBeGreaterThanOrEqual(4.5);
    for (const h of HUES) {
      // Buttons: light text on the 600 shade. Coloured text: 400 on dark, 600 on light.
      expect(contrast(white, vars[`--color-${h}-600`]), `${h}-600 button`).toBeGreaterThanOrEqual(4.5);
      const ink = v.dark ? vars[`--color-${h}-400`] : vars[`--color-${h}-700`];
      expect(contrast(ink, card), `${h} text`).toBeGreaterThanOrEqual(4.5);
      // Badges: dark text on a pale tint (light), light text on a deep tint (dark).
      if (!v.dark) expect(contrast(vars[`--color-${h}-800`], vars[`--color-${h}-100`]), `${h} badge`).toBeGreaterThanOrEqual(4.5);
    }
    expect(contrast(white, tripletHex(vars['--accent'])), 'accent button').toBeGreaterThanOrEqual(4.5);
    expect(contrast(tripletHex(vars['--accent-ink']), card), 'accent text').toBeGreaterThanOrEqual(4.5);
    expect(name).toBeTruthy();
  });

  test('variants: dark-only themes are always dark, Catppuccin flavours resolve', () => {
    const dracula = THEMES.find((t) => t.id === 'dracula');
    expect(themeVariant(dracula, false).dark).toBe(true);
    const ctp = THEMES.find((t) => t.id === 'catppuccin');
    expect(themeVariant(ctp, false).dark).toBe(false);
    expect(themeVariant(ctp, true, 'frappe').neutral[8]).toBe('#303446');
    expect(themeVariant(ctp, true, 'nope').neutral[8]).toBe('#1e1e2e');
    expect(themeVariant(THEMES[0], true)).toBeNull();
    expect(STEPS).toHaveLength(11);
  });
});
