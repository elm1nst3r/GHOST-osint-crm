// The project graph and identifiers (graph plan, phase 1).
const { identifierOf, businessIdentifiers } = require('./identifiers');
const { buildProjectGraph, buildFocusGraph, neighbourhood } = require('./graph');

describe('identifierOf', () => {
  test.each([
    ['Email', ' John@Mail.COM ', 'email', 'john@mail.com'],
    ['E-mail', 'john@mail.com', 'email', 'john@mail.com'],
    ['Other', 'ann@example.org', 'email', 'ann@example.org'], // the value wins over the label
    ['Phone', '+31 (6) 1234-5678', 'phone', '+31612345678'],
    ['Username', '@Frodo_B', 'username', 'frodo_b'],
    ['Telegram', 'frodo', 'username', 'frodo'],
    ['Website', 'https://www.Example.com/', 'domain', 'example.com'],
    ['Website', 'https://example.com/team/ann/', 'url', 'example.com/team/ann'],
    ['Social Media', 'twitter.com/Frodo', 'url', 'twitter.com/frodo'],
    ['IP Address', '10.0.0.1', 'ip', '10.0.0.1'],
  ])('%s %j → %s %s', (type, value, kind, key) => {
    expect(identifierOf(type, value)).toEqual({ kind, key, value: value.trim() });
  });

  test('not identifiers', () => {
    expect(identifierOf('Vehicle', 'AB-123-CD')).toBeNull();
    expect(identifierOf('Document ID', 'X1234567')).toBeNull();
    expect(identifierOf('Phone', 'call me')).toBeNull();
    expect(identifierOf('Email', '')).toBeNull();
  });

  test('business contact fields', () => {
    expect(businessIdentifiers({ email: 'Info@Isengard.me', phone: '', website: 'isengard.me' }).map((i) => i.key))
      .toEqual(['info@isengard.me', 'isengard.me']);
  });
});

// A small in-memory database answering the queries utils/graph.js makes.
function fakeDb(data) {
  const t = { people: [], businesses: [], crypto_wallets: [], assets: [], properties: [], wireless_networks: [], relationships: [], transactions: [], ...data };
  const ofProject = (table, pid) => t[table].filter((r) => r.project_id === pid);
  const inProject = (type, id, pid) => {
    const table = { person: 'people', business: 'businesses', crypto_wallet: 'crypto_wallets' }[type];
    return t[table].some((r) => r.id === id && r.project_id === pid);
  };
  return {
    query: jest.fn(async (sql, [p]) => {
      let m;
      if ((m = /FROM (\w+) WHERE project_id = \$1 ORDER BY id/.exec(sql))) return { rows: ofProject(m[1], p) };
      if ((m = /FROM (\w+) WHERE id = ANY/.exec(sql))) return { rows: t[m[1]].filter((r) => p.includes(r.id)) };
      if (/FROM relationships r/.test(sql)) {
        return { rows: t.relationships.filter((r) => r.project_id === p
          || inProject(r.source_type, r.source_id, p) || inProject(r.target_type, r.target_id, p)) };
      }
      if (/FROM assets a JOIN LATERAL/.test(sql)) {
        return { rows: ofProject('assets', p).flatMap((a) => {
          const tx = t.transactions.filter((x) => x.subject_asset_id === a.id).sort((x, y) => (y.occurred_on > x.occurred_on ? 1 : -1))[0];
          return tx ? [{ id: a.id, to_person_id: tx.to_person_id, to_business_id: tx.to_business_id, occurred_on: tx.occurred_on }] : [];
        }) };
      }
      if (/FROM transactions WHERE project_id/.test(sql)) {
        const party = (x, dir) => (x[`${dir}_person_id`] ? `person:${x[`${dir}_person_id`]}` : x[`${dir}_business_id`] ? `business:${x[`${dir}_business_id`]}` : null);
        const pairs = new Map();
        for (const x of ofProject('transactions', p)) {
          const src = party(x, 'from'); const dst = party(x, 'to');
          if (!src || !dst) continue;
          const k = `${src}>${dst}`;
          const cur = pairs.get(k) || { src, dst, count: 0, transaction_types: [] };
          cur.count += 1;
          if (!cur.transaction_types.includes(x.transaction_type)) cur.transaction_types.push(x.transaction_type);
          pairs.set(k, cur);
        }
        return { rows: [...pairs.values()] };
      }
      throw new Error(`unexpected query: ${sql.slice(0, 80)}`);
    }),
  };
}

