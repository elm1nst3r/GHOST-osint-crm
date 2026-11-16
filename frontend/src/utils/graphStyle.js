// The graph's look (graph plan, phase 1): a Cytoscape stylesheet built from
// the theme. Cytoscape can't read CSS variables, so the --graph-* tokens
// (themes/palette.js) are read once per theme and passed in here.
import { mix } from '../themes/color';
import { NODE_ICONS, IDENTIFIER_ICONS, iconUri } from './graphIcons';
import { EDGE_LAYERS, typesInLayer } from './edgeLayers';

// GHOST's own colours, for when a variable is missing.
export const FALLBACK_THEME = {
  bg: '#0f172a', grid: '#1e293b', text: '#e2e8f0', ring: '#e2e8f0',
  selected: '#fbbf24', hover: '#fb7185', nodeText: '#e2e8f0',
  node: {
    person: '#60a5fa', business: '#4ade80', crypto_wallet: '#c084fc', asset: '#fb923c',
    property: '#2dd4bf', wireless_network: '#38bdf8', identifier: '#94a3b8',
  },
  edge: {
    family: '#34d399', friend: '#60a5fa', enemy: '#f87171', associate: '#64748b',
    employer: '#a78bfa', employee: '#c4b5fd', suspect: '#f87171', witness: '#fbbf24', victim: '#f472b6',
    owner: '#4ade80', owns_business: '#22c55e', board_member: '#a855f7', owns_property: '#14b8a6',
    transaction: '#22d3ee', holds: '#f97316', uses_network: '#0ea5e9', identifier: '#64748b', other: '#475569',
  },
  matrix: false,
};

const NODE_VAR = { crypto_wallet: 'wallet', wireless_network: 'wireless' };
const cssName = (type) => type.replace(/_/g, '-');

// The theme's graph colours, read from the element's computed style.
export function readGraphTheme(element, { matrix = false } = {}) {
  const cs = getComputedStyle(element);
  const get = (name, fallback) => cs.getPropertyValue(`--graph-${name}`).trim() || fallback;
  const f = FALLBACK_THEME;
  return {
    bg: get('bg', f.bg), grid: get('grid', f.grid), text: get('text', f.text), ring: get('ring', f.ring),
    selected: get('node-selected', f.selected), hover: get('node-hover', f.hover), nodeText: get('node-text', f.nodeText),
    node: Object.fromEntries(Object.entries(f.node).map(([type, fb]) => [type, get(`node-${NODE_VAR[type] || cssName(type)}`, fb)])),
    edge: Object.fromEntries(Object.entries(f.edge).map(([type, fb]) => [type, get(`edge-${cssName(type)}`, fb)])),
    matrix,
  };
}

// Edge line style per layer: personal ties solid, business dashed, money
// dotted, traces (identifiers, networks) fine and dotted.
const LAYER_LINE = {
  governance: { 'line-style': 'solid', width: 2.5 },
  employment: { 'line-style': 'dashed', 'line-dash-pattern': [7, 4], width: 2 },
  financial: { 'line-style': 'dotted', width: 2 },
  social: { 'line-style': 'solid', width: 1.6 },
  investigative: { 'line-style': 'solid', width: 2 },
  digital: { 'line-style': 'dashed', 'line-dash-pattern': [2, 4], width: 1.2 },
  other: { 'line-style': 'solid', width: 1.2 },
};

// Types whose direction means something get an arrow.
const DIRECTED = ['owner', 'owns_business', 'owns_property', 'board_member', 'employee', 'employer', 'holds', 'transaction'];

