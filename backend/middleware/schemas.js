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

// ── reusable refinements ──────────────────────────────────────────────────────

const dateString = z
  .string()
  .optional()
  .refine((v) => !v || !isNaN(Date.parse(v)), { message: 'Invalid date' });

// ── People ────────────────────────────────────────────────────────────────────
// NOTE: people.js uses camelCase body keys (firstName, lastName, etc.)

const personLocationSchema = z.object({
  label: z.string().optional(),
  address: z.string().optional(),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
});

const personBaseFields = {
  lastName: z.string().max(255).optional(),
  date_of_birth: dateString,
  dateOfBirth: dateString,
  category: z.string().max(1000).optional(),
  status: z.string().max(1000).optional(),
  crmStatus: z.string().max(1000).optional(),
  caseName: z.string().max(1000).optional(),
  notes: z.string().max(1000).optional(),
  profilePictureUrl: z.string().optional(),
  aliases: z.array(z.string()).optional().default([]),
  locations: z.array(personLocationSchema).optional().default([]),
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
  role: z.string().optional(),
  department: z.string().optional(),
  email: z.string().optional(),
  notes: z.string().optional(),
});

const businessBaseFields = {
  type: z.string().max(255).optional(),
  industry: z.string().max(255).optional(),
  status: z.string().max(255).optional(),
  email: z.string().email().optional().or(z.literal('')),
  website: z.string().url().optional().or(z.literal('')),
  phone: z
    .string()
    .regex(/^[\d\s\-\+\(\)]+$/, 'Invalid phone format')
    .optional()
    .or(z.literal('')),
  address: z.string().max(500).optional(),
  city: z.string().max(500).optional(),
  state: z.string().max(500).optional(),
  country: z.string().max(500).optional(),
  postal_code: z.string().max(500).optional(),
  registration_number: z.string().max(500).optional(),
  notes: z.string().max(500).optional(),
  registration_date: dateString,
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  owner_person_id: z.number().int().positive().optional().nullable(),
  employees: z.array(employeeSchema).optional().default([]),
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
  link: z.string().url().optional().or(z.literal('')),
  description: z.string().max(1000).optional(),
  category: z.string().max(1000).optional(),
  status: z.string().max(255).optional(),
  tags: z.array(z.string()).optional().default([]),
  notes: z.string().max(1000).optional(),
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

const caseBaseFields = {
  description: z.string().max(2000).optional(),
  status: z.enum(['open', 'closed', 'pending']).optional(),
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

const TodoCreateSchema = z.object({
  text: z.string().min(1, 'Todo text is required').max(2000),
  status: z.enum(['open', 'in_progress', 'closed']).optional().default('open'),
  last_update_comment: z.string().max(1000).optional(),
});

const TodoUpdateSchema = z
  .object({
    text: z.string().min(1).max(2000).optional(),
    status: z.enum(['open', 'in_progress', 'closed']).optional(),
    last_update_comment: z.string().max(1000).optional(),
  })
  .refine((data) => data.text !== undefined || data.status !== undefined, {
    message: 'text or status is required',
  });

// ── Travel History ────────────────────────────────────────────────────────────

const travelHistoryBaseFields = {
  location_type: z.string().max(255).optional(),
  location_name: z.string().max(255).optional(),
  address: z.string().max(255).optional(),
  city: z.string().max(255).optional(),
  state: z.string().max(255).optional(),
  country: z.string().max(255).optional(),
  postal_code: z.string().max(255).optional(),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  arrival_date: dateString,
  departure_date: dateString,
  purpose: z.string().max(1000).optional(),
  transportation_mode: z.string().max(1000).optional(),
  notes: z.string().max(1000).optional(),
};

const TravelHistoryCreateSchema = z.object({ ...travelHistoryBaseFields });
const TravelHistoryUpdateSchema = z.object({ ...travelHistoryBaseFields });

// ── Properties ────────────────────────────────────────────────────────────────

const propertyBaseFields = {
  property_type: z.string().max(500).optional(),
  description: z.string().max(500).optional(),
  address: z.string().max(500).optional(),
  city: z.string().max(500).optional(),
  state: z.string().max(500).optional(),
  country: z.string().max(500).optional(),
  postal_code: z.string().max(500).optional(),
  notes: z.string().max(500).optional(),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  owner_person_id: z.number().int().positive().optional().nullable(),
  case_id: z.number().int().positive().optional().nullable(),
  area_sqm: z.number().nonnegative().optional().nullable(),
  purchase_value: z.number().nonnegative().optional().nullable(),
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
  category: z.string().max(500).optional(),
  identifier: z.string().max(500).optional(),
  description: z.string().max(500).optional(),
  notes: z.string().max(500).optional(),
  location_mode: z
    .enum(['with_holder', 'fixed_known', 'fixed_custom', 'unknown'])
    .optional()
    .default('with_holder'),
  status: z.string().max(100).optional(),
  estimated_value: z.number().nonnegative().optional().nullable(),
  currency: z.string().max(10).optional(),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  location_name: z.string().max(255).optional(),
  address: z.string().max(255).optional(),
  city: z.string().max(255).optional(),
  state: z.string().max(255).optional(),
  country: z.string().max(255).optional(),
  postal_code: z.string().max(255).optional(),
  location_person_id: z.number().int().positive().optional().nullable(),
  location_ref: z.union([z.string(), z.number()]).optional().nullable(),
  owner_person_id: z.number().int().positive().optional().nullable(),
  case_id: z.number().int().positive().optional().nullable(),
};

const AssetCreateSchema = z.object({
  name: z.string().min(1, 'Asset name is required').max(255),
  seed_acquisition: z.boolean().optional(),
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
  value: z.number().nonnegative().optional().nullable(),
  currency: z.string().max(10).optional(),
  notes: z.string().max(1000).optional(),
  item_label: z.string().max(1000).optional(),
  item_category: z.string().max(1000).optional(),
  from_person_id: z.number().int().positive().optional().nullable(),
  to_person_id: z.number().int().positive().optional().nullable(),
  from_business_id: z.number().int().positive().optional().nullable(),
  to_business_id: z.number().int().positive().optional().nullable(),
  from_external: z.string().max(255).optional().nullable(),
  to_external: z.string().max(255).optional().nullable(),
  subject_asset_id: z.number().int().positive().optional().nullable(),
  subject_business_id: z.number().int().positive().optional().nullable(),
  subject_property_id: z.number().int().positive().optional().nullable(),
  location_business_id: z.number().int().positive().optional().nullable(),
  location_property_id: z.number().int().positive().optional().nullable(),
  location_name: z.string().max(255).optional(),
  location_address: z.string().max(255).optional(),
  location_city: z.string().max(255).optional(),
  location_country: z.string().max(255).optional(),
  location_latitude: z.number().min(-90).max(90).optional().nullable(),
  location_longitude: z.number().min(-180).max(180).optional().nullable(),
  // transaction body also uses address/city/country/state/postal_code for geocoding
  address: z.string().max(255).optional(),
  city: z.string().max(255).optional(),
  state: z.string().max(255).optional(),
  country: z.string().max(255).optional(),
  postal_code: z.string().max(255).optional(),
  latitude: z.number().min(-90).max(90).optional().nullable(),
  longitude: z.number().min(-180).max(180).optional().nullable(),
  case_id: z.number().int().positive().optional().nullable(),
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
  options: z.array(z.string()).optional(),
  is_active: z.boolean().optional(),
});

const SettingsCustomFieldUpdateSchema = z.object({
  field_label: z.string().min(1, 'field_label is required').max(255),
  field_type: z.enum(['text', 'number', 'date', 'boolean', 'select'], {
    required_error: 'field_type is required',
  }),
  options: z.array(z.string()).optional(),
  is_active: z.boolean().optional(),
});

// ── Settings — Model Options ──────────────────────────────────────────────────

const SettingsModelOptionCreateSchema = z.object({
  model_type: z.string().min(1, 'model_type is required').max(100),
  option_value: z.string().min(1, 'option_value is required').max(255),
  option_label: z.string().min(1, 'option_label is required').max(255),
  display_order: z.number().int().optional(),
});

const SettingsModelOptionUpdateSchema = z.object({
  option_label: z.string().max(255).optional(),
  is_active: z.boolean().optional(),
  display_order: z.number().int().optional(),
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
