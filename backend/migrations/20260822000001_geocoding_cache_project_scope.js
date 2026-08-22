// File: backend/migrations/20260822000001_geocoding_cache_project_scope.js
//
// The geocoding cache was keyed on (address_hash, provider) only, with no
// notion of project (issue #83 follow-up, reported by hunterghoul1): geocode
// a given address while working Project A, and the same address looked up
// later from unrelated Project B returns Project A's cached result instead
// of re-resolving. Not a privacy boundary -- a geocode result is just
// "this address string resolves to these coordinates" from a public
// provider, nothing project-confidential leaks -- but it's a real
// data-quality bug: an address can legitimately mean something different
// (or simply have moved/changed) between two unrelated investigations.
//
// project_id is nullable rather than backfilled: existing cache rows have
// no recorded project, and guessing one would be worse than just letting
// them age out unused. Entity-save call sites (people/businesses/assets/
// properties/transactions) now always pass their project_id; the standalone
// /api/geocoding lookup tools intentionally still pass none and share an
// unscoped pool of rows, since they aren't tied to a specific investigation.
//
// NULLS NOT DISTINCT (PG15+) so repeated lookups of the same unscoped
// address still collide and update in place via ON CONFLICT, instead of
// piling up a fresh row per lookup.

exports.up = async function up(knex) {
  // Fresh installs have no geocoding_cache yet -- ImprovedGeocodingService
  // creates it lazily already in this shape.
  if (!(await knex.schema.hasTable('geocoding_cache'))) return;

  await knex.raw(`ALTER TABLE geocoding_cache ADD COLUMN IF NOT EXISTS project_id INTEGER REFERENCES projects(id) ON DELETE CASCADE`);

  await knex.raw(`DROP INDEX IF EXISTS geocoding_cache_hash_provider_key`);
  await knex.raw(`
    CREATE UNIQUE INDEX IF NOT EXISTS geocoding_cache_hash_provider_project_key
      ON geocoding_cache(address_hash, provider, project_id) NULLS NOT DISTINCT
  `);
  await knex.raw(`CREATE INDEX IF NOT EXISTS idx_geocoding_cache_project ON geocoding_cache(project_id)`);
};

exports.down = async function down(knex) {
  if (!(await knex.schema.hasTable('geocoding_cache'))) return;

  await knex.raw(`DROP INDEX IF EXISTS idx_geocoding_cache_project`);
  await knex.raw(`DROP INDEX IF EXISTS geocoding_cache_hash_provider_project_key`);
  // Collapse back to one row per (address_hash, provider) before restoring
  // the old constraint -- keep the most recently updated row.
  await knex.raw(`
    DELETE FROM geocoding_cache a
    USING geocoding_cache b
    WHERE a.address_hash = b.address_hash AND a.provider = b.provider
      AND (a.updated_at, a.id) < (b.updated_at, b.id)
  `);
  await knex.raw(`
    CREATE UNIQUE INDEX IF NOT EXISTS geocoding_cache_hash_provider_key
      ON geocoding_cache(address_hash, provider)
  `);
  await knex.raw(`ALTER TABLE geocoding_cache DROP COLUMN IF EXISTS project_id`);
};