// `transitions: false` for big graphs: Cytoscape animates a style transition
// element by element, which on thousands of elements takes seconds.
export function buildStylesheet(theme = FALLBACK_THEME, { transitions = true } = {}) {
  const t = { ...FALLBACK_THEME, ...theme };
  const fade = (props) => (transitions ? { 'transition-property': props, 'transition-duration': 150 } : {});
  const muted = (color) => mix(color, t.bg, 0.22); // fill: a dark tint of the type colour
  const styles = [
    {
      selector: 'node',
      style: {
        width: 30,
        height: 30,
        'background-color': t.node.person,
        'border-width': 2,
        'border-color': t.node.person,
        'background-fit': 'none',
        'background-width': '52%',
        'background-height': '52%',
        'background-clip': 'none',
        color: t.nodeText,
        'font-size': 11,
        'font-weight': 500,
        'text-valign': 'bottom',
        'text-margin-y': 6,
        'text-wrap': 'ellipsis',
        'text-max-width': 140,
        'text-outline-color': t.bg,
        'text-outline-width': 2.5,
        // Labels give way when zoomed out; important (bigger) nodes keep
        // theirs longest because their font is larger.
        'min-zoomed-font-size': 8,
        'overlay-opacity': 0,
        ...fade('opacity, border-width, border-color'),
      },
    },
    // Mappings only where the data exists: connect mode adds bare helper nodes.
    { selector: 'node[label]', style: { label: 'data(label)' } },
    {
      selector: 'node[weight]',
      style: {
        width: 'mapData(weight, 0, 1, 30, 64)',
        height: 'mapData(weight, 0, 1, 30, 64)',
        'font-size': 'mapData(weight, 0, 1, 11, 15)',
      },
    },
  ];

  for (const [type, color] of Object.entries(t.node)) {
    styles.push({
      selector: `node.t-${type}`,
      style: { 'background-color': muted(color), 'border-color': color, 'background-image': iconUri(NODE_ICONS[type], color) },
    });
  }
  for (const [kind, icon] of Object.entries(IDENTIFIER_ICONS)) {
    styles.push({ selector: `node.k-${kind}`, style: { 'background-image': iconUri(icon, t.node.identifier) } });
  }
  styles.push(
    { selector: 'node.t-identifier', style: { shape: 'round-rectangle', width: 26, height: 26, 'font-size': 10, color: mix(t.nodeText, t.bg, 0.75) } },
    { selector: 'node.t-business', style: { shape: 'round-rectangle' } },
    { selector: 'node.t-crypto_wallet', style: { shape: 'round-hexagon' } },
    { selector: 'node.t-asset', style: { shape: 'round-diamond' } },
    { selector: 'node.t-property', style: { shape: 'round-pentagon' } },
    { selector: 'node.t-wireless_network', style: { shape: 'round-triangle' } },
    // Someone from another project (cross-project link): dashed outline.
    { selector: 'node.foreign', style: { 'border-style': 'dashed' } },
    { selector: 'node.focus', style: { 'border-width': 4, 'border-color': t.selected } },
    // Pinned by hand: a double outline; layouts leave it where it is.
    { selector: 'node.pinned', style: { 'border-style': 'double', 'border-width': 5 } },
    {
      selector: 'edge',
      style: {
        'curve-style': 'bezier',
        width: 1.5,
        'line-color': t.edge.other,
        'target-arrow-color': t.edge.other,
        'arrow-scale': 0.8,
        opacity: 0.85,
        'overlay-opacity': 0,
        ...fade('opacity, width'),
      },
    },
  );
  for (const layer of EDGE_LAYERS) styles.push({ selector: `edge.l-${layer}`, style: LAYER_LINE[layer] });
  for (const [type, color] of Object.entries(t.edge)) {
    styles.push({ selector: `edge[type = "${type}"]`, style: { 'line-color': color, 'target-arrow-color': color } });
  }
  if (t.matrix) {
    // Matrix: phosphor-green lines and monospace labels. Before the hover
    // and selection rules, which must still win.
    styles.push(
      { selector: 'node', style: { color: '#4ade80', 'text-outline-color': '#022c22', 'font-family': 'ui-monospace, monospace' } },
      { selector: 'edge', style: { 'line-color': '#16a34a', 'target-arrow-color': '#16a34a' } },
    );
  }
  styles.push(
    { selector: DIRECTED.map((type) => `edge[type = "${type}"]`).join(', '), style: { 'target-arrow-shape': 'triangle' } },
    { selector: 'edge[count > 1]', style: { width: 'mapData(count, 1, 20, 2, 7)' } },
    // An employee matched by name only: faded, until someone links them.
    { selector: 'edge.by-name', style: { opacity: 0.4, 'line-style': 'dashed', 'line-dash-pattern': [3, 5] } },
    // Hover: the node and its neighbours stay, the rest fades.
    { selector: '.faded', style: { opacity: 0.12, 'text-opacity': 0 } },
    { selector: 'node.hovered', style: { 'border-color': t.hover, 'border-width': 3 } },
    // Phase 3. Colour by connected group: the outline takes the group's colour.
    { selector: 'node[groupColor]', style: { 'border-color': 'data(groupColor)', 'border-width': 3 } },
    // A case drawn as a box around its entities.
    {
      selector: 'node.grp',
      style: {
        shape: 'round-rectangle', 'background-color': t.text, 'background-opacity': 0.05, 'background-image': 'none',
        'border-width': 1.5, 'border-style': 'dashed', 'border-color': mix(t.text, t.bg, 0.45),
        'text-valign': 'top', 'text-halign': 'center', 'text-margin-y': -4, 'font-size': 12, 'font-weight': 600,
        color: mix(t.text, t.bg, 0.8), padding: 18,
      },
    },
    // Found, and the shortest path: the rest fades back.
    { selector: '.dimmed', style: { opacity: 0.15, 'text-opacity': 0 } },
    { selector: 'node.match', style: { 'border-color': t.selected, 'border-width': 5, 'z-index': 10 } },
    { selector: 'node.on-path', style: { 'border-color': t.selected, 'border-width': 5, 'z-index': 10 } },
    { selector: 'edge.on-path', style: { 'line-color': t.selected, 'target-arrow-color': t.selected, width: 4, opacity: 1, 'z-index': 10 } },
    { selector: 'edge.on-path[typeLabel]', style: { label: 'data(typeLabel)', 'font-size': 10, color: t.text, 'text-rotation': 'autorotate', 'text-outline-color': t.bg, 'text-outline-width': 2 } },
    { selector: 'edge.highlighted', style: { opacity: 1, width: 3 } },
    { selector: 'edge.highlighted[typeLabel]', style: { label: 'data(typeLabel)', 'font-size': 10, color: t.text, 'text-rotation': 'autorotate', 'text-outline-color': t.bg, 'text-outline-width': 2 } },
    { selector: 'node:selected', style: { 'border-color': t.selected, 'border-width': 4 } },
    { selector: 'edge:selected', style: { 'line-color': t.selected, 'target-arrow-color': t.selected, width: 3, opacity: 1 } },
    // Connect mode (edgehandles)
    { selector: '.eh-handle', style: { 'background-color': t.selected, width: 12, height: 12, shape: 'ellipse', 'border-width': 0, label: '' } },
    { selector: '.eh-source, .eh-target', style: { 'border-width': 4, 'border-color': t.selected } },
    { selector: '.eh-preview, .eh-ghost-edge', style: { 'line-color': t.selected, 'target-arrow-color': t.selected, 'target-arrow-shape': 'triangle', 'line-style': 'dashed', opacity: 1 } },
    { selector: '.eh-ghost-edge.eh-preview-active', style: { opacity: 0 } },
  );
  return styles;
}

// Which edge types each layer has, for the legend.
export const legendLayers = () => EDGE_LAYERS.map((layer) => ({ layer, types: typesInLayer(layer) }));
