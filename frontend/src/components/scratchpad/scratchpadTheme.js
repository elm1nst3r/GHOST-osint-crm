// File: frontend/src/components/scratchpad/scratchpadTheme.js
// Colour themes for the scratchpad panel. Class names are written out in
// full so Tailwind's scanner picks them up.

export const SCRATCHPAD_THEMES = {
  default: {
    panel: 'glass-card',
    header: 'bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700',
    icon: 'text-accent-ink',
    entry: 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700',
    swatch: 'bg-accent-primary',
  },
  amber: {
    panel: 'bg-amber-50 dark:bg-note-amber border border-amber-300 dark:border-amber-700/60',
    header: 'bg-amber-100 dark:bg-amber-900/40 border-amber-200 dark:border-amber-800/60',
    icon: 'text-amber-600 dark:text-amber-400',
    entry: 'bg-white/70 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800/50',
    swatch: 'bg-amber-400',
  },
  emerald: {
    panel: 'bg-emerald-50 dark:bg-note-emerald border border-emerald-300 dark:border-emerald-700/60',
    header: 'bg-emerald-100 dark:bg-emerald-900/40 border-emerald-200 dark:border-emerald-800/60',
    icon: 'text-emerald-600 dark:text-emerald-400',
    entry: 'bg-white/70 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800/50',
    swatch: 'bg-emerald-500',
  },
  sky: {
    panel: 'bg-sky-50 dark:bg-note-sky border border-sky-300 dark:border-sky-700/60',
    header: 'bg-sky-100 dark:bg-sky-900/40 border-sky-200 dark:border-sky-800/60',
    icon: 'text-sky-600 dark:text-sky-400',
    entry: 'bg-white/70 dark:bg-sky-950/40 border-sky-200 dark:border-sky-800/50',
    swatch: 'bg-sky-500',
  },
  violet: {
    panel: 'bg-violet-50 dark:bg-note-violet border border-violet-300 dark:border-violet-700/60',
    header: 'bg-violet-100 dark:bg-violet-900/40 border-violet-200 dark:border-violet-800/60',
    icon: 'text-violet-600 dark:text-violet-400',
    entry: 'bg-white/70 dark:bg-violet-950/40 border-violet-200 dark:border-violet-800/50',
    swatch: 'bg-violet-500',
  },
  rose: {
    panel: 'bg-rose-50 dark:bg-note-rose border border-rose-300 dark:border-rose-700/60',
    header: 'bg-rose-100 dark:bg-rose-900/40 border-rose-200 dark:border-rose-800/60',
    icon: 'text-rose-600 dark:text-rose-400',
    entry: 'bg-white/70 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800/50',
    swatch: 'bg-rose-500',
  },
  slate: {
    panel: 'bg-slate-800 dark:bg-slate-950 border border-slate-700 text-slate-100 dark',
    header: 'bg-slate-900 border-slate-700',
    icon: 'text-slate-300',
    entry: 'bg-slate-900/70 border-slate-700',
    swatch: 'bg-slate-700',
  },
};

export const themeFor = (color) => SCRATCHPAD_THEMES[color] || SCRATCHPAD_THEMES.default;

export const FONT_SIZE_CLASS = { sm: 'text-xs', md: 'text-sm', lg: 'text-base' };
