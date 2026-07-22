// File: frontend/src/contexts/ThemeContext.js
// Appearance customization: theme mode (light/dark/system), accent color,
// density and surface style. Persisted to localStorage under one key and
// applied to <html> synchronously on first render so there is no flash.
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

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
  themeMode: 'light',   // 'light' | 'dark' | 'system'
  accent: 'blue',       // one of ACCENT_PRESETS ids
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

const applyToDocument = (settings) => {
  const root = document.documentElement;
  const preset = ACCENT_PRESETS.find((p) => p.id === settings.accent) || ACCENT_PRESETS[0];
  root.style.setProperty('--accent', preset.accent);
  root.style.setProperty('--accent-hover', preset.hover);
  root.setAttribute('data-density', settings.density);
  root.setAttribute('data-surface', settings.surface);
  root.classList.toggle('dark', resolveDark(settings.themeMode));
};

const ThemeContext = createContext(null);

export const ThemeProvider = ({ children }) => {
  const [settings, setSettings] = useState(() => {
    const initial = loadStored();
    // Apply synchronously during first render — before first paint
    applyToDocument(initial);
    return initial;
  });

  // Persist + apply on every change
  useEffect(() => {
    applyToDocument(settings);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    } catch (e) { /* storage unavailable — preferences just won't persist */ }
  }, [settings]);

  // Follow OS preference while in system mode
  useEffect(() => {
    if (settings.themeMode !== 'system' || !window.matchMedia) return undefined;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = (e) => document.documentElement.classList.toggle('dark', e.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [settings.themeMode]);

  const setThemeMode = useCallback((themeMode) => setSettings((s) => ({ ...s, themeMode })), []);
  const setAccent    = useCallback((accent)    => setSettings((s) => ({ ...s, accent })), []);
  const setDensity   = useCallback((density)   => setSettings((s) => ({ ...s, density })), []);
  const setSurface   = useCallback((surface)   => setSettings((s) => ({ ...s, surface })), []);

  // Compatibility API for the old boolean dark-mode toggle
  const darkMode = resolveDark(settings.themeMode);
  const setDarkMode = useCallback((value) => {
    setSettings((s) => ({ ...s, themeMode: value ? 'dark' : 'light' }));
  }, []);
  const toggleDarkMode = useCallback(() => {
    setSettings((s) => ({ ...s, themeMode: resolveDark(s.themeMode) ? 'light' : 'dark' }));
  }, []);

  return (
    <ThemeContext.Provider value={{
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
