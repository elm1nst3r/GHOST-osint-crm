// The project graph (graph plan, phase 1): every entity of a project as a
// node and everything that ties them together as an edge, built in one place
// for the graph view and the MCP tools.
//
// Nodes: people, businesses, crypto wallets, assets, properties, wireless
// networks and identifiers (emails, phones, usernames, domains, URLs, IPs
// from OSINT entries and business contact fields). Ids are "<type>:<id>";
// identifiers are "identifier:<kind>:<normalised value>".
//
// Edges: relationships rows (people, businesses, wallets), business owners
// and employees (an employee that's only a name gets a faded edge when
// exactly one person in the project has that name), business ownership,
// asset holders (latest transaction), property owners, wireless network
// associations, transactions between two parties (combined per pair), and
// identifier edges.
//
// Access (#116): the project's own data, plus the far end of a link into
// another project only when the caller may see that project (`visible`;
// null = admin). Nothing else from another project appears, and an
// identifier only comes from entities the caller may see.
const { identifierOf, businessIdentifiers } = require('./identifiers');

const ENTITY_TYPES = ['person', 'business', 'crypto_wallet', 'asset', 'property', 'wireless_network'];
const OPTIONAL_TYPES = ['asset', 'property', 'wireless_network'];
const TABLES = {
  person: 'people', business: 'businesses', crypto_wallet: 'crypto_wallets',
  asset: 'assets', property: 'properties', wireless_network: 'wireless_networks',
};
const COLUMNS = {
  person: 'id, first_name, patronymic, last_name, aliases, category, status, case_id, project_id, osint_data, created_at, updated_at',
  business: 'id, name, type, industry, status, email, phone, website, owner_person_id, owner_business_id, employees, case_id, project_id, created_at, updated_at',
  crypto_wallet: 'id, label, address, network, status, case_id, project_id, created_at, updated_at',
  asset: 'id, name, category, status, case_id, project_id, created_at, updated_at',
  property: 'id, name, property_type, owner_person_id, case_id, project_id, created_at, updated_at',
  wireless_network: 'id, ssid, bssid, network_type, person_id, associated_person_ids, associated_business_ids, case_id, project_id, created_at, updated_at',
};

const nodeId = (type, id) => `${type}:${id}`;
const isVisible = (visible, projectId) => !visible || visible.includes(Number(projectId));
const personName = (p) => [p.first_name, p.patronymic, p.last_name].filter(Boolean).join(' ').trim();

// One node per entity row; what each type shows.
function entityNode(type, row, projectId) {
  const base = {
    id: nodeId(type, row.id), type, entity_id: row.id,
    project_id: row.project_id, case_id: row.case_id ?? null,
    status: row.status ?? null, created_at: row.created_at, updated_at: row.updated_at,
  };
  if (Number(row.project_id) !== Number(projectId)) base.foreign = true;
  switch (type) {
    case 'person':
      return {
        ...base, label: personName(row) || `#${row.id}`, category: row.category ?? null,
        first_name: row.first_name, patronymic: row.patronymic, last_name: row.last_name,
        aliases: row.aliases || [],
      };
    case 'business':
      return { ...base, label: row.name, category: row.type || row.industry || null };
    case 'crypto_wallet':
      return { ...base, label: row.label || row.address, address: row.address, category: row.network ?? null };
    case 'asset':
      return { ...base, label: row.name, category: row.category ?? null };
    case 'property':
      return { ...base, label: row.name, category: row.property_type ?? null };
    case 'wireless_network':
      return { ...base, label: row.ssid || row.bssid || `#${row.id}`, category: row.network_type ?? null };
    default:
      return { ...base, label: `#${row.id}` };
  }
}

class GraphBuilder {
  constructor(projectId, visible) {
    this.projectId = Number(projectId);
    this.visible = visible;
    this.nodes = new Map();
    this.edges = new Map();
  }

  addNode(node) {
    if (!this.nodes.has(node.id)) this.nodes.set(node.id, node);
  }

