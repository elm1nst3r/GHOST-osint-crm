// File: backend/migrations/20261110000001_remove_orphaned_relationships.js
//
// Deleting a person, business or crypto wallet used to leave its
// relationships rows behind (they have no foreign keys: source/target are
// polymorphic), so everyone linked to it kept an "Unknown" connection. The
// delete routes now remove them (removeEntityRelationships in
// routes/relationships.js); this clears the ones left by earlier deletes,
// and unlinks business employee entries that still point at a deleted
// person, which made saving that business fail with "person not found".

const ENTITY_TABLES = { person: 'people', business: 'businesses', crypto_wallet: 'crypto_wallets' };

exports.up = async function up(knex) {
  for (const [type, table] of Object.entries(ENTITY_TABLES)) {
    for (const end of ['source', 'target']) {
      await knex.raw(`
        DELETE FROM relationships r
        WHERE r.${end}_type = ?
          AND NOT EXISTS (SELECT 1 FROM ${table} t WHERE t.id = r.${end}_id)
      `, [type]);
    }
  }

  await knex.raw(`
    UPDATE businesses b
    SET employees = (
      SELECT jsonb_agg(
        CASE WHEN (e->>'person_id') ~ '^\\d+$'
                  AND NOT EXISTS (SELECT 1 FROM people p WHERE p.id = (e->>'person_id')::int)
             THEN e || '{"person_id": null}'::jsonb
             ELSE e END)
      FROM jsonb_array_elements(b.employees) AS e
    )
    WHERE jsonb_typeof(b.employees) = 'array'
      AND EXISTS (
        SELECT 1 FROM jsonb_array_elements(b.employees) AS e
        WHERE (e->>'person_id') ~ '^\\d+$'
          AND NOT EXISTS (SELECT 1 FROM people p WHERE p.id = (e->>'person_id')::int)
      )
  `);
};

// Nothing to restore: the removed rows pointed at records that no longer exist.
exports.down = async function down() {};
