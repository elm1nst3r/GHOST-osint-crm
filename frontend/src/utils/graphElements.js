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
// `focusId`: the entity view's centre, which no filter removes. `keep`:
// more ids no filter removes (neighbours someone asked to see). `hidden`:
// ids hidden by hand, gone whatever else says (graph plan, phase 2).
export function filterGraph(graph, {
  types = DEFAULT_NODE_TYPES, filters = EMPTY_FILTERS, layers, solo = null,
  focusId = null, formatName = null, now = new Date(), keep = [], hidden = [],
} = {}) {
  const f = { ...EMPTY_FILTERS, ...filters };
  const search = f.searchTerm.trim().toLowerCase();
  const since = cutoff(f.dateRange, now);
  const kept = new Set([...keep, ...(focusId ? [focusId] : [])]);
  const gone = new Set(hidden);

  const passes = (n) => {
    if (gone.has(n.id) && n.id !== focusId) return false;
    if (kept.has(n.id)) return true;
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
    if (kept.has(n.id)) return true;
    if (n.type === 'identifier') return linked.has(n.id); // no holder left: nothing to show
    // Around one entity, something whose links are all switched off has
    // nothing to say about it.
    if (focusId || f.connectionTypes.length || !f.showIsolated) return linked.has(n.id);
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

// Two graphs as one (an expansion added to what was loaded); the first one's
// copy of a node or edge wins.
export function mergeGraphs(a, b) {
  if (!b || (!b.nodes.length && !b.edges.length)) return a;
  const nodeIds = new Set(a.nodes.map((n) => n.id));
  const edgeKey = (e) => e.relationship_id ? `r${e.relationship_id}` : `${e.source}|${e.target}|${e.type}`;
  const edgeKeys = new Set(a.edges.map(edgeKey));
  return {
    nodes: [...a.nodes, ...b.nodes.filter((n) => !nodeIds.has(n.id))],
    edges: [...a.edges, ...b.edges.filter((e) => !edgeKeys.has(edgeKey(e)))],
  };
}

// The node's links in a graph, for the inspector: [{ edge, other }].
export function linksOf(graph, nodeId) {
  const byId = new Map(graph.nodes.map((n) => [n.id, n]));
  return graph.edges
    .filter((e) => e.source === nodeId || e.target === nodeId)
    .map((e) => ({ edge: e, other: byId.get(e.source === nodeId ? e.target : e.source), outgoing: e.source === nodeId }))
    .filter((l) => l.other);
}

// Business-managed links (owner, employees, ownership) are edited in the
// business form; other relationship rows can be edited or deleted directly.
const BUSINESS_MANAGED = ['owner', 'owns_business', 'employee', 'board_member'];
export const edgeEditable = (e) =>
  e.kind === 'relationship' && Boolean(e.relationship_id) && !(e.source.startsWith('business:') && BUSINESS_MANAGED.includes(e.type));
// Which entity's form holds a link that isn't its own relationship row:
// a business's owner and staff, the business it's owned by, a property's
// owner. → node id, or null.
export function edgeManagedBy(e) {
  if (edgeEditable(e) || e.kind !== 'relationship') return null;
  if (e.type === 'owns_business' || e.type === 'owns_property') return e.target;
  if (e.source.startsWith('business:') && BUSINESS_MANAGED.includes(e.type)) return e.source;
  return null;
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
