// From the API's graph to what's drawn (graph plan, phase 1).
import { describe, test, expect } from 'vitest';
import {
  filterGraph, toElements, includeFor, filterOptions, activeFilterCount,
  DEFAULT_NODE_TYPES, EMPTY_FILTERS, mergeGraphs, linksOf, edgeEditable, edgeManagedBy,
} from './graphElements';
import { DEFAULT_EDGE_LAYERS } from './edgeLayers';
import { buildStylesheet, FALLBACK_THEME } from './graphStyle';
import { THEMES } from '../themes/themes';
import { variantVars } from '../themes/palette';

const node = (id, type, extra = {}) => ({ id, type, label: id, degree: 1, created_at: '2026-01-01', ...extra });
const graph = {
  nodes: [
    node('person:1', 'person', { category: 'Suspect', status: 'Active', case_id: 7, aliases: ['Ringbearer'], updated_at: '2026-11-10' }),
    node('person:2', 'person', { category: 'Witness', status: 'Closed', case_id: 8 }),
    node('person:3', 'person', { degree: 0 }),
    node('business:4', 'business', { degree: 3 }),
    node('asset:5', 'asset'),
    node('identifier:email:a@b.c', 'identifier', { kind: 'email' }),
  ],
  edges: [
    { id: 'e1', source: 'person:1', target: 'person:2', type: 'friend', kind: 'relationship' },
    { id: 'e2', source: 'business:4', target: 'person:1', type: 'owner', kind: 'relationship' },
    { id: 'e3', source: 'person:1', target: 'asset:5', type: 'holds', kind: 'holder' },
    { id: 'e4', source: 'person:1', target: 'identifier:email:a@b.c', type: 'identifier', kind: 'identifier' },
    { id: 'e5', source: 'person:1', target: 'business:4', type: 'transaction', kind: 'transaction', count: 4 },
  ],
};
const ids = (list) => list.map((x) => x.id).sort();
const ALL = { ...DEFAULT_NODE_TYPES, asset: true, identifier: true };

describe('filterGraph', () => {
  test('types switched off disappear with their edges; the money layer is off by default', () => {
    const g = filterGraph(graph, { layers: DEFAULT_EDGE_LAYERS });
    expect(ids(g.nodes)).toEqual(['business:4', 'person:1', 'person:2', 'person:3']);
    expect(ids(g.edges)).toEqual(['e1', 'e2']);
  });

  test('an identifier stays only while someone shown has it', () => {
    expect(ids(filterGraph(graph, { types: ALL }).nodes)).toContain('identifier:email:a@b.c');
    const g = filterGraph(graph, { types: ALL, filters: { ...EMPTY_FILTERS, searchTerm: 'person:2' } });
    expect(ids(g.nodes)).toEqual(['person:2']);
  });

  test('search covers aliases; case, category and status filters', () => {
    expect(ids(filterGraph(graph, { filters: { ...EMPTY_FILTERS, searchTerm: 'ringb' } }).nodes)).toEqual(['person:1']);
    expect(ids(filterGraph(graph, { filters: { ...EMPTY_FILTERS, caseIds: [8] } }).nodes)).toEqual(['person:2']);
    expect(ids(filterGraph(graph, { filters: { ...EMPTY_FILTERS, categories: ['Suspect'], statuses: ['Active'] } }).nodes)).toEqual(['person:1']);
  });

  test('isolated entities, minimum links, link types, date range', () => {
    expect(ids(filterGraph(graph, { filters: { ...EMPTY_FILTERS, showIsolated: false } }).nodes)).not.toContain('person:3');
    expect(ids(filterGraph(graph, { filters: { ...EMPTY_FILTERS, minConnections: 2 } }).nodes)).toEqual(['business:4']);
    expect(ids(filterGraph(graph, { filters: { ...EMPTY_FILTERS, connectionTypes: ['owner'] } }).nodes)).toEqual(['business:4', 'person:1']);
    const recent = filterGraph(graph, { filters: { ...EMPTY_FILTERS, dateRange: 'week' }, now: new Date('2026-11-15') });
    expect(ids(recent.nodes)).toEqual(['person:1']);
  });

  test('solo shows one layer; the focus entity survives every filter', () => {
    expect(ids(filterGraph(graph, { types: ALL, solo: 'governance' }).edges)).toEqual(['e2', 'e3']);
    const g = filterGraph(graph, { focusId: 'person:3', filters: { ...EMPTY_FILTERS, searchTerm: 'zzz' } });
    expect(ids(g.nodes)).toEqual(['person:3']);
    // Around one entity, nodes whose links are all switched off drop out.
    const around = filterGraph(graph, { types: ALL, focusId: 'person:1', layers: DEFAULT_EDGE_LAYERS });
    expect(ids(around.nodes)).toEqual(['asset:5', 'business:4', 'identifier:email:a@b.c', 'person:1', 'person:2']);
    expect(ids(around.edges)).not.toContain('e5');
  });
});

