// What the graph shows and how, remembered per user in this browser (the
// Relationships section). It starts with everything on; whatever someone
// switches off or filters stays that way next time. Case filters aren't
// kept: cases belong to one project.
import { NODE_TYPES, EMPTY_FILTERS } from './graphElements';
import { EDGE_LAYERS } from './edgeLayers';

export const MAX_TYPES = Object.fromEntries(NODE_TYPES.map((type) => [type, true]));
export const MAX_LAYERS = Object.fromEntries(EDGE_LAYERS.map((layer) => [layer, true]));

export const DEFAULT_PREFS = {
  types: MAX_TYPES,
  layers: MAX_LAYERS,
  solo: null,
  identifierMode: 'shared',
  layout: 'force',
  sizeBy: 'connections',
  groupBy: 'none',
  collapse: false,
  filters: EMPTY_FILTERS,
  showFilters: false,
};

const LAYOUTS = ['force', 'hierarchical', 'concentric', 'circle', 'grid'];
const SIZE_BY = ['uniform', 'connections', 'pagerank', 'betweenness'];
const GROUP_BY = ['none', 'case', 'component'];

const key = (userId) => `ghost-graph-view:${userId ?? 'anon'}`;
const pick = (value, allowed, fallback) => (allowed.includes(value) ? value : fallback);
// Only known switches, each a boolean; unknown or missing ones are on.
const switches = (stored, names) => Object.fromEntries(names.map((n) => [n, stored?.[n] !== false]));

// Whatever was stored, made safe: old or damaged values fall back to the defaults.
export function cleanPrefs(stored) {
  const p = stored && typeof stored === 'object' ? stored : {};
  const f = p.filters && typeof p.filters === 'object' ? p.filters : {};
  const list = (v) => (Array.isArray(v) ? v.filter((x) => typeof x === 'string') : []);
  return {
    types: switches(p.types, NODE_TYPES),
    layers: switches(p.layers, EDGE_LAYERS),
    solo: EDGE_LAYERS.includes(p.solo) ? p.solo : null,
    identifierMode: pick(p.identifierMode, ['shared', 'all'], 'shared'),
    layout: pick(p.layout, LAYOUTS, 'force'),
    sizeBy: pick(p.sizeBy, SIZE_BY, 'connections'),
    groupBy: pick(p.groupBy, GROUP_BY, 'none'),
    collapse: p.collapse === true,
    filters: {
      ...EMPTY_FILTERS,
      searchTerm: typeof f.searchTerm === 'string' ? f.searchTerm : '',
      categories: list(f.categories),
      statuses: list(f.statuses),
      connectionTypes: list(f.connectionTypes),
      minConnections: Number.isInteger(f.minConnections) && f.minConnections > 0 ? f.minConnections : 0,
      showIsolated: f.showIsolated !== false,
      dateRange: pick(f.dateRange, ['all', 'week', 'month', 'year'], 'all'),
    },
    showFilters: p.showFilters === true,
  };
}

export function readGraphPrefs(userId) {
  try {
    const raw = localStorage.getItem(key(userId));
    return raw ? cleanPrefs(JSON.parse(raw)) : DEFAULT_PREFS;
  } catch { return DEFAULT_PREFS; }
}

export function writeGraphPrefs(userId, prefs) {
  try {
    const { filters, ...rest } = prefs;
    localStorage.setItem(key(userId), JSON.stringify({ ...rest, filters: { ...filters, caseIds: [] } }));
  } catch { /* private mode, or storage full */ }
}
