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

module.exports = { checkCaseProjectConsistency };