describe('phase 2: hidden, kept, merged, links', () => {
  test('hidden by hand beats everything but the focus; kept beats the switches', () => {
    expect(ids(filterGraph(graph, { hidden: ['person:2'] }).nodes)).not.toContain('person:2');
    expect(ids(filterGraph(graph, { hidden: ['person:3'], focusId: 'person:3' }).nodes)).toContain('person:3');
    const g = filterGraph(graph, { keep: ['asset:5'], layers: DEFAULT_EDGE_LAYERS });
    expect(ids(g.nodes)).toContain('asset:5');
    expect(ids(g.edges)).toContain('e3');
  });

  test('mergeGraphs adds what is new, once', () => {
    const more = {
      nodes: [node('person:1', 'person', { label: 'copy' }), node('person:9', 'person')],
      edges: [{ id: 'x', source: 'person:1', target: 'person:2', type: 'friend' }, { id: 'y', source: 'person:9', target: 'person:1', type: 'family' }],
    };
    const m = mergeGraphs(graph, more);
    expect(m.nodes.filter((n) => n.id === 'person:1')).toHaveLength(1);
    expect(m.nodes.find((n) => n.id === 'person:1').label).toBe('person:1');
    expect(ids(m.edges)).toEqual(['e1', 'e2', 'e3', 'e4', 'e5', 'y']);
    expect(mergeGraphs(graph, { nodes: [], edges: [] })).toBe(graph);
  });

  test('linksOf lists each link with the other end and its direction', () => {
    const links = linksOf(graph, 'business:4');
    expect(links.map((l) => [l.other.id, l.outgoing])).toEqual([['person:1', true], ['person:1', false]]);
  });

  test('which links are edited where', () => {
    const rel = (source, type, extra = {}) => ({ kind: 'relationship', relationship_id: 5, source, target: 'person:2', type, ...extra });
    expect(edgeEditable(rel('person:1', 'friend'))).toBe(true);
    expect(edgeEditable(rel('business:4', 'employee'))).toBe(false);
    expect(edgeManagedBy(rel('business:4', 'employee'))).toBe('business:4');
    expect(edgeManagedBy({ kind: 'relationship', source: 'business:3', target: 'business:4', type: 'owns_business' })).toBe('business:4');
    expect(edgeManagedBy({ kind: 'relationship', source: 'person:1', target: 'property:7', type: 'owns_property' })).toBe('property:7');
    expect(edgeEditable({ kind: 'transaction', source: 'person:1', target: 'person:2', type: 'transaction' })).toBe(false);
    expect(edgeManagedBy(rel('person:1', 'friend'))).toBeNull();
  });
});