const person = (id, first, last, project = 1, extra = {}) => ({ id, first_name: first, last_name: last, project_id: project, osint_data: [], ...extra });
const ids = (list) => list.map((x) => x.id).sort();
const edge = (graph, source, target) => graph.edges.find((e) => e.source === source && e.target === target);

describe('buildProjectGraph', () => {
  const base = () => ({
    people: [
      person(1, 'Frodo', 'Baggins', 1, { osint_data: [{ type: 'Email', value: 'Frodo@Shire.me' }, { type: 'Vehicle', value: 'pony' }] }),
      person(2, 'Sam', 'Gamgee', 1, { osint_data: [{ type: 'E-mail', value: 'frodo@shire.me' }, { type: 'Phone', value: '+44 1234 5678' }] }),
      person(3, 'Bill', 'Ferny', 1),
      person(4, 'Bill', 'Ferny', 1),
      person(5, 'Rosie', 'Cotton', 1),
      person(9, 'Galadriel', '', 2, { osint_data: [{ type: 'Phone', value: '+44 (1234) 5678' }] }),
    ],
    businesses: [
      { id: 10, name: 'Green Dragon', project_id: 1, owner_person_id: 5, employees: [
        { name: 'Sam Gamgee', person_id: 2 },
        { name: 'rosie cotton', person_id: null, role: 'Barmaid' },
        { name: 'Bill Ferny', person_id: null },
        { name: 'Nobody Here', person_id: null },
      ] },
    ],
    relationships: [
      { id: 100, project_id: 1, source_type: 'person', source_id: 1, target_type: 'person', target_id: 2, relationship_type: 'friend' },
      { id: 101, project_id: 1, source_type: 'business', source_id: 10, target_type: 'person', target_id: 5, relationship_type: 'owner' },
      { id: 102, project_id: 1, source_type: 'person', source_id: 1, target_type: 'person', target_id: 9, relationship_type: 'associate' },
      { id: 103, project_id: 2, source_type: 'person', source_id: 9, target_type: 'person', target_id: 3, relationship_type: 'suspect' },
    ],
  });

  test('entities, relationships and business ties; the owner only once', async () => {
    const g = await buildProjectGraph(fakeDb(base()), 1, { visible: [1] });
    expect(ids(g.nodes)).toEqual(['business:10', 'person:1', 'person:2', 'person:3', 'person:4', 'person:5']);
    expect(edge(g, 'person:1', 'person:2')).toMatchObject({ kind: 'relationship', type: 'friend', relationship_id: 100 });
    expect(g.edges.filter((e) => e.source === 'business:10' && e.target === 'person:5' && e.type === 'owner')).toHaveLength(1);
    expect(edge(g, 'business:10', 'person:2')).toMatchObject({ type: 'employee' });
    expect(g.nodes.find((n) => n.id === 'person:1').degree).toBe(1);
  });

  test('employees known by name: one match is a faded edge, two matches or none give nothing', async () => {
    const g = await buildProjectGraph(fakeDb(base()), 1, { visible: [1] });
    expect(g.edges.find((e) => e.target === 'person:5' && e.type === 'employee')).toMatchObject({ matched_by_name: true, note: 'Barmaid' });
    expect(g.edges.filter((e) => ['person:3', 'person:4'].includes(e.target) && e.source === 'business:10')).toEqual([]);
    expect(edge(g, 'business:10', 'person:2').matched_by_name).toBeUndefined();
  });

  test("another project: only when the caller may see it, and never through that project's rows", async () => {
    const hidden = await buildProjectGraph(fakeDb(base()), 1, { visible: [1] });
    expect(hidden.nodes.map((n) => n.id)).not.toContain('person:9');
    expect(edge(hidden, 'person:1', 'person:9')).toBeUndefined();
    expect(edge(hidden, 'person:9', 'person:3')).toBeUndefined();

    const shown = await buildProjectGraph(fakeDb(base()), 1, { visible: [1, 2] });
    expect(shown.nodes.find((n) => n.id === 'person:9')).toMatchObject({ foreign: true, project_id: 2 });
    expect(edge(shown, 'person:9', 'person:3')).toMatchObject({ type: 'suspect' });
    expect(ids((await buildProjectGraph(fakeDb(base()), 1, { visible: null })).nodes)).toContain('person:9');
  });

  test('identifiers: shared ones by default, written two ways still one; hidden people add none', async () => {
    const g = await buildProjectGraph(fakeDb(base()), 1, { visible: [1], include: ['identifiers'] });
    const idNodes = g.nodes.filter((n) => n.type === 'identifier');
    expect(idNodes.map((n) => n.id)).toEqual(['identifier:email:frodo@shire.me']);
    expect(g.edges.filter((e) => e.target === 'identifier:email:frodo@shire.me').map((e) => e.source).sort()).toEqual(['person:1', 'person:2']);

    const all = await buildProjectGraph(fakeDb(base()), 1, { visible: [1], include: ['identifiers'], identifiers: 'all' });
    expect(all.nodes.filter((n) => n.type === 'identifier').map((n) => n.id).sort())
      .toEqual(['identifier:email:frodo@shire.me', 'identifier:phone:+4412345678']);

    // Galadriel (project 2) has the same phone: only a caller who sees project 2 learns that.
    const both = await buildProjectGraph(fakeDb(base()), 1, { visible: [1, 2], include: ['identifiers'] });
    expect(both.edges.filter((e) => e.target === 'identifier:phone:+4412345678').map((e) => e.source).sort()).toEqual(['person:2', 'person:9']);
  });

  test('optional types and transactions only when asked for', async () => {
    const data = {
      ...base(),
      assets: [{ id: 20, name: 'Ring', project_id: 1 }],
      properties: [{ id: 30, name: 'Bag End', owner_person_id: 1, project_id: 1 }],
      wireless_networks: [{ id: 40, ssid: 'ShireNet', project_id: 1, person_id: 2, associated_person_ids: [2, 1], associated_business_ids: [10] }],
      transactions: [
        { project_id: 1, from_person_id: 1, to_person_id: 2, subject_asset_id: 20, occurred_on: '2025-01-01', transaction_type: 'gift' },
        { project_id: 1, from_person_id: 1, to_person_id: 2, occurred_on: '2025-02-01', transaction_type: 'loan' },
      ],
    };
    const plain = await buildProjectGraph(fakeDb(data), 1, { visible: [1] });
    expect(plain.nodes.some((n) => ['asset', 'property', 'wireless_network'].includes(n.type))).toBe(false);
    expect(plain.edges.some((e) => e.kind === 'transaction')).toBe(false);

    const full = await buildProjectGraph(fakeDb(data), 1, { visible: [1], include: ['asset', 'property', 'wireless_network', 'transactions'] });
    expect(edge(full, 'person:2', 'asset:20')).toMatchObject({ kind: 'holder', type: 'holds' });
    expect(edge(full, 'person:1', 'property:30')).toMatchObject({ type: 'owns_property' });
    expect(full.edges.filter((e) => e.target === 'wireless_network:40').map((e) => e.source).sort()).toEqual(['business:10', 'person:1', 'person:2']);
    expect(full.edges.filter((e) => e.kind === 'transaction')).toEqual([
      expect.objectContaining({ source: 'person:1', target: 'person:2', count: 2, transaction_types: ['gift', 'loan'] }),
    ]);
  });
});

