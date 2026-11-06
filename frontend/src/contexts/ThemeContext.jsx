// File: frontend/src/contexts/ThemeContext.jsx
// Appearance customization: colour theme, theme mode (light/dark/system),
// accent color, density and surface style. Persisted to localStorage under one
// key and applied to <html> synchronously on first render so there is no flash.
//
// A colour theme is pure CSS (src/themes/themes.css, generated): this only sets
// data-theme / data-flavour and the dark class on <html>. A hand-picked accent
// is the one thing set inline, since it can be combined with any theme.
import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { THEMES, themeById, themeVariant } from '../themes/themes';
import { accentPair } from '../themes/palette';
import { toTriplet } from '../themes/color';

const STORAGE_KEY = 'ghost-appearance';
const LEGACY_DARK_KEY = 'darkMode';

// Accent presets — RGB triplets so Tailwind's <alpha-value> keeps working.
export const ACCENT_PRESETS = [
  { id: 'blue',    label: 'Blue',    hex: '#2563eb', accent: '37 99 235',  hover: '29 78 216'  },
  { id: 'violet',  label: 'Violet',  hex: '#7c3aed', accent: '124 58 237', hover: '109 40 217' },
  { id: 'teal',    label: 'Teal',    hex: '#0d9488', accent: '13 148 136', hover: '15 118 110' },
  { id: 'emerald', label: 'Emerald', hex: '#059669', accent: '5 150 105',  hover: '4 120 87'   },
  { id: 'amber',   label: 'Amber',   hex: '#d97706', accent: '217 119 6',  hover: '180 83 9'   },
  { id: 'rose',    label: 'Rose',    hex: '#e11d48', accent: '225 29 72',  hover: '190 18 60'  },
];

const DEFAULTS = {
  theme: null,          // a THEMES id; null = the instance default (admin), else GHOST
  darkFlavour: null,    // Catppuccin's dark flavour (mocha | macchiato | frappe)
  themeMode: 'light',   // 'light' | 'dark' | 'system'
  accent: 'blue',       // one of ACCENT_PRESETS ids, or 'auto' = the theme's own
  density: 'comfortable', // 'comfortable' | 'compact'
  surface: 'solid',     // 'solid' | 'glass'
};

const prefersDark = () =>
  typeof window !== 'undefined' &&
  window.matchMedia &&
  window.matchMedia('(prefers-color-scheme: dark)').matches;

const resolveDark = (mode) => (mode === 'system' ? prefersDark() : mode === 'dark');

const loadStored = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return { ...DEFAULTS, ...parsed };
    }
    // Migrate the legacy boolean dark-mode key
    const legacy = localStorage.getItem(LEGACY_DARK_KEY);
    if (legacy !== null) {
      return { ...DEFAULTS, themeMode: JSON.parse(legacy) ? 'dark' : 'light' };
    }
  } catch (e) {
    // Corrupt storage — fall through to defaults
  }
  return { ...DEFAULTS };
};

// The instance default theme (Settings → General, admins), remembered so the
// sign-in screen already has it.
const DEFAULT_THEME_KEY = 'ghost-default-theme';
const readDefaultTheme = () => { try { return localStorage.getItem(DEFAULT_THEME_KEY); } catch { return null; } };

export const activeTheme = (settings, instanceDefault) => themeById(settings.theme || instanceDefault || 'ghost');
// A dark-only theme (Dracula, Matrix) is dark whatever the mode says.
const isDark = (settings, theme) => Boolean(theme.darkOnly) || resolveDark(settings.themeMode);

