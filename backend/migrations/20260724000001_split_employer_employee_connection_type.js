// File: backend/migrations/20260724000001_split_employer_employee_connection_type.js
// Splits the single 'Employer/Employee' connection type into two directed
// types so employment can be mapped hierarchically (employer → employee).
//
// seedDefaults.js already inserts the new 'employee' option on every boot, but
// its ON CONFLICT DO NOTHING can't relabel the pre-existing 'employer' row on
// databases seeded before this change — so we do that here. Both statements are
// idempotent. This touches seed data only (not schema); it is safe on fresh and
// existing databases alike.

exports.up = async function up(knex) {
  // Relabel the existing type: 'Employer/Employee' → 'Employer'
  await knex('model_options')
    .where({ model_type: 'connection_type', option_value: 'employer' })
    .update({ option_label: 'Employer' });

  // Ensure the new 'employee' type exists (idempotent; also seeded on boot)
  await knex.raw(`
    INSERT INTO model_options (model_type, option_value, option_label, display_order)
    VALUES ('connection_type', 'employee', 'Employee', 6)
    ON CONFLICT (model_type, option_value) DO NOTHING
  `);
};

// No-op down: reverting would either restore a now-misleading label or delete a
// type that live person.connections may already reference, orphaning edges.
exports.down = async function down() {};
