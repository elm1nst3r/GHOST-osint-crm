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
const { reverseConnectionType } = require('../utils/connectionTypes');

const ENTITY_TABLE = { person: 'people', business: 'businesses', crypto_wallet: 'crypto_wallets' };

async function fetchEntityProject(entityType, entityId, db = pool) {
  const table = ENTITY_TABLE[entityType];
  const { rows } = await db.query(`SELECT project_id FROM ${table} WHERE id = $1`, [entityId]);
  return rows[0]?.project_id ?? null;
}

// Shared by POST / and the sync helpers below -- a relationship whose two
// endpoints are in different projects is only allowed if the relationship's
// own project has allow_cross_linking on. Throws (with a 409 statusCode) so
// the caller's request fails loudly instead of silently dropping the link.
async function assertLinkAllowed(relationshipProjectId, sourceProjectId, targetProjectId, db = pool) {
  if (sourceProjectId === targetProjectId) return;
  const { rows } = await db.query('SELECT allow_cross_linking FROM projects WHERE id = $1', [relationshipProjectId]);
  if (!rows[0] || !rows[0].allow_cross_linking) {
    const err = new Error('Cannot link entities from different projects unless the project has allow_cross_linking enabled');
    err.statusCode = 409;
    throw err;
  }
}

// A link from a record in projectId to type/id: the target must exist and be
// in projectId, or, with allow_cross_linking on, in another project. With
// `canSee` (the caller's membership check: error text or null), a target in
// a project the caller can't see reads as "not found", like a missing one,
// so a member of one project can't link to, and read back, another
// project's people (#116). Targets in `stored` (already linked from this
// record) skip that check: an edit sends every link back, including ones a
// colleague made.
async function checkLinkTarget(type, id, projectId, db = pool, canSee = null, stored = new Set()) {
  const targetProjectId = await fetchEntityProject(type, id, db);
  const notFound = () => Object.assign(new Error(`${type} ${id} not found`), { statusCode: 404 });
  if (targetProjectId === null) throw notFound();
  if (targetProjectId !== Number(projectId) && canSee && !stored.has(Number(id)) && await canSee(targetProjectId)) throw notFound();
  await assertLinkAllowed(projectId, projectId, targetProjectId, db);
}

async function storedTargets(db, sourceType, sourceId, targetType, types = null) {
  const { rows } = await db.query(
    `SELECT target_id FROM relationships WHERE source_type = $1 AND source_id = $2 AND target_type = $3
     ${types ? 'AND relationship_type = ANY($4)' : ''}`,
    types ? [sourceType, sourceId, targetType, types] : [sourceType, sourceId, targetType]);
  return new Set(rows.map((r) => Number(r.target_id)));
}

// Converges a person's person->person relationship rows to match an incoming
// `connections` array (issue #83's replacement for the old person.connections
// JSONB write path). Full replace rather than a field-by-field diff: simpler,
// and GET always recomputes `connections` from these rows anyway, so there's
// no externally-visible identity to preserve across an edit.
// `db` is the caller's transaction client, so the person's own update and
// this replace commit or roll back together.
async function syncPersonConnections(personId, projectId, caseId, connections, db = pool, canSee = null) {
  const desired = (Array.isArray(connections) ? connections : [])
    .filter((c) => c && c.person_id != null)
    .map((c) => ({
      target_id: parseInt(c.person_id, 10),
      relationship_type: c.type || 'other',
      note: c.note || null,
    }));

  // Cross-project check per target, same rule as POST /relationships -- this
  // is the write path AddEditPersonForm actually uses, so skipping it here
  // would let a deep-linked out-of-project edit bypass allow_cross_linking
  // entirely (issue #83 follow-up).
  const stored = canSee ? await storedTargets(db, 'person', personId, 'person') : new Set();
  for (const c of desired) {
    await checkLinkTarget('person', c.target_id, projectId, db, canSee, stored);
  }

  await db.query(
    `DELETE FROM relationships WHERE source_type = 'person' AND source_id = $1 AND target_type = 'person'`,
    [personId]
  );

  for (const c of desired) {
    await db.query(
      `INSERT INTO relationships (project_id, case_id, source_type, source_id, target_type, target_id, relationship_type, note)
       VALUES ($1, $2, 'person', $3, 'person', $4, $5, $6)`,
      [projectId, caseId || null, personId, c.target_id, c.relationship_type, c.note]
    );
  }
}

