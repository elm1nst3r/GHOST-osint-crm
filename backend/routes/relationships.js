// File: backend/routes/relationships.js
// Real CRUD over the `relationships` table (issue #83), replacing the dead
// entityNetwork.js JSONB-scanning endpoints. `people.connections` /
// `businesses.employees` stay the read-time computed view for backward
// compatibility with existing frontend consumers — this route is the
// write-of-record and the one place cross-project-link enforcement lives.
const express = require('express');
const router = express.Router();
const { pool } = require('../config/database');
const { requireAuth } = require('../middleware/auth');
const { validateIdParam } = require('../middleware/validation');
const { validate, RelationshipCreateSchema, RelationshipUpdateSchema } = require('../middleware/schemas');
const { apiLimiter } = require('../middleware/rateLimiters');
const { applyProjectScope, requireProjectMember } = require('../utils/projectAccess');
const { inTransaction } = require('../utils/transaction');

const ENTITY_TABLE = { person: 'people', business: 'businesses', crypto_wallet: 'crypto_wallets' };

async function fetchEntityProject(entityType, entityId) {
  const table = ENTITY_TABLE[entityType];
  const { rows } = await pool.query(`SELECT project_id FROM ${table} WHERE id = $1`, [entityId]);
  return rows[0]?.project_id ?? null;
}

// Shared by POST / and the sync helpers below -- a relationship whose two
// endpoints are in different projects is only allowed if the relationship's
// own project has allow_cross_linking on. Throws (with a 409 statusCode) so
// the caller's request fails loudly instead of silently dropping the link.
async function assertLinkAllowed(relationshipProjectId, sourceProjectId, targetProjectId) {
  if (sourceProjectId === targetProjectId) return;
  const { rows } = await pool.query('SELECT allow_cross_linking FROM projects WHERE id = $1', [relationshipProjectId]);
  if (!rows[0] || !rows[0].allow_cross_linking) {
    const err = new Error('Cannot link entities from different projects unless the project has allow_cross_linking enabled');
    err.statusCode = 409;
    throw err;
  }
}

// Converges a person's person->person relationship rows to match an incoming
// `connections` array (issue #83's replacement for the old person.connections
// JSONB write path). Full replace rather than a field-by-field diff: simpler,
// and GET always recomputes `connections` from these rows anyway, so there's
// no externally-visible identity to preserve across an edit.
// `options.assertMember(projectId)` (async, throws on refusal) guards the
// two-way rows, which are written into the OTHER person's project: the
// caller is only known to be a member of this person's project. Returns the
// connections added back on other people, for their audit history.
async function syncPersonConnections(personId, projectId, caseId, connections, options = {}) {
  const typeOf = (value) => (typeof value === 'string' && value.trim() ? value.slice(0, 100) : null);
  const desired = (Array.isArray(connections) ? connections : [])
    .filter((c) => c && c.person_id != null)
    .map((c) => ({
      target_id: parseInt(c.person_id, 10),
      relationship_type: c.type || 'other',
      note: c.note || null,
      // Transient, never stored on the row: "two-way" asks for the other
      // person to get a connection back to this one, if they have none yet.
      mutual: c.mutual === true,
      reverse_type: typeOf(c.reverse_type) || typeOf(c.type) || 'other',
    }));

  // Cross-project check per target, same rule as POST /relationships -- this
  // is the write path AddEditPersonForm actually uses, so skipping it here
  // would let a deep-linked out-of-project edit bypass allow_cross_linking
  // entirely (issue #83 follow-up). All checks run before any write.
  const targets = new Map();
  for (const c of desired) {
    const { rows } = await pool.query('SELECT project_id, case_id FROM people WHERE id = $1', [c.target_id]);
    if (rows.length === 0) {
      const err = new Error(`person ${c.target_id} not found`);
      err.statusCode = 404;
      throw err;
    }
    targets.set(c.target_id, rows[0]);
    await assertLinkAllowed(projectId, projectId, rows[0].project_id);
    if (c.mutual && c.target_id !== personId) {
      // The reverse row belongs to the other person's project, so it is that
      // project's allow_cross_linking that decides whether it may exist, and
      // the caller must be allowed to write there.
      await assertLinkAllowed(rows[0].project_id, rows[0].project_id, projectId);
      if (options.assertMember) await options.assertMember(rows[0].project_id);
    }
  }

  // One transaction: a failed insert must not leave the person with their
  // connections deleted and only half re-added.
  return inTransaction(async (client) => {
    await client.query(
      `DELETE FROM relationships WHERE source_type = 'person' AND source_id = $1 AND target_type = 'person'`,
      [personId]
    );

    for (const c of desired) {
      await client.query(
        `INSERT INTO relationships (project_id, case_id, source_type, source_id, target_type, target_id, relationship_type, note)
         VALUES ($1, $2, 'person', $3, 'person', $4, $5, $6)`,
        [projectId, caseId || null, personId, c.target_id, c.relationship_type, c.note]
      );
    }

    // Only adds: an existing connection back (of any type) is left as it is,
    // and the other person's connections are never removed from here.
    const addedBack = [];
    for (const c of desired) {
      if (!c.mutual || c.target_id === personId) continue;
      const target = targets.get(c.target_id);
      const { rowCount } = await client.query(
        `INSERT INTO relationships (project_id, case_id, source_type, source_id, target_type, target_id, relationship_type, note)
         SELECT $1, $2, 'person', $3, 'person', $4, $5, $6
         WHERE NOT EXISTS (
           SELECT 1 FROM relationships
           WHERE source_type = 'person' AND source_id = $3 AND target_type = 'person' AND target_id = $4
         )`,
        [target.project_id, target.case_id || null, c.target_id, personId, c.reverse_type, c.note]
      );
      if (rowCount > 0) addedBack.push({ person_id: c.target_id, connection: { person_id: personId, type: c.reverse_type, note: c.note } });
    }
    return addedBack;
  });
}

