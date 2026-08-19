// File: backend/migrations/20260819000002_transaction_wallet_support.js
//
// Wallet-to-wallet crypto transfers (issue #82) reuse `transactions` rather
// than a parallel table -- it already has the "kind" pattern (from/to as
// person/business/external, same shape here for wallet) plus tags, and the
// generic list/detail/graph-edge machinery. from_wallet_id/to_wallet_id
// follow the from_person_id/from_business_id precedent exactly; tx_hash is
// the one genuinely crypto-specific field, so it's just a nullable column
// rather than a side table.

exports.up = async function up(knex) {
  await knex.raw(`
    ALTER TABLE transactions
    ADD COLUMN IF NOT EXISTS from_wallet_id INTEGER REFERENCES crypto_wallets(id) ON DELETE SET NULL
  `);
  await knex.raw(`
    ALTER TABLE transactions
    ADD COLUMN IF NOT EXISTS to_wallet_id INTEGER REFERENCES crypto_wallets(id) ON DELETE SET NULL
  `);
  await knex.raw(`
    ALTER TABLE transactions
    ADD COLUMN IF NOT EXISTS tx_hash VARCHAR(255)
  `);
  await knex.raw(`CREATE INDEX IF NOT EXISTS idx_transactions_from_wallet ON transactions(from_wallet_id)`);
  await knex.raw(`CREATE INDEX IF NOT EXISTS idx_transactions_to_wallet ON transactions(to_wallet_id)`);
  await knex.raw(`CREATE INDEX IF NOT EXISTS idx_transactions_tx_hash ON transactions(tx_hash)`);
};

exports.down = async function down(knex) {
  await knex.raw(`DROP INDEX IF EXISTS idx_transactions_tx_hash`);
  await knex.raw(`DROP INDEX IF EXISTS idx_transactions_to_wallet`);
  await knex.raw(`DROP INDEX IF EXISTS idx_transactions_from_wallet`);
  await knex.raw(`ALTER TABLE transactions DROP COLUMN IF EXISTS tx_hash`);
  await knex.raw(`ALTER TABLE transactions DROP COLUMN IF EXISTS to_wallet_id`);
  await knex.raw(`ALTER TABLE transactions DROP COLUMN IF EXISTS from_wallet_id`);
};