  // Same pair and type once: a business owner arrives both as the business's
  // owner_person_id and as the relationships row synced from it.
  addEdge(edge) {
    const key = `${edge.source}|${edge.target}|${edge.type}`;
    if (this.edges.has(key)) return;
    this.edges.set(key, { id: edge.id || `e:${this.edges.size + 1}`, ...edge });
  }
}

async function loadProjectRows(db, type, projectId) {
  const { rows } = await db.query(
    `SELECT ${COLUMNS[type]} FROM ${TABLES[type]} WHERE project_id = $1 ORDER BY id`, [projectId]);
  return rows;
}

// Rows of `type` by id, wherever they are; the caller decides what it may see.
async function loadRowsById(db, type, ids) {
  if (!ids.length) return [];
  const { rows } = await db.query(
    `SELECT ${COLUMNS[type]} FROM ${TABLES[type]} WHERE id = ANY($1::int[]) ORDER BY id`, [ids]);
  return rows;
}

// Builds the graph of one project.
// opts.include: optional types to add (asset, property, wireless_network,
//   transactions, identifiers); people, businesses and wallets always come.
// opts.identifiers: 'shared' (only identifiers two or more entities have,
//   the default) or 'all'.
async function buildProjectGraph(db, projectId, { visible = null, include = [], identifiers = 'shared' } = {}) {
  const g = new GraphBuilder(projectId, visible);
  const want = new Set(include);
  const types = ENTITY_TYPES.filter((t) => !OPTIONAL_TYPES.includes(t) || want.has(t));

  const rows = {};
  for (const type of types) {
    rows[type] = await loadProjectRows(db, type, projectId);
    rows[type].forEach((r) => g.addNode(entityNode(type, r, projectId)));
  }

  // A link may lead out of the project: that end is added when visible.
  const pending = new Map(); // type → Set of ids not loaded yet
  const ref = (type, id) => {
    if (id == null) return null;
    const key = nodeId(type, id);
    if (!g.nodes.has(key)) {
      if (!pending.has(type)) pending.set(type, new Set());
      pending.get(type).add(Number(id));
    }
    return key;
  };
  const edgesWaiting = [];
  const link = (edge) => edgesWaiting.push(edge);

  // Relationships rows touching this project's people, businesses or wallets.
  const { rows: rels } = await db.query(
    `WITH ents AS (
       SELECT 'person'::text AS t, id FROM people WHERE project_id = $1
       UNION ALL SELECT 'business', id FROM businesses WHERE project_id = $1
       UNION ALL SELECT 'crypto_wallet', id FROM crypto_wallets WHERE project_id = $1)
     SELECT r.id, r.project_id, r.source_type, r.source_id, r.target_type, r.target_id, r.relationship_type, r.note, r.created_at
     FROM relationships r
     WHERE r.project_id = $1
        OR (r.source_type, r.source_id) IN (SELECT t, id FROM ents)
        OR (r.target_type, r.target_id) IN (SELECT t, id FROM ents)
     ORDER BY r.id`, [projectId]);
  for (const r of rels) {
    if (!isVisible(visible, r.project_id)) continue;
    link({
      id: `relationship:${r.id}`, kind: 'relationship', relationship_id: r.id,
      source: ref(r.source_type, r.source_id), target: ref(r.target_type, r.target_id),
      type: r.relationship_type, note: r.note, created_at: r.created_at,
    });
  }

  // Businesses: owner, owning business, employees.
  const peopleByName = new Map();
  for (const p of rows.person) {
    const name = personName(p).toLowerCase();
    if (name) peopleByName.set(name, peopleByName.has(name) ? null : p.id); // null = ambiguous
  }
  for (const b of rows.business) {
    const me = nodeId('business', b.id);
    if (b.owner_person_id) link({ kind: 'relationship', source: me, target: ref('person', b.owner_person_id), type: 'owner' });
    if (b.owner_business_id) link({ kind: 'relationship', source: ref('business', b.owner_business_id), target: me, type: 'owns_business' });
    for (const e of Array.isArray(b.employees) ? b.employees : []) {
      if (!e) continue;
      const type = e.is_decision_maker ? 'board_member' : 'employee';
      if (e.person_id != null) {
        link({ kind: 'relationship', source: me, target: ref('person', e.person_id), type, note: e.role || null });
      } else if (e.name) {
        const match = peopleByName.get(String(e.name).trim().toLowerCase());
        if (match) {
          link({ kind: 'relationship', source: me, target: nodeId('person', match), type, note: e.role || null, matched_by_name: true });
        }
      }
    }
  }

  // Assets: whoever the latest transaction handed them to.
  if (rows.asset) {
    const { rows: holders } = await db.query(
      `SELECT a.id, lt.to_person_id, lt.to_business_id, lt.occurred_on
       FROM assets a JOIN LATERAL (
         SELECT tx.to_person_id, tx.to_business_id, tx.occurred_on FROM transactions tx
         WHERE tx.subject_asset_id = a.id
         ORDER BY tx.occurred_on DESC NULLS LAST, tx.id DESC LIMIT 1) lt ON true
       WHERE a.project_id = $1`, [projectId]);
    for (const h of holders) {
      const holder = h.to_person_id ? ref('person', h.to_person_id) : h.to_business_id ? ref('business', h.to_business_id) : null;
      if (holder) link({ kind: 'holder', source: holder, target: nodeId('asset', h.id), type: 'holds', last_at: h.occurred_on });
    }
  }

  // Properties: their owner.
  for (const p of rows.property || []) {
    if (p.owner_person_id) link({ kind: 'relationship', source: ref('person', p.owner_person_id), target: nodeId('property', p.id), type: 'owns_property' });
  }

  // Wireless networks: who they're tied to.
  for (const w of rows.wireless_network || []) {
    const me = nodeId('wireless_network', w.id);
    const people = new Set([...(w.associated_person_ids || []), ...(w.person_id ? [w.person_id] : [])].map(Number));
    people.forEach((pid) => link({ kind: 'association', source: ref('person', pid), target: me, type: 'uses_network' }));
    (w.associated_business_ids || []).forEach((bid) => link({ kind: 'association', source: ref('business', bid), target: me, type: 'uses_network' }));
  }

  // Transactions between two parties, one edge per direction and pair.
  if (want.has('transactions')) {
    const party = (dir) => `CASE WHEN ${dir}_person_id IS NOT NULL THEN 'person:' || ${dir}_person_id
      WHEN ${dir}_business_id IS NOT NULL THEN 'business:' || ${dir}_business_id
      WHEN ${dir}_wallet_id IS NOT NULL THEN 'crypto_wallet:' || ${dir}_wallet_id END`;
    const { rows: pairs } = await db.query(
      `SELECT src, dst, COUNT(*)::int AS count, MIN(occurred_on) AS first_at, MAX(occurred_on) AS last_at,
              ARRAY_AGG(DISTINCT transaction_type ORDER BY transaction_type) AS transaction_types
       FROM (SELECT ${party('from')} AS src, ${party('to')} AS dst, occurred_on, transaction_type
             FROM transactions WHERE project_id = $1) x
       WHERE src IS NOT NULL AND dst IS NOT NULL
       GROUP BY src, dst ORDER BY src, dst`, [projectId]);
    for (const p of pairs) {
      const [st, sid] = p.src.split(':');
      const [tt, tid] = p.dst.split(':');
      link({
        kind: 'transaction', source: ref(st, sid), target: ref(tt, tid), type: 'transaction',
        count: p.count, first_at: p.first_at, last_at: p.last_at, transaction_types: p.transaction_types,
      });
    }
  }

  // Load the far ends that lie outside the project; keep the visible ones.
  for (const [type, ids] of pending) {
    if (!TABLES[type]) continue;
    for (const row of await loadRowsById(db, type, [...ids])) {
      if (isVisible(visible, row.project_id)) g.addNode(entityNode(type, row, projectId));
    }
  }
  for (const e of edgesWaiting) {
    if (e.source && e.target && e.source !== e.target && g.nodes.has(e.source) && g.nodes.has(e.target)) g.addEdge(e);
  }

  // Identifiers of every visible person and business in the graph.
  if (want.has('identifiers')) {
    const holders = new Map(); // identifier id → { node, holders: Set }
    const add = (entityKey, found) => {
      const id = `identifier:${found.kind}:${found.key}`;
      if (!holders.has(id)) {
        holders.set(id, { node: { id, type: 'identifier', kind: found.kind, label: found.value, key: found.key }, holders: new Set() });
      }
      holders.get(id).holders.add(entityKey);
    };
    const people = rows.person.concat(await foreignRows(db, g, 'person'));
    for (const p of people) {
      for (const entry of Array.isArray(p.osint_data) ? p.osint_data : []) {
        const found = entry && identifierOf(entry.type, entry.value);
        if (found) add(nodeId('person', p.id), found);
      }
    }
    const businesses = rows.business.concat(await foreignRows(db, g, 'business'));
    for (const b of businesses) businessIdentifiers(b).forEach((found) => add(nodeId('business', b.id), found));

    for (const { node, holders: hs } of holders.values()) {
      if (identifiers !== 'all' && hs.size < 2) continue;
      g.addNode(node);
      hs.forEach((h) => g.addEdge({ kind: 'identifier', source: h, target: node.id, type: 'identifier', identifier_kind: node.kind }));
    }
  }

  const degree = new Map();
  for (const e of g.edges.values()) {
    degree.set(e.source, (degree.get(e.source) || 0) + 1);
    degree.set(e.target, (degree.get(e.target) || 0) + 1);
  }
  const nodes = [...g.nodes.values()].map((n) => ({ ...n, degree: degree.get(n.id) || 0 }));
  return { nodes, edges: [...g.edges.values()] };
}

