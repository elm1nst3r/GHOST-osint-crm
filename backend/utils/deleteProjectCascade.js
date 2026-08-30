// Cascade-delete every project-scoped row, then the project itself (issue #88).
//
// Before this, deleting a project with any data was refused outright and the
// operator had to hand-delete every entity first. This removes all of it in
// one transaction.
//
// Only project_id-bearing tables are listed here. Two related tables are left
// out on purpose because their FK already does the work:
//   - project_members    -> ON DELETE CASCADE
//   - geocoding_cache     -> project_id ON DELETE CASCADE
// audit_logs is deliberately NOT touched: it has no project_id and is an
// append-only trail; its entity_id references becoming dangling is expected.
//
// Every cross-entity FK among these tables is ON DELETE SET NULL or CASCADE
// (see the baseline migration), so the only constraint that actually blocks
// deletion is the NO ACTION project_id FK on the tables below — which is why
// they must all be cleared before the projects row. Delete order among them
// is therefore not constraint-critical; it's ordered child-ish -> parent-ish
// for readability, with `cases` last since many tables SET NULL to it.
const PROJECT_SCOPED_TABLES = [
  'relationships',
  'transactions',
  'travel_history',
  'wireless_networks',
  'assets',
  'properties',
  'crypto_wallets',
  'todos',
  'people',
  'businesses',
  'cases',
];

// Runs inside a caller-provided transaction client (so the route and the
// retention scheduler can each own their own BEGIN/COMMIT). Returns the
// deleted projects row, or null if no such project existed.
async function deleteProjectCascade(client, projectId) {
  for (const table of PROJECT_SCOPED_TABLES) {
    await client.query(`DELETE FROM ${table} WHERE project_id = $1`, [projectId]);
  }
  const result = await client.query('DELETE FROM projects WHERE id = $1 RETURNING *', [projectId]);
  return result.rows[0] || null;
}

// Per-table row counts for a project — powers the delete-confirmation dialog
// and the retention warning. Uses the same table list so it can't drift.
async function getProjectStats(db, projectId) {
  const counts = {};
  let total = 0;
  for (const table of PROJECT_SCOPED_TABLES) {
    const { rows } = await db.query(
      `SELECT COUNT(*)::int AS n FROM ${table} WHERE project_id = $1`,
      [projectId]
    );
    counts[table] = rows[0].n;
    total += rows[0].n;
  }
  return { counts, total };
}

module.exports = { deleteProjectCascade, getProjectStats, PROJECT_SCOPED_TABLES };
