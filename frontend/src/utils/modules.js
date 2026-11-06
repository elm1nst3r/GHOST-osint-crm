// The sidebar's groups, and which sections an admin can switch off
// (Settings → General → Modules; the list lives in backend/utils/modules.js).
// A switched-off module leaves the menu, its address goes to the dashboard,
// and its tabs and map layers are hidden. Its data and API stay.

// Mirrors SWITCHABLE_MODULES in backend/utils/modules.js.
export const SWITCHABLE_MODULES = [
  'transactions', 'assets', 'properties', 'crypto-wallets',
  'relationships', 'map', 'wireless',
  'tools', 'files',
];

// Sidebar groups, in order. `heading: null` items sit above the first heading.
export const NAV_GROUPS = [
  { heading: null, items: ['dashboard'] },
  { heading: 'investigation', items: ['cases', 'people', 'businesses'] },
  { heading: 'money', items: ['transactions', 'assets', 'properties', 'crypto-wallets'] },
  { heading: 'analysis', items: ['relationships', 'map', 'wireless'] },
  { heading: 'sources', items: ['tools', 'files'] },
];

export const isModuleOn = (disabled, id) => !SWITCHABLE_MODULES.includes(id) || !disabled.includes(id);

// The groups with switched-off items removed, and empty groups dropped.
export const visibleNavGroups = (disabled) => NAV_GROUPS
  .map((g) => ({ ...g, items: g.items.filter((id) => isModuleOn(disabled, id)) }))
  .filter((g) => g.items.length > 0);