// Same idea for a business's owner_person_id / employees (person_id-backed
// only, matching the Phase 3 migration's rule) -- keeps relationships
// current for businesses created/edited after that one-time migration, not
// just the ones it covered historically.
//
// owner_business_id is NOT synced by syncBusinessRelationships below. Phase
// 3's migration stores that edge owner -> owned (source = the owning
// business, target = this one), i.e. NOT rooted at this business, so it
// can't be converged by a "delete everything sourced from me, reinsert" pass
// scoped to this business. syncBusinessOwnership (further down) handles it
// separately, keyed on the specific old/new owner rather than a full
// converge, since a delete-and-reinsert scoped to the owner would also wipe
// out that owner's edges to any OTHER businesses it owns.
async function syncBusinessRelationships(businessId, projectId, caseId, { ownerPersonId, employees }) {
  const desired = [];
  if (ownerPersonId) desired.push({ target_type: 'person', target_id: parseInt(ownerPersonId, 10), relationship_type: 'owner', note: null });
  for (const e of Array.isArray(employees) ? employees : []) {
    if (e && e.person_id != null) {
      desired.push({
        target_type: 'person',
        target_id: parseInt(e.person_id, 10),
        relationship_type: e.is_decision_maker ? 'board_member' : 'employee',
        note: e.role || null,
      });
    }
  }

  // Same cross-project guard as syncPersonConnections -- checked before any
  // DELETE so a rejected save doesn't lose existing relationships.
  for (const d of desired) {
    const targetProjectId = await fetchEntityProject(d.target_type, d.target_id);
    if (targetProjectId === null) {
      const err = new Error(`${d.target_type} ${d.target_id} not found`);
      err.statusCode = 404;
      throw err;
    }
    await assertLinkAllowed(projectId, projectId, targetProjectId);
  }

  // Scoped to the relationship_types this function manages, not every row
  // sourced from this business -- a relationship created directly through
  // POST /relationships (any other type) must survive a businesses.js edit.
  await pool.query(
    `DELETE FROM relationships
     WHERE source_type = 'business' AND source_id = $1
       AND target_type = 'person' AND relationship_type IN ('owner', 'employee', 'board_member')`,
    [businessId]
  );

  for (const d of desired) {
    await pool.query(
      `INSERT INTO relationships (project_id, case_id, source_type, source_id, target_type, target_id, relationship_type, note)
       VALUES ($1, $2, 'business', $3, $4, $5, $6, $7)`,
      [projectId, caseId || null, businessId, d.target_type, d.target_id, d.relationship_type, d.note]
    );
  }
}

