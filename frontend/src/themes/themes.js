// The colour themes in Settings → Appearance. Each theme gives, per light and
// dark variant, a neutral ramp (backgrounds, borders, text) and its colours;
// palette.js turns that into GHOST's CSS colour variables and makes sure the
// shades GHOST uses for text and buttons stay readable.
//
// Palettes are the themes' own published colours (all MIT licensed):
// Catppuccin, Nord, Dracula, Gruvbox, Solarized, Tokyo Night, Rosé Pine.
// Matrix is GHOST's own.

// Neutral ramps run 50 (lightest) → 950 (darkest), the order GHOST's
// slate/gray classes use. For dark variants the dark end is the background.
const ramp = (...hex) => hex;

// Catppuccin-style named stops → ramp.
const darkRamp = (p) => ramp(p.bright, p.text, p.subtext1, p.subtext0, p.overlay1, p.overlay0, p.surface1, p.surface0, p.base, p.mantle, p.crust);
const lightRamp = (p) => ramp(p.mantle, p.crust, p.surface0, p.surface1, p.overlay0, p.subtext0, p.subtext1, p.text, p.deep, p.deeper, p.deepest);

// ── Catppuccin ──────────────────────────────────────────────────────────────
const latte = {
  rosewater: '#dc8a78', flamingo: '#dd7878', pink: '#ea76cb', mauve: '#8839ef', red: '#d20f39', maroon: '#e64553',
  peach: '#fe640b', yellow: '#df8e1d', green: '#40a02b', teal: '#179299', sky: '#04a5e5', sapphire: '#209fb5',
  blue: '#1e66f5', lavender: '#7287fd', text: '#4c4f69', subtext1: '#5c5f77', subtext0: '#6c6f85', overlay2: '#7c7f93',
  overlay1: '#8c8fa1', overlay0: '#9ca0b0', surface2: '#acb0be', surface1: '#bcc0cc', surface0: '#ccd0da',
  base: '#eff1f5', mantle: '#e6e9ef', crust: '#dce0e8', deep: '#3c3f55', deeper: '#2c2e40', deepest: '#1e1f2c',
};
const frappe = {
  rosewater: '#f2d5cf', flamingo: '#eebebe', pink: '#f4b8e4', mauve: '#ca9ee6', red: '#e78284', maroon: '#ea999c',
  peach: '#ef9f76', yellow: '#e5c890', green: '#a6d189', teal: '#81c8be', sky: '#99d1db', sapphire: '#85c1dc',
  blue: '#8caaee', lavender: '#babbf1', text: '#c6d0f5', subtext1: '#b5bfe2', subtext0: '#a5adce', overlay2: '#949cbb',
  overlay1: '#838ba7', overlay0: '#737994', surface2: '#626880', surface1: '#51576d', surface0: '#414559',
  base: '#303446', mantle: '#292c3c', crust: '#232634', bright: '#e1e7fb',
};
const macchiato = {
  rosewater: '#f4dbd6', flamingo: '#f0c6c6', pink: '#f5bde6', mauve: '#c6a0f6', red: '#ed8796', maroon: '#ee99a0',
  peach: '#f5a97f', yellow: '#eed49f', green: '#a6da95', teal: '#8bd5ca', sky: '#91d7e3', sapphire: '#7dc4e4',
  blue: '#8aadf4', lavender: '#b7bdf8', text: '#cad3f5', subtext1: '#b8c0e0', subtext0: '#a5adcb', overlay2: '#939ab7',
  overlay1: '#8087a2', overlay0: '#6e738d', surface2: '#5b6078', surface1: '#494d64', surface0: '#363a4f',
  base: '#24273a', mantle: '#1e2030', crust: '#181926', bright: '#e3e8fa',
};
const mocha = {
  rosewater: '#f5e0dc', flamingo: '#f2cdcd', pink: '#f5c2e7', mauve: '#cba6f7', red: '#f38ba8', maroon: '#eba0ac',
  peach: '#fab387', yellow: '#f9e2af', green: '#a6e3a1', teal: '#94e2d5', sky: '#89dceb', sapphire: '#74c7ec',
  blue: '#89b4fa', lavender: '#b4befe', text: '#cdd6f4', subtext1: '#bac2de', subtext0: '#a6adc8', overlay2: '#9399b2',
  overlay1: '#7f849c', overlay0: '#6c7086', surface2: '#585b70', surface1: '#45475a', surface0: '#313244',
  base: '#1e1e2e', mantle: '#181825', crust: '#11111b', bright: '#e6ebfa',
};
const ctpHues = (p) => ({
  red: p.red, orange: p.peach, amber: p.yellow, yellow: p.yellow, green: p.green, emerald: p.green, teal: p.teal,
  cyan: p.sky, sky: p.sapphire, blue: p.blue, indigo: p.lavender, violet: p.mauve, purple: p.mauve, pink: p.pink, rose: p.maroon,
});
const ctpDark = (p) => ({ dark: true, neutral: darkRamp(p), white: p.bright, hues: ctpHues(p), accent: p.mauve });