describe('the graph around one entity', () => {
  const graph = {
    nodes: ['a', 'b', 'c', 'd', 'mail', 'e'].map((id) => ({ id, type: id === 'mail' ? 'identifier' : 'person' })),
    edges: [
      { source: 'a', target: 'b' }, { source: 'b', target: 'c' }, { source: 'c', target: 'd' },
      { source: 'a', target: 'mail' }, { source: 'e', target: 'mail' },
    ],
  };

  test('depth counts links; an identifier brings everyone who has it', () => {
    expect(ids(neighbourhood(graph, 'a', 1).nodes)).toEqual(['a', 'b', 'e', 'mail']);
    expect(ids(neighbourhood(graph, 'a', 2).nodes)).toEqual(['a', 'b', 'c', 'e', 'mail']);
    expect(neighbourhood(graph, 'a', 1).edges).toHaveLength(3);
  });

  test('buildFocusGraph includes every type', async () => {
    const db = fakeDb({
      people: [person(1, 'Frodo', 'Baggins', 1, { osint_data: [{ type: 'Phone', value: '123456' }] })],
      properties: [{ id: 30, name: 'Bag End', owner_person_id: 1, project_id: 1 }],
    });
    const g = await buildFocusGraph(db, 1, 'person:1', { visible: [1] });
    expect(ids(g.nodes)).toEqual(['identifier:phone:123456', 'person:1', 'property:30']);
  });
});
