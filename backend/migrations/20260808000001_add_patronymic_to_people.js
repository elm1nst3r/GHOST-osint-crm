// File: backend/migrations/20260808000001_add_patronymic_to_people.js
// Adds people.patronymic (issue #61). Russian, Ukrainian, Bulgarian and many
// other naming conventions treat the patronymic as a distinct name part rather
// than part of the given or family name, so folding it into first_name loses
// the structure and breaks sorting and search.
//
// Nullable with no default: existing rows simply have no patronymic, and
// full-name expressions skip it when it's absent.

exports.up = async function up(knex) {
  await knex.raw(`
    ALTER TABLE people
    ADD COLUMN IF NOT EXISTS patronymic VARCHAR(255)
  `);
  await knex.raw(`
    CREATE INDEX IF NOT EXISTS idx_people_patronymic ON people(patronymic)
  `);
};

exports.down = async function down(knex) {
  await knex.raw(`DROP INDEX IF EXISTS idx_people_patronymic`);
  await knex.raw(`ALTER TABLE people DROP COLUMN IF EXISTS patronymic`);
};