// ── Nord ────────────────────────────────────────────────────────────────────
const nord = {
  n0: '#2e3440', n1: '#3b4252', n2: '#434c5e', n3: '#4c566a', n4: '#d8dee9', n5: '#e5e9f0', n6: '#eceff4',
  n7: '#8fbcbb', n8: '#88c0d0', n9: '#81a1c1', n10: '#5e81ac', red: '#bf616a', orange: '#d08770', yellow: '#ebcb8b', green: '#a3be8c', purple: '#b48ead',
};
const nordHues = {
  red: nord.red, orange: nord.orange, amber: nord.yellow, yellow: nord.yellow, green: nord.green, emerald: nord.green, teal: nord.n7,
  cyan: nord.n8, sky: nord.n8, blue: nord.n10, indigo: nord.n9, violet: nord.purple, purple: nord.purple, pink: nord.purple, rose: nord.red,
};

// ── Gruvbox ─────────────────────────────────────────────────────────────────
const gruvDark = { bg0h: '#1d2021', bg0: '#282828', bg1: '#3c3836', bg2: '#504945', bg3: '#665c54', bg4: '#7c6f64', gray: '#928374', fg4: '#a89984', fg3: '#bdae93', fg2: '#d5c4a1', fg1: '#ebdbb2', fg0: '#fbf1c7' };
const gruvBright = { red: '#fb4934', green: '#b8bb26', yellow: '#fabd2f', blue: '#83a598', purple: '#d3869b', aqua: '#8ec07c', orange: '#fe8019' };
const gruvFaded = { red: '#9d0006', green: '#79740e', yellow: '#b57614', blue: '#076678', purple: '#8f3f71', aqua: '#427b58', orange: '#af3a03' };
const gruvHues = (c) => ({
  red: c.red, orange: c.orange, amber: c.yellow, yellow: c.yellow, green: c.green, emerald: c.aqua, teal: c.aqua,
  cyan: c.aqua, sky: c.blue, blue: c.blue, indigo: c.blue, violet: c.purple, purple: c.purple, pink: c.purple, rose: c.red,
});

// ── Solarized ───────────────────────────────────────────────────────────────
const sol = {
  base03: '#002b36', base02: '#073642', base01: '#586e75', base00: '#657b83', base0: '#839496', base1: '#93a1a1', base2: '#eee8d5', base3: '#fdf6e3',
  yellow: '#b58900', orange: '#cb4b16', red: '#dc322f', magenta: '#d33682', violet: '#6c71c4', blue: '#268bd2', cyan: '#2aa198', green: '#859900',
};
const solHues = {
  red: sol.red, orange: sol.orange, amber: sol.yellow, yellow: sol.yellow, green: sol.green, emerald: sol.green, teal: sol.cyan,
  cyan: sol.cyan, sky: sol.blue, blue: sol.blue, indigo: sol.violet, violet: sol.violet, purple: sol.violet, pink: sol.magenta, rose: sol.magenta,
};

