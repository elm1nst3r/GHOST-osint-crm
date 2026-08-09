// File: backend/migrations/20260809000002_geocoding_cache_per_provider.js
//
// The geocoding cache was keyed on the address alone (issue #62).
//
// With a second provider selectable that breaks in two ways: a lookup for the
// newly-selected provider still returned the previous provider's coordinates —
// including the poor matches that prompted the switch — and once lookups were
// made provider-aware, the insert would collide on address_hash and overwrite
// the other provider's row without updating `provider`, so every lookup missed
// the cache forever and re-queried the API on every single request.
//
// Uniqueness therefore has to be (address_hash, provider).

exports.up = async function up(knex) {
  // Rows predating a provider column value are Nominatim results.
  await knex.raw(`UPDATE geocoding_cache SET provider = 'nominatim' WHERE provider IS NULL`);
  await knex.raw(`ALTER TABLE geocoding_cache ALTER COLUMN provider SET DEFAULT 'nominatim'`);
  await knex.raw(`ALTER TABLE geocoding_cache ALTER COLUMN provider SET NOT NULL`);

  // The original UNIQUE was created inline, so its constraint name is
  // generated. Drop whatever unique constraint covers address_hash alone.
  await knex.raw(`
    DO $$
    DECLARE conname TEXT;
    BEGIN
      SELECT c.conname INTO conname
      FROM pg_constraint c
      JOIN pg_class t ON t.oid = c.conrelid
      WHERE t.relname = 'geocoding_cache'
        AND c.contype = 'u'
        AND (SELECT COUNT(*) FROM unnest(c.conkey)) = 1
        AND c.conkey[1] = (
          SELECT attnum FROM pg_attribute
          WHERE attrelid = t.oid AND attname = 'address_hash'
        );
      IF conname IS NOT NULL THEN
        EXECUTE format('ALTER TABLE geocoding_cache DROP CONSTRAINT %I', conname);
      END IF;
    END $$;
  `);

  await knex.raw(`
    CREATE UNIQUE INDEX IF NOT EXISTS geocoding_cache_hash_provider_key
      ON geocoding_cache(address_hash, provider)
  `);
};

exports.down = async function down(knex) {
  await knex.raw(`DROP INDEX IF EXISTS geocoding_cache_hash_provider_key`);
  // Collapse back to one row per address before restoring the old constraint.
  await knex.raw(`
    DELETE FROM geocoding_cache a
    USING geocoding_cache b
    WHERE a.address_hash = b.address_hash AND a.id > b.id
  `);
  await knex.raw(`
    ALTER TABLE geocoding_cache ADD CONSTRAINT geocoding_cache_address_hash_key UNIQUE (address_hash)
  `);
};