// Keeps the business->business ownership edge (source = the OWNING
// business, target = businessId) live across create/update, closing the gap
// left by Phase 3's migration (which produced correct rows once, but nothing
// kept them current afterward -- see the comment above
// syncBusinessRelationships). Deletes the specific prior edge by its old
// owner (if any) and inserts the new one (if any) rather than converging a
// set, since the edge isn't sourced from businessId. oldOwnerBusinessId /
// newOwnerBusinessId may be null, string, or number -- both sides are
// normalized before comparing so a no-op update (unchanged owner) doesn't
// do a pointless delete+reinsert.
async function syncBusinessOwnership(businessId, projectId, caseId, oldOwnerBusinessId, newOwnerBusinessId) {
  const oldOwner = oldOwnerBusinessId != null ? parseInt(oldOwnerBusinessId, 10) : null;
  const newOwner = newOwnerBusinessId != null ? parseInt(newOwnerBusinessId, 10) : null;
  if (oldOwner === newOwner) return;

  if (oldOwner != null) {
    await pool.query(
      `DELETE FROM relationships
       WHERE source_type = 'business' AND source_id = $1
         AND target_type = 'business' AND target_id = $2 AND relationship_type = 'owner'`,
      [oldOwner, businessId]
    );
  }

  if (newOwner != null) {
    const ownerProjectId = await fetchEntityProject('business', newOwner);
    if (ownerProjectId === null) {
      const err = new Error(`business ${newOwner} not found`);
      err.statusCode = 404;
      throw err;
    }
    await assertLinkAllowed(projectId, projectId, ownerProjectId);
    await pool.query(
      `INSERT INTO relationships (project_id, case_id, source_type, source_id, target_type, target_id, relationship_type, note)
       VALUES ($1, $2, 'business', $3, 'business', $4, 'owner', NULL)`,
      [projectId, caseId || null, newOwner, businessId]
    );
  }
}

// Relationship rows have no foreign keys (source/target are polymorphic), so
// deleting a person, business or wallet must remove the rows that name it
// at either end itself -- left behind, they show as "Unknown" connections
// on everyone linked to it. Call it with the transaction client that runs
// the entity's own DELETE so both happen or neither does.
async function removeEntityRelationships(db, entityType, entityId) {
  await db.query(
    `DELETE FROM relationships
     WHERE (source_type = $1 AND source_id = $2) OR (target_type = $1 AND target_id = $2)`,
    [entityType, entityId]
  );
  if (entityType === 'person') {
    // businesses.employees is still the business form's own list: keep the
    // entry (name, role, ...) but drop the link to the deleted person, as a
    // name-only employee. A dangling person_id would make every later save
    // of that business fail with "person not found".
    await db.query(
      `UPDATE businesses
       SET employees = (
         SELECT jsonb_agg(CASE WHEN e->>'person_id' = $1::text THEN e || '{"person_id": null}'::jsonb ELSE e END)
         FROM jsonb_array_elements(employees) AS e
       )
       WHERE jsonb_typeof(employees) = 'array'
         AND EXISTS (SELECT 1 FROM jsonb_array_elements(employees) AS e WHERE e->>'person_id' = $1::text)`,
      [String(entityId)]
    );
  }
}

router.use(apiLimiter);

