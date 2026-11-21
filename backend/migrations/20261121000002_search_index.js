// File: backend/migrations/20261121000002_search_index.js
//
// Full-text search (search-and-command-palette plan). One row per searchable
// record in search_index, written by triggers on each table so imports, MCP,
// bulk edits and anything added later can't leave it stale. The search route
// (routes/search.js) reads only this table.
//
//   title     the record's name (weight A)
//   subtitle  a short context line shown under it (weight B)
//   body      everything else worth finding (weight C)
//
// The 'simple' configuration: no stemming, so it behaves the same in every
// language. pg_trgm makes partial-word matches (ILIKE) fast; it ships with
// PostgreSQL, but an external database may not let us create it. Search then
// still works, just without that index.
//
// Not indexed on purpose: wireless network passwords, saved raw records
// (Advanced Search → Saved records searches those), tools (not per project).

// Each table: the entity type, and the SQL for title, subtitle and body over
// the row `r`. JSON columns are checked for their type first: old rows hold
// odd shapes now and then.
const arr = (col) => `CASE WHEN jsonb_typeof(${col}) = 'array' THEN ${col} ELSE '[]'::jsonb END`;
const obj = (col) => `CASE WHEN jsonb_typeof(${col}) = 'object' THEN ${col} ELSE '{}'::jsonb END`;

const SOURCES = [
  {
    table: 'people', type: 'person',
    title: `concat_ws(' ', r.first_name, NULLIF(r.patronymic, ''), NULLIF(r.last_name, ''))`,
    subtitle: `concat_ws(' · ', NULLIF(r.category, ''), NULLIF(r.case_name, ''))`,
    body: `concat_ws(' ',
      array_to_string(r.aliases, ' '), r.notes,
      (SELECT string_agg(concat_ws(' ', e->>'value', e->>'notes'), ' ') FROM jsonb_array_elements(${arr('r.osint_data')}) e),
      (SELECT string_agg(concat_ws(' ', l->>'label', l->>'address', l->>'city', l->>'state', l->>'country', l->>'postal_code', l->>'notes'), ' ')
         FROM jsonb_array_elements(${arr('r.locations')}) l),
      (SELECT string_agg(kv.value, ' ') FROM jsonb_each_text(${obj('r.custom_fields')}) kv))`,
  },
  {
    table: 'businesses', type: 'business',
    title: 'r.name',
    subtitle: `concat_ws(' · ', NULLIF(r.type, ''), NULLIF(r.industry, ''), NULLIF(r.city, ''))`,
    body: `concat_ws(' ', r.registration_number, r.phone, r.email, r.website, r.address, r.city, r.state,
      r.country, r.postal_code, r.notes,
      (SELECT string_agg(concat_ws(' ', e->>'name', e->>'role', e->>'department'), ' ') FROM jsonb_array_elements(${arr('r.employees')}) e))`,
  },
  {
    table: 'crypto_wallets', type: 'crypto_wallet',
    title: `COALESCE(NULLIF(r.label, ''), r.address)`,
    subtitle: `concat_ws(' · ', NULLIF(r.network, ''), CASE WHEN NULLIF(r.label, '') IS NOT NULL THEN r.address END)`,
    body: `concat_ws(' ', r.address, array_to_string(r.tags, ' '), r.notes, r.external_reference_url)`,
  },
  {
    table: 'properties', type: 'property',
    title: 'r.name',
    subtitle: `concat_ws(' · ', NULLIF(r.property_type, ''), NULLIF(r.city, ''))`,
    body: `concat_ws(' ', r.description, r.address, r.city, r.state, r.country, r.postal_code, r.notes)`,
  },
  {
    table: 'assets', type: 'asset',
    title: 'r.name',
    subtitle: `concat_ws(' · ', NULLIF(r.category, ''), NULLIF(r.identifier, ''))`,
    body: `concat_ws(' ', r.identifier, r.description, r.notes, r.location_name, r.address, r.city, r.state, r.country)`,
  },
  {
    table: 'cases', type: 'case',
    title: 'r.case_name',
    subtitle: `NULLIF(r.status, '')`,
    body: `COALESCE(r.description, '')`,
  },
  {
    table: 'todos', type: 'todo',
    title: 'left(r.text, 300)',
    subtitle: `NULLIF(r.status, '')`,
    body: `concat_ws(' ', r.text, r.last_update_comment)`,
  },
  {
    table: 'files', type: 'file',
    title: 'r.original_name',
    subtitle: 'r.mime_type',
    body: `concat_ws(' ', r.description,
      r.metadata#>>'{camera,make}', r.metadata#>>'{camera,model}', r.metadata#>>'{camera,lens}',
      r.metadata#>>'{camera,software}', r.metadata#>>'{camera,body_serial}', r.metadata#>>'{camera,lens_serial}',
      r.metadata#>>'{people,artist}', r.metadata#>>'{people,creator}', r.metadata#>>'{people,copyright}',
      r.metadata#>>'{text,title}', r.metadata#>>'{text,description}', r.metadata#>>'{text,keywords}')`,
  },
  {
    table: 'wireless_networks', type: 'wireless_network',
    title: `COALESCE(NULLIF(r.ssid, ''), r.bssid)`,
    subtitle: `concat_ws(' · ', r.bssid, NULLIF(r.area_name, ''))`,
    body: `concat_ws(' ', r.bssid, r.area_name, r.encryption, r.notes, array_to_string(r.tags, ' '), r.association_note)`,
  },
];

