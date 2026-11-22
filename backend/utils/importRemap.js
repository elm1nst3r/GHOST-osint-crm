// Import (backend/server.js POST /api/import): every record gets a new id,
// so links between records are rewritten onto the new ids. Pure, so it's
// tested without a database.

// The entity types a relationship row can link (routes/relationships.js
// ENTITY_TABLE).
const LINKABLE = ['person', 'business', 'crypto_wallet'];

// rel: a row of the exported relationships table.
// maps: { person: {oldId: newId}, business: {...}, crypto_wallet: {...} }
// → { ok: true, source_type, source_id, target_type, target_id }
//   or { ok: false, reason } when it can't be rebuilt: an unknown type, or
//   an end that isn't in the file (a record in another project).
function remapRelationship(rel, maps) {
  if (!rel || !LINKABLE.includes(rel.source_type) || !LINKABLE.includes(rel.target_type)) {
    return { ok: false, reason: `unknown link type ${rel?.source_type} → ${rel?.target_type}` };
  }
  const source = maps[rel.source_type]?.[rel.source_id];
  const target = maps[rel.target_type]?.[rel.target_id];
  if (!source || !target) {
    return { ok: false, reason: 'links to a record that is not in the file (e.g. one in another project)' };
  }
  return { ok: true, source_type: rel.source_type, source_id: source, target_type: rel.target_type, target_id: target };
}

// Rows that would come out identical after remapping (same ends, type and
// note) are imported once.
const relationshipKey = (r, type, note) => `${r.source_type}:${r.source_id}>${r.target_type}:${r.target_id}:${type ?? ''}:${note ?? ''}`;

module.exports = { remapRelationship, relationshipKey, LINKABLE };
