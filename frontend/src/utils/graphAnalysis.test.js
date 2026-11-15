// Analysis on the graph as drawn (graph plan, phase 3).
import { describe, test, expect } from 'vitest';
import {
  findMatches, shortestPath, neighbourhoodOf, pageRank, betweenness, sizeWeights, components,
  groupColors, collapseLeaves, atDate, dateSpan, graphStats, toGraphML, toGraphJSON,
} from './graphAnalysis';

const node = (id, extra = {}) => ({ id, type: 'person', label: id, degree: 1, created_at: '2026-01-01', ...extra });
const edge = (id, source, target, extra = {}) => ({ id, source, target, type: 'friend', kind: 'relationship', ...extra });
const ids = (list) => list.map((x) => x.id).sort();

// Two groups joined by b—c (c is the bridge): a, b | c | d, e, f; g alone.
const graph = {
  nodes: ['a', 'b', 'c', 'd', 'e', 'f', 'g'].map((id) => node(id)),
  edges: [edge('ab', 'a', 'b'), edge('bc', 'b', 'c'), edge('cd', 'c', 'd'), edge('de', 'd', 'e'), edge('df', 'd', 'f'), edge('ef', 'e', 'f')],
};

describe('find and focus', () => {
  test('find matches names, aliases and addresses, in graph order', () => {
    const nodes = [node('person:1', { label: 'Frodo', aliases: ['Mr. Underhill'] }), node('crypto_wallet:2', { type: 'crypto_wallet', label: 'Shire fund', address: '0xABC' })];
    expect(findMatches(nodes, 'underhill')).toEqual(['person:1']);
    expect(findMatches(nodes, '0xabc')).toEqual(['crypto_wallet:2']);
    expect(findMatches(nodes, '  ')).toEqual([]);
  });

  test('neighbourhood: hops out, identifiers pass through to everyone who has them', () => {
    expect(ids(neighbourhoodOf(graph, 'c', 1).nodes)).toEqual(['b', 'c', 'd']);
    expect(ids(neighbourhoodOf(graph, 'c', 2).nodes)).toEqual(['a', 'b', 'c', 'd', 'e', 'f']);
    const withPhone = {
      nodes: [...graph.nodes, node('identifier:phone:1', { type: 'identifier' })],
      edges: [...graph.edges, edge('gp', 'g', 'identifier:phone:1'), edge('ap', 'a', 'identifier:phone:1')],
    };
    expect(ids(neighbourhoodOf(withPhone, 'g', 1).nodes)).toEqual(['a', 'g', 'identifier:phone:1']);
  });
});

describe('shortest path (same as the server)', () => {
  test('fewest links either way; none; same node', () => {
    expect(shortestPath(graph, 'a', 'f')).toEqual({ nodes: ['a', 'b', 'c', 'd', 'f'], edges: ['ab', 'bc', 'cd', 'df'] });
    expect(shortestPath(graph, 'f', 'a').nodes).toEqual(['f', 'd', 'c', 'b', 'a']);
    expect(shortestPath(graph, 'a', 'g')).toBeNull();
    expect(shortestPath(graph, 'a', 'a')).toEqual({ nodes: ['a'], edges: [] });
    expect(shortestPath(graph, 'a', 'zzz')).toBeNull();
  });

  test('ties go to the first link in edge order', () => {
    const tie = { nodes: ['a', 'b', 'c', 'd'].map((id) => node(id)), edges: [edge('ac', 'a', 'c'), edge('ab', 'a', 'b'), edge('bd', 'b', 'd'), edge('cd', 'c', 'd')] };
    expect(shortestPath(tie, 'a', 'd').nodes).toEqual(['a', 'c', 'd']);
  });
});

describe('centrality and sizes', () => {
  test('PageRank sums to 1 and favours the busy node', () => {
    const r = pageRank(graph);
    expect([...r.values()].reduce((a, b) => a + b, 0)).toBeCloseTo(1, 6);
    expect(r.get('d')).toBeGreaterThan(r.get('a'));
  });

  test('betweenness: the bridge scores highest, ends and loners zero', () => {
    const { scores, approximate } = betweenness(graph);
    expect(approximate).toBe(false);
    const top = [...scores].sort((x, y) => y[1] - x[1])[0][0];
    expect(['c', 'd']).toContain(top);
    expect(scores.get('c')).toBeGreaterThan(scores.get('b'));
    expect(scores.get('a')).toBe(0);
    expect(scores.get('g')).toBe(0);
    // A path of three: the middle sits on the only pair's path → 1.
    const line = { nodes: ['x', 'y', 'z'].map((id) => node(id)), edges: [edge('xy', 'x', 'y'), edge('yz', 'y', 'z')] };
    expect(betweenness(line).scores.get('y')).toBeCloseTo(1);
  });

  test('large graphs are sampled and say so', () => {
    const n = 60;
    const ring = { nodes: Array.from({ length: n }, (_, i) => node(`n${i}`)), edges: Array.from({ length: n }, (_, i) => edge(`e${i}`, `n${i}`, `n${(i + 1) % n}`)) };
    const { scores, approximate } = betweenness(ring, { sampleAbove: 50, samples: 20 });
    expect(approximate).toBe(true);
    expect(scores.get('n0')).toBeGreaterThan(0);
  });

  test('size weights are 0..1 per mode', () => {
    const g = { ...graph, nodes: graph.nodes.map((n) => ({ ...n, degree: n.id === 'd' ? 4 : 1 })) };
    expect(sizeWeights(g, 'uniform').get('d')).toBe(0);
    expect(sizeWeights(g, 'connections').get('d')).toBe(1);
    expect(sizeWeights(g, 'connections').get('a')).toBeCloseTo(0.5);
    for (const mode of ['pagerank', 'betweenness']) {
      const w = sizeWeights(g, mode);
      expect(Math.max(...w.values())).toBe(1);
      expect(Math.min(...w.values())).toBeGreaterThanOrEqual(0);
    }
  });
});

