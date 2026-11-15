// Analysis on the graph as drawn (graph plan, phase 3): find, shortest path,
// focus, size by PageRank or betweenness, folding leaves, connected groups,
// the graph as of a date, statistics, and GraphML / JSON export. Pure: works
// on { nodes, edges } in API form (see graphElements.js), so it's unit-tested
// without a canvas. Links count in both directions throughout.
import { nodeLabel } from './graphElements';

// id → [{ other, edge }], edges whose ends are both in the graph, edge order.
function adjacency(graph) {
  const ids = new Set(graph.nodes.map((n) => n.id));
  const adj = new Map(graph.nodes.map((n) => [n.id, []]));
  for (const e of graph.edges) {
    if (!ids.has(e.source) || !ids.has(e.target) || e.source === e.target) continue;
    adj.get(e.source).push({ other: e.target, edge: e });
    adj.get(e.target).push({ other: e.source, edge: e });
  }
  return adj;
}

// ── Find ──

// Ids of the nodes whose shown name, stored name, aliases, address or
// identifier value contain the text, in graph order.
export function findMatches(nodes, term, formatName = null) {
  const q = String(term || '').trim().toLowerCase();
  if (!q) return [];
  return nodes.filter((n) => [nodeLabel(n, formatName), n.label, n.address, ...(n.aliases || [])]
    .filter(Boolean).join(' ').toLowerCase().includes(q)).map((n) => n.id);
}

// ── Shortest path ──

// The same algorithm as backend utils/graph.js shortestPath (keep them the
// same): breadth-first, neighbours in edge order. → { nodes, edges } (ids,
// in order) or null.
export function shortestPath(graph, from, to) {
  const adj = adjacency(graph);
  if (!adj.has(from) || !adj.has(to)) return null;
  if (from === to) return { nodes: [from], edges: [] };
  const prev = new Map([[from, null]]);
  let frontier = [from];
  while (frontier.length && !prev.has(to)) {
    const next = [];
    for (const id of frontier) {
      for (const { other, edge } of adj.get(id)) {
        if (prev.has(other)) continue;
        prev.set(other, { from: id, edge });
        next.push(other);
      }
    }
    frontier = next;
  }
  if (!prev.has(to)) return null;
  const nodes = [to];
  const edges = [];
  for (let at = to; prev.get(at); at = prev.get(at).from) {
    edges.unshift(prev.get(at).edge.id);
    nodes.unshift(prev.get(at).from);
  }
  return { nodes, edges };
}

// ── Focus ──

// Everything within `hops` links of a node. An identifier reached passes
// through to everyone else who has it (as on the server), so "who shares
// this phone" needs no extra hop.
export function neighbourhoodOf(graph, id, hops = 1) {
  const adj = adjacency(graph);
  if (!adj.has(id)) return graph;
  const types = new Map(graph.nodes.map((n) => [n.id, n.type]));
  const keep = new Set([id]);
  let frontier = [id];
  for (let d = 0; d < hops && frontier.length; d += 1) {
    const next = [];
    for (const at of frontier) {
      for (const { other } of adj.get(at)) {
        if (keep.has(other)) continue;
        keep.add(other);
        next.push(other);
        if (types.get(other) === 'identifier') adj.get(other).forEach((h) => keep.add(h.other));
      }
    }
    frontier = next;
  }
  return {
    nodes: graph.nodes.filter((n) => keep.has(n.id)),
    edges: graph.edges.filter((e) => keep.has(e.source) && keep.has(e.target)),
  };
}

// ── Centrality ──

// Links per node in this graph.
export function degrees(graph) {
  const adj = adjacency(graph);
  return new Map([...adj].map(([id, list]) => [id, list.length]));
}

// PageRank over links taken both ways. → Map id → score (sums to 1).
export function pageRank(graph, { damping = 0.85, iterations = 60, tolerance = 1e-8 } = {}) {
  const adj = adjacency(graph);
  const ids = [...adj.keys()];
  const n = ids.length;
  if (!n) return new Map();
  let rank = new Map(ids.map((id) => [id, 1 / n]));
  for (let i = 0; i < iterations; i += 1) {
    // Nodes without links hand their share to everyone.
    let dangling = 0;
    for (const id of ids) if (!adj.get(id).length) dangling += rank.get(id);
    const next = new Map(ids.map((id) => [id, (1 - damping) / n + (damping * dangling) / n]));
    for (const id of ids) {
      const out = adj.get(id);
      if (!out.length) continue;
      const share = (damping * rank.get(id)) / out.length;
      for (const { other } of out) next.set(other, next.get(other) + share);
    }
    let diff = 0;
    for (const id of ids) diff += Math.abs(next.get(id) - rank.get(id));
    rank = next;
    if (diff < tolerance) break;
  }
  return rank;
}

