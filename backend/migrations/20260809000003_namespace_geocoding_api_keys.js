// File: backend/migrations/20260809000003_namespace_geocoding_api_keys.js
//
// v2.13.0 stored the Yandex key under the one-off setting name
// `geocoding_yandex_api_key`. Adding a third provider made that pattern
// untenable, so keys are now namespaced as `geocoding_api_key_<provider>`.
//
// Anyone who configured Yandex on v2.13.0 would otherwise silently lose their
// key on upgrade — the provider would stay selected, quietly fall back to
// Nominatim, and they'd be left wondering why results got worse.

exports.up = async function up(knex) {
  await knex.raw(`
    UPDATE app_settings
    SET key = 'geocoding_api_key_yandex'
    WHERE key = 'geocoding_yandex_api_key'
      AND NOT EXISTS (SELECT 1 FROM app_settings WHERE key = 'geocoding_api_key_yandex')
  `);
  // If both somehow exist, the new one wins and the stale row goes.
  await knex.raw(`DELETE FROM app_settings WHERE key = 'geocoding_yandex_api_key'`);
};

exports.down = async function down(knex) {
  await knex.raw(`
    UPDATE app_settings
    SET key = 'geocoding_yandex_api_key'
    WHERE key = 'geocoding_api_key_yandex'
  `);
};