// ── Tokyo Night ─────────────────────────────────────────────────────────────
const tnNight = {
  bg: '#1a1b26', bgDark: '#16161e', bgHi: '#292e42', black: '#414868', fg: '#c0caf5', fgDark: '#a9b1d6', comment: '#565f89', dark5: '#737aa2',
  blue: '#7aa2f7', cyan: '#7dcfff', blue1: '#2ac3de', magenta: '#bb9af7', purple: '#9d7cd8', orange: '#ff9e64', yellow: '#e0af68', green: '#9ece6a', teal: '#1abc9c', red: '#f7768e',
};
const tnDay = {
  bg: '#e1e2e7', bgDark: '#d0d5e3', bgHi: '#c4c8da', fg: '#3760bf', fgDark: '#6172b0', comment: '#848cb5',
  blue: '#2e7de9', cyan: '#007197', blue1: '#188092', magenta: '#9854f1', purple: '#7847bd', orange: '#b15c00', yellow: '#8c6c3e', green: '#587539', teal: '#118c74', red: '#f52a65',
};
const tnHues = (c) => ({
  red: c.red, orange: c.orange, amber: c.yellow, yellow: c.yellow, green: c.green, emerald: c.teal, teal: c.teal,
  cyan: c.cyan, sky: c.blue1, blue: c.blue, indigo: c.purple, violet: c.magenta, purple: c.purple, pink: c.magenta, rose: c.red,
});

// ── Rosé Pine ───────────────────────────────────────────────────────────────
const rpMain = { base: '#191724', surface: '#1f1d2e', overlay: '#26233a', muted: '#6e6a86', subtle: '#908caa', text: '#e0def4', love: '#eb6f92', gold: '#f6c177', rose: '#ebbcba', pine: '#31748f', foam: '#9ccfd8', iris: '#c4a7e7', hlLow: '#21202e', hlMed: '#403d52', hlHigh: '#524f67' };
const rpDawn = { base: '#faf4ed', surface: '#fffaf3', overlay: '#f2e9e1', muted: '#9893a5', subtle: '#797593', text: '#575279', love: '#b4637a', gold: '#ea9d34', rose: '#d7827e', pine: '#286983', foam: '#56949f', iris: '#907aa9', hlLow: '#f4ede8', hlMed: '#dfdad9', hlHigh: '#cecacd' };
const rpHues = (c) => ({
  red: c.love, orange: c.rose, amber: c.gold, yellow: c.gold, green: c.pine, emerald: c.foam, teal: c.foam,
  cyan: c.foam, sky: c.foam, blue: c.pine, indigo: c.iris, violet: c.iris, purple: c.iris, pink: c.rose, rose: c.love,
});

// ── Dracula ─────────────────────────────────────────────────────────────────
const drac = { bg: '#282a36', bgDark: '#21222c', bgDarker: '#191a21', line: '#44475a', fg: '#f8f8f2', comment: '#6272a4', cyan: '#8be9fd', green: '#50fa7b', orange: '#ffb86c', pink: '#ff79c6', purple: '#bd93f9', red: '#ff5555', yellow: '#f1fa8c' };

// ── Matrix (GHOST's own) ────────────────────────────────────────────────────
const MONO = '"JetBrains Mono", "Fira Code", ui-monospace, SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace';

