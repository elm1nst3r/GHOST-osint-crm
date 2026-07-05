// File: backend/utils/openapiSpec.js
// Builds an OpenAPI 3.1 document from the Zod schemas in middleware/schemas.js.
// Zod 4's native z.toJSONSchema() is the single source of truth for request
// bodies — no schema duplication (issue #44). Served at GET /api/openapi.json.

const { z } = require('zod');
const { version } = require('../package.json');
const S = require('../middleware/schemas');

// ── Zod → JSON Schema ─────────────────────────────────────────────────────────

function toSchema(zodSchema) {
  const json = z.toJSONSchema(zodSchema, { io: 'input', unrepresentable: 'any' });
  delete json.$schema; // component schemas inherit the document's dialect
  return json;
}

// ── shared building blocks ────────────────────────────────────────────────────

const ref = (name) => ({ $ref: `#/components/schemas/${name}` });

const idParam = {
  name: 'id', in: 'path', required: true,
  schema: { type: 'integer', minimum: 1 },
};

const paginationParams = [
  { name: 'limit', in: 'query', schema: { type: 'integer', default: 100, maximum: 1000 } },
  { name: 'offset', in: 'query', schema: { type: 'integer', default: 0, minimum: 0 } },
];

const queryParam = (name, description, schema = { type: 'string' }) =>
  ({ name, in: 'query', description, schema });

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
  const { params, body, responses, admin, description } = extra;
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
  if (admin) o['x-requires-admin'] = true;
  return o;
}

// Standard CRUD path set for one entity.
// opts.paginated: list returns { data, meta }; otherwise a plain array.
// opts.getById / opts.listParams control extras.
function crudPaths(tag, base, createSchemaName, updateSchemaName, opts = {}) {
  const paths = {};
  const listResponse = opts.paginated ? paginatedEnvelope : objectArray;

  paths[base] = {
    get: op(tag, `List ${tag}`, {
      params: [...(opts.paginated ? paginationParams : []), ...(opts.listParams || [])],
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
      CaseCreate: toSchema(S.CaseCreateSchema),
      CaseUpdate: toSchema(S.CaseUpdateSchema),
      TodoCreate: toSchema(S.TodoCreateSchema),
      TodoUpdate: toSchema(S.TodoUpdateSchema),
      TravelHistoryCreate: toSchema(S.TravelHistoryCreateSchema),
      TravelHistoryUpdate: toSchema(S.TravelHistoryUpdateSchema),
      PropertyCreate: toSchema(S.PropertyCreateSchema),
      PropertyUpdate: toSchema(S.PropertyUpdateSchema),
      AssetCreate: toSchema(S.AssetCreateSchema),
      AssetUpdate: toSchema(S.AssetUpdateSchema),
      TransactionCreate: toSchema(S.TransactionCreateSchema),
      TransactionUpdate: toSchema(S.TransactionUpdateSchema),
      SettingsCustomFieldCreate: toSchema(S.SettingsCustomFieldCreateSchema),
      SettingsCustomFieldUpdate: toSchema(S.SettingsCustomFieldUpdateSchema),
      SettingsModelOptionCreate: toSchema(S.SettingsModelOptionCreateSchema),
      SettingsModelOptionUpdate: toSchema(S.SettingsModelOptionUpdateSchema),
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
    ...crudPaths('People', '/people', 'PersonCreate', 'PersonUpdate', {
      paginated: true,
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
    ...crudPaths('Businesses', '/businesses', 'BusinessCreate', 'BusinessUpdate'),
    '/businesses/{id}/transactions': {
      get: op('Ledger', 'Transactions a business appears in', { params: [idParam], responseSchema: objectArray }),
    },
    '/businesses/{id}/venue-stats': {
      get: op('Ledger', 'Venue analytics: distinct visitors and ranked people', { params: [idParam] }),
    },

    // ── Tools / Todos / Cases ──
    ...crudPaths('Tools', '/tools', 'ToolCreate', 'ToolUpdate', { getById: false }),
    ...crudPaths('Todos', '/todos', 'TodoCreate', 'TodoUpdate', { getById: false }),
    ...crudPaths('Cases', '/cases', 'CaseCreate', 'CaseUpdate', { getById: false }),

    // ── Properties ──
    ...crudPaths('Properties', '/properties', 'PropertyCreate', 'PropertyUpdate', {
      paginated: true,
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
    ...crudPaths('Assets', '/assets', 'AssetCreate', 'AssetUpdate', { paginated: true }),

    // ── Transactions ──
    ...crudPaths('Transactions', '/transactions', 'TransactionCreate', 'TransactionUpdate', {
      paginated: true,
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
        params: [queryParam('q', 'Search term')],
      }),
    },
    '/search/advanced': {
      get: op('Search', 'Advanced multi-filter search', {
        params: [queryParam('q', 'Search term')],
      }),
    },

    // ── Locations ──
    '/locations': {
      get: op('Locations', 'All mappable locations across entities', { responseSchema: objectArray }),
    },

    // ── Geocoding ──
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

    // ── Entity network ──
    '/entity-relationships': {
      get: op('Relationships', 'List entity relationships'),
      post: op('Relationships', 'Create an entity relationship', { body: anyObject }),
    },
    '/entity-relationships/{id}': {
      delete: op('Relationships', 'Delete an entity relationship', { params: [idParam] }),
    },
    '/relationship-types': {
      get: op('Relationships', 'Available relationship types'),
    },
    '/entity-network': {
      get: op('Relationships', 'Full entity network graph (nodes and edges)'),
    },

    // ── Wireless networks ──
    '/wireless-networks': {
      get: op('Wireless Networks', 'List wireless networks with filters', { responseSchema: objectArray }),
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
    '/wireless-networks/{id}/associate': {
      post: op('Wireless Networks', 'Associate a network with a person', { params: [idParam], body: anyObject }),
      delete: op('Wireless Networks', 'Remove a person association', { params: [idParam] }),
    },

    // ── Settings ──
    '/settings/custom-fields': {
      get: op('Settings', 'List custom field definitions', { admin: true }),
      post: op('Settings', 'Create a custom field', { admin: true, body: ref('SettingsCustomFieldCreate') }),
    },
    '/settings/custom-fields/{id}': {
      put: op('Settings', 'Update a custom field', { admin: true, params: [idParam], body: ref('SettingsCustomFieldUpdate') }),
      delete: op('Settings', 'Delete a custom field', { admin: true, params: [idParam] }),
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
  },
};

module.exports = spec;
