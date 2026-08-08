// File: backend/middleware/schemas.js
// Zod schemas for all entity types + validate() middleware factory.
// Usage: router.post('/', requireAuth, validate(PersonCreateSchema), handler)

const { z } = require('zod');

// ── validate factory ──────────────────────────────────────────────────────────

function validate(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({
        error: 'Validation failed',
        fields: result.error.flatten().fieldErrors,
      });
    }
    req.body = result.data; // coerced + unknown-fields stripped
    next();
  };
}

// ── reusable field builders ───────────────────────────────────────────────────
// Real request bodies are messier than the happy path: edit forms send null for
// cleared fields, HTML inputs send '' when empty, and <select>/<input> values
// arrive as strings even for numeric fields. These builders accept all of that
// (unions keep the generated OpenAPI spec representable, unlike z.preprocess):
//   optStr — string | null, '' allowed
//   optNum — number | numeric string (coerced) | '' → null | null
//   optId  — positive integer flavour of optNum

const optStr = (max) => z.union([z.string().max(max), z.null()]).optional();

const optNum = (inner) =>
  z
    .union([
      inner,
      z.string().min(1).transform(Number).pipe(inner),
      z.literal('').transform(() => null),
      z.null(),
    ])
    .optional();

const optId = () => optNum(z.number().int().positive());

const dateString = z
  .union([
    z
      .string()
      .refine((v) => v === '' || !isNaN(Date.parse(v)), { message: 'Invalid date' })
      .transform((v) => (v === '' ? null : v)),
    z.null(),
  ])
  .optional();

// Arrays: treat null like "not provided" so edit forms can't crash list fields.
const optArray = (item) =>
  z.union([z.array(item), z.null().transform(() => [])]).default([]);

// ── People ────────────────────────────────────────────────────────────────────
// NOTE: people.js uses camelCase body keys (firstName, lastName, etc.)

const personLocationSchema = z.object({
  label: optStr(500),
  address: optStr(500),
  latitude: optNum(z.number().min(-90).max(90)),
  longitude: optNum(z.number().min(-180).max(180)),
});

const personBaseFields = {
  lastName: optStr(255),
  patronymic: optStr(255),
  date_of_birth: dateString,
  dateOfBirth: dateString,
  category: optStr(1000),
  status: optStr(1000),
  crmStatus: optStr(1000),
  caseName: optStr(1000),
  notes: optStr(1000),
  profilePictureUrl: optStr(2000),
  aliases: optArray(z.string()),
  locations: optArray(personLocationSchema),
  // JSONB blobs stored as-is by the route. They MUST be declared here even
  // though we don't validate their internals — validate() strips unknown
  // fields, and the route writes `field || []`, so an undeclared field
  // doesn't just fail to save: editing a person WIPES it to empty.
  // connections entries without a person_id can't be rendered or resolved
  // (a null person_id used to crash the Entity Network view, issue #56), so
  // they are dropped rather than rejected — rejecting would make a person
  // with one bad legacy entry uneditable.
  connections: optArray(z.record(z.string(), z.any())).transform((arr) =>
    arr.filter((c) => c && c.person_id != null)
  ),
  osintData: optArray(z.record(z.string(), z.any())),
  attachments: optArray(z.record(z.string(), z.any())),
  custom_fields: z
    .union([z.record(z.string(), z.any()), z.null().transform(() => ({}))])
    .optional(),
};

const PersonCreateSchema = z.object({
  firstName: z.string().min(1, 'First name is required').max(255),
  ...personBaseFields,
});

const PersonUpdateSchema = z
  .object({
    firstName: z.string().min(1).max(255).optional(),
    ...personBaseFields,
  });

// ── Businesses ────────────────────────────────────────────────────────────────

const employeeSchema = z.object({
  name: z.string(),
  // Real reference to a person record. Entries created before this existed —
  // and any typed in free-hand — carry only a name, so the graph still falls
  // back to name matching when it's absent (issue #65).
  person_id: optId(),
  // zbyte64's ask: separate decision makers from employees. Deliberately a
  // boolean, not a role enum — "those role labels are largely superficial,
  // they describe expected rituals, but not the dynamic of collective
  // decision making". The specific title stays in the free-text role field.
  is_decision_maker: z.union([z.boolean(), z.null().transform(() => false)]).optional(),
  role: optStr(500),
  department: optStr(500),
  email: optStr(500),
  notes: optStr(2000),
});

const businessBaseFields = {
  type: optStr(255),
  industry: optStr(255),
  status: optStr(255),
  email: z.union([z.string().email(), z.literal(''), z.null()]).optional(),
  website: z.union([z.string().url(), z.literal(''), z.null()]).optional(),
  phone: z
    .union([
      z.string().regex(/^[\d\s\-\+\(\)]+$/, 'Invalid phone format'),
      z.literal(''),
      z.null(),
    ])
    .optional(),
  address: optStr(500),
  city: optStr(500),
  state: optStr(500),
  country: optStr(500),
  postal_code: optStr(500),
  registration_number: optStr(500),
  notes: optStr(500),
  registration_date: dateString,
  latitude: optNum(z.number().min(-90).max(90)),
  longitude: optNum(z.number().min(-180).max(180)),
  owner_person_id: optId(),
  // A business can be owned by another business, so ownership chains (holding
  // companies, shells) are representable rather than collapsing to one hop.
  owner_business_id: optId(),
  employees: optArray(employeeSchema),
};