// Betweenness (Brandes): how often a node sits on the shortest paths between
// others, i.e. who connects groups. Normalised to 0..1. Above `sampleAbove`
// nodes, paths from an evenly spread sample of sources (approximate, and
// says so). Integer indexes and typed arrays: 5,000 entities in a fraction
// of a second.
export function betweenness(graph, { sampleAbove = 1500, samples = 400 } = {}) {
  const ids = graph.nodes.map((n) => n.id);
  const n = ids.length;
  const scores = new Map(ids.map((id) => [id, 0]));
  if (n < 3) return { scores, approximate: false };
  // Adjacency as offsets into one array (both directions).
  const index = new Map(ids.map((id, i) => [id, i]));
  const degree = new Int32Array(n);
  const pairs = [];
  for (const e of graph.edges) {
    const a = index.get(e.source); const b = index.get(e.target);
    if (a === undefined || b === undefined || a === b) continue;
    pairs.push(a, b);
    degree[a] += 1; degree[b] += 1;
  }
  const start = new Int32Array(n + 1);
  for (let i = 0; i < n; i += 1) start[i + 1] = start[i] + degree[i];
  const fill = start.slice(0, n);
  const adj = new Int32Array(start[n]);
  for (let k = 0; k < pairs.length; k += 2) {
    adj[fill[pairs[k]]++] = pairs[k + 1];
    adj[fill[pairs[k + 1]]++] = pairs[k];
  }

  const approximate = n > sampleAbove;
  const sources = approximate
    ? Array.from({ length: samples }, (_, i) => Math.floor((i * n) / samples))
    : Array.from({ length: n }, (_, i) => i);
  const total = new Float64Array(n);
  const sigma = new Float64Array(n);
  const delta = new Float64Array(n);
  const dist = new Int32Array(n);
  const order = new Int32Array(n);
  for (const s of sources) {
    dist.fill(-1); sigma.fill(0); delta.fill(0);
    dist[s] = 0; sigma[s] = 1;
    let head = 0; let tail = 0;
    order[tail++] = s;
    while (head < tail) {
      const v = order[head++];
      for (let k = start[v]; k < start[v + 1]; k += 1) {
        const w = adj[k];
        if (dist[w] < 0) { dist[w] = dist[v] + 1; order[tail++] = w; }
        if (dist[w] === dist[v] + 1) sigma[w] += sigma[v];
      }
    }
    // Back from the farthest: predecessors are the neighbours one step closer.
    for (let i = tail - 1; i > 0; i -= 1) {
      const w = order[i];
      for (let k = start[w]; k < start[w + 1]; k += 1) {
        const v = adj[k];
        if (dist[v] === dist[w] - 1) delta[v] += (sigma[v] / sigma[w]) * (1 + delta[w]);
      }
      total[w] += delta[w];
    }
  }
  // Undirected: every pair was counted from both ends; sampling scales up.
  const scale = (approximate ? n / sources.length : 1) / 2;
  const max = ((n - 1) * (n - 2)) / 2;
  ids.forEach((id, i) => scores.set(id, (total[i] * scale) / max));
  return { scores, approximate };
}

// Node size, 0..1, by: uniform | connections | pagerank | betweenness.
// Connections uses the entity's links in the whole project (both directions),
// the rest are computed over what's drawn.
export function sizeWeights(graph, sizeBy, { pagerank = null, between = null } = {}) {
  const norm = (map) => {
    const max = Math.max(0, ...map.values());
    return new Map([...map].map(([id, v]) => [id, max > 0 ? Math.sqrt(v / max) : 0]));
  };
  if (sizeBy === 'uniform') return new Map(graph.nodes.map((n) => [n.id, 0]));
  if (sizeBy === 'pagerank') return norm(pagerank || pageRank(graph));
  if (sizeBy === 'betweenness') return norm(between || betweenness(graph).scores);
  return norm(new Map(graph.nodes.map((n) => [n.id, n.degree || 0])));
}

