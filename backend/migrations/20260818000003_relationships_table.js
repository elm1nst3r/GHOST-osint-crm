// File: backend/migrations/20260818000003_relationships_table.js
//
// Third step of project-based data isolation (issue #83). Relationships were
// never a real table — they lived as JSONB `connections` arrays on `people`
// rows (plus `employees[]`/`owner_person_id`/`owner_business_id` on
// `businesses`, wired together only client-side in RelationshipManager.js).
// The cross-project-linking design needs relationships to be independently
// addressable rows with their own project_id/case_id, so this migration
// introduces `relationships` and copies the existing data into it.
//
// Nothing is dropped: people.connections, businesses.employees, and
// businesses.owner_person_id/owner_business_id all stay exactly as they are.
// `connections` becomes a read-time computed field as of the route changes
// that follow this migration (not this file) — `employees`/ownership scalars
// stay the live source of truth for businesses.js, which depends on them
// directly for its self-ownership check and audit logging.
//
// Only employees[] entries with a real person_id are migrated — name-only
// legacy entries stay exactly where they are (issue #65's stated preference
// for the real reference over the name-matching fallback; migrating a name
// guess into a permanent row would manufacture a false-positive connection).

exports.up = async function up(knex) {
  await knex.raw(`
    CREATE TABLE IF NOT EXISTS relationships (
      id SERIAL PRIMARY KEY,
      project_id INTEGER NOT NULL REFERENCES projects(id),
      case_id INTEGER REFERENCES cases(id),
      source_type VARCHAR(20) NOT NULL,
      source_id INTEGER NOT NULL,
      target_type VARCHAR(20) NOT NULL,
      target_id INTEGER NOT NULL,
      relationship_type VARCHAR(100) NOT NULL,
      note TEXT,
      created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
    );
  `);
  await knex.raw(`CREATE INDEX IF NOT EXISTS idx_relationships_source ON relationships(source_type, source_id)`);
  await knex.raw(`CREATE INDEX IF NOT EXISTS idx_relationships_target ON relationships(target_type, target_id)`);
  await knex.raw(`CREATE INDEX IF NOT EXISTS idx_relationships_project ON relationships(project_id)`);
  await knex.raw(`CREATE INDEX IF NOT EXISTS idx_relationships_case ON relationships(case_id)`);
  await knex.raw(`
    DROP TRIGGER IF EXISTS set_timestamp ON relationships;
    CREATE TRIGGER set_timestamp
    BEFORE UPDATE ON relationships
    FOR EACH ROW
    EXECUTE PROCEDURE trigger_set_timestamp();
  `);

  // people.connections -> person/person rows. Bad legacy entries with no
  // person_id (issue #56) are skipped, same filtering PersonUpdateSchema
  // already applies on write.
  await knex.raw(`
    INSERT INTO relationships (project_id, case_id, source_type, source_id, target_type, target_id, relationship_type, note)
    SELECT p.project_id, p.case_id, 'person', p.id, 'person', (c->>'person_id')::int,
           COALESCE(NULLIF(c->>'type', ''), 'other'), c->>'note'
    FROM people p, jsonb_array_elements(p.connections) AS c
    WHERE jsonb_typeof(p.connections) = 'array'
      AND (c->>'person_id') ~ '^\\d+$'
  `);

  // businesses.employees -> business/person rows, only where a real
  // person_id is present.
  await knex.raw(`
    INSERT INTO relationships (project_id, case_id, source_type, source_id, target_type, target_id, relationship_type, note)
    SELECT b.project_id, b.case_id, 'business', b.id, 'person', (e->>'person_id')::int,
           CASE WHEN (e->>'is_decision_maker')::boolean IS TRUE THEN 'board_member' ELSE 'employee' END,
           e->>'role'
    FROM businesses b, jsonb_array_elements(b.employees) AS e
    WHERE jsonb_typeof(b.employees) = 'array'
      AND (e->>'person_id') ~ '^\\d+$'
  `);

  // owner_person_id -> business/person 'owner' row.
  await knex.raw(`
    INSERT INTO relationships (project_id, case_id, source_type, source_id, target_type, target_id, relationship_type)
    SELECT project_id, case_id, 'business', id, 'person', owner_person_id, 'owner'
    FROM businesses
    WHERE owner_person_id IS NOT NULL
  `);

  // owner_business_id -> business/business 'owner' row, stored parent (owner)
  // -> child (owned), matching the person-owner direction above. The current
  // JSONB-era storage is child -> parent with a render-only _reverse flag,
  // because storage lived on the child; a real table has no such constraint,
  // so this migration picks the semantically correct direction going forward.
  await knex.raw(`
    INSERT INTO relationships (project_id, case_id, source_type, source_id, target_type, target_id, relationship_type)
    SELECT b.project_id, b.case_id, 'business', b.owner_business_id, 'business', b.id, 'owner'
    FROM businesses b
    WHERE b.owner_business_id IS NOT NULL
  `);
};

exports.down = async function down(knex) {
  await knex.raw(`DROP TRIGGER IF EXISTS set_timestamp ON relationships`);
  await knex.raw(`DROP TABLE IF EXISTS relationships`);
};
