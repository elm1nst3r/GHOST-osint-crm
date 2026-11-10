// Links between people, businesses and crypto wallets that the database
// can't clean up by itself, because they have no foreign key (#112):
//   - relationships rows (source_type/source_id, target_type/target_id);
//   - businesses.employees[].person_id (JSON);
//   - wireless_networks.associated_person_ids / associated_business_ids.
// Everything else that points at these tables has ON DELETE SET NULL or
// CASCADE. Without this, deleting someone left "Unknown" connections behind,
// and a business whose employee pointed at a deleted person could no longer
// be saved ("person … not found").

const TYPES = new Set(['person', 'business', 'crypto_wallet']);

// Call in the same transaction as the DELETE of the entity itself.
async function removeEntityLinks(db, type, id) {
  if (!TYPES.has(type)) throw new Error(`unknown entity type ${type}`);
  await db.query(
    `DELETE FROM relationships
     WHERE (source_type = $1 AND source_id = $2) OR (target_type = $1 AND target_id = $2)`,
    [type, id]
  );
  if (type === 'person') {
    // The employee entry keeps its name; only the link to the person goes.
    await db.query(
      `UPDATE businesses SET employees = (
         SELECT jsonb_agg(CASE WHEN e->>'person_id' = $1::text THEN jsonb_set(e, '{person_id}', 'null') ELSE e END ORDER BY n)
         FROM jsonb_array_elements(employees) WITH ORDINALITY AS t(e, n))
       WHERE jsonb_typeof(employees) = 'array'
         AND EXISTS (SELECT 1 FROM jsonb_array_elements(employees) e WHERE e->>'person_id' = $1::text)`,
      [id]
    );
    await db.query(
      `UPDATE wireless_networks SET associated_person_ids = array_remove(associated_person_ids, $1::int)
       WHERE $1::int = ANY(associated_person_ids)`,
      [id]
    );
  }
  if (type === 'business') {
    await db.query(
      `UPDATE wireless_networks SET associated_business_ids = array_remove(associated_business_ids, $1::int)
       WHERE $1::int = ANY(associated_business_ids)`,
      [id]
    );
  }
}

// The same cleanup for everything at once, for links whose other end is
// already gone: after a project is deleted (links into it from other
// projects), and once by migration for leftovers of earlier deletes.
// No parameters, so the migration can run these statements as they are.
const ENTITY_EXISTS = (type, id) => `CASE ${type}
  WHEN 'person' THEN EXISTS (SELECT 1 FROM people WHERE id = ${id})
  WHEN 'business' THEN EXISTS (SELECT 1 FROM businesses WHERE id = ${id})
  WHEN 'crypto_wallet' THEN EXISTS (SELECT 1 FROM crypto_wallets WHERE id = ${id})
  ELSE TRUE END`;

const SWEEP_STATEMENTS = [
  `DELETE FROM relationships r
   WHERE NOT (${ENTITY_EXISTS('r.source_type', 'r.source_id')}) OR NOT (${ENTITY_EXISTS('r.target_type', 'r.target_id')})`,
  `UPDATE businesses b SET employees = (
     SELECT jsonb_agg(CASE WHEN e->>'person_id' IS NOT NULL AND e->>'person_id' <> 'null'
                            AND NOT EXISTS (SELECT 1 FROM people p WHERE p.id::text = e->>'person_id')
                       THEN jsonb_set(e, '{person_id}', 'null') ELSE e END ORDER BY n)
     FROM jsonb_array_elements(b.employees) WITH ORDINALITY AS t(e, n))
   WHERE jsonb_typeof(b.employees) = 'array' AND EXISTS (
     SELECT 1 FROM jsonb_array_elements(b.employees) e
     WHERE e->>'person_id' IS NOT NULL AND NOT EXISTS (SELECT 1 FROM people p WHERE p.id::text = e->>'person_id'))`,
  `UPDATE wireless_networks w SET associated_person_ids = ARRAY(
     SELECT x FROM unnest(w.associated_person_ids) WITH ORDINALITY AS t(x, n) WHERE EXISTS (SELECT 1 FROM people WHERE id = x) ORDER BY n)
   WHERE EXISTS (SELECT 1 FROM unnest(w.associated_person_ids) x WHERE NOT EXISTS (SELECT 1 FROM people WHERE id = x))`,
  `UPDATE wireless_networks w SET associated_business_ids = ARRAY(
     SELECT x FROM unnest(w.associated_business_ids) WITH ORDINALITY AS t(x, n) WHERE EXISTS (SELECT 1 FROM businesses WHERE id = x) ORDER BY n)
   WHERE EXISTS (SELECT 1 FROM unnest(w.associated_business_ids) x WHERE NOT EXISTS (SELECT 1 FROM businesses WHERE id = x))`,
];

async function sweepOrphanedLinks(db) {
  for (const sql of SWEEP_STATEMENTS) await db.query(sql);
}

module.exports = { removeEntityLinks, sweepOrphanedLinks, SWEEP_STATEMENTS };
