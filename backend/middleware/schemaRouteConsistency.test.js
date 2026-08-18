// Guard test: every body field a route reads must be declared in its Zod schema.
//
// validate() strips unknown fields from req.body. If a route reads a field the
// schema doesn't declare, the value silently disappears — and because routes
// write `field || []` / `field || null`, an UPDATE can actively wipe stored
// data. This happened twice: assets' initial_holder (holder never seeded) and
// people's connections/osintData/attachments/custom_fields (wiped on edit).
// This test makes the mismatch a CI failure instead of silent data loss.
//
// Access patterns covered:
//   req.body.foo
//   const { foo, bar } = req.body
//   const b = req.body; ... b.foo        (assets.js / transactions.js style)
//   function helper(body) { body.foo }   (validators in route files + utils)
//   nested objects (initial_holder) — child reads checked against child schema
//   transactionHelpers TX_COLUMNS / SUBJECT_REFS / LOCATION_REFS field lists

const fs = require('fs');
const path = require('path');
const { z } = require('zod');
const S = require('./schemas');

const ROUTES_DIR = path.join(__dirname, '..', 'routes');

// Unwrap Optional/Nullable/Default wrappers to reach an inner ZodObject.
function innerShape(schema) {
  let s = schema;
  for (let i = 0; i < 10 && s; i++) {
    if (s.shape) return Object.keys(s.shape);
    s = s.def?.innerType || s.unwrap?.();
  }
  return null;
}

const shape = (...schemas) =>
  new Set(schemas.flatMap((s) => Object.keys(s.shape || {})));

// route file → union of schema keys used by that route's POST/PUT handlers
const ROUTE_SCHEMAS = {
  'people.js': shape(S.PersonCreateSchema, S.PersonUpdateSchema),
  'businesses.js': shape(S.BusinessCreateSchema, S.BusinessUpdateSchema),
  'tools.js': shape(S.ToolCreateSchema, S.ToolUpdateSchema, S.ToolBulkImportSchema),
  'cases.js': shape(S.CaseCreateSchema, S.CaseUpdateSchema),
  'projects.js': shape(S.ProjectCreateSchema, S.ProjectUpdateSchema),
  'relationships.js': shape(S.RelationshipCreateSchema, S.RelationshipUpdateSchema),
  'todos.js': shape(S.TodoCreateSchema, S.TodoUpdateSchema),
  'travelHistory.js': shape(S.TravelHistoryCreateSchema, S.TravelHistoryUpdateSchema),
  'properties.js': shape(S.PropertyCreateSchema, S.PropertyUpdateSchema),
  'assets.js': shape(S.AssetCreateSchema, S.AssetUpdateSchema),
  'transactions.js': shape(S.TransactionCreateSchema, S.TransactionUpdateSchema),
  'settings.js': shape(
    S.SettingsCustomFieldCreateSchema,
    S.SettingsCustomFieldUpdateSchema,
    S.SettingsModelOptionCreateSchema,
    S.SettingsModelOptionUpdateSchema,
    S.SettingsGeocodingUpdateSchema,
    S.SettingsUpdateCheckSchema
  ),
};

// Identifiers that match the extraction patterns but are not body fields.
// `rows`: assets.js reuses `b` as a query-result var inside resolveAssetLocation.
const ALLOWLIST = {
  'assets.js': new Set(['rows']),
};

// Nested body objects: parent must be in the route schema, and every child
// read through a local alias (const ih = b.initial_holder; ih.person_id) must
// be declared in the nested schema.
const NESTED = {
  'assets.js': { parent: 'initial_holder', schema: S.AssetCreateSchema.shape.initial_holder },
};

