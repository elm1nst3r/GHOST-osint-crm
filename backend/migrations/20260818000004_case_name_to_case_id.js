// File: backend/migrations/20260818000004_case_name_to_case_id.js
//
// Fourth step of project-based data isolation (issue #83). CaseManagement.js
// never actually used the case_id FK -- it grouped people by matching the
// free-text people.case_name string against cases.case_name. That's now
// fixed (see CaseManagement.js), so existing data needs a one-time cutover:
// wherever a person's case_name matches an existing case's case_name (within
// the same project -- guaranteed by construction, since both were backfilled
// onto the same Default Project), point people.case_id at that case.
//
// case_name itself is NOT cleared. Deprecated, not dropped: rows with no
// matching case keep case_id NULL (case is optional) and their case_name
// intact, consistent with how this repo handles disruptive field changes
// elsewhere (see the patronymic/validation-strip incident in CLAUDE.md --
// never silently discard data on a schema change).

exports.up = async function up(knex) {
  await knex.raw(`
    UPDATE people p
    SET case_id = c.id
    FROM cases c
    WHERE p.case_id IS NULL
      AND p.case_name IS NOT NULL
      AND p.case_name != ''
      AND c.case_name = p.case_name
      AND c.project_id = p.project_id
  `);
};

exports.down = async function down(knex) {
  // Not reversible in a meaningful sense (case_id may also have been set by
  // hand after this migration ran) -- no-op, matching this repo's convention
  // of not clearing data on down migrations it can't attribute cleanly.
};
