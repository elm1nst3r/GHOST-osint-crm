// From GET /api/graph to what the graph draws (graph plan, phase 1): the
// filters, layers and entity-type switches applied, then Cytoscape elements.
// Pure, so it's unit-tested without a canvas.
import { isTypeVisible, layerForType } from './edgeLayers';

export const NODE_TYPES = ['person', 'business', 'crypto_wallet', 'asset', 'property', 'wireless_network', 'identifier'];

// What the project graph shows unless switched (the entity view shows all).
export const DEFAULT_NODE_TYPES = {
  person: true, business: true, crypto_wallet: true,
  asset: false, property: false, wireless_network: false, identifier: false,
};

// The `include` the API needs for a set of node-type switches (+ transaction
// edges when the financial layer is on).
export function includeFor(types, layers = {}, solo = null) {
  const include = [];
  if (types.asset) include.push('asset');
  if (types.property) include.push('property');
  if (types.wireless_network) include.push('wireless_network');
  if (types.identifier) include.push('identifiers');
  if (solo ? solo === 'financial' : layers.financial !== false) include.push('transactions');
  return include;
}

export const EMPTY_FILTERS = {
  searchTerm: '',
  caseIds: [],
  categories: [],
  statuses: [],
  connectionTypes: [],
  minConnections: 0,
  showIsolated: true,
  dateRange: 'all', // all | week | month | year
};

export const activeFilterCount = (f) =>
  (f.searchTerm ? 1 : 0) + f.caseIds.length + f.categories.length + f.statuses.length
  + f.connectionTypes.length + (f.minConnections > 0 ? 1 : 0) + (f.dateRange !== 'all' ? 1 : 0)
  + (f.showIsolated ? 0 : 1);

const cutoff = (range, now) => {
  const d = new Date(now);
  if (range === 'week') d.setDate(d.getDate() - 7);
  else if (range === 'month') d.setMonth(d.getMonth() - 1);
  else if (range === 'year') d.setFullYear(d.getFullYear() - 1);
  else return null;
  return d;
};

// The node's name as shown; people follow the UI language's name order.
export const nodeLabel = (node, formatName) =>
  (node.type === 'person' && formatName ? formatName(node) : node.label) || node.label || node.id;

// → { nodes, edges } still in API form, after every filter.
// `focusId`: the entity view's centre, which no filter removes.
export function filterGraph(graph, {
  types = DEFAULT_NODE_TYPES, filters = EMPTY_FILTERS, layers, solo = null,
  focusId = null, formatName = null, now = new Date(),
} = {}) {
  const f = { ...EMPTY_FILTERS, ...filters };
  const search = f.searchTerm.trim().toLowerCase();
  const since = cutoff(f.dateRange, now);

  const passes = (n) => {
    if (n.id === focusId) return true;
    if (types[n.type] === false) return false;
    if (n.type === 'identifier') return true; // judged by its holders below
    if (search) {
      const hay = [nodeLabel(n, formatName), n.label, ...(n.aliases || [])].join(' ').toLowerCase();
      if (!hay.includes(search)) return false;
    }
    if (f.caseIds.length && !f.caseIds.includes(n.case_id)) return false;
    if (f.categories.length && !f.categories.includes(n.category)) return false;
    if (f.statuses.length && !f.statuses.includes(n.status)) return false;
    if (f.minConnections > 0 && (n.degree || 0) < f.minConnections) return false;
    if (since && new Date(n.updated_at || n.created_at) < since) return false;
    return true;
  };

  let nodes = graph.nodes.filter(passes);
  let ids = new Set(nodes.map((n) => n.id));
  let edges = graph.edges.filter((e) => ids.has(e.source) && ids.has(e.target)
    && isTypeVisible(e.type, layers, solo)
    && (!f.connectionTypes.length || f.connectionTypes.includes(e.type)));

  const linked = new Set(edges.flatMap((e) => [e.source, e.target]));
  nodes = nodes.filter((n) => {
    if (n.id === focusId) return true;
    if (n.type === 'identifier') return linked.has(n.id); // no holder left: nothing to show
    if (f.connectionTypes.length || !f.showIsolated) return linked.has(n.id);
    return true;
  });
  ids = new Set(nodes.map((n) => n.id));
  edges = edges.filter((e) => ids.has(e.source) && ids.has(e.target));
  return { nodes, edges };
}

// API nodes/edges → Cytoscape element definitions.
export function toElements({ nodes, edges }, { formatName = null, focusId = null, edgeLabel = (type) => type } = {}) {
  const maxDegree = Math.max(1, ...nodes.map((n) => n.degree || 0));
  return [
    ...nodes.map((n) => ({
      group: 'nodes',
      data: {
        ...n,
        label: nodeLabel(n, formatName),
        // 0..1, for size and for which labels show first when zoomed out
        weight: Math.sqrt((n.degree || 0) / maxDegree),
      },
      classes: [
        `t-${n.type}`,
        n.type === 'identifier' ? `k-${n.kind}` : '',
        n.foreign ? 'foreign' : '',
        n.id === focusId ? 'focus' : '',
      ].filter(Boolean).join(' '),
    })),
    ...edges.map((e) => ({
      group: 'edges',
      data: { ...e, layer: layerForType(e.type), typeLabel: edgeLabel(e.type) },
      classes: [
        `l-${layerForType(e.type)}`,
        `k-${e.kind}`,
        e.matched_by_name ? 'by-name' : '',
      ].filter(Boolean).join(' '),
    })),
  ];
}

// The values the filter lists offer, from what's in the graph.
export function filterOptions(graph) {
  const entities = graph.nodes.filter((n) => n.type !== 'identifier');
  const uniq = (list) => [...new Set(list.filter((v) => v != null && v !== ''))].sort();
  return {
    categories: uniq(entities.map((n) => n.category)),
    statuses: uniq(entities.map((n) => n.status)),
    connectionTypes: uniq(graph.edges.map((e) => e.type)),
  };
}

// How many of each type are drawn, for the header.
export const countByType = (nodes) => nodes.reduce((acc, n) => ({ ...acc, [n.type]: (acc[n.type] || 0) + 1 }), {});
