// File: backend/migrations/20261110000001_orphaned_entity_links.js
//
// Deleting a person, business or crypto wallet left its relationships, business
// employee links and wireless network links behind (#112); deletes clean them
// up now (utils/entityLinks.js). This removes what earlier deletes left.
// Nothing to undo: the removed rows pointed at records that no longer exist.
const { SWEEP_STATEMENTS } = require('../utils/entityLinks');

exports.up = async function up(knex) {
  for (const sql of SWEEP_STATEMENTS) await knex.raw(sql);
};

exports.down = async function down() {};
