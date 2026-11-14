// Records that point at other records (#116): a transaction's people and
// businesses, an asset's location or holder, a property's owner, a wireless
// network's associated people. The record's project is checked by the route;
// this checks what it points at, or a member of one project could point at a
// person in another and read that person's name and addresses back.
//
// Allowed: something in the record's own project, or, when that project
// allows cross-project links, something in another project the caller is a
// member of. Anything the caller may not see reads as "not found", so ids
// can't be probed.
const { pool } = require('../config/database');
const { requireProjectMember } = require('./projectAccess');

const TABLES = {
  person: 'people',
  business: 'businesses',
  crypto_wallet: 'crypto_wallets',
  asset: 'assets',
  property: 'properties',
};

// Which column of a transaction points at what.
const TRANSACTION_REFS = {
  from_person_id: 'person', to_person_id: 'person',
  from_business_id: 'business', to_business_id: 'business',
  from_wallet_id: 'crypto_wallet', to_wallet_id: 'crypto_wallet',
  subject_asset_id: 'asset', subject_business_id: 'business', subject_property_id: 'property',
  location_business_id: 'business', location_property_id: 'property',
};

// { field: type } + a body → [{ field, type, id }] for the ids that are set.
function refsFrom(body, fields) {
  return Object.entries(fields)
    .filter(([field]) => body[field] != null && body[field] !== '')
    .map(([field, type]) => ({ field, type, id: body[field] }));
}

// Is `id` what the record already holds in `field`? (A value or a list.)
function alreadyStored(existing, field, id) {
  if (!existing) return false;
  const stored = existing[field];
  if (Array.isArray(stored)) return stored.map(Number).includes(Number(id));
  return stored != null && Number(stored) === Number(id);
}

// → null when every ref may be used in projectId, else { status, error }.
// refs: [{ field, type, id }]; empty ids are skipped. `existing`: the stored
// row on an edit; what it already points at was allowed when it was saved
// and is not checked again (edit forms send every field back, and the
// editor may not see everything a colleague linked). `canSee(projectId)` →
// error text or null; defaults to the caller's membership.
async function checkRefs(req, projectId, refs, { db = pool, canSee, existing = null } = {}) {
  const visible = canSee || ((pid) => requireProjectMember(req, pid));
  let crossLinking;
  for (const { field, type, id } of refs) {
    if (id == null || id === '') continue;
    if (alreadyStored(existing, field, id)) continue;
    const table = TABLES[type];
    if (!table) throw new Error(`unknown reference type ${type}`);
    const n = Number(id);
    const notFound = { status: 400, error: `${field}: ${type.replace('_', ' ')} ${id} not found` };
    if (!Number.isInteger(n) || n <= 0) return notFound;
    const { rows } = await db.query(`SELECT project_id FROM ${table} WHERE id = $1`, [n]);
    if (!rows[0]) return notFound;
    const refProject = rows[0].project_id;
    if (Number(refProject) === Number(projectId)) continue;
    if (await visible(refProject)) return notFound;
    if (crossLinking === undefined) {
      const p = await db.query('SELECT allow_cross_linking FROM projects WHERE id = $1', [projectId]);
      crossLinking = p.rows[0]?.allow_cross_linking === true;
    }
    if (!crossLinking) {
      return { status: 400, error: `${field}: ${type.replace('_', ' ')} ${id} is in another project, and this project doesn't allow links to other projects` };
    }
  }
  return null;
}

module.exports = { checkRefs, refsFrom, alreadyStored, TRANSACTION_REFS, TABLES };
