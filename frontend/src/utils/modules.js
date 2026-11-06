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

// ── Collapsible groups ───────────────────────────────────────────────────────
// Which group headings are collapsed, per browser. A collapsed group still
// shows the section you are in, so the menu never hides where you are.
const COLLAPSED_KEY = 'ghost-nav-collapsed';
const HEADINGS = NAV_GROUPS.map((g) => g.heading).filter(Boolean);

export function readCollapsedGroups() {
  try {
    const v = JSON.parse(localStorage.getItem(COLLAPSED_KEY) || '[]');
    return Array.isArray(v) ? v.filter((h) => HEADINGS.includes(h)) : [];
  } catch { return []; }
}

export function writeCollapsedGroups(list) {
  try { localStorage.setItem(COLLAPSED_KEY, JSON.stringify(list)); } catch { /* private mode */ }
}

export const itemsShown = (items, collapsed, activeId) => (collapsed ? items.filter((id) => id === activeId) : items);
