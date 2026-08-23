// File: backend/migrations/20260819000001_crypto_wallets.js
//
// Entity/relationship layer for cryptocurrency investigations (issue #82).
// Roy's scoping in the issue thread: GHOST does not do blockchain analysis
// (clustering, tracing, attribution) -- that's GraphSense/Chainalysis
// territory -- it just makes wallets first-class citizens in the existing
// investigation graph, with `external_reference_url` as the jump-off point
// to whichever specialized tool did the actual analysis.
//
// A new table, not a retrofit like #83's other entities needed -- this is
// created after projects/relationships already exist, so project_id is
// NOT NULL from the start and there's no backfill step.
//
// tags is text[] + GIN, matching transactions.tags (issue #65) -- the
// investigator's own vocabulary (suspicious/exchange/mixer/scam are seeded
// suggestions via model_options, not a fixed enum).

exports.up = async function up(knex) {
  await knex.raw(`
    CREATE TABLE IF NOT EXISTS crypto_wallets (
      id SERIAL PRIMARY KEY,
      address VARCHAR(255) NOT NULL,
      network VARCHAR(100),
      label VARCHAR(255),
      tags TEXT[] NOT NULL DEFAULT '{}',
      external_reference_url VARCHAR(1000),
      notes TEXT,
      status VARCHAR(50) DEFAULT 'active',
      case_id INTEGER REFERENCES cases(id) ON DELETE SET NULL,
      project_id INTEGER NOT NULL REFERENCES projects(id),
      created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
    );
  `);
  await knex.raw(`
    DROP TRIGGER IF EXISTS set_timestamp ON crypto_wallets;
    CREATE TRIGGER set_timestamp
    BEFORE UPDATE ON crypto_wallets
    FOR EACH ROW
    EXECUTE PROCEDURE trigger_set_timestamp();
  `);
  await knex.raw(`CREATE INDEX IF NOT EXISTS idx_crypto_wallets_project ON crypto_wallets(project_id)`);
  await knex.raw(`CREATE INDEX IF NOT EXISTS idx_crypto_wallets_case ON crypto_wallets(case_id)`);
  await knex.raw(`CREATE INDEX IF NOT EXISTS idx_crypto_wallets_tags ON crypto_wallets USING GIN (tags)`);
  await knex.raw(`CREATE INDEX IF NOT EXISTS idx_crypto_wallets_address ON crypto_wallets(address)`);

  await knex.raw(`
    INSERT INTO model_options (model_type, option_value, option_label, display_order) VALUES
      ('crypto_wallet_network', 'bitcoin', 'Bitcoin', 1),
      ('crypto_wallet_network', 'ethereum', 'Ethereum', 2),
      ('crypto_wallet_network', 'solana', 'Solana', 3),
      ('crypto_wallet_network', 'tron', 'Tron', 4),
      ('crypto_wallet_network', 'other', 'Other', 5),
      ('crypto_wallet_tag', 'suspicious', 'Suspicious', 1),
      ('crypto_wallet_tag', 'exchange', 'Exchange', 2),
      ('crypto_wallet_tag', 'mixer', 'Mixer', 3),
      ('crypto_wallet_tag', 'scam', 'Scam', 4)
    ON CONFLICT (model_type, option_value) DO NOTHING
  `);
};

exports.down = async function down(knex) {
  await knex.raw(`DELETE FROM model_options WHERE model_type IN ('crypto_wallet_network', 'crypto_wallet_tag')`);
  await knex.raw(`DROP TABLE IF EXISTS crypto_wallets`);
};
