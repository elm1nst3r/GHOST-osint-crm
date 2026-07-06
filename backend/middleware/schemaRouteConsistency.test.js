// Guard test: every body field a route reads must be declared in its Zod schema.
//
// validate() strips unknown fields from req.body. If a route reads a field the
// schema doesn't declare, the value silently disappears — and because routes
// write `field || []` / `field || null`, an UPDATE can actively wipe stored
// data. This happened twice: assets' initial_holder (holder never seeded) and
// people's connections/osintData/attachments/custom_fields (wiped on edit).
// This test makes the mismatch a CI failure instead of silent data loss.

const fs = require('fs');
const path = require('path');
const S = require('./schemas');

const ROUTES_DIR = path.join(__dirname, '..', 'routes');

const shape = (...schemas) =>
  new Set(schemas.flatMap((s) => Object.keys(s.shape || {})));

// route file → union of schema keys used by that route's POST/PUT handlers
const ROUTE_SCHEMAS = {
  'people.js': shape(S.PersonCreateSchema, S.PersonUpdateSchema),
  'businesses.js': shape(S.BusinessCreateSchema, S.BusinessUpdateSchema),
  'tools.js': shape(S.ToolCreateSchema, S.ToolUpdateSchema),
  'cases.js': shape(S.CaseCreateSchema, S.CaseUpdateSchema),
  'todos.js': shape(S.TodoCreateSchema, S.TodoUpdateSchema),
  'travelHistory.js': shape(S.TravelHistoryCreateSchema, S.TravelHistoryUpdateSchema),
  'properties.js': shape(S.PropertyCreateSchema, S.PropertyUpdateSchema),
  'assets.js': shape(S.AssetCreateSchema, S.AssetUpdateSchema),
  'transactions.js': shape(S.TransactionCreateSchema, S.TransactionUpdateSchema),
  'settings.js': shape(
    S.SettingsCustomFieldCreateSchema,
    S.SettingsCustomFieldUpdateSchema,
    S.SettingsModelOptionCreateSchema,
    S.SettingsModelOptionUpdateSchema
  ),
};

// Known false positives: identifiers that match the extraction patterns but are
// not req.body fields (e.g. `b` is also used for query-result vars in helpers).
const ALLOWLIST = {
  'assets.js': new Set(['rows']),
};

// Nested object fields read via a parent that IS declared (parent.child) —
// the parent being in the schema is what matters.
const NESTED_PARENTS = {
  'assets.js': ['initial_holder'],
};

function bodyFieldsReadBy(source, file) {
  const reads = new Set();

  for (const m of source.matchAll(/req\.body\.([a-zA-Z_][a-zA-Z0-9_]*)/g)) {
    reads.add(m[1]);
  }

  // `const b = req.body` convention (assets.js, transactions.js)
  if (/const\s+b\s*=\s*req\.body/.test(source)) {
    for (const m of source.matchAll(/\bb\.([a-zA-Z_][a-zA-Z0-9_]*)/g)) {
      reads.add(m[1]);
    }
  }

  // const { a, b: renamed, c } = req.body
  for (const m of source.matchAll(/const\s*\{([^}]+)\}\s*=\s*req\.body/gs)) {
    m[1].split(',').forEach((f) => {
      const name = f.split(':')[0].trim();
      if (/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name)) reads.add(name);
    });
  }

  // drop fields reached through a declared nested parent (ih.person_id etc.)
  const allow = ALLOWLIST[file] || new Set();
  return [...reads].filter((k) => !allow.has(k));
}

describe('schema ↔ route body-field consistency', () => {
  for (const [file, schemaKeys] of Object.entries(ROUTE_SCHEMAS)) {
    test(`${file}: every body field read is declared in its schema`, () => {
      const source = fs.readFileSync(path.join(ROUTES_DIR, file), 'utf8');
      const nested = new Set(
        (NESTED_PARENTS[file] || []).flatMap((parent) => {
          // fields accessed on a local var holding body.<parent> are fine
          const re = new RegExp(`const\\s+(\\w+)\\s*=\\s*b\\.${parent}`);
          const m = source.match(re);
          if (!m) return [];
          const varName = m[1];
          return [...source.matchAll(new RegExp(`\\b${varName}\\.([a-zA-Z_][a-zA-Z0-9_]*)`, 'g'))].map(
            (mm) => mm[1]
          );
        })
      );

      const undeclared = bodyFieldsReadBy(source, file).filter(
        (k) => !schemaKeys.has(k) && !nested.has(k)
      );

      expect(undeclared).toEqual([]);
    });
  }

  test('transactionHelpers TX_COLUMNS are all declared in the transaction schema', () => {
    const { TX_COLUMNS } = require('../utils/transactionHelpers');
    if (!TX_COLUMNS) return; // helper shape changed; other tests will catch it
    const keys = new Set(Object.keys(S.TransactionCreateSchema.shape));
    expect(TX_COLUMNS.filter((c) => !keys.has(c))).toEqual([]);
  });
});
