// One look for the controls around the graph: every control in the toolbar
// is 32 px tall, selects and inputs have the same outline, pressed buttons
// the same tint as the active menu item, and groups of controls are set
// apart by the same gap and divider.

const focus = 'focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-accent-primary/40';

export const ui = {
  // Square icon button.
  icon: `inline-flex items-center justify-center h-8 w-8 shrink-0 rounded-(--radius-control) text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700/70 hover:text-slate-900 dark:hover:text-slate-100 disabled:opacity-40 disabled:pointer-events-none transition-colors ${focus}`,
  // Icon and text.
  button: `inline-flex items-center gap-x-1.5 h-8 px-2.5 shrink-0 rounded-(--radius-control) text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700/70 hover:text-slate-900 dark:hover:text-slate-100 disabled:opacity-40 transition-colors ${focus}`,
  // Added to a button that's switched on.
  pressed: 'bg-accent-primary/10 text-accent-ink hover:bg-accent-primary/15 hover:text-accent-ink dark:bg-accent-primary/15 dark:hover:bg-accent-primary/20 dark:hover:text-accent-ink',
  select: 'h-8 w-auto ps-2.5 pe-2 text-sm rounded-(--radius-control) border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:border-slate-400 dark:hover:border-slate-500 focus:outline-hidden focus:border-accent-primary focus:ring-2 focus:ring-accent-primary/25 transition-colors',
  // A smaller select, for inside a row of chips.
  selectSmall: 'h-7 w-auto ps-2 pe-1.5 text-xs rounded-(--radius-control) border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 focus:outline-hidden focus:border-accent-primary focus:ring-2 focus:ring-accent-primary/25',
  input: 'h-8 px-2.5 text-sm rounded-(--radius-control) border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 hover:border-slate-400 dark:hover:border-slate-500 focus:outline-hidden focus:border-accent-primary focus:ring-2 focus:ring-accent-primary/25 transition-colors',
  divider: 'hidden sm:block h-5 w-px mx-1 bg-slate-200 dark:bg-slate-700 shrink-0',
  // Rows under the toolbar (switches, filters, the date bar, the trail).
  row: 'flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-2 border-b border-slate-200 dark:border-slate-700 shrink-0',
  rowLabel: 'text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 shrink-0',
  // On/off chip (entity types, link layers, filter values).
  chip: (on) => `inline-flex items-center gap-x-1.5 h-7 px-2.5 rounded-full border text-xs transition-colors ${focus} ${
    on
      ? 'border-accent-primary/50 bg-accent-primary/10 text-slate-800 dark:text-slate-100'
      : 'border-slate-300 dark:border-slate-600 text-slate-500 dark:text-slate-400 hover:border-slate-400 dark:hover:border-slate-500 hover:text-slate-700 dark:hover:text-slate-200'
  }`,
  label: 'block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1',
};