function extractBodyReads(source) {
  const reads = new Set();

  for (const m of source.matchAll(/req\.body\.([a-zA-Z_][a-zA-Z0-9_]*)/g)) reads.add(m[1]);

  // helper functions taking the body: fn(body) { body.foo } — both route-file
  // validators and the `const b = req.body` convention
  for (const m of source.matchAll(/\bbody\.([a-zA-Z_][a-zA-Z0-9_]*)/g)) reads.add(m[1]);
  if (/const\s+b\s*=\s*req\.body/.test(source)) {
    for (const m of source.matchAll(/\bb\.([a-zA-Z_][a-zA-Z0-9_]*)/g)) reads.add(m[1]);
  }

  for (const m of source.matchAll(/const\s*\{([^}]+)\}\s*=\s*req\.body/gs)) {
    m[1].split(',').forEach((f) => {
      const name = f.split(':')[0].trim();
      if (/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name)) reads.add(name);
    });
  }

  return reads;
}

describe('schema ↔ route body-field consistency', () => {
  for (const [file, schemaKeys] of Object.entries(ROUTE_SCHEMAS)) {
    test(`${file}: every body field read is declared in its schema`, () => {
      const source = fs.readFileSync(path.join(ROUTES_DIR, file), 'utf8');
      const allow = ALLOWLIST[file] || new Set();
      const nestedCfg = NESTED[file];

      // resolve nested-alias reads (const ih = b.initial_holder → ih.person_id)
      const nestedReads = new Set();
      if (nestedCfg) {
        const aliasMatch = source.match(
          new RegExp(`const\\s+(\\w+)\\s*=\\s*(?:b|req\\.body)\\.${nestedCfg.parent}`)
        );
        if (aliasMatch) {
          const alias = aliasMatch[1];
          for (const m of source.matchAll(new RegExp(`\\b${alias}\\.([a-zA-Z_][a-zA-Z0-9_]*)`, 'g'))) {
            nestedReads.add(m[1]);
          }
        }
      }

      const undeclared = [...extractBodyReads(source)].filter(
        (k) => !schemaKeys.has(k) && !allow.has(k) && !nestedReads.has(k)
      );
      expect(undeclared).toEqual([]);

      // nested child reads must be declared in the nested schema itself
      if (nestedCfg && nestedReads.size) {
        const childKeys = innerShape(nestedCfg.schema);
        expect(childKeys).not.toBeNull();
        expect([...nestedReads].filter((k) => !childKeys.includes(k))).toEqual([]);
      }
    });
  }

  test('transactionHelpers: TX_COLUMNS, ref lists, and body reads are all declared', () => {
    const helpers = require('../utils/transactionHelpers');
    const keys = new Set(Object.keys(S.TransactionCreateSchema.shape));

    for (const listName of ['TX_COLUMNS', 'SUBJECT_REFS', 'LOCATION_REFS']) {
      const list = helpers[listName];
      if (!list) continue;
      expect({ [listName]: list.filter((c) => !keys.has(c)) }).toEqual({ [listName]: [] });
    }

    // body.X reads inside the helper module itself (validateTransactionShape etc.)
    const src = fs.readFileSync(path.join(__dirname, '..', 'utils', 'transactionHelpers.js'), 'utf8');
    const reads = [...src.matchAll(/\bbody\.([a-zA-Z_][a-zA-Z0-9_]*)/g)].map((m) => m[1]);
    expect([...new Set(reads)].filter((k) => !keys.has(k))).toEqual([]);
  });

  test('guard self-check: extraction patterns actually find fields', () => {
    // If a refactor changes body-access conventions, extraction could silently
    // return nothing and this suite would pass vacuously. Assert it still sees
    // a realistic number of fields in the two most complex routes.
    const assets = extractBodyReads(fs.readFileSync(path.join(ROUTES_DIR, 'assets.js'), 'utf8'));
    const people = extractBodyReads(fs.readFileSync(path.join(ROUTES_DIR, 'people.js'), 'utf8'));
    expect(assets.size).toBeGreaterThan(10);
    expect(people.size).toBeGreaterThan(10);
  });
});