const applyToDocument = (settings, instanceDefault) => {
  const root = document.documentElement;
  const theme = activeTheme(settings, instanceDefault);
  const dark = isDark(settings, theme);
  root.dataset.theme = theme.id;
  if (theme.darkNames) root.dataset.flavour = settings.darkFlavour || theme.defaultDark;
  else delete root.dataset.flavour;

  // Accent: a theme brings its own ('auto'); a picked preset overrides it.
  const preset = ACCENT_PRESETS.find((p) => p.id === settings.accent);
  const useThemeAccent = theme.id !== 'ghost' && (settings.accent === 'auto' || !preset);
  if (useThemeAccent) {
    ['--accent', '--accent-hover', '--accent-ink'].forEach((v) => root.style.removeProperty(v));
  } else {
    const p = preset || ACCENT_PRESETS[0];
    const variant = themeVariant(theme, dark, settings.darkFlavour);
    root.style.setProperty('--accent', p.accent);
    root.style.setProperty('--accent-hover', p.hover);
    // On a themed dark background the preset needs a readable text shade.
    if (variant?.dark) root.style.setProperty('--accent-ink', toTriplet(accentPair(p.hex, variant).ink));
    else root.style.removeProperty('--accent-ink');
  }
  root.setAttribute('data-density', settings.density);
  root.setAttribute('data-surface', settings.surface);
  root.classList.toggle('dark', dark);
};

const ThemeContext = createContext(null);

export const ThemeProvider = ({ children }) => {
  const [instanceDefault, setInstanceDefaultState] = useState(readDefaultTheme);
  const [settings, setSettings] = useState(() => {
    const initial = loadStored();
    // Apply synchronously during first render — before first paint
    applyToDocument(initial, readDefaultTheme());
    return initial;
  });

  // Persist + apply on every change
  useEffect(() => {
    applyToDocument(settings, instanceDefault);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    } catch (e) { /* storage unavailable — preferences just won't persist */ }
  }, [settings, instanceDefault]);

  // Follow OS preference while in system mode
  useEffect(() => {
    if (settings.themeMode !== 'system' || !window.matchMedia) return undefined;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => applyToDocument(settings, instanceDefault);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [settings, instanceDefault]);

  // Picking a theme switches to its own accent; a preset can be picked after.
  const setTheme = useCallback((theme) => setSettings((s) => ({ ...s, theme, accent: 'auto' })), []);
  const setDarkFlavour = useCallback((darkFlavour) => setSettings((s) => ({ ...s, darkFlavour })), []);
  const setInstanceDefaultTheme = useCallback((id) => {
    try { if (id) localStorage.setItem(DEFAULT_THEME_KEY, id); else localStorage.removeItem(DEFAULT_THEME_KEY); } catch { /* ignore */ }
    setInstanceDefaultState(id || null);
  }, []);

  const setThemeMode = useCallback((themeMode) => setSettings((s) => ({ ...s, themeMode })), []);
  const setAccent    = useCallback((accent)    => setSettings((s) => ({ ...s, accent })), []);
  const setDensity   = useCallback((density)   => setSettings((s) => ({ ...s, density })), []);
  const setSurface   = useCallback((surface)   => setSettings((s) => ({ ...s, surface })), []);

  const theme = activeTheme(settings, instanceDefault);
  // Compatibility API for the old boolean dark-mode toggle
  const darkMode = isDark(settings, theme);
  const setDarkMode = useCallback((value) => {
    setSettings((s) => ({ ...s, themeMode: value ? 'dark' : 'light' }));
  }, []);
  const toggleDarkMode = useCallback(() => {
    setSettings((s) => ({ ...s, themeMode: resolveDark(s.themeMode) ? 'light' : 'dark' }));
  }, []);

  return (
    <ThemeContext.Provider value={{
      theme, themeChoice: settings.theme, setTheme, themes: THEMES,
      darkFlavour: settings.darkFlavour || theme.defaultDark || null, setDarkFlavour,
      instanceDefaultTheme: instanceDefault, setInstanceDefaultTheme,
      themeMode: settings.themeMode, setThemeMode,
      accent: settings.accent, setAccent,
      density: settings.density, setDensity,
      surface: settings.surface, setSurface,
      darkMode, setDarkMode, toggleDarkMode,
      accentPresets: ACCENT_PRESETS,
    }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
};
