// File: backend/migrations/20261103000001_scratchpad.js
//
// Scratchpad: a small floating notepad, private to each user. It's for
// copy-pasting and quick notes while working, not long-term storage, so it is
// deliberately NOT project-scoped: the same notes follow the user across
// projects, and nobody else (admins included) can read them.
//
//   scratchpad_entries   one row per note (markdown), with where it was added
//   scratchpad_settings  that user's scratchpad preferences (on/off, colour,
//                        opacity, dock corner, ...) as JSON; no row = defaults

exports.up = async function up(knex) {
  await knex.raw(`
    CREATE TABLE IF NOT EXISTS scratchpad_entries (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      content TEXT NOT NULL,
      source_label VARCHAR(255),
      created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
    );
  `);
  await knex.raw(`CREATE INDEX IF NOT EXISTS idx_scratchpad_entries_user ON scratchpad_entries(user_id, created_at)`);

  await knex.raw(`
    CREATE TABLE IF NOT EXISTS scratchpad_settings (
      user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      settings JSONB NOT NULL DEFAULT '{}'::jsonb,
      updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
    );
  `);
};

exports.down = async function down(knex) {
  await knex.raw(`DROP TABLE IF EXISTS scratchpad_settings`);
  await knex.raw(`DROP TABLE IF EXISTS scratchpad_entries`);
};