export const THEMES = [
  {
    id: 'ghost', name: 'GHOST', description: 'The standard look.',
    // No palette: GHOST's own colours (index.css) and the accent picker.
    light: null, dark: null,
    swatch: ['#f1f5f9', '#ffffff', '#2563eb', '#0f172a'],
  },
  {
    id: 'catppuccin', name: 'Catppuccin', credit: 'catppuccin.com', url: 'https://catppuccin.com',
    light: { neutral: lightRamp(latte), white: latte.base, hues: ctpHues(latte), accent: latte.mauve },
    dark: { mocha: ctpDark(mocha), macchiato: ctpDark(macchiato), frappe: ctpDark(frappe) },
    darkNames: { mocha: 'Mocha', macchiato: 'Macchiato', frappe: 'Frappé' }, defaultDark: 'mocha', lightName: 'Latte',
    swatch: ['#1e1e2e', '#313244', '#cba6f7', '#89b4fa'],
  },
  {
    id: 'nord', name: 'Nord', credit: 'nordtheme.com', url: 'https://www.nordtheme.com',
    light: { neutral: ramp(nord.n5, nord.n4, '#cfd6e2', '#bcc5d4', '#8f9bb0', '#5a6478', nord.n3, nord.n2, nord.n1, nord.n0, '#242933'), white: nord.n6, hues: nordHues, accent: nord.n10 },
    dark: { neutral: ramp(nord.n6, nord.n5, nord.n4, '#c0c8d6', '#9aa4b6', '#6f7a8f', nord.n3, nord.n2, nord.n1, nord.n0, '#242933'), white: nord.n6, hues: { ...nordHues, blue: nord.n9 }, accent: nord.n8, dark: true },
    swatch: ['#2e3440', '#3b4252', '#88c0d0', '#a3be8c'],
  },
  {
    id: 'dracula', name: 'Dracula', credit: 'draculatheme.com', url: 'https://draculatheme.com', darkOnly: true,
    dark: {
      dark: true, white: drac.fg, accent: drac.purple,
      neutral: ramp('#ffffff', drac.fg, '#d6d8e4', '#b6bad0', '#8d97c2', drac.comment, '#525670', drac.line, drac.bg, drac.bgDark, drac.bgDarker),
      hues: { red: drac.red, orange: drac.orange, amber: drac.orange, yellow: drac.yellow, green: drac.green, emerald: drac.green, teal: drac.cyan, cyan: drac.cyan, sky: drac.cyan, blue: drac.purple, indigo: drac.purple, violet: drac.purple, purple: drac.purple, pink: drac.pink, rose: drac.pink },
    },
    swatch: ['#282a36', '#44475a', '#bd93f9', '#ff79c6'],
  },
  {
    id: 'gruvbox', name: 'Gruvbox', credit: 'github.com/morhetz/gruvbox', url: 'https://github.com/morhetz/gruvbox',
    light: { neutral: ramp('#f2e5bc', gruvDark.fg1, gruvDark.fg2, gruvDark.fg3, gruvDark.gray, '#6b5f52', gruvDark.bg2, gruvDark.bg1, gruvDark.bg0, gruvDark.bg0h, '#141617'), white: gruvDark.fg0, hues: gruvHues(gruvFaded), accent: gruvFaded.orange },
    dark: { dark: true, neutral: ramp(gruvDark.fg0, gruvDark.fg1, gruvDark.fg2, gruvDark.fg3, gruvDark.fg4, gruvDark.gray, gruvDark.bg3, gruvDark.bg2, gruvDark.bg1, gruvDark.bg0, gruvDark.bg0h), white: gruvDark.fg1, hues: gruvHues(gruvBright), accent: gruvBright.orange },
    swatch: ['#282828', '#3c3836', '#fe8019', '#b8bb26'],
  },
  {
    id: 'solarized', name: 'Solarized', credit: 'ethanschoonover.com/solarized', url: 'https://ethanschoonover.com/solarized/',
    light: { neutral: ramp(sol.base2, '#e6dfc8', '#d9d2bb', '#c8c1aa', sol.base1, sol.base00, sol.base01, sol.base02, sol.base03, '#00212b', '#00171e'), white: sol.base3, hues: solHues, accent: sol.blue },
    dark: { dark: true, neutral: ramp(sol.base3, sol.base2, '#c9c6b4', sol.base1, sol.base0, sol.base00, sol.base01, '#0d4553', sol.base02, sol.base03, '#00212b'), white: sol.base2, hues: solHues, accent: sol.blue },
    swatch: ['#002b36', '#073642', '#268bd2', '#b58900'],
  },
  {
    id: 'tokyo-night', name: 'Tokyo Night', credit: 'github.com/folke/tokyonight.nvim', url: 'https://github.com/folke/tokyonight.nvim',
    light: { neutral: ramp(tnDay.bgDark, tnDay.bgHi, '#b7bccf', '#a8aecb', tnDay.comment, tnDay.fgDark, '#4b5a9a', tnDay.fg, '#2e4a94', '#243a75', '#1a2b57'), white: tnDay.bg, hues: tnHues(tnDay), accent: tnDay.blue },
    dark: { dark: true, neutral: ramp('#e0e6ff', tnNight.fg, tnNight.fgDark, '#9aa5ce', tnNight.dark5, tnNight.comment, tnNight.black, tnNight.bgHi, '#1f2335', tnNight.bg, tnNight.bgDark), white: tnNight.fg, hues: tnHues(tnNight), accent: tnNight.blue },
    swatch: ['#1a1b26', '#292e42', '#7aa2f7', '#bb9af7'],
  },
  {
    id: 'rose-pine', name: 'Rosé Pine', credit: 'rosepinetheme.com', url: 'https://rosepinetheme.com',
    light: { neutral: ramp(rpDawn.overlay, rpDawn.hlLow, rpDawn.hlMed, rpDawn.hlHigh, rpDawn.muted, rpDawn.subtle, '#66628a', rpDawn.text, '#46426a', '#36335a', '#26234a'), white: rpDawn.surface, hues: rpHues(rpDawn), accent: rpDawn.iris },
    dark: { dark: true, neutral: ramp('#f2f0fa', rpMain.text, '#c9c6e0', rpMain.subtle, '#7f7b98', rpMain.muted, rpMain.hlHigh, rpMain.hlMed, rpMain.overlay, rpMain.surface, rpMain.base), white: rpMain.text, hues: rpHues(rpMain), accent: rpMain.iris },
    swatch: ['#191724', '#26233a', '#c4a7e7', '#ebbcba'],
  },
  {
    id: 'matrix', name: 'Matrix', description: 'Wake up, investigator. Phosphor green, monospace, scanlines.', darkOnly: true, font: MONO, effect: 'matrix',
    dark: {
      dark: true, white: '#9dffb5', accent: '#00ff41',
      neutral: ramp('#c8ffd5', '#7dffa0', '#4dff7c', '#22d955', '#1aa843', '#14803a', '#0f4f24', '#0a3418', '#06200f', '#020d06', '#000000'),
      hues: {
        red: '#ff4d6a', orange: '#ffb000', amber: '#ffb000', yellow: '#d4ff3c', green: '#00ff41', emerald: '#00e676', teal: '#00ffa3',
        cyan: '#3dffd8', sky: '#00ff7f', blue: '#00ff41', indigo: '#58ff8f', violet: '#7dffb0', purple: '#a6ff6e', pink: '#c6ff4d', rose: '#ff4d6a',
      },
    },
    swatch: ['#000000', '#06200f', '#00ff41', '#9dffb5'],
  },
];

export const themeById = (id) => THEMES.find((th) => th.id === id) || THEMES[0];

// The variant to use: a light/dark pair follows the mode; a dark-only theme
// is always dark. Catppuccin offers several dark flavours.
export function themeVariant(theme, wantDark, darkFlavour) {
  if (!theme.light && !theme.dark) return null;
  const dark = theme.darkOnly || wantDark || !theme.light;
  if (!dark) return { ...theme.light, dark: false };
  if (theme.darkNames) return theme.dark[darkFlavour] || theme.dark[theme.defaultDark];
  return { ...theme.dark, dark: true };
}