// ── Groups ──

// Connected groups, largest first. → [[ids]]
export function components(graph) {
  const adj = adjacency(graph);
  const seen = new Set();
  const groups = [];
  for (const id of adj.keys()) {
    if (seen.has(id)) continue;
    const group = [];
    const stack = [id];
    seen.add(id);
    while (stack.length) {
      const at = stack.pop();
      group.push(at);
      for (const { other } of adj.get(at)) if (!seen.has(other)) { seen.add(other); stack.push(other); }
    }
    groups.push(group);
  }
  return groups.sort((a, b) => b.length - a.length);
}

// Readable on the dark and the light graph backgrounds.
export const GROUP_COLORS = ['#f59e0b', '#10b981', '#3b82f6', '#ef4444', '#a855f7', '#14b8a6', '#ec4899', '#84cc16', '#6366f1', '#f97316'];

// id → colour per connected group of two or more; lone entities get none.
export function groupColors(graph) {
  const colors = new Map();
  components(graph).filter((g) => g.length > 1)
    .forEach((group, i) => group.forEach((id) => colors.set(id, GROUP_COLORS[i % GROUP_COLORS.length])));
  return colors;
}

// ── Folding leaves ──

// Entities with one link fold into their hub ("+N"), unless their hub has
// one link too (a pair stays a pair) or they're in `keep` (selected, on a
// path, found). Hubs in `unfolded` keep their leaves.
// → { graph, folded: Map hubId → [leaf ids] }
export function collapseLeaves(graph, { keep = new Set(), unfolded = new Set() } = {}) {
  const adj = adjacency(graph);
  const folded = new Map();
  const gone = new Set();
  for (const [id, links] of adj) {
    if (links.length !== 1 || keep.has(id)) continue;
    const hub = links[0].other;
    if (adj.get(hub).length < 2 || unfolded.has(hub) || gone.has(hub)) continue;
    gone.add(id);
    if (!folded.has(hub)) folded.set(hub, []);
    folded.get(hub).push(id);
  }
  if (!gone.size) return { graph, folded };
  return {
    graph: {
      nodes: graph.nodes.filter((n) => !gone.has(n.id)),
      edges: graph.edges.filter((e) => !gone.has(e.source) && !gone.has(e.target)),
    },
    folded,
  };
}

// ── As of a date ──

const day = (value) => (value ? String(value).slice(0, 10) : null);

// When a link appeared: a relationship when it was entered, money from its
// first transaction, a holding from the transaction that handed it over;
// links stored on an entity (a business's staff) with the later of its ends.
const EVENT_KINDS = ['transaction', 'holder'];
const eventDate = (e) => (e.kind === 'transaction' ? day(e.first_at) : e.kind === 'holder' ? day(e.last_at) : null);
function edgeSince(e, nodeSince) {
  if (EVENT_KINDS.includes(e.kind)) return eventDate(e);
  if (e.created_at) return day(e.created_at);
  const a = nodeSince.get(e.source); const b = nodeSince.get(e.target);
  return a && b ? (a > b ? a : b) : (a || b);
}

// Since when an entity counts: the day it was entered, or earlier when money
// or a holding shows it was there before (data entered or imported later).
function nodeSinceMap(graph) {
  const since = new Map(graph.nodes.map((n) => [n.id, day(n.created_at)]));
  for (const e of graph.edges) {
    const at = eventDate(e);
    if (!at) continue;
    for (const id of [e.source, e.target]) {
      if (since.has(id) && (!since.get(id) || at < since.get(id))) since.set(id, at);
    }
  }
  return since;
}

// The graph as it was on a date (YYYY-MM-DD, inclusive): entities there by
// then and links that existed by then. Identifiers stay; the filters drop
// those nobody shown has.
export function atDate(graph, date) {
  if (!date) return graph;
  const nodeSince = nodeSinceMap(graph);
  const nodes = graph.nodes.filter((n) => n.type === 'identifier' || !nodeSince.get(n.id) || nodeSince.get(n.id) <= date);
  const ids = new Set(nodes.map((n) => n.id));
  const edges = graph.edges.filter((e) => {
    if (!ids.has(e.source) || !ids.has(e.target)) return false;
    const since = edgeSince(e, nodeSince);
    return !since || since <= date;
  });
  return { nodes, edges };
}

