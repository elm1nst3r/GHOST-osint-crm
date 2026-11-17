// File: backend/migrations/20261117000001_person_case_link.js
//
// Issue #118: people added to a case from Case Management got only case_id,
// people given a case in the person form got only case_name, and each kind of
// save cleared the other. The routes now keep both in step; this repairs the
// rows saved before that.

exports.up = async function up(knex) {
  // A name with no id: link it to the case of that name in the person's project.
  await knex.raw(`
    UPDATE people p SET case_id = c.id
    FROM cases c
    WHERE p.case_id IS NULL AND p.case_name IS NOT NULL AND p.case_name <> ''
      AND c.project_id = p.project_id AND LOWER(c.case_name) = LOWER(p.case_name)
  `);
  // An id: show that case's current name.
  await knex.raw(`
    UPDATE people p SET case_name = c.case_name
    FROM cases c
    WHERE p.case_id = c.id AND p.case_name IS DISTINCT FROM c.case_name
  `);
};

// Data repair only; nothing to undo.
exports.down = async function down() {};
