// File: backend/utils/openapiSpec.js
// Builds an OpenAPI 3.1 document from the Zod schemas in middleware/schemas.js.
// Zod 4's native z.toJSONSchema() is the single source of truth for request
// bodies — no schema duplication (issue #44). Served at GET /api/openapi.json.

const { z } = require('zod');
const { version } = require('../package.json');
const S = require('../middleware/schemas');
const { FROM_REFS, TO_REFS, SUBJECT_REFS, LOCATION_REFS } = require('./transactionHelpers');

// ── Zod → JSON Schema ─────────────────────────────────────────────────────────

function toSchema(zodSchema) {
  const json = z.toJSONSchema(zodSchema, { io: 'input', unrepresentable: 'any' });
  delete json.$schema; // component schemas inherit the document's dialect
  return json;
}

// Transaction party rules (issue #43): the from_*/to_*/subject_*/location_*
// groups are mutually exclusive at runtime (validateTransactionShape). A strict
// JSON-Schema oneOf/not-required encoding would falsely reject requests that
// send the unused keys as null (which the UI does and the API accepts), so the
// rules are expressed as a machine-readable x-mutually-exclusive extension plus
// prose — MCP tool generation surfaces the description to the calling LLM.
const TX_EXCLUSIVE_GROUPS = [
  { role: 'giver', fields: FROM_REFS },
  { role: 'receiver', fields: TO_REFS },
  { role: 'referenced subject', fields: SUBJECT_REFS },
  { role: 'event location reference', fields: LOCATION_REFS },
];

function withPartyRules(schema) {
  const rules = TX_EXCLUSIVE_GROUPS
    .map(({ role, fields }) => `at most one of ${fields.join(', ')} may be set as the ${role}`)
    .join('; ');
  return {
    ...schema,
    description:
      `${schema.description ? schema.description + ' ' : ''}Party rules: ${rules}. ` +
      'At least one party (from_* or to_*) is required. Explicit null or empty-string ' +
      'values count as unset. Violations return 400 naming the conflicting fields.',
    'x-mutually-exclusive': TX_EXCLUSIVE_GROUPS.map(({ role, fields }) => ({ role, fields })),
  };
}

// ── shared building blocks ────────────────────────────────────────────────────

const ref = (name) => ({ $ref: `#/components/schemas/${name}` });

const idParam = {
  name: 'id', in: 'path', required: true,
  schema: { type: 'integer', minimum: 1 },
};

const userIdParam = {
  name: 'userId', in: 'path', required: true,
  schema: { type: 'integer', minimum: 1 },
};

const paginationParams = [
  { name: 'limit', in: 'query', schema: { type: 'integer', default: 100, maximum: 1000 } },
  { name: 'offset', in: 'query', schema: { type: 'integer', default: 0, minimum: 0 } },
];

const queryParam = (name, description, schema = { type: 'string' }) =>
  ({ name, in: 'query', description, schema });

// Project scoping (issues #83/#84): every project-scoped list goes through
// applyProjectScope, so the parameter behaves identically on all of them.
const projectParam = queryParam(
  'project_id',
  'Restrict to one project. Non-admins must be a member of it (403 otherwise); ' +
  'when omitted they see every project they belong to, admins see all projects.',
  { type: 'integer' }
);

const multipartBody = (schema) => ({
  required: true,
  content: { 'multipart/form-data': { schema } },
});

const jsonBody = (schema) => ({
  required: true,
  content: { 'application/json': { schema } },
});

const jsonResponse = (description, schema) => ({
  description,
  content: { 'application/json': { schema } },
});

const anyObject = { type: 'object', additionalProperties: true };
const objectArray = { type: 'array', items: anyObject };
const paginatedEnvelope = {
  type: 'object',
  properties: {
    data: objectArray,
    meta: {
      type: 'object',
      properties: {
        total: { type: 'integer' },
        limit: { type: 'integer' },
        offset: { type: 'integer' },
        hasMore: { type: 'boolean' },
      },
    },
  },
};

