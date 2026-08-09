// File: backend/migrations/20260809000001_app_settings.js
//
// Server-side key/value settings (issue #62).
//
// App settings have lived in browser localStorage, which is fine for a display
// preference but useless for anything the backend needs — and a geocoding API
// key is used by the server, not the browser. This gives us somewhere to keep
// operator configuration that must outlive one browser profile.
//
// Values are stored as text; callers coerce. Secrets stored here are never
// returned to the client (see routes/settings.js — the API reports only
// whether a key is set).

exports.up = async function up(knex) {
  await knex.raw(`
    CREATE TABLE IF NOT EXISTS app_settings (
      key VARCHAR(100) PRIMARY KEY,
      value TEXT,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
};

exports.down = async function down(knex) {
  await knex.raw(`DROP TABLE IF EXISTS app_settings`);
};
