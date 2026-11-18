// File: backend/utils/projectConsistency.js
// A case belongs to exactly one project (issue #83); an entity's case_id
// must belong to the same project the entity itself is being saved into.
// Deferred to the app layer rather than a DB constraint -- Postgres CHECK
// can't reference another table, and a trigger was more migration risk than
// the schema-landing phase needed. This is that deferred check.
const { pool } = require('../config/database');

// Returns null if case_id is unset or consistent with projectId; otherwise
// an error message safe to return to the client.
async function checkCaseProjectConsistency(caseId, projectId) {
  if (caseId == null) return null;
  const { rows } = await pool.query('SELECT project_id FROM cases WHERE id = $1', [caseId]);
  if (rows.length === 0) return `case_id ${caseId} not found`;
  if (rows[0].project_id !== projectId) {
    return `case_id ${caseId} belongs to a different project than project_id ${projectId}`;
  }
  return null;
}

// A person is linked to a case by case_id (the real link since issue #83)
// and also carries case_name, which lists and the person form show and edit.
// Case Management sets only case_id and the person form only case_name, so
// each used to wipe the other's link (issue #118). Resolves either into a
// matching pair: case_id wins; a name is matched to a case of the person's
// project (ignoring case); an unmatched name is kept as free text.
async function resolvePersonCase({ case_id, caseName }, projectId) {
  if (case_id != null) {
    const { rows } = await pool.query('SELECT case_name FROM cases WHERE id = $1', [case_id]);
    return { case_id, case_name: rows[0]?.case_name ?? null };
  }
  const name = typeof caseName === 'string' ? caseName.trim() : '';
  if (!name) return { case_id: null, case_name: null };
  const { rows } = await pool.query(
    'SELECT id, case_name FROM cases WHERE project_id = $1 AND LOWER(case_name) = LOWER($2) ORDER BY id LIMIT 1',
    [projectId, name]
  );
  return rows.length ? { case_id: rows[0].id, case_name: rows[0].case_name } : { case_id: null, case_name: name };
}

module.exports = { checkCaseProjectConsistency, resolvePersonCase };