const errorResponses = {
  400: jsonResponse('Validation failed', ref('ValidationError')),
  401: jsonResponse('Not authenticated', ref('Error')),
  404: jsonResponse('Not found', ref('Error')),
  500: jsonResponse('Server error', ref('Error')),
};

function op(tag, summary, extra = {}) {
  const { params, body, multipart, responses, admin, description, mcp } = extra;
  const o = {
    tags: [tag],
    summary,
    responses: {
      200: jsonResponse('Success', extra.responseSchema || anyObject),
      ...errorResponses,
      ...(responses || {}),
    },
  };
  if (description) o.description = description;
  if (params) o.parameters = params;
  if (body) o.requestBody = jsonBody(body);
  if (multipart) o.requestBody = multipartBody(multipart);
  if (admin) o['x-requires-admin'] = true;
  // Instance administration, file uploads and whole-database operations are
  // documented but kept out of the MCP toolset (mcp/tools.js honours this).
  if (mcp === false) o['x-mcp-exclude'] = true;
  return o;
}

// Standard CRUD path set for one entity.
// opts.paginated: list returns { data, meta }; otherwise a plain array.
// opts.projectScoped: list accepts the shared project_id filter.
// opts.getById / opts.listParams control extras.
function crudPaths(tag, base, createSchemaName, updateSchemaName, opts = {}) {
  const paths = {};
  const listResponse = opts.paginated ? paginatedEnvelope : objectArray;

  paths[base] = {
    get: op(tag, `List ${tag}`, {
      params: [
        ...(opts.paginated ? paginationParams : []),
        ...(opts.projectScoped ? [projectParam] : []),
        ...(opts.listParams || []),
      ],
      responseSchema: listResponse,
    }),
    post: op(tag, `Create a ${tag.replace(/s$/, '').toLowerCase()}`, {
      body: ref(createSchemaName),
      responses: { 201: jsonResponse('Created', anyObject) },
    }),
  };

  paths[`${base}/{id}`] = {
    ...(opts.getById !== false && { get: op(tag, `Get one by ID`, { params: [idParam] }) }),
    put: op(tag, `Update by ID`, { params: [idParam], body: ref(updateSchemaName) }),
    delete: op(tag, `Delete by ID`, { params: [idParam] }),
  };

  return paths;
}

// ── document ──────────────────────────────────────────────────────────────────

