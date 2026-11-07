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

const intParam = (name, description) => queryParam(name, description, { type: 'integer' });
const caseParam = intParam('case_id', 'Filter by case');
const dateRangeParams = (field) => [
  queryParam('date_from', `Only ${field} on or after this date (YYYY-MM-DD)`),
  queryParam('date_to', `Only ${field} on or before this date (YYYY-MM-DD)`),
];

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
// opts.adminOnly: methods (e.g. ['post', 'delete']) that need an admin session.
// opts.deleteParams / opts.deleteDescription: extras for DELETE {base}/{id}.
// opts.getById / opts.listParams control extras.
function crudPaths(tag, base, createSchemaName, updateSchemaName, opts = {}) {
  const paths = {};
  const listResponse = opts.paginated ? paginatedEnvelope : objectArray;
  const admin = (method) => (opts.adminOnly || []).includes(method);

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
      admin: admin('post'),
      responses: { 201: jsonResponse('Created', anyObject) },
    }),
  };

  paths[`${base}/{id}`] = {
    ...(opts.getById !== false && { get: op(tag, `Get one by ID`, { params: [idParam] }) }),
    put: op(tag, `Update by ID`, { params: [idParam], body: ref(updateSchemaName) }),
    delete: op(tag, `Delete by ID`, {
      params: [idParam, ...(opts.deleteParams || [])],
      admin: admin('delete'),
      description: opts.deleteDescription,
    }),
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
      'REST API for GHOST. All endpoints (except login/session) require either an ' +
      'authenticated session cookie (POST /api/auth/login, then reuse the cookie) or a ' +
      'personal API token sent as `Authorization: Bearer ghost_…` (created under ' +
      'Settings → Security). Accounts with two-factor sign-in need the token: their ' +
      'login is not complete until POST /api/auth/mfa/verify. Validation errors return field-level detail: ' +
      '`{ "error": "Validation failed", "fields": { "<field>": ["<message>"] } }`. ' +
      'Endpoints marked x-requires-admin need an admin-role session.',
  },
  servers: [{ url: '/api' }],
  security: [{ cookieAuth: [] }, { bearerAuth: [] }],
  tags: [
    { name: 'Auth', description: 'Session login/logout and the current user profile. With two-factor on, login answers `mfa_required` and the session is signed in only after /auth/mfa/verify or the passkey step.' },
    { name: 'Account', description: 'The caller\'s own sign-in security: authenticator app, passkeys, recovery codes and personal API tokens. Needs a browser session; API tokens are refused here.' },
    { name: 'Projects', description: 'Projects are the isolation boundary: every case-scoped record belongs to exactly one. Non-admins only reach projects they are members of, with one role per project: owner > manager > investigator. Owners and managers edit project settings; membership changes are allowed only on members ranked below the caller, never on the caller themselves, and only admins appoint or remove owners. Creating and deleting projects is admin-only.' },
    { name: 'Cases', description: 'Cases group records inside a project.' },
    { name: 'People', description: 'Person records, including their locations.' },
    { name: 'Travel History', description: 'Travel entries and pattern analysis for a person.' },
    { name: 'Businesses', description: 'Organisations, their staff, and ownership chains.' },
    { name: 'Relationships', description: 'Typed links between people, businesses and crypto wallets.' },
    { name: 'Properties', description: 'Real estate and other mappable property.' },
    { name: 'Assets', description: 'Tracked items of value and who holds them.' },
    { name: 'Crypto Wallets', description: 'Wallet addresses as entities. GHOST records them; it does not do chain analysis.' },
    { name: 'Records', description: 'Saved records: results an integration returned, kept on a person exactly as the provider sent them (issue #96). Any member of the person\'s project may list, search, save and delete them.' },
    { name: 'Files', description: 'Documents attached to a person or to a project. Any project member may upload, download and edit them; deleting needs the uploader, a project owner or manager, or an admin. Every upload, download and delete is audit-logged.' },
    { name: 'Transactions', description: 'Transfers of value between people, businesses and external parties.' },
    { name: 'Ledger', description: 'Read-only views derived from transactions and asset holdings.' },
    { name: 'Wireless Networks', description: 'Wi-Fi/Bluetooth/cell observations, WiGLE KML import, and person associations.' },
    { name: 'Locations', description: 'Aggregated mappable locations across entities.' },
    { name: 'Geocoding', description: 'Address lookup through the configured geocoding provider.' },
    { name: 'Search', description: 'Global and advanced search.' },
    { name: 'Tools', description: 'The OSINT tool catalogue: links, and integrated tools GHOST calls server-side. Central tools are managed by admins and shared with everyone or with selected projects; users may add their own (when an admin allows it), private or shared with their projects. API keys are write-only and never returned.' },
    { name: 'Integrations', description: 'Installed integration manifests: the JSON definitions behind integrated tools. Built-ins ship with GHOST; admins can install community ones.' },
    { name: 'Todos', description: 'Investigation task list.' },
    { name: 'Scratchpad', description: 'The caller\'s private notepad: markdown notes and panel settings. Not project-scoped, and only ever visible to its owner.' },
    { name: 'Settings', description: 'Custom fields, model options (taxonomies) and instance configuration.' },
    { name: 'Users', description: 'User administration and the member-picker directory.' },
    { name: 'Audit Logs', description: 'Who changed what, and when.' },
    { name: 'System', description: 'Health, version, the OpenAPI document itself, and whole-database export/import.' },
  ],
  components: {
    securitySchemes: {
      cookieAuth: { type: 'apiKey', in: 'cookie', name: 'connect.sid' },
      bearerAuth: { type: 'http', scheme: 'bearer', description: 'Personal API token (ghost_…), created under Settings → Security.' },
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
      ToolCredential: toSchema(S.ToolCredentialSchema),
      ToolRun: toSchema(S.ToolRunSchema),
      ToolExport: toSchema(S.ToolExportSchema),
      ToolFileImport: toSchema(S.ToolFileImportSchema),
      IntegrationImport: toSchema(S.IntegrationImportSchema),
      IntegrationDraftTest: toSchema(S.IntegrationDraftTestSchema),
      IntegrationDraftMap: toSchema(S.IntegrationDraftMapSchema),
      SettingsTools: toSchema(S.SettingsToolsSchema),
      PersonOsintAppend: toSchema(S.PersonOsintAppendSchema),
      OsintRecordsAdd: toSchema(S.OsintRecordsAddSchema),
      SettingsModules: toSchema(S.SettingsModulesSchema),
      SsoLink: toSchema(S.SsoLinkSchema),
      SsoCreate: toSchema(S.SsoCreateSchema),
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
      ScratchpadEntryCreate: toSchema(S.ScratchpadEntryCreateSchema),
      ScratchpadEntryUpdate: toSchema(S.ScratchpadEntryUpdateSchema),
      ScratchpadSettings: toSchema(S.ScratchpadSettingsSchema),
      TravelHistoryCreate: toSchema(S.TravelHistoryCreateSchema),
      TravelHistoryUpdate: toSchema(S.TravelHistoryUpdateSchema),
      PropertyCreate: toSchema(S.PropertyCreateSchema),
      PropertyUpdate: toSchema(S.PropertyUpdateSchema),
      AssetCreate: toSchema(S.AssetCreateSchema),
      AssetUpdate: toSchema(S.AssetUpdateSchema),
      CryptoWalletCreate: toSchema(S.CryptoWalletCreateSchema),
      FileUpdate: toSchema(S.FileUpdateSchema),
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
      SettingsSecurity: toSchema(S.SettingsSecuritySchema),
      MfaVerify: toSchema(S.MfaVerifySchema),
      PasskeySignIn: toSchema(S.PasskeySignInSchema),
      TotpEnable: toSchema(S.TotpEnableSchema),
      PasswordConfirm: toSchema(S.PasswordConfirmSchema),
      PasskeyCreate: toSchema(S.PasskeyCreateSchema),
      ApiTokenCreate: toSchema(S.ApiTokenCreateSchema),
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
    '/auth/logout': {
      post: {
        ...op('Auth', 'Log out and destroy the session', {
          description: 'After a single sign-on session, `redirect` is the identity provider\'s sign-out address (OIDC_LOGOUT) for the browser to open.',
        }),
        security: [],
      },
    },
    '/auth/methods': {
      get: { ...op('Auth', 'How users can sign in: password, single sign-on, or both', { mcp: false }), security: [] },
    },
    '/auth/oidc/login': {
      get: {
        ...op('Auth', 'Single sign-on: send the browser to the identity provider', {
          mcp: false,
          description: 'A browser navigation, not an API call (issue #105). Redirects to the OpenID Connect provider (Authorization Code + PKCE).',
          responses: { 302: { description: 'Redirect to the identity provider, or to /?sso_error=… when single sign-on is off or unreachable' } },
        }),
        security: [],
      },
    },
    '/auth/oidc/callback': {
      get: {
        ...op('Auth', 'Single sign-on: the identity provider sends the browser back here', {
          mcp: false,
          params: [queryParam('error', 'Set by the identity provider when the sign-in was cancelled or failed (it also adds code, state and iss).')],
          description: 'Checks the answer (state, nonce, PKCE, ID token) and starts a GHOST session for the linked user. '
            + 'Redirects to / on success, or /?sso_error=not_linked|inactive|email_in_use|expired|denied|failed.',
          responses: { 302: { description: 'Redirect into GHOST' } },
        }),
        security: [],
      },
    },
    '/auth/mfa/verify': {
      post: {
        ...op('Auth', 'Second sign-in step: authenticator code or recovery code', {
          body: ref('MfaVerify'), mcp: false,
          description: 'After a login that answered `mfa_required`. Send `code` (6 digits) or `recovery_code`. Five wrong codes end the attempt; log in again.',
        }),
        security: [],
      },
    },
    '/auth/mfa/passkey/options': {
      post: { ...op('Auth', 'Second sign-in step: start a passkey check', { mcp: false }), security: [] },
    },
    '/auth/mfa/passkey/verify': {
      post: { ...op('Auth', 'Second sign-in step: finish a passkey check', { body: ref('PasskeySignIn'), mcp: false }), security: [] },
    },

    // ── Account security (issue #90) ──
    '/account/security': {
      get: op('Account', 'Two-factor status, passkeys and where passkeys can be used', { mcp: false }),
    },
    '/account/totp/setup': {
      post: op('Account', 'Start authenticator-app setup (new secret and QR code)', { mcp: false }),
    },
    '/account/totp': {
      post: op('Account', 'Confirm authenticator-app setup with a code', { body: ref('TotpEnable'), mcp: false,
        description: 'Returns `recovery_codes` when this is the first two-factor method; they are shown only once.' }),
      delete: op('Account', 'Remove the authenticator app', { body: ref('PasswordConfirm'), mcp: false }),
    },
    '/account/recovery-codes': {
      post: op('Account', 'Replace the recovery codes', { body: ref('PasswordConfirm'), mcp: false }),
    },
    '/account/passkeys/options': {
      post: op('Account', 'Start adding a passkey', { mcp: false }),
    },
    '/account/passkeys': {
      post: op('Account', 'Finish adding a passkey', { body: ref('PasskeyCreate'), mcp: false }),
    },
    '/account/passkeys/{id}': {
      delete: op('Account', 'Remove a passkey', { params: [idParam], body: ref('PasswordConfirm'), mcp: false }),
    },
    '/account/tokens': {
      get: op('Account', 'List personal API tokens', { mcp: false, responseSchema: objectArray }),
      post: op('Account', 'Create a personal API token', { body: ref('ApiTokenCreate'), mcp: false,
        description: 'The token is in this response only; GHOST stores a hash.' }),
    },
    '/account/tokens/{id}': {
      delete: op('Account', 'Revoke a personal API token', { params: [idParam], mcp: false }),
    },
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
      listParams: [...paginationParams, caseParam],
    }),
    '/people/{id}/osint': {
      post: op('People', 'Add OSINT data entries to a person', {
        params: [idParam], body: ref('PersonOsintAppend'),
        description: 'Appends entries. A value the person already has (same type and value) gets the new finding added to its `sources` instead of a second entry; '
          + 'running the same search again refreshes that finding\'s count and date. New entries with a source are marked unverified. '
          + 'Answers { added, updated, unchanged, osint_data }.',
      }),
    },
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
    ...crudPaths('Tools', '/tools', 'ToolCreate', 'ToolUpdate', {
      getById: false,
      projectScoped: true,
      listParams: [queryParam('all', 'Admins only: "true" lists every tool, including users\' private ones', { type: 'string' })],
    }),
    '/tools/{id}/credentials': {
      put: op('Tools', 'Set an API key for an integrated tool', {
        mcp: false, params: [idParam], body: ref('ToolCredential'),
        description: 'scope "shared" sets the key everyone uses (needs the right to manage the tool); scope "mine" sets the caller\'s own key for tools using per-user keys. Keys are stored encrypted and never returned.',
      }),
      delete: op('Tools', 'Remove an API key', {
        mcp: false, params: [idParam, queryParam('scope', '"shared" (default) or "mine"')],
      }),
    },
    '/tools/{id}/run': {
      post: op('Tools', 'Search with an integrated tool', {
        mcp: false, params: [idParam], body: ref('ToolRun'),
        description: 'Calls the integration server-side and returns its results mapped into fields. With person_id the tool must be available in that person\'s project. Rate-limited, audit-logged.',
      }),
    },
    '/tools/{id}/test': {
      post: op('Tools', 'Test an integrated tool\'s connection and key', { mcp: false, params: [idParam] }),
    },
    '/tools/export': {
      post: op('Tools', 'Export the tool list', {
        mcp: false, body: ref('ToolExport'),
        description: 'include_config adds sharing settings for tools the caller manages; with a passphrase (8+ characters) their shared API keys are included, encrypted with it.',
      }),
    },
    '/tools/import': {
      post: op('Tools', 'Import a tool list exported by GHOST', {
        mcp: false, body: ref('ToolFileImport'),
        description: 'Admins import central tools, other users their own. include_config applies the file\'s sharing settings (projects matched by name) and, with the passphrase, its API keys. project_id assigns every tool to that project instead.',
      }),
    },
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
    // ── Scratchpad (private to the caller; kept out of the MCP toolset) ──
    '/scratchpad': {
      get: op('Scratchpad', 'Get the caller\'s notes and scratchpad settings', { mcp: false }),
    },
    '/scratchpad/entries': {
      post: op('Scratchpad', 'Add a note', {
        mcp: false, body: ref('ScratchpadEntryCreate'),
        responses: { 201: jsonResponse('Created', anyObject) },
      }),
      delete: op('Scratchpad', 'Clear every note', {
        mcp: false,
        params: [queryParam('up_to_id', 'Only clear notes with an id up to and including this one', { type: 'integer' })],
      }),
    },
    '/scratchpad/entries/{id}': {
      put: op('Scratchpad', 'Edit a note', { mcp: false, params: [idParam], body: ref('ScratchpadEntryUpdate') }),
      delete: op('Scratchpad', 'Delete a note', { mcp: false, params: [idParam] }),
    },
    '/scratchpad/settings': {
      put: op('Scratchpad', 'Update scratchpad settings (only the keys sent change)', { mcp: false, body: ref('ScratchpadSettings') }),
    },
    ...crudPaths('Cases', '/cases', 'CaseCreate', 'CaseUpdate', { getById: false, projectScoped: true }),
    ...crudPaths('Projects', '/projects', 'ProjectCreate', 'ProjectUpdate', {
      getById: false,
      adminOnly: ['post', 'delete'],
      deleteParams: [
        queryParam('confirm_name', 'The project name, echoed back. Required when the project still contains data.'),
      ],
      deleteDescription:
        'Removes the project and every project-scoped record in it. GET /projects/{id}/stats ' +
        'shows what would be destroyed.',
    }),
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
        description: 'Requires the owner or manager role on the project, or admin. Only an admin may add an owner; only an owner or admin may add a manager. Returns 409 if the user is already a member.',
        params: [idParam],
        body: ref('ProjectMemberCreate'),
        responses: {
          201: jsonResponse('Member added', anyObject),
          403: jsonResponse('Not an owner or manager of this project, or the change is above their role', ref('Error')),
          409: jsonResponse('Already a member', ref('Error')),
        },
      }),
    },
    '/projects/{id}/members/{userId}': {
      put: op('Projects', "Change a member's project role", {
        description: "Requires the owner or manager role on the project, or admin. Roles rank owner > manager > investigator: a non-admin may only change members ranked below themselves, may only grant roles below their own, and may not change their own membership.",
        params: [idParam, userIdParam],
        body: ref('ProjectMemberUpdate'),
        responses: { 403: jsonResponse('Not an owner or manager of this project, or the change is above their role', ref('Error')) },
      }),
      delete: op('Projects', 'Remove a member from a project', {
        description: 'Requires the owner or manager role on the project, or admin. A non-admin may only remove members ranked below themselves (owner > manager > investigator), and may not remove themselves.',
        params: [idParam, userIdParam],
        responses: { 403: jsonResponse('Not an owner or manager of this project, or the change is above their role', ref('Error')) },
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
    ...crudPaths('Assets', '/assets', 'AssetCreate', 'AssetUpdate', {
      paginated: true,
      projectScoped: true,
      listParams: [
        queryParam('category', 'Filter by category (an asset_category model option)'),
        queryParam('status', 'Filter by status'),
        caseParam,
        queryParam('q', 'Search name/identifier'),
        intParam('holder_person_id', 'Assets currently held by this person'),
        queryParam('bbox', 'Map bounds filter: west,south,east,north'),
      ],
    }),

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

    // ── Saved records (issue #96) ──
    '/records': {
      get: op('Records', 'List or search saved records', {
        description: 'Newest first. `q` matches any text in a record, its source or the search that found it.',
        params: [
          ...paginationParams,
          projectParam,
          intParam('person_id', 'Only records saved on this person'),
          queryParam('integration_id', 'Only records from this integration'),
          queryParam('q', 'Text anywhere in the record'),
        ],
        responseSchema: paginatedEnvelope,
      }),
      post: op('Records', 'Save integration records on a person', {
        body: ref('OsintRecordsAdd'),
        description: 'Each record is kept exactly as sent (max 100 KB, nesting 32 levels). A record the person already has from the same integration, '
          + 'with the same content in any key order, is refreshed (latest search, date and count) instead of saved twice. '
          + 'Answers { added, updated, unchanged, rejected: [{ index, error }], saved: [{ index, id }] }.',
      }),
    },
    '/records/{id}': {
      get: op('Records', 'Get a saved record', { params: [idParam] }),
      delete: op('Records', 'Delete a saved record', { params: [idParam] }),
    },

    // ── Files (issue #97) ──
    '/files': {
      get: op('Files', 'List files', {
        description: 'Newest first. Returns metadata only; fetch the bytes from /files/{id}/content.',
        params: [
          ...paginationParams,
          projectParam,
          intParam('person_id', 'Only files attached to this person'),
          intParam('uploaded_by', 'Only files uploaded by this user'),
          queryParam('q', 'Search file name and description'),
        ],
        responseSchema: paginatedEnvelope,
      }),
      post: op('Files', 'Upload a file', {
        mcp: false,
        description: 'Send project_id for a project-level file, or person_id to attach it to a person ' +
          '(the project then comes from the person). Upload limit is FILES_MAX_BYTES (default 50 MB); ' +
          'larger files return 413. The SHA-256 of the stored bytes is returned as `sha256`.',
        multipart: {
          type: 'object',
          properties: {
            file: { type: 'string', format: 'binary' },
            project_id: { type: 'integer' },
            person_id: { type: 'integer' },
            description: { type: 'string', maxLength: 2000 },
          },
          required: ['file'],
        },
        responses: {
          201: jsonResponse('Uploaded', anyObject),
          413: jsonResponse('File exceeds the size limit', ref('Error')),
        },
      }),
    },
    '/files/{id}': {
      get: op('Files', 'Get file metadata', { params: [idParam] }),
      put: op('Files', 'Edit a file\'s description or person', {
        params: [idParam],
        body: ref('FileUpdate'),
        description: 'Only the fields sent change. person_id: null moves the file to project level.',
      }),
      delete: op('Files', 'Delete a file', {
        params: [idParam],
        description: 'Allowed for the uploader, the project\'s owners and managers, and admins.',
      }),
    },
    '/files/{id}/content': {
      get: op('Files', 'Download a file', {
        mcp: false,
        params: [idParam, queryParam('preview', 'Send 1 when the bytes are for an in-app preview; logged as a view instead of a download.')],
        description: 'Always sent as an attachment with Content-Type application/octet-stream.',
        responses: {
          200: { description: 'The file', content: { 'application/octet-stream': { schema: { type: 'string', format: 'binary' } } } },
          410: jsonResponse('The stored file is missing from disk', ref('Error')),
        },
      }),
    },

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
        intParam('business_id', 'Transactions where the business is giver, receiver, subject or venue'),
        intParam('wallet_id', 'Transactions where the crypto wallet is sender or receiver'),
        queryParam('tx_hash', 'Exact on-chain transaction hash'),
        intParam('subject_asset_id', 'Filter by the asset the transaction is about'),
        intParam('subject_business_id', 'Filter by the business the transaction is about'),
        intParam('subject_property_id', 'Filter by the property the transaction is about'),
        intParam('location_business_id', 'Filter by venue (business)'),
        intParam('location_property_id', 'Filter by venue (property)'),
        caseParam,
        ...dateRangeParams('transactions that occurred'),
        queryParam('bbox', 'Map bounds filter: west,south,east,north'),
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
          caseParam,
          ...dateRangeParams('transactions that occurred'),
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
      get: op('Search', 'Advanced multi-filter search over people', {
        params: [
          queryParam('searchText', 'Text to look for'),
          queryParam('searchIn[]', 'Fields searchText is matched against. Defaults to name.', {
            type: 'array', items: { type: 'string', enum: ['name', 'aliases', 'notes'] },
          }),
          queryParam('categories[]', 'Only people in one of these categories', { type: 'array', items: { type: 'string' } }),
          queryParam('statuses[]', 'Only people with one of these statuses', { type: 'array', items: { type: 'string' } }),
          queryParam('dateFilter', 'Which timestamp dateFrom/dateTo apply to. Defaults to updated; all ignores the dates.', {
            type: 'string', enum: ['updated', 'created', 'all'],
          }),
          queryParam('dateFrom', 'Earliest timestamp (inclusive)'),
          queryParam('dateTo', 'Latest timestamp (inclusive)'),
          queryParam('sortBy', 'Sort column', {
            type: 'string', default: 'updated_at',
            enum: ['updated_at', 'created_at', 'first_name', 'last_name', 'status', 'category'],
          }),
          queryParam('sortOrder', 'Sort direction', { type: 'string', enum: ['asc', 'desc'], default: 'desc' }),
          queryParam('limit', 'Maximum rows', { type: 'integer', default: 100, maximum: 500 }),
          projectParam,
        ],
      }),
    },

    // ── Locations ──
    '/locations': {
      get: op('Locations', 'All mappable locations across entities', {
        params: [
          projectParam,
          caseParam,
          queryParam('limit', 'Maximum people returned', { type: 'integer', default: 100 }),
          queryParam('offset', 'People to skip', { type: 'integer', default: 0 }),
          queryParam('bbox', 'Map bounds filter: minLng,minLat,maxLng,maxLat'),
          queryParam('confidence', 'Minimum geocode confidence, 0-100', { type: 'integer', default: 30 }),
          queryParam('includeUngeocoded', 'Send true to also return people whose locations have no coordinates', {
            type: 'string', enum: ['true'],
          }),
        ],
        responseSchema: objectArray,
      }),
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
        params: [
          queryParam('q', 'Partial address (at least 3 characters)'),
          queryParam('limit', 'Maximum suggestions', { type: 'integer', default: 5 }),
        ],
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
      get: op('Wireless Networks', 'Wireless network statistics', { params: [projectParam] }),
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
      post: op('Wireless Networks', 'Associate a network with a person or business', {
        params: [idParam],
        body: {
          type: 'object',
          description: 'One of person_id or business_id is required.',
          properties: {
            person_id: { type: 'integer' },
            business_id: { type: 'integer' },
            association_note: { type: 'string' },
            association_confidence: { type: 'string' },
          },
        },
      }),
      delete: op('Wireless Networks', 'Remove an association from a network', {
        description:
          'Removes the named person or business. With neither given, every association on the network is cleared.',
        params: [idParam],
        body: {
          type: 'object',
          properties: {
            person_id: { type: 'integer' },
            business_id: { type: 'integer' },
          },
        },
      }),
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
    '/settings/modules': {
      get: op('Settings', 'Which sections the interface shows', {
        description: '`available`: the sections an admin can switch off; `disabled`: the ones switched off. Display only: their data and API stay.',
      }),
      put: op('Settings', 'Switch interface sections off or on', { admin: true, mcp: false, body: ref('SettingsModules') }),
    },
    '/settings/tools': {
      get: op('Settings', 'OSINT tools policy (whether users may add their own tools)'),
      put: op('Settings', 'Set the OSINT tools policy', { admin: true, mcp: false, body: ref('SettingsTools') }),
    },
    '/integrations': {
      get: op('Integrations', 'List installed integrations', {
        description: 'Each entry shows the host it calls, how it authenticates and its operations.',
      }),
      post: op('Integrations', 'Install a community integration manifest', {
        admin: true, mcp: false, body: ref('IntegrationImport'),
        description: 'The manifest is validated; built-in ids can\'t be replaced. replace=true updates an imported one.',
      }),
    },
    '/integrations/draft/test': {
      post: op('Integrations', 'Integration builder: test one search of an uninstalled integration', {
        admin: true, mcp: false, body: ref('IntegrationDraftTest'),
        description: 'Validates the draft, makes one request through the same guarded client as normal searches, and returns the (trimmed) response. The secret is used once and never stored.',
      }),
    },
    '/integrations/draft/map': {
      post: op('Integrations', 'Integration builder: preview how a response maps to results', {
        admin: true, mcp: false, body: ref('IntegrationDraftMap'),
        description: 'Pure mapping; makes no outbound request.',
      }),
    },
    '/integrations/{id}': {
      get: op('Integrations', 'Get an integration and its full manifest', {
        params: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
      }),
      delete: op('Integrations', 'Remove an imported integration', {
        admin: true, mcp: false, params: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        description: 'Refused while tools still use it. Built-ins can\'t be removed.',
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
    '/settings/security': {
      get: op('Settings', 'Get sign-in security settings', { admin: true, mcp: false }),
      put: op('Settings', 'Require two-factor sign-in for every user', { admin: true, body: ref('SettingsSecurity'), mcp: false }),
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
    '/users/sso': {
      get: op('Users', 'Single sign-on status and sign-ins waiting for an admin', {
        admin: true, mcp: false,
        description: 'Sign-ins that matched no linked account (issue #105). Link each to an existing user or create a user for it.',
      }),
    },
    '/users/sso/pending/{id}': {
      delete: op('Users', 'Dismiss a waiting single sign-on request', { admin: true, mcp: false, params: [idParam] }),
    },
    '/users/sso/pending/{id}/link': {
      post: op('Users', 'Link a waiting single sign-on request to an existing user', { admin: true, mcp: false, params: [idParam], body: ref('SsoLink') }),
    },
    '/users/sso/pending/{id}/create': {
      post: op('Users', 'Create a user for a waiting single sign-on request', {
        admin: true, mcp: false, params: [idParam], body: ref('SsoCreate'),
        description: 'The user has no GHOST password and signs in with single sign-on only.',
      }),
    },
    '/users/{id}/sso': {
      get: op('Users', 'Single sign-on identities linked to a user', { admin: true, mcp: false, params: [idParam] }),
    },
    '/users/{id}/sso/{identityId}': {
      delete: op('Users', 'Unlink a single sign-on identity (signs the user out)', {
        admin: true, mcp: false,
        params: [idParam, { name: 'identityId', in: 'path', required: true, schema: { type: 'integer', minimum: 1 } }],
      }),
    },
    '/users/{id}/two-factor': {
      delete: op('Users', 'Reset a user\'s two-factor sign-in', { admin: true, params: [idParam], mcp: false,
        description: 'Removes their authenticator app, passkeys and recovery codes and signs them out everywhere.' }),
    },
    '/users/{id}': {
      get: op('Users', 'Get a user', { admin: true, params: [idParam] }),
      put: op('Users', 'Update a user', { admin: true, params: [idParam], body: anyObject }),
      delete: op('Users', 'Delete a user', { admin: true, params: [idParam] }),
    },

    // ── Audit logs (admin) ──
    '/audit-logs': {
      get: op('Audit Logs', 'List audit log entries', {
        admin: true,
        params: [
          queryParam('entity_type', 'Filter by entity type'),
          intParam('entity_id', 'Filter by entity id'),
          intParam('user_id', 'Filter by the user who made the change'),
          queryParam('action', 'Filter by action'),
          queryParam('start_date', 'Entries at or after this timestamp'),
          queryParam('end_date', 'Entries at or before this timestamp'),
          ...paginationParams.map((param) => ({ ...param, schema: { type: 'integer', default: param.schema.default } })),
        ],
      }),
    },
    '/audit-logs/entity/{entity_type}/{entity_id}': {
      get: op('Audit Logs', 'Audit history for one entity', {
        admin: true,
        params: [
          { name: 'entity_type', in: 'path', required: true, schema: { type: 'string' } },
          { name: 'entity_id', in: 'path', required: true, schema: { type: 'integer' } },
          ...paginationParams.map((param) => ({ ...param, schema: { type: 'integer', default: param.schema.default } })),
        ],
      }),
    },
    '/audit-logs/stats': {
      get: op('Audit Logs', 'Audit log statistics', {
        admin: true,
        params: [
          queryParam('start_date', 'Count entries at or after this timestamp'),
          queryParam('end_date', 'Count entries at or before this timestamp'),
        ],
      }),
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
      get: op('System', 'Export investigation data as one JSON file', {
        admin: true, mcp: false,
        description:
          'Spans all projects. Covers people, businesses, properties, assets, transactions, wireless ' +
          'networks, tools, todos, cases, travel history, custom fields and model options. Not included: ' +
          'crypto wallets, relationship rows, projects and their members, users and audit logs — use a ' +
          'database backup for a complete copy. The file is the input format for POST /import.',
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
