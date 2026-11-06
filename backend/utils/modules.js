// Sections an admin can switch off for the whole instance (Settings →
// General → Modules). Switching one off only takes it out of the interface:
// the menu, its address, its tabs and map layers. The data stays, and the
// API (and so the MCP server) keeps working, so it is not access control.
//
// Dashboard, Cases, People, Businesses and Settings are always on.
const SWITCHABLE_MODULES = [
  'transactions', 'assets', 'properties', 'crypto-wallets',
  'relationships', 'map', 'wireless',
  'tools', 'files',
];
const DISABLED_MODULES_KEY = 'disabled_modules';

// The stored list, keeping only known module ids (a module removed in a later
// version, or a hand-edited value, is ignored rather than breaking the menu).
function parseDisabledModules(stored) {
  let list;
  try { list = JSON.parse(stored ?? '[]'); } catch { list = []; }
  if (!Array.isArray(list)) return [];
  return SWITCHABLE_MODULES.filter((id) => list.includes(id));
}

async function readDisabledModules(db) {
  const { rows } = await db.query('SELECT value FROM app_settings WHERE key = $1', [DISABLED_MODULES_KEY]);
  return parseDisabledModules(rows[0]?.value);
}

module.exports = { SWITCHABLE_MODULES, DISABLED_MODULES_KEY, parseDisabledModules, readDisabledModules };
