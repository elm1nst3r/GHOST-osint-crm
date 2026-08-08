// File: backend/migrations/20260808000002_ownership_chains_and_transaction_tags.js
//
// Groundwork for conflict-of-interest mapping (issue #65, from zbyte64's
// real-world use case: tracking board members of councils against the private
// interests of those same people).
//
// 1. businesses.owner_business_id — a business can be owned by another
//    business, not just by a person. Without this an ownership *chain* can't be
//    represented at all, so the shell-company pattern (holdings sold into
//    entities the same principal controls) is invisible to the graph.
//
// 2. transactions.tags — free-form labels so an investigator can mark a
//    transaction (e.g. 'city-council-conflict-of-interest') and then filter or
//    drive an MCP/LLM pass off it. text[] rather than a join table: these are
//    the investigator's own vocabulary, not a managed taxonomy.
//
// Both are nullable/defaulted and additive; existing rows are unaffected.

exports.up = async function up(knex) {
  await knex.raw(`
    ALTER TABLE businesses
    ADD COLUMN IF NOT EXISTS owner_business_id INTEGER
      REFERENCES businesses(id) ON DELETE SET NULL
  `);
  await knex.raw(`
    CREATE INDEX IF NOT EXISTS idx_businesses_owner_business_id
      ON businesses(owner_business_id)
  `);

  await knex.raw(`
    ALTER TABLE transactions
    ADD COLUMN IF NOT EXISTS tags TEXT[] NOT NULL DEFAULT '{}'
  `);
  // GIN so `tags @> ARRAY['x']` stays fast as the log grows
  await knex.raw(`
    CREATE INDEX IF NOT EXISTS idx_transactions_tags ON transactions USING GIN (tags)
  `);

  // Governance link, distinct from employment. zbyte64: "It is enough for me to
  // separate out decision makers from employees" — the specific title (chair,
  // trustee, treasurer) is deliberately left to the free-text role field.
  await knex.raw(`
    INSERT INTO model_options (model_type, option_value, option_label, display_order)
    VALUES ('connection_type', 'board_member', 'Board Member / Decision Maker', 7)
    ON CONFLICT (model_type, option_value) DO NOTHING
  `);

  // seedDefaults' ON CONFLICT DO NOTHING can't renumber rows that already
  // exist, so on an established database board_member would tie with suspect
  // at 7 and the picker order would be arbitrary. Shift the tail down by one.
  // Idempotent: only touches rows still on their pre-board_member ordering.
  for (const [value, order] of [['suspect', 8], ['witness', 9], ['victim', 10], ['other', 11]]) {
    await knex('model_options')
      .where({ model_type: 'connection_type', option_value: value })
      .update({ display_order: order });
  }

  // 'Endorsement / Promotion' — an exchange of value that isn't a payment.
  await knex('model_options')
    .where({ model_type: 'transaction_type', option_value: 'other' })
    .update({ display_order: 15 });
  await knex.raw(`
    INSERT INTO model_options (model_type, option_value, option_label, display_order)
    VALUES ('transaction_type', 'endorsement', 'Endorsement / Promotion', 14)
    ON CONFLICT (model_type, option_value) DO NOTHING
  `);
};

exports.down = async function down(knex) {
  await knex.raw(`DROP INDEX IF EXISTS idx_transactions_tags`);
  await knex.raw(`ALTER TABLE transactions DROP COLUMN IF EXISTS tags`);
  await knex.raw(`DROP INDEX IF EXISTS idx_businesses_owner_business_id`);
  await knex.raw(`ALTER TABLE businesses DROP COLUMN IF EXISTS owner_business_id`);
  await knex('model_options')
    .where({ model_type: 'connection_type', option_value: 'board_member' })
    .del();
};