describe('toElements and helpers', () => {
  test('nodes carry classes, weight and the shown name; edges their layer and label', () => {
    const els = toElements(filterGraph(graph, { types: ALL, layers: { ...DEFAULT_EDGE_LAYERS, financial: true } }), {
      formatName: (n) => `Name of ${n.id}`, focusId: 'person:1', edgeLabel: (type) => type.toUpperCase(),
    });
    const p1 = els.find((e) => e.data.id === 'person:1');
    expect(p1.data.label).toBe('Name of person:1');
    expect(p1.classes).toBe('t-person focus');
    expect(els.find((e) => e.data.id === 'business:4').data.weight).toBe(1);
    expect(els.find((e) => e.data.id === 'identifier:email:a@b.c').classes).toBe('t-identifier k-email');
    expect(els.find((e) => e.data.id === 'e5')).toMatchObject({ classes: 'l-financial k-transaction', data: { typeLabel: 'TRANSACTION' } });
  });

  test('include follows the switches', () => {
    expect(includeFor(DEFAULT_NODE_TYPES, DEFAULT_EDGE_LAYERS)).toEqual([]);
    expect(includeFor(ALL, { ...DEFAULT_EDGE_LAYERS, financial: true })).toEqual(['asset', 'identifiers', 'transactions']);
    expect(includeFor(DEFAULT_NODE_TYPES, DEFAULT_EDGE_LAYERS, 'financial')).toEqual(['transactions']);
  });

  test('filter options and the active-filter count', () => {
    expect(filterOptions(graph)).toEqual({
      categories: ['Suspect', 'Witness'], statuses: ['Active', 'Closed'],
      connectionTypes: ['friend', 'holds', 'identifier', 'owner', 'transaction'],
    });
    expect(activeFilterCount(EMPTY_FILTERS)).toBe(0);
    expect(activeFilterCount({ ...EMPTY_FILTERS, caseIds: [1, 2], showIsolated: false })).toBe(3);
  });
});

describe('buildStylesheet', () => {
  const colourProps = ['background-color', 'border-color', 'line-color', 'target-arrow-color', 'color', 'text-outline-color'];
  const isColour = (v) => typeof v !== 'string' || /^#[0-9a-f]{6}$/i.test(v) || v.startsWith('mapData') || v.startsWith('data(');

  test('every theme gives valid colours for every type', () => {
    const variants = THEMES.flatMap((th) => [
      ...(th.light ? [{ id: `${th.id} light`, v: { ...th.light, dark: false } }] : []),
      ...(th.darkNames ? Object.keys(th.darkNames).map((f) => ({ id: `${th.id} ${f}`, v: th.dark[f] }))
        : th.dark ? [{ id: `${th.id} dark`, v: { ...th.dark, dark: true } }] : []),
    ]);
    for (const { id, v: variant } of variants) {
      {
        const vars = variantVars(variant);
        const read = (name) => vars[`--graph-${name}`];
        const t = {
          ...FALLBACK_THEME, bg: read('bg'), text: read('text'), nodeText: read('node-text'), selected: read('node-selected'),
          node: { ...FALLBACK_THEME.node, person: read('node-person'), asset: read('node-asset'), wireless_network: read('node-wireless'), identifier: read('node-identifier') },
          edge: { ...FALLBACK_THEME.edge, holds: read('edge-holds'), identifier: read('edge-identifier'), uses_network: read('edge-uses-network') },
        };
        for (const rule of buildStylesheet(t)) {
          for (const prop of colourProps) {
            if (prop in rule.style) expect(isColour(rule.style[prop]), `${id} ${rule.selector} ${prop}=${rule.style[prop]}`).toBe(true);
          }
        }
      }
    }
  });

  test('icons are data URIs; Matrix adds its own rules', () => {
    const rules = buildStylesheet(FALLBACK_THEME);
    expect(rules.find((r) => r.selector === 'node.t-person').style['background-image']).toMatch(/^data:image\/svg\+xml;utf8,/);
    expect(buildStylesheet({ ...FALLBACK_THEME, matrix: true }).length).toBe(rules.length + 2);
  });
});