const spec = {
  openapi: '3.1.0',
  info: {
    title: 'GHOST OSINT CRM API',
    version,
    description:
      'REST API for GHOST. All endpoints (except login/session) require an ' +
      'authenticated session cookie — POST /api/auth/login first and reuse the ' +
      'cookie. Validation errors return field-level detail: ' +
      '`{ "error": "Validation failed", "fields": { "<field>": ["<message>"] } }`. ' +
      'Endpoints marked x-requires-admin need an admin-role session.',
  },
  servers: [{ url: '/api' }],
  security: [{ cookieAuth: [] }],
  tags: [
    { name: 'Auth', description: 'Session login/logout and the current user profile.' },
    { name: 'Projects', description: 'Projects are the isolation boundary: every case-scoped record belongs to exactly one. Includes per-project membership and roles.' },
    { name: 'Cases', description: 'Cases group records inside a project.' },
    { name: 'People', description: 'Person records, including their locations.' },
    { name: 'Travel History', description: 'Travel entries and pattern analysis for a person.' },
    { name: 'Businesses', description: 'Organisations, their staff, and ownership chains.' },
    { name: 'Relationships', description: 'Typed links between people, businesses and crypto wallets.' },
    { name: 'Properties', description: 'Real estate and other mappable property.' },
    { name: 'Assets', description: 'Tracked items of value and who holds them.' },
    { name: 'Crypto Wallets', description: 'Wallet addresses as entities. GHOST records them; it does not do chain analysis.' },
    { name: 'Transactions', description: 'Transfers of value between people, businesses and external parties.' },
    { name: 'Ledger', description: 'Read-only views derived from transactions and asset holdings.' },
    { name: 'Wireless Networks', description: 'Wi-Fi/Bluetooth/cell observations, WiGLE KML import, and person associations.' },
    { name: 'Locations', description: 'Aggregated mappable locations across entities.' },
    { name: 'Geocoding', description: 'Address lookup through the configured geocoding provider.' },
    { name: 'Search', description: 'Global and advanced search.' },
    { name: 'Tools', description: 'The OSINT tool catalogue.' },
    { name: 'Todos', description: 'Investigation task list.' },
    { name: 'Settings', description: 'Custom fields, model options (taxonomies) and instance configuration.' },
    { name: 'Users', description: 'User administration and the member-picker directory.' },
    { name: 'Audit Logs', description: 'Who changed what, and when.' },
    { name: 'System', description: 'Health, version, the OpenAPI document itself, and whole-database export/import.' },
  ],
  components: {
    securitySchemes: {
      cookieAuth: { type: 'apiKey', in: 'cookie', name: 'connect.sid' },
    },
    schemas: {
      Error: {
        type: 'object',
        properties: { error: { type: 'string' } },
        required: ['error'],
      },
      ValidationError: {
        type: 'object',
        properties: {
          error: { type: 'string', const: 'Validation failed' },
          fields: {
            type: 'object',
            additionalProperties: { type: 'array', items: { type: 'string' } },
          },
        },
        required: ['error', 'fields'],
      },
      PersonCreate: toSchema(S.PersonCreateSchema),
      PersonUpdate: toSchema(S.PersonUpdateSchema),
      BusinessCreate: toSchema(S.BusinessCreateSchema),
      BusinessUpdate: toSchema(S.BusinessUpdateSchema),
      ToolCreate: toSchema(S.ToolCreateSchema),
      ToolUpdate: toSchema(S.ToolUpdateSchema),
      ToolBulkImport: toSchema(S.ToolBulkImportSchema),
      CaseCreate: toSchema(S.CaseCreateSchema),
      CaseUpdate: toSchema(S.CaseUpdateSchema),
      ProjectCreate: toSchema(S.ProjectCreateSchema),
      ProjectUpdate: toSchema(S.ProjectUpdateSchema),
      ProjectMemberCreate: toSchema(S.ProjectMemberCreateSchema),
      ProjectMemberUpdate: toSchema(S.ProjectMemberUpdateSchema),
      RelationshipCreate: toSchema(S.RelationshipCreateSchema),
      RelationshipUpdate: toSchema(S.RelationshipUpdateSchema),
      TodoCreate: toSchema(S.TodoCreateSchema),
      TodoUpdate: toSchema(S.TodoUpdateSchema),
      TravelHistoryCreate: toSchema(S.TravelHistoryCreateSchema),
      TravelHistoryUpdate: toSchema(S.TravelHistoryUpdateSchema),
      PropertyCreate: toSchema(S.PropertyCreateSchema),
      PropertyUpdate: toSchema(S.PropertyUpdateSchema),
      AssetCreate: toSchema(S.AssetCreateSchema),
      AssetUpdate: toSchema(S.AssetUpdateSchema),
      CryptoWalletCreate: toSchema(S.CryptoWalletCreateSchema),
      CryptoWalletUpdate: toSchema(S.CryptoWalletUpdateSchema),
      TransactionCreate: withPartyRules(toSchema(S.TransactionCreateSchema)),
      TransactionUpdate: withPartyRules(toSchema(S.TransactionUpdateSchema)),
      SettingsCustomFieldCreate: toSchema(S.SettingsCustomFieldCreateSchema),
      SettingsCustomFieldUpdate: toSchema(S.SettingsCustomFieldUpdateSchema),
      SettingsModelOptionCreate: toSchema(S.SettingsModelOptionCreateSchema),
      SettingsModelOptionUpdate: toSchema(S.SettingsModelOptionUpdateSchema),
      SettingsBrandingUpdate: toSchema(S.SettingsBrandingUpdateSchema),
      SettingsGeocodingUpdate: toSchema(S.SettingsGeocodingUpdateSchema),
      SettingsUpdateCheck: toSchema(S.SettingsUpdateCheckSchema),
      SettingsProjectRetention: toSchema(S.SettingsProjectRetentionSchema),
    },
  },
  paths: {
    // ── Auth ──
    '/auth/login': {
      post: {
        tags: ['Auth'],
        summary: 'Log in and receive a session cookie',
        security: [],
        requestBody: jsonBody({
          type: 'object',
          properties: {
            username: { type: 'string' },
            password: { type: 'string' },
          },
          required: ['username', 'password'],
        }),
        responses: {
          200: jsonResponse('Logged in; session cookie set', anyObject),
          401: jsonResponse('Invalid credentials', ref('Error')),
          429: jsonResponse('Rate limited (default 10 attempts / 15 min)', ref('Error')),
        },
      },
    },
    '/auth/logout': { post: op('Auth', 'Log out and destroy the session') },
    '/auth/session': {
      get: { ...op('Auth', 'Check current session state'), security: [] },
    },
    '/auth/me': {
      get: op('Auth', 'Get the current user profile'),
      put: op('Auth', 'Update the current user profile', { body: anyObject }),
    },

    // ── People ──
    // NOTE: unlike properties/assets/transactions, the people list returns a
    // plain array for backwards compatibility (issue #40); pagination metadata
    // is in the X-Total-Count / X-Has-More response headers.
    ...crudPaths('People', '/people', 'PersonCreate', 'PersonUpdate', {
      projectScoped: true,
      listParams: paginationParams,
    }),
    '/people/{id}/locations': {
      post: op('People', 'Add a location to a person', { params: [idParam], body: anyObject }),
    },
    '/people/{id}/locations/{index}': {
      put: op('People', 'Update a person location by array index', {
        params: [idParam, { name: 'index', in: 'path', required: true, schema: { type: 'integer', minimum: 0 } }],
        body: anyObject,
      }),
      delete: op('People', 'Remove a person location by array index', {
        params: [idParam, { name: 'index', in: 'path', required: true, schema: { type: 'integer', minimum: 0 } }],
      }),
    },
    '/people/{id}/travel-history': {
      get: op('Travel History', 'List travel history for a person', { params: [idParam], responseSchema: objectArray }),
      post: op('Travel History', 'Add a travel history entry', { params: [idParam], body: ref('TravelHistoryCreate') }),
    },
    '/people/{id}/travel-analysis': {
      get: op('Travel History', 'Travel pattern analysis for a person', { params: [idParam] }),
    },
    '/travel-history/{id}': {
      put: op('Travel History', 'Update a travel history entry', { params: [idParam], body: ref('TravelHistoryUpdate') }),
      delete: op('Travel History', 'Delete a travel history entry', { params: [idParam] }),
    },
    '/people/{id}/transactions': {
      get: op('Ledger', 'Transactions a person appears in', { params: [idParam], responseSchema: objectArray }),
    },
    '/people/{id}/assets': {
      get: op('Ledger', 'Assets currently held by a person', { params: [idParam], responseSchema: objectArray }),
    },

    // ── Businesses ──
    ...crudPaths('Businesses', '/businesses', 'BusinessCreate', 'BusinessUpdate', {
      projectScoped: true,
      listParams: [queryParam('case_id', 'Filter by case', { type: 'integer' })],
    }),
    '/businesses/{id}/transactions': {
      get: op('Ledger', 'Transactions a business appears in', { params: [idParam], responseSchema: objectArray }),
    },
    '/businesses/{id}/venue-stats': {
      get: op('Ledger', 'Venue analytics: distinct visitors and ranked people', { params: [idParam] }),
    },

    // ── Tools / Todos / Cases ──
    ...crudPaths('Tools', '/tools', 'ToolCreate', 'ToolUpdate', { getById: false }),
    '/tools/bulk-import': {
      post: op('Tools', 'Import many OSINT tools in one request', {
        body: ref('ToolBulkImport'),
        description:
          'Duplicates are matched on name, case-insensitively. mode="skip" (the default) leaves existing tools '
          + 'untouched; mode="update" overwrites only the fields each row supplies, so a partial row cannot blank '
          + 'out a tool\'s other values. Rows are processed individually — one bad row does not abort the rest — '
          + 'and the response reports created/updated/skipped counts plus per-row errors. Prefer this over calling '
          + 'the single-tool create repeatedly: it is one request and is not subject to the per-request rate limit.',
      }),
    },
    ...crudPaths('Todos', '/todos', 'TodoCreate', 'TodoUpdate', {
      getById: false,
      projectScoped: true,
      listParams: [queryParam('case_id', 'Filter by case', { type: 'integer' })],
    }),
    ...crudPaths('Cases', '/cases', 'CaseCreate', 'CaseUpdate', { getById: false, projectScoped: true }),
    ...crudPaths('Projects', '/projects', 'ProjectCreate', 'ProjectUpdate', { getById: false }),
    '/projects/{id}/stats': {
      get: op('Projects', 'Per-entity row counts for a project', {
        description: 'Powers the delete-confirmation dialog. DELETE /projects/{id} '
          + 'requires the project name echoed back in a "confirm_name" body field '
          + 'when the project still contains data, and then removes every '
          + 'project-scoped entity along with the project.',
        params: [idParam],
      }),
    },

    '/projects/{id}/members': {
      get: op('Projects', 'List the members of a project', {
        description: 'Any member of the project (or an admin) may read the list.',
        params: [idParam],
        responseSchema: objectArray,
      }),
      post: op('Projects', 'Add a user to a project', {
        description: 'Requires the manager role on the project, or admin. Returns 409 if the user is already a member.',
        params: [idParam],
        body: ref('ProjectMemberCreate'),
        responses: {
          201: jsonResponse('Member added', anyObject),
          403: jsonResponse('Not a manager of this project', ref('Error')),
          409: jsonResponse('Already a member', ref('Error')),
        },
      }),
    },
    '/projects/{id}/members/{userId}': {
      put: op('Projects', "Change a member's project role", {
        description: 'Requires the manager role on the project, or admin.',
        params: [idParam, userIdParam],
        body: ref('ProjectMemberUpdate'),
        responses: { 403: jsonResponse('Not a manager of this project', ref('Error')) },
      }),
      delete: op('Projects', 'Remove a member from a project', {
        description: 'Requires the manager role on the project, or admin.',
        params: [idParam, userIdParam],
        responses: { 403: jsonResponse('Not a manager of this project', ref('Error')) },
      }),
    },

    // ── Properties ──
    ...crudPaths('Properties', '/properties', 'PropertyCreate', 'PropertyUpdate', {
      paginated: true,
      projectScoped: true,
      listParams: [
        queryParam('property_type', 'Filter by property type'),
        queryParam('case_id', 'Filter by case', { type: 'integer' }),
        queryParam('owner_person_id', 'Filter by owner', { type: 'integer' }),
        queryParam('q', 'Search name/address/city'),
        queryParam('bbox', 'Map bounds filter: west,south,east,north'),
      ],
    }),
    '/properties/{id}/transactions': {
      get: op('Ledger', 'Transactions a property appears in', { params: [idParam], responseSchema: objectArray }),
    },

    // ── Assets ──
    ...crudPaths('Assets', '/assets', 'AssetCreate', 'AssetUpdate', { paginated: true, projectScoped: true }),

    // ── Crypto wallets (issue #82) ──
    ...crudPaths('Crypto Wallets', '/crypto-wallets', 'CryptoWalletCreate', 'CryptoWalletUpdate', {
      paginated: true,
      projectScoped: true,
      listParams: [
        queryParam('network', 'Filter by network (a crypto_wallet_network model option)'),
        queryParam('status', 'Filter by status'),
        queryParam('case_id', 'Filter by case', { type: 'integer' }),
        queryParam('q', 'Search address/label'),
        queryParam('tag', 'Wallets carrying this exact tag'),
      ],
    }),

    // ── Transactions ──
    ...crudPaths('Transactions', '/transactions', 'TransactionCreate', 'TransactionUpdate', {
      paginated: true,
      projectScoped: true,
      listParams: [
        queryParam('transaction_type', 'Filter by type (a transaction_type model option)'),
        queryParam('item_category', 'Filter by item category'),
        queryParam('person_id', 'Transactions where the person is giver or receiver', { type: 'integer' }),
        queryParam('from_person_id', 'Filter by giver', { type: 'integer' }),
        queryParam('to_person_id', 'Filter by receiver', { type: 'integer' }),
      ],
    }),

    // ── Ledger ──
    '/{entityType}/{id}/ledger': {
      get: op('Ledger', 'Unified chronological ledger for an entity', {
        description:
          'Every transaction the entity appears in (as giver, receiver, subject, ' +
          'or venue) with value-in/value-out/net per currency and current holdings.',
        params: [
          { name: 'entityType', in: 'path', required: true, schema: { type: 'string', enum: ['people', 'businesses', 'properties'] } },
          idParam,
        ],
      }),
    },

    // ── Search ──
    '/search': {
      get: op('Search', 'Global search across entities', {
        params: [queryParam('q', 'Search term'), projectParam],
      }),
    },
    '/search/advanced': {
      get: op('Search', 'Advanced multi-filter search', {
        params: [queryParam('q', 'Search term'), projectParam],
      }),
    },

    // ── Locations ──
    '/locations': {
      get: op('Locations', 'All mappable locations across entities', { params: [projectParam], responseSchema: objectArray }),
    },

    // ── Geocoding ──
    '/geocode': {
      get: op('Geocoding', 'Geocode one address to coordinates', {
        description:
          'Returns { lat, lng }. A miss returns 404 with a structured reason: ' +
          'not_found, low_confidence, timeout or service_error.',
        params: [{ ...queryParam('q', 'Address to geocode (at least 3 characters)'), required: true }],
      }),
    },
    '/geocode/batch': {
      post: op('Geocoding', 'Geocode every person location that is missing coordinates (legacy)', {
        admin: true, mcp: false,
      }),
    },
    '/geocode/batch-enhanced': {
      post: op('Geocoding', 'Geocode a supplied list of locations and write the results back', {
        admin: true, mcp: false,
        body: {
          type: 'object',
          properties: {
            locations: objectArray,
            minConfidence: { type: 'number', default: 30 },
            maxConcurrent: { type: 'integer', default: 3 },
          },
          required: ['locations'],
        },
      }),
    },
    '/geocode/suggestions': {
      get: op('Geocoding', 'Address autocomplete suggestions (rate limited: 60/min)', {
        params: [queryParam('q', 'Partial address')],
      }),
    },
    '/geocode/address': {
      post: op('Geocoding', 'Geocode a single address (rate limited: 60/min)', {
        body: { type: 'object', properties: { address: { type: 'string' } }, required: ['address'] },
      }),
    },
    '/geocode/stats': {
      get: op('Geocoding', 'Geocoding coverage statistics'),
    },

    // ── Relationships ──
    ...crudPaths('Relationships', '/relationships', 'RelationshipCreate', 'RelationshipUpdate', {
      getById: false,
      listParams: [
        queryParam('source_type', 'Filter by source entity type (person|business)'),
        queryParam('source_id', 'Filter by source entity id', { type: 'integer' }),
        queryParam('target_type', 'Filter by target entity type (person|business)'),
        queryParam('target_id', 'Filter by target entity id', { type: 'integer' }),
        queryParam('project_id', 'Filter by project', { type: 'integer' }),
        queryParam('case_id', 'Filter by case', { type: 'integer' }),
      ],
    }),

    // ── Wireless networks ──
    '/wireless-networks': {
      get: op('Wireless Networks', 'List wireless networks with filters', {
        params: [
          projectParam,
          queryParam('case_id', 'Filter by case', { type: 'integer' }),
          queryParam('person_id', 'Networks associated with this person', { type: 'integer' }),
          queryParam('ssid', 'Filter by SSID'),
          queryParam('bssid', 'Filter by BSSID'),
          queryParam('network_type', 'Filter by network type'),
          queryParam('encryption', 'Filter by encryption'),
          queryParam('import_source', 'Filter by the file the network was imported from'),
          queryParam('signal_min', 'Minimum signal strength (dBm)', { type: 'number' }),
          queryParam('signal_max', 'Maximum signal strength (dBm)', { type: 'number' }),
        ],
        responseSchema: objectArray,
      }),
      post: op('Wireless Networks', 'Create a wireless network', { body: anyObject }),
    },
    '/wireless-networks/{id}': {
      get: op('Wireless Networks', 'Get a wireless network', { params: [idParam] }),
      put: op('Wireless Networks', 'Update a wireless network', { params: [idParam], body: anyObject }),
      delete: op('Wireless Networks', 'Delete a wireless network', { params: [idParam] }),
    },
    '/wireless-networks/stats': {
      get: op('Wireless Networks', 'Wireless network statistics'),
    },
    '/wireless-networks/nearby': {
      get: op('Wireless Networks', 'Networks observed near a point', {
        params: [
          { ...queryParam('latitude', 'Latitude, -90 to 90', { type: 'number' }), required: true },
          { ...queryParam('longitude', 'Longitude, -180 to 180', { type: 'number' }), required: true },
          queryParam('radius', 'Search radius in kilometres', { type: 'number', default: 0.5 }),
          projectParam,
        ],
        responseSchema: objectArray,
      }),
    },
    '/wireless-networks/bulk-delete': {
      post: op('Wireless Networks', 'Delete many wireless networks in one request', {
        admin: true, mcp: false,
        body: {
          type: 'object',
          properties: {
            ids: { type: 'array', items: { type: 'integer' }, minItems: 1 },
            project_id: { type: 'integer', description: 'When given, only networks in this project are deleted.' },
          },
          required: ['ids'],
        },
      }),
    },
    '/wireless-networks/import-kml': {
      post: op('Wireless Networks', 'Import a WiGLE KML export', {
        mcp: false,
        description: 'Upload limit is KML_MAX_BYTES (default 5 MB); larger files return 413.',
        multipart: {
          type: 'object',
          properties: {
            kmlFile: { type: 'string', format: 'binary' },
            project_id: { type: 'integer', description: 'Project the imported networks land in.' },
          },
          required: ['kmlFile', 'project_id'],
        },
        responses: { 413: jsonResponse('KML file exceeds the size limit', ref('Error')) },
      }),
    },
    '/wireless-networks/{id}/associate': {
      post: op('Wireless Networks', 'Associate a network with a person', { params: [idParam], body: anyObject }),
      delete: op('Wireless Networks', 'Remove a person association', { params: [idParam] }),
    },

    // ── Settings ──
    '/settings/custom-fields': {
      get: op('Settings', 'List custom field definitions'),
      post: op('Settings', 'Create a custom field', { admin: true, body: ref('SettingsCustomFieldCreate') }),
    },
    '/settings/custom-fields/{id}': {
      put: op('Settings', 'Update a custom field', { admin: true, params: [idParam], body: ref('SettingsCustomFieldUpdate') }),
      delete: op('Settings', 'Delete a custom field', { admin: true, params: [idParam] }),
    },
    '/settings/branding': {
      get: {
        ...op('Settings', 'App name, logo and the default language/theme', {
          mcp: false,
          description: 'Public: the login screen needs it before a session exists.',
        }),
        security: [],
      },
      put: op('Settings', 'Update branding and the default language/theme', {
        admin: true, mcp: false, body: ref('SettingsBrandingUpdate'),
      }),
    },
    '/settings/geocoding': {
      get: op('Settings', 'Geocoding provider configuration', {
        admin: true, mcp: false,
        description: 'API keys are never returned, only whether each provider has one stored.',
      }),
      put: op('Settings', 'Set the geocoding provider and its API keys', {
        admin: true, mcp: false, body: ref('SettingsGeocodingUpdate'),
      }),
    },
    '/settings/updates': {
      get: op('Settings', 'Whether the update check is enabled', { admin: true, mcp: false }),
      put: op('Settings', 'Enable or disable the update check', {
        admin: true, mcp: false, body: ref('SettingsUpdateCheck'),
        description: 'When disabled the server makes no outbound request at all.',
      }),
    },
    '/settings/project-retention': {
      get: op('Settings', 'Archived-project retention period', { admin: true, mcp: false }),
      put: op('Settings', 'Set the archived-project retention period', {
        admin: true, mcp: false, body: ref('SettingsProjectRetention'),
        description:
          'Days a project may stay closed before it and all its data are permanently deleted. 0 means never.',
      }),
    },
    '/settings/model-options': {
      get: op('Settings', 'List model options (taxonomies: statuses, types, categories)'),
      post: op('Settings', 'Create a model option', { admin: true, body: ref('SettingsModelOptionCreate') }),
    },
    '/settings/model-options/{id}': {
      put: op('Settings', 'Update a model option', { admin: true, params: [idParam], body: ref('SettingsModelOptionUpdate') }),
      delete: op('Settings', 'Delete a model option', { admin: true, params: [idParam] }),
    },

    // ── Users (admin) ──
    '/users': {
      get: op('Users', 'List users', { admin: true }),
      post: op('Users', 'Create a user', { admin: true, body: anyObject }),
    },
    '/users/directory': {
      get: op('Users', 'Active users (id, username, email) for member pickers', {
        description: 'Available to any signed-in user, unlike the admin-only user list.',
        responseSchema: objectArray,
      }),
    },
    '/users/{id}': {
      get: op('Users', 'Get a user', { admin: true, params: [idParam] }),
      put: op('Users', 'Update a user', { admin: true, params: [idParam], body: anyObject }),
      delete: op('Users', 'Delete a user', { admin: true, params: [idParam] }),
    },

    // ── Audit logs (admin) ──
    '/audit-logs': {
      get: op('Audit Logs', 'List audit log entries', { admin: true }),
    },
    '/audit-logs/entity/{entity_type}/{entity_id}': {
      get: op('Audit Logs', 'Audit history for one entity', {
        admin: true,
        params: [
          { name: 'entity_type', in: 'path', required: true, schema: { type: 'string' } },
          { name: 'entity_id', in: 'path', required: true, schema: { type: 'integer' } },
        ],
      }),
    },
    '/audit-logs/stats': {
      get: op('Audit Logs', 'Audit log statistics', { admin: true }),
    },

    // ── System ──
    '/health': {
      get: {
        tags: ['System'],
        summary: 'Liveness and database connectivity',
        security: [],
        'x-mcp-exclude': true,
        responses: {
          200: jsonResponse('Healthy', anyObject),
          503: jsonResponse('Database unreachable', anyObject),
        },
      },
    },
    '/system/health': {
      get: op('System', 'Process, memory and database diagnostics', { admin: true, mcp: false }),
    },
    '/version': {
      get: op('System', 'Running version and whether a newer release exists', {
        mcp: false,
        params: [queryParam('force', 'Set to 1 to bypass the cached update check', { type: 'string', enum: ['1'] })],
      }),
    },
    '/openapi.json': {
      get: op('System', 'This document', { mcp: false }),
    },
    '/export': {
      get: op('System', 'Export every record in the database as one JSON file', {
        admin: true, mcp: false,
        description: 'Spans all projects. The file is the input format for POST /import.',
      }),
    },
    '/import': {
      post: op('System', 'Import a file produced by GET /export', {
        admin: true, mcp: false,
        description:
          'Records are created in the project named by project_id, with ids remapped. ' +
          'By default the import is best-effort and reports per-record failures.',
        params: [
          { ...queryParam('project_id', 'Project the imported records land in', { type: 'integer' }), required: true },
          queryParam('strict', 'Set to 1 to roll the whole import back if any record fails', { type: 'string', enum: ['1'] }),
        ],
        body: {
          type: 'object',
          properties: {
            version: { type: 'string' },
            exportDate: { type: 'string' },
            data: anyObject,
          },
          required: ['version', 'data'],
        },
      }),
    },
    '/upload/logo': {
      post: op('System', 'Upload an application logo', {
        admin: true, mcp: false,
        description:
          'Returns a logoUrl to store with PUT /settings/branding. Images only, 5 MB limit.',
        multipart: {
          type: 'object',
          properties: { appLogo: { type: 'string', format: 'binary' } },
          required: ['appLogo'],
        },
      }),
    },
  },
};

module.exports = spec;