// GET /?source_type=&source_id=&target_type=&target_id=&project_id=&case_id=
router.get('/', requireAuth, async (req, res) => {
  try {
    const where = [];
    const params = [];
    const add = (clause, value) => { params.push(value); where.push(clause.replace('?', `$${params.length}`)); };

    if (req.query.source_type) add('source_type = ?', req.query.source_type);
    if (req.query.source_id) add('source_id = ?', parseInt(req.query.source_id, 10));
    if (req.query.target_type) add('target_type = ?', req.query.target_type);
    if (req.query.target_id) add('target_id = ?', parseInt(req.query.target_id, 10));
    const scopeErr = await applyProjectScope(req, 'relationships', where, params);
    if (scopeErr) return res.status(403).json({ error: scopeErr });
    if (req.query.case_id) add('case_id = ?', parseInt(req.query.case_id, 10));

    const sql = `SELECT * FROM relationships${where.length ? ' WHERE ' + where.join(' AND ') : ''} ORDER BY created_at DESC, id DESC`;
    const result = await pool.query(sql, params);
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching relationships:', err);
    res.status(500).json({ error: 'Failed to fetch relationships' });
  }
});

router.post('/', requireAuth, validate(RelationshipCreateSchema), async (req, res) => {
  const { project_id, case_id, source_type, source_id, target_type, target_id, relationship_type, note } = req.body;

  const accessErr = await requireProjectMember(req, project_id);
  if (accessErr) return res.status(403).json({ error: accessErr });

  try {
    const [sourceProjectId, targetProjectId] = await Promise.all([
      fetchEntityProject(source_type, source_id),
      fetchEntityProject(target_type, target_id),
    ]);
    if (sourceProjectId === null) return res.status(404).json({ error: `${source_type} ${source_id} not found` });
    if (targetProjectId === null) return res.status(404).json({ error: `${target_type} ${target_id} not found` });

    await assertLinkAllowed(project_id, sourceProjectId, targetProjectId);

    const result = await pool.query(
      `INSERT INTO relationships (project_id, case_id, source_type, source_id, target_type, target_id, relationship_type, note)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [project_id, case_id || null, source_type, source_id, target_type, target_id, relationship_type, note || null]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    if (err.statusCode) return res.status(err.statusCode).json({ error: err.message });
    console.error('Error creating relationship:', err);
    res.status(500).json({ error: 'Failed to create relationship' });
  }
});

// Changes only the fields sent: a client editing the type doesn't need to
// know the case or note, and leaving them out must not clear them (#109).
router.put('/:id', requireAuth, validateIdParam, validate(RelationshipUpdateSchema), async (req, res) => {
  const { case_id, relationship_type, note } = req.body;
  const sent = (key) => Object.prototype.hasOwnProperty.call(req.body, key);

  try {
    const existing = await pool.query('SELECT project_id FROM relationships WHERE id = $1', [req.params.id]);
    if (existing.rows.length === 0) return res.status(404).json({ error: 'Relationship not found' });
    const accessErr = await requireProjectMember(req, existing.rows[0].project_id);
    if (accessErr) return res.status(403).json({ error: accessErr });

    const result = await pool.query(
      `UPDATE relationships SET
         case_id = CASE WHEN $1 THEN $2::int ELSE case_id END,
         relationship_type = $3,
         note = CASE WHEN $4 THEN $5 ELSE note END
       WHERE id = $6 RETURNING *`,
      [sent('case_id'), case_id || null, relationship_type, sent('note'), note || null, req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Relationship not found' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error updating relationship:', err);
    res.status(500).json({ error: 'Failed to update relationship' });
  }
});

router.delete('/:id', requireAuth, validateIdParam, async (req, res) => {
  try {
    const existing = await pool.query('SELECT project_id FROM relationships WHERE id = $1', [req.params.id]);
    if (existing.rows.length === 0) return res.status(404).json({ error: 'Relationship not found' });
    const accessErr = await requireProjectMember(req, existing.rows[0].project_id);
    if (accessErr) return res.status(403).json({ error: accessErr });

    const result = await pool.query('DELETE FROM relationships WHERE id = $1 RETURNING *', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Relationship not found' });
    res.json({ message: 'Relationship deleted successfully' });
  } catch (err) {
    console.error('Error deleting relationship:', err);
    res.status(500).json({ error: 'Failed to delete relationship' });
  }
});

module.exports = router;
module.exports.syncPersonConnections = syncPersonConnections;
module.exports.syncBusinessRelationships = syncBusinessRelationships;
module.exports.syncBusinessOwnership = syncBusinessOwnership;
module.exports.removeEntityRelationships = removeEntityRelationships;