// Full rows (with osint_data / contact fields) of the foreign people or
// businesses already in the graph, for their identifiers.
async function foreignRows(db, g, type) {
  const ids = [...g.nodes.values()].filter((n) => n.type === type && n.foreign).map((n) => n.entity_id);
  return loadRowsById(db, type, ids);
}

// The neighbourhood of one entity: everything within `depth` links, of every
// type. Identifiers pass through: reaching one also brings in everyone else
// who has it, so "who shares this phone" needs no extra hop.
function neighbourhood(graph, focusId, depth = 1) {
  const adjacent = new Map();
  for (const e of graph.edges) {
    if (!adjacent.has(e.source)) adjacent.set(e.source, []);
    if (!adjacent.has(e.target)) adjacent.set(e.target, []);
    adjacent.get(e.source).push(e.target);
    adjacent.get(e.target).push(e.source);
  }
  const types = new Map(graph.nodes.map((n) => [n.id, n.type]));
  const keep = new Set([focusId]);
  let frontier = [focusId];
  for (let d = 0; d < depth && frontier.length; d += 1) {
    const next = [];
    for (const id of frontier) {
      for (const other of adjacent.get(id) || []) {
        if (keep.has(other)) continue;
        keep.add(other);
        next.push(other);
        if (types.get(other) === 'identifier') {
          (adjacent.get(other) || []).forEach((holder) => keep.add(holder));
        }
      }
    }
    frontier = next;
  }
  return {
    nodes: graph.nodes.filter((n) => keep.has(n.id)),
    edges: graph.edges.filter((e) => keep.has(e.source) && keep.has(e.target)),
  };
}

// The graph around one entity: its project with every type and identifier,
// cut down to the neighbourhood. Degrees stay those of the whole project.
async function buildFocusGraph(db, projectId, focusId, { visible = null, depth = 1 } = {}) {
  const full = await buildProjectGraph(db, projectId, {
    visible, include: [...OPTIONAL_TYPES, 'transactions', 'identifiers'], identifiers: 'all',
  });
  return neighbourhood(full, focusId, depth);
}

module.exports = {
  ENTITY_TYPES, OPTIONAL_TYPES, TABLES, nodeId,
  buildProjectGraph, buildFocusGraph, neighbourhood,
};
