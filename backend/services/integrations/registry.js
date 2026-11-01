// File: backend/services/integrations/registry.js
//
// Installed integration manifests (issue #96). Built-ins ship as JSON files in
// backend/integrations/ and are synced into integration_manifests at startup,
// so a GHOST upgrade updates them. Admins can also import community
// manifests; those are stored with source 'imported' and are never
// overwritten by the sync, even if a later release ships a built-in with the
// same id.
const fs = require('fs');
const path = require('path');
const { validateManifest, publicSummary } = require('./manifest');

const BUILTIN_DIR = path.join(__dirname, '..', '..', 'integrations');

function loadBuiltins(dir = BUILTIN_DIR) {
  let files = [];
  try { files = fs.readdirSync(dir).filter((f) => f.endsWith('.json')); } catch { return []; }
  const out = [];
  for (const file of files) {
    try {
      const { manifest, errors } = validateManifest(JSON.parse(fs.readFileSync(path.join(dir, file), 'utf8')));
      if (errors) { console.error(`[integrations] ${file} is invalid: ${errors.join('; ')}`); continue; }
      out.push(manifest);
    } catch (err) {
      console.error(`[integrations] could not read ${file}: ${err.message}`);
    }
  }
  return out;
}

async function syncBuiltins(pool, dir = BUILTIN_DIR) {
  const builtins = loadBuiltins(dir);
  for (const m of builtins) {
    await pool.query(
      `INSERT INTO integration_manifests (id, manifest, source) VALUES ($1, $2, 'builtin')
       ON CONFLICT (id) DO UPDATE SET manifest = EXCLUDED.manifest, updated_at = CURRENT_TIMESTAMP
       WHERE integration_manifests.source = 'builtin'`,
      [m.id, JSON.stringify(m)]
    );
  }
  return builtins.length;
}

const builtinIds = () => new Set(loadBuiltins().map((m) => m.id));

function fromRow(row) {
  if (!row) return null;
  const { manifest, errors } = validateManifest(row.manifest);
  if (errors) return null;
  return { manifest, source: row.source };
}

async function getManifest(db, id) {
  if (!id) return null;
  const { rows } = await db.query('SELECT manifest, source FROM integration_manifests WHERE id = $1', [id]);
  return fromRow(rows[0]);
}

async function listManifests(db) {
  const { rows } = await db.query('SELECT manifest, source FROM integration_manifests ORDER BY id');
  return rows.map(fromRow).filter(Boolean);
}

const summaries = async (db) => (await listManifests(db)).map(({ manifest, source }) => publicSummary(manifest, source));

module.exports = { BUILTIN_DIR, loadBuiltins, syncBuiltins, builtinIds, getManifest, listManifests, summaries };