// The first and last date in a graph, for the slider. → { min, max } or null.
export function dateSpan(graph) {
  const nodeSince = nodeSinceMap(graph);
  const dates = [...nodeSince.values(), ...graph.edges.map((e) => edgeSince(e, nodeSince))].filter(Boolean).sort();
  return dates.length ? { min: dates[0], max: dates[dates.length - 1] } : null;
}

// ── Statistics ──

export function graphStats(graph, { between = null, top = 5 } = {}) {
  const deg = degrees(graph);
  const entities = graph.nodes.filter((n) => n.type !== 'identifier');
  const rank = (score) => entities
    .map((n) => ({ id: n.id, value: score.get(n.id) || 0 }))
    .filter((x) => x.value > 0)
    .sort((a, b) => b.value - a.value || a.id.localeCompare(b.id))
    .slice(0, top);
  return {
    nodes: graph.nodes.length,
    edges: graph.edges.length,
    groups: components(graph).filter((g) => g.length > 1).length,
    isolated: entities.filter((n) => !deg.get(n.id)).map((n) => n.id),
    mostConnected: rank(deg),
    mostBetween: between ? rank(between) : [],
  };
}

// ── Export ──

const xml = (value) => String(value ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
  // eslint-disable-next-line no-control-regex
  .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '');

const NODE_KEYS = [
  ['label', 'string'], ['type', 'string'], ['kind', 'string'], ['category', 'string'], ['status', 'string'],
  ['case_id', 'int'], ['project_id', 'int'], ['entity_id', 'int'], ['x', 'double'], ['y', 'double'],
];
const EDGE_KEYS = [['label', 'string'], ['type', 'string'], ['kind', 'string'], ['note', 'string'], ['count', 'int']];

// GraphML for Gephi, yEd and Cytoscape Desktop (our own writer).
// `positions`: { id: { x, y } } from the canvas, optional.
export function toGraphML(graph, { formatName = null, edgeLabel = (type) => type, positions = {} } = {}) {
  const keys = [
    ...NODE_KEYS.map(([name, type]) => `  <key id="n_${name}" for="node" attr.name="${name}" attr.type="${type}"/>`),
    ...EDGE_KEYS.map(([name, type]) => `  <key id="e_${name}" for="edge" attr.name="${name}" attr.type="${type}"/>`),
  ];
  const data = (prefix, values) => Object.entries(values)
    .filter(([, v]) => v != null && v !== '')
    .map(([k, v]) => `      <data key="${prefix}_${k}">${xml(v)}</data>`);
  const nodes = graph.nodes.map((n) => {
    const p = positions[n.id];
    return [`    <node id="${xml(n.id)}">`, ...data('n', {
      label: nodeLabel(n, formatName), type: n.type, kind: n.kind, category: n.category, status: n.status,
      case_id: n.case_id, project_id: n.project_id, entity_id: n.entity_id,
      x: p ? Math.round(p.x) : null, y: p ? Math.round(p.y) : null,
    }), '    </node>'].join('\n');
  });
  const edges = graph.edges.map((e) => [`    <edge id="${xml(e.id)}" source="${xml(e.source)}" target="${xml(e.target)}">`, ...data('e', {
    label: edgeLabel(e.type), type: e.type, kind: e.kind, note: e.note, count: e.count,
  }), '    </edge>'].join('\n'));
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<graphml xmlns="http://graphml.graphdrawing.org/xmlns" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"',
    '  xsi:schemaLocation="http://graphml.graphdrawing.org/xmlns http://graphml.graphdrawing.org/xmlns/1.0/graphml.xsd">',
    ...keys,
    '  <graph id="G" edgedefault="directed">',
    ...nodes,
    ...edges,
    '  </graph>',
    '</graphml>',
    '',
  ].join('\n');
}

// Our own JSON: the nodes and edges as the API gives them, with the shown
// name and position.
export function toGraphJSON(graph, { formatName = null, positions = {}, meta = {} } = {}) {
  return JSON.stringify({
    format: 'ghost-graph/v1',
    exported_at: new Date().toISOString(),
    ...meta,
    nodes: graph.nodes.map((n) => ({ ...n, label: nodeLabel(n, formatName), ...(positions[n.id] ? { position: positions[n.id] } : {}) })),
    edges: graph.edges,
  }, null, 2);
}