describe('groups and folding', () => {
  test('connected groups, largest first; colours for groups of two or more', () => {
    expect(components(graph).map((g) => g.length)).toEqual([6, 1]);
    const colors = groupColors(graph);
    expect(colors.get('a')).toBe(colors.get('f'));
    expect(colors.has('g')).toBe(false);
  });

  test('leaves fold into their hub; pairs, kept and unfolded stay', () => {
    const { graph: g, folded } = collapseLeaves(graph);
    expect(ids(g.nodes)).toEqual(['b', 'c', 'd', 'e', 'f', 'g']);
    expect(folded.get('b')).toEqual(['a']);
    expect(collapseLeaves(graph, { keep: new Set(['a']) }).folded.size).toBe(0);
    expect(collapseLeaves(graph, { unfolded: new Set(['b']) }).folded.size).toBe(0);
    const pair = { nodes: [node('x'), node('y')], edges: [edge('xy', 'x', 'y')] };
    expect(collapseLeaves(pair).graph).toBe(pair);
  });
});

describe('as of a date', () => {
  const g = {
    nodes: [
      node('p:1', { created_at: '2025-01-01T10:00:00Z' }), node('p:2', { created_at: '2025-06-01T10:00:00Z' }),
      node('b:3', { type: 'business', created_at: '2025-01-01' }), node('identifier:email:x', { type: 'identifier', created_at: undefined }),
    ],
    edges: [
      edge('r', 'p:1', 'p:2', { created_at: '2025-09-01T08:00:00Z' }),
      edge('t', 'p:1', 'b:3', { kind: 'transaction', type: 'transaction', first_at: '2025-03-01' }),
      edge('o', 'b:3', 'p:2', { kind: 'relationship', type: 'owner' }), // stored on the business: from its later end
    ],
  };

  test('entities and links by the date they appeared', () => {
    expect(ids(atDate(g, '2025-02-01').nodes)).toEqual(['b:3', 'identifier:email:x', 'p:1']);
    expect(ids(atDate(g, '2025-02-01').edges)).toEqual([]);
    expect(ids(atDate(g, '2025-03-01').edges)).toEqual(['t']);
    expect(ids(atDate(g, '2025-06-01').edges)).toEqual(['o', 't']);
    expect(ids(atDate(g, '2025-09-01').edges)).toEqual(['o', 'r', 't']);
    expect(atDate(g, null)).toBe(g);
  });

  test('entered later, but money shows they were there: they count from the money', () => {
    const imported = {
      nodes: [node('p:1', { created_at: '2026-11-06' }), node('p:2', { created_at: '2026-11-06' }), node('p:3', { created_at: '2026-11-06' }), node('a:9', { type: 'asset', created_at: '2026-11-06' })],
      edges: [
        edge('t', 'p:1', 'p:2', { kind: 'transaction', type: 'transaction', first_at: '2025-09-22T00:00:00Z' }),
        edge('h', 'p:2', 'a:9', { kind: 'holder', type: 'holds', last_at: '2025-09-22' }),
        edge('r', 'p:1', 'p:3', { created_at: '2026-11-06' }),
      ],
    };
    const then = atDate(imported, '2025-10-01');
    expect(ids(then.nodes)).toEqual(['a:9', 'p:1', 'p:2']);
    expect(ids(then.edges)).toEqual(['h', 't']);
    expect(ids(atDate(imported, '2025-09-21').nodes)).toEqual([]);
    expect(dateSpan(imported)).toEqual({ min: '2025-09-22', max: '2026-11-06' });
  });

  test('the span of dates', () => {
    expect(dateSpan(g)).toEqual({ min: '2025-01-01', max: '2025-09-01' });
    expect(dateSpan({ nodes: [], edges: [] })).toBeNull();
  });
});

describe('statistics and export', () => {
  test('stats: groups, isolated, most connected, most between', () => {
    const s = graphStats(graph, { between: betweenness(graph).scores, top: 2 });
    expect(s).toMatchObject({ nodes: 7, edges: 6, groups: 1, isolated: ['g'] });
    expect(s.mostConnected[0]).toEqual({ id: 'd', value: 3 });
    expect(s.mostBetween.map((x) => x.id)).toContain('c');
  });

  test('GraphML is well-formed, escaped, with positions', () => {
    const g = { nodes: [node('person:1', { label: 'Tom & "Goldberry" <3' })], edges: [edge('e1', 'person:1', 'person:1', { note: 'self' })] };
    const out = toGraphML(g, { positions: { 'person:1': { x: 10.4, y: -3 } }, edgeLabel: (t) => t.toUpperCase() });
    const doc = new DOMParser().parseFromString(out, 'application/xml');
    expect(doc.getElementsByTagName('parsererror')).toHaveLength(0);
    expect(doc.getElementsByTagName('node')).toHaveLength(1);
    expect(out).toContain('Tom &amp; &quot;Goldberry&quot; &lt;3');
    expect(out).toContain('<data key="n_x">10</data>');
    expect(out).toContain('<data key="e_label">FRIEND</data>');
  });

  test('JSON keeps the API fields, the shown name and positions', () => {
    const data = JSON.parse(toGraphJSON(graph, { formatName: (n) => n.id.toUpperCase(), positions: { a: { x: 1, y: 2 } }, meta: { project_id: 12 } }));
    expect(data).toMatchObject({ format: 'ghost-graph/v1', project_id: 12 });
    expect(data.nodes[0]).toMatchObject({ id: 'a', label: 'A', position: { x: 1, y: 2 } });
    expect(data.edges).toHaveLength(6);
  });
});