const BusinessCreateSchema = z.object({
  name: z.string().min(1, 'Business name is required').max(255),
  ...businessBaseFields,
});

const BusinessUpdateSchema = z.object({
  name: z.string().min(1, 'Business name is required').max(255),
  ...businessBaseFields,
});

// ── Tools ─────────────────────────────────────────────────────────────────────

const toolBaseFields = {
  link: z.union([z.string().url(), z.literal(''), z.null()]).optional(),
  description: optStr(1000),
  category: optStr(1000),
  status: optStr(255),
  tags: optArray(z.string()),
  notes: optStr(1000),
};

const ToolCreateSchema = z.object({
  name: z.string().min(1, 'Tool name is required').max(255),
  ...toolBaseFields,
});

const ToolUpdateSchema = z.object({
  name: z.string().min(1, 'Tool name is required').max(255),
  ...toolBaseFields,
});

// ── Cases ─────────────────────────────────────────────────────────────────────

// Status vocabularies must match what the UI actually sends (CaseManagement.js
// and Dashboard.js option lists), not an idealised set.
const caseBaseFields = {
  description: optStr(2000),
  status: z.enum(['active', 'on_hold', 'closed']).nullable().optional(),
};

const CaseCreateSchema = z.object({
  case_name: z.string().min(1, 'Case name is required').max(255),
  ...caseBaseFields,
});

const CaseUpdateSchema = z.object({
  case_name: z.string().min(1, 'Case name is required').max(255),
  ...caseBaseFields,
});

// ── Todos ─────────────────────────────────────────────────────────────────────

const TODO_STATUSES = ['open', 'in_progress', 'on_hold', 'attention', 'done', 'cancelled'];

const TodoCreateSchema = z.object({
  text: z.string().min(1, 'Todo text is required').max(2000),
  status: z.enum(TODO_STATUSES).nullable().optional().default('open'),
  last_update_comment: optStr(1000),
});

const TodoUpdateSchema = z
  .object({
    text: z.string().min(1).max(2000).optional(),
    status: z.enum(TODO_STATUSES).nullable().optional(),
    last_update_comment: optStr(1000),
  })
  .refine((data) => data.text !== undefined || data.status !== undefined, {
    message: 'text or status is required',
  });

// ── Travel History ────────────────────────────────────────────────────────────

const travelHistoryBaseFields = {
  location_type: optStr(255),
  location_name: optStr(255),
  address: optStr(255),
  city: optStr(255),
  state: optStr(255),
  country: optStr(255),
  postal_code: optStr(255),
  latitude: optNum(z.number().min(-90).max(90)),
  longitude: optNum(z.number().min(-180).max(180)),
  arrival_date: dateString,
  departure_date: dateString,
  purpose: optStr(1000),
  transportation_mode: optStr(1000),
  notes: optStr(1000),
};

const TravelHistoryCreateSchema = z.object({ ...travelHistoryBaseFields });
const TravelHistoryUpdateSchema = z.object({ ...travelHistoryBaseFields });

// ── Properties ────────────────────────────────────────────────────────────────

const propertyBaseFields = {
  property_type: optStr(500),
  description: optStr(500),
  address: optStr(500),
  city: optStr(500),
  state: optStr(500),
  country: optStr(500),
  postal_code: optStr(500),
  notes: optStr(500),
  latitude: optNum(z.number().min(-90).max(90)),
  longitude: optNum(z.number().min(-180).max(180)),
  owner_person_id: optId(),
  case_id: optId(),
  area_sqm: optNum(z.number().nonnegative()),
  purchase_value: optNum(z.number().nonnegative()),
};

const PropertyCreateSchema = z.object({
  name: z.string().min(1, 'Property name is required').max(255),
  ...propertyBaseFields,
});

const PropertyUpdateSchema = z.object({
  name: z.string().min(1, 'Property name is required').max(255),
  ...propertyBaseFields,
});

// ── Assets ────────────────────────────────────────────────────────────────────

const assetBaseFields = {
  category: optStr(500),
  identifier: optStr(500),
  description: optStr(500),
  notes: optStr(500),
  location_mode: z
    .enum(['with_holder', 'fixed_known', 'fixed_custom', 'unknown'])
    .nullable()
    .optional()
    .default('with_holder'),
  status: optStr(100),
  estimated_value: optNum(z.number().nonnegative()),
  currency: optStr(10),
  latitude: optNum(z.number().min(-90).max(90)),
  longitude: optNum(z.number().min(-180).max(180)),
  location_name: optStr(255),
  address: optStr(255),
  city: optStr(255),
  state: optStr(255),
  country: optStr(255),
  postal_code: optStr(255),
  location_person_id: optId(),
  location_ref: z.union([z.string(), z.number(), z.null()]).optional(),
  owner_person_id: optId(),
  case_id: optId(),
};