// Two-way connections (#112): ticking "two-way" on A's connection to B also
// records B's connection to A, read from B's side (employer ↔ employee). It
// only ever adds: if B already has a connection to A, that one stays exactly
// as it is. The new row belongs to B and lives in B's project, so the caller
// must be allowed to edit B there (`canEdit(projectId)` → error text or null).
// Returns what was added, for the audit trail of each other person.
async function addReverseConnections(personId, connections, canEdit, db = pool) {
  const me = parseInt(personId, 10);
  const added = [];
  const wanted = (Array.isArray(connections) ? connections : []).filter((c) => c && c.two_way && c.person_id != null);
  for (const c of wanted) {
    const otherId = parseInt(c.person_id, 10);
    if (otherId === me) continue;
    const { rows } = await db.query('SELECT id, project_id, case_id FROM people WHERE id = $1', [otherId]);
    const other = rows[0];
    if (!other) {
      const err = new Error(`person ${otherId} not found`);
      err.statusCode = 404;
      throw err;
    }
    const existing = await db.query(
      `SELECT 1 FROM relationships
       WHERE source_type = 'person' AND source_id = $1 AND target_type = 'person' AND target_id = $2 LIMIT 1`,
      [otherId, me]
    );
    if (existing.rows.length) continue;
    const denied = await canEdit(other.project_id);
    if (denied) {
      const err = new Error(`Can't add the connection back on person ${otherId}: ${denied}`);
      err.statusCode = 403;
      throw err;
    }
    const myProjectId = await fetchEntityProject('person', me, db);
    await assertLinkAllowed(other.project_id, other.project_id, myProjectId, db);
    const type = reverseConnectionType(c.type);
    await db.query(
      `INSERT INTO relationships (project_id, case_id, source_type, source_id, target_type, target_id, relationship_type, note)
       VALUES ($1, $2, 'person', $3, 'person', $4, $5, $6)`,
      [other.project_id, other.case_id || null, otherId, me, type, c.note || null]
    );
    added.push({ person_id: otherId, type, note: c.note || null });
  }
  return added;
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
async function syncBusinessRelationships(businessId, projectId, caseId, { ownerPersonId, employees }, db = pool, canSee = null) {
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
  const stored = canSee && businessId
    ? await storedTargets(db, 'business', businessId, 'person', ['owner', 'employee', 'board_member'])
    : new Set();
  for (const d of desired) {
    await checkLinkTarget(d.target_type, d.target_id, projectId, db, canSee, stored);
  }

  // Scoped to the relationship_types this function manages, not every row
  // sourced from this business -- a relationship created directly through
  // POST /relationships (any other type) must survive a businesses.js edit.
  await db.query(
    `DELETE FROM relationships
     WHERE source_type = 'business' AND source_id = $1
       AND target_type = 'person' AND relationship_type IN ('owner', 'employee', 'board_member')`,
    [businessId]
  );

  for (const d of desired) {
    await db.query(
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
async function syncBusinessOwnership(businessId, projectId, caseId, oldOwnerBusinessId, newOwnerBusinessId, db = pool, canSee = null) {
  const oldOwner = oldOwnerBusinessId != null ? parseInt(oldOwnerBusinessId, 10) : null;
  const newOwner = newOwnerBusinessId != null ? parseInt(newOwnerBusinessId, 10) : null;
  if (oldOwner === newOwner) return;

  if (oldOwner != null) {
    await db.query(
      `DELETE FROM relationships
       WHERE source_type = 'business' AND source_id = $1
         AND target_type = 'business' AND target_id = $2 AND relationship_type = 'owner'`,
      [oldOwner, businessId]
    );
  }

  if (newOwner != null) {
    await checkLinkTarget('business', newOwner, projectId, db, canSee);
    await db.query(
      `INSERT INTO relationships (project_id, case_id, source_type, source_id, target_type, target_id, relationship_type, note)
       VALUES ($1, $2, 'business', $3, 'business', $4, 'owner', NULL)`,
      [projectId, caseId || null, newOwner, businessId]
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
    // Both ends are checked against the relationship's project (#116):
    // before, two people of a project the caller isn't in could be linked
    // from the caller's own project.
    const canSee = (pid) => requireProjectMember(req, pid);
    await checkLinkTarget(source_type, source_id, project_id, pool, canSee);
    await checkLinkTarget(target_type, target_id, project_id, pool, canSee);

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
module.exports.addReverseConnections = addReverseConnections;
module.exports.syncBusinessRelationships = syncBusinessRelationships;
module.exports.syncBusinessOwnership = syncBusinessOwnership;
