// File: backend/migrations/20261117000001_person_case_link.js
//
// Issue #118: people added to a case from Case Management got only case_id,
// people given a case in the person form got only case_name, and each kind of
// save cleared the other. The routes now keep both in step; this repairs the
// rows saved before that.

exports.up = async function up(knex) {
  // A name with no id: link it to the case of that name in the person's project.
  // Names that differ only in upper/lower case: the oldest case, as the routes pick.
  await knex.raw(`
    UPDATE people p SET case_id = (
      SELECT c.id FROM cases c
      WHERE c.project_id = p.project_id AND LOWER(c.case_name) = LOWER(p.case_name)
      ORDER BY c.id LIMIT 1
    )
    WHERE p.case_id IS NULL AND p.case_name IS NOT NULL AND p.case_name <> ''
      AND EXISTS (SELECT 1 FROM cases c WHERE c.project_id = p.project_id AND LOWER(c.case_name) = LOWER(p.case_name))
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