exports.SOURCES = SOURCES;

exports.up = async function up(knex) {
  // Inside the migration's transaction: a refused CREATE EXTENSION would
  // abort it, so try it behind a savepoint.
  await knex.raw('SAVEPOINT trgm');
  try {
    await knex.raw('CREATE EXTENSION IF NOT EXISTS pg_trgm');
    await knex.raw('RELEASE SAVEPOINT trgm');
  } catch (err) {
    await knex.raw('ROLLBACK TO SAVEPOINT trgm');
    console.warn(`[search] pg_trgm is not available (${err.message}); partial-word search will be slower.`);
  }

  await knex.raw(`
    CREATE TABLE search_index (
      entity_type TEXT NOT NULL,
      entity_id INTEGER NOT NULL,
      project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      title TEXT NOT NULL DEFAULT '',
      subtitle TEXT,
      body TEXT NOT NULL DEFAULT '',
      search_text TEXT GENERATED ALWAYS AS (title || ' ' || COALESCE(subtitle, '') || ' ' || body) STORED,
      tsv TSVECTOR GENERATED ALWAYS AS (
        setweight(to_tsvector('simple', title), 'A') ||
        setweight(to_tsvector('simple', COALESCE(subtitle, '')), 'B') ||
        setweight(to_tsvector('simple', body), 'C')
      ) STORED,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (entity_type, entity_id)
    )
  `);
  await knex.raw('CREATE INDEX search_index_tsv ON search_index USING GIN (tsv)');
  await knex.raw('CREATE INDEX search_index_project ON search_index (project_id, entity_type)');
  const { rows } = await knex.raw(`SELECT 1 FROM pg_extension WHERE extname = 'pg_trgm'`);
  if (rows.length) {
    await knex.raw('CREATE INDEX search_index_trgm ON search_index USING GIN (search_text gin_trgm_ops)');
  }

  await knex.raw(`
    CREATE FUNCTION search_index_put(p_type TEXT, p_id INTEGER, p_project INTEGER, p_title TEXT, p_subtitle TEXT, p_body TEXT)
    RETURNS void LANGUAGE sql AS $$
      INSERT INTO search_index (entity_type, entity_id, project_id, title, subtitle, body, updated_at)
      VALUES (p_type, p_id, p_project, left(COALESCE(p_title, ''), 500), left(NULLIF(p_subtitle, ''), 500),
              left(COALESCE(p_body, ''), 200000), NOW())
      ON CONFLICT (entity_type, entity_id) DO UPDATE SET
        project_id = EXCLUDED.project_id, title = EXCLUDED.title, subtitle = EXCLUDED.subtitle,
        body = EXCLUDED.body, updated_at = NOW()
    $$
  `);

  // One trigger function for every table: TG_ARGV[0] is the entity type, and
  // search_doc_<table>(row) writes the row's entry.
  await knex.raw(`
    CREATE FUNCTION search_index_trigger() RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN
      IF TG_OP = 'DELETE' THEN
        DELETE FROM search_index WHERE entity_type = TG_ARGV[0] AND entity_id = OLD.id;
        RETURN OLD;
      END IF;
      EXECUTE format('SELECT search_doc_%s($1)', TG_TABLE_NAME) USING NEW;
      RETURN NEW;
    END
    $$
  `);

  for (const s of SOURCES) {
    await knex.raw(`
      CREATE FUNCTION search_doc_${s.table}(r ${s.table}) RETURNS void LANGUAGE sql AS $$
        SELECT search_index_put('${s.type}', r.id, r.project_id, ${s.title}, ${s.subtitle}, ${s.body})
      $$
    `);
    await knex.raw(`
      CREATE TRIGGER search_index_${s.table}
      AFTER INSERT OR UPDATE OR DELETE ON ${s.table}
      FOR EACH ROW EXECUTE FUNCTION search_index_trigger('${s.type}')
    `);
    await knex.raw(`SELECT search_doc_${s.table}(r) FROM ${s.table} r`);
  }
};

exports.down = async function down(knex) {
  for (const s of SOURCES) {
    await knex.raw(`DROP TRIGGER IF EXISTS search_index_${s.table} ON ${s.table}`);
    await knex.raw(`DROP FUNCTION IF EXISTS search_doc_${s.table}(${s.table})`);
  }
  await knex.raw('DROP FUNCTION IF EXISTS search_index_trigger()');
  await knex.raw('DROP FUNCTION IF EXISTS search_index_put(TEXT, INTEGER, INTEGER, TEXT, TEXT, TEXT)');
  await knex.raw('DROP TABLE IF EXISTS search_index');
  // pg_trgm stays: other things may use it.
};