// Optional initial holder on create — seeds an acquisition transaction.
// Must be declared here or validate()'s unknown-field stripping deletes it
// before the route can read it.
const initialHolderSchema = z
  .object({
    person_id: optId(),
    business_id: optId(),
    external: optStr(255),
    occurred_on: dateString,
  })
  .nullable()
  .optional();

const AssetCreateSchema = z.object({
  name: z.string().min(1, 'Asset name is required').max(255),
  initial_holder: initialHolderSchema,
  ...assetBaseFields,
});

const AssetUpdateSchema = z.object({
  name: z.string().min(1, 'Asset name is required').max(255),
  ...assetBaseFields,
});

// ── Transactions ──────────────────────────────────────────────────────────────
// Complex polymorphic rules are handled by the existing validateTransactionShape()
// in transactionHelpers.js.  Zod only enforces basic types here.

const TransactionCreateSchema = z.object({
  transaction_type: z.string().min(1, 'transaction_type is required'),
  occurred_on: dateString,
  value: optNum(z.number().nonnegative()),
  currency: optStr(10),
  notes: optStr(1000),
  // Investigator-defined labels (e.g. 'city-council-conflict-of-interest') for
  // filtering and for driving an MCP/LLM pass over a subset (issue #65).
  tags: optArray(z.string().max(100)),
  item_label: optStr(1000),
  item_category: optStr(1000),
  from_person_id: optId(),
  to_person_id: optId(),
  from_business_id: optId(),
  to_business_id: optId(),
  from_external: optStr(255),
  to_external: optStr(255),
  subject_asset_id: optId(),
  subject_business_id: optId(),
  subject_property_id: optId(),
  location_business_id: optId(),
  location_property_id: optId(),
  location_name: optStr(255),
  location_address: optStr(255),
  location_city: optStr(255),
  location_country: optStr(255),
  location_latitude: optNum(z.number().min(-90).max(90)),
  location_longitude: optNum(z.number().min(-180).max(180)),
  // transaction body also uses address/city/country/state/postal_code for geocoding
  address: optStr(255),
  city: optStr(255),
  state: optStr(255),
  country: optStr(255),
  postal_code: optStr(255),
  latitude: optNum(z.number().min(-90).max(90)),
  longitude: optNum(z.number().min(-180).max(180)),
  case_id: optId(),
});

const TransactionUpdateSchema = TransactionCreateSchema;

// ── Settings — Custom Fields ──────────────────────────────────────────────────
// POST /custom-fields: field_name + field_label + field_type required
// PUT  /custom-fields/:id: field_label + field_type required (field_name immutable)

const SettingsCustomFieldCreateSchema = z.object({
  field_name: z
    .string()
    .min(1, 'field_name is required')
    .max(255)
    .regex(/^[a-zA-Z0-9_]+$/, 'field_name can only contain alphanumeric characters and underscores'),
  field_label: z.string().min(1, 'field_label is required').max(255),
  field_type: z.enum(['text', 'number', 'date', 'boolean', 'select'], {
    required_error: 'field_type is required',
  }),
  options: optArray(z.string()),
  is_active: z.boolean().nullable().optional(),
});

const SettingsCustomFieldUpdateSchema = z.object({
  field_label: z.string().min(1, 'field_label is required').max(255),
  field_type: z.enum(['text', 'number', 'date', 'boolean', 'select'], {
    required_error: 'field_type is required',
  }),
  options: optArray(z.string()),
  is_active: z.boolean().nullable().optional(),
});

// ── Settings — Model Options ──────────────────────────────────────────────────

const SettingsModelOptionCreateSchema = z.object({
  model_type: z.string().min(1, 'model_type is required').max(100),
  option_value: z.string().min(1, 'option_value is required').max(255),
  option_label: z.string().min(1, 'option_label is required').max(255),
  display_order: optNum(z.number().int()),
});

const SettingsModelOptionUpdateSchema = z.object({
  option_label: z.string().max(255).optional(),
  is_active: z.boolean().nullable().optional(),
  display_order: optNum(z.number().int()),
});

// ── exports ───────────────────────────────────────────────────────────────────

module.exports = {
  validate,
  PersonCreateSchema,
  PersonUpdateSchema,
  BusinessCreateSchema,
  BusinessUpdateSchema,
  ToolCreateSchema,
  ToolUpdateSchema,
  CaseCreateSchema,
  CaseUpdateSchema,
  TodoCreateSchema,
  TodoUpdateSchema,
  TravelHistoryCreateSchema,
  TravelHistoryUpdateSchema,
  PropertyCreateSchema,
  PropertyUpdateSchema,
  AssetCreateSchema,
  AssetUpdateSchema,
  TransactionCreateSchema,
  TransactionUpdateSchema,
  SettingsCustomFieldCreateSchema,
  SettingsCustomFieldUpdateSchema,
  SettingsModelOptionCreateSchema,
  SettingsModelOptionUpdateSchema,
};
