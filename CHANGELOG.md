# Changelog

All notable changes to GHOST OSINT CRM will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### ✨ Added — OpenAPI specification endpoint (issue #44, phase A)

- **`GET /api/openapi.json`** (authenticated) serves a machine-readable OpenAPI
  3.1 document describing the full API surface: 54 paths, request-body schemas
  for every POST/PUT, auth flow, pagination, rate limits, and admin-only markers.
- Generated at startup from the Zod schemas in `middleware/schemas.js` via
  Zod 4's native `z.toJSONSchema()` — **zero new dependencies** and no duplicated
  schema definitions. Validation and documentation share one source of truth.
- MCP services and other API clients can now discover the schema from the API
  itself instead of hand-maintaining copies.
- Corrected: the people list is documented as returning a plain array with
  pagination headers (`X-Total-Count` / `X-Has-More`), matching actual
  behaviour (issue #40 backwards compatibility) — not the `{ data, meta }`
  envelope used by newer list endpoints.

### ✨ Added — Bundled MCP server (issue #44, phase B)

- **New `mcp/` package**: a Model Context Protocol server (`mcp/ghost-mcp.js`)
  that exposes the entire GHOST API as LLM tools over stdio. Works with Claude
  Desktop, Claude Code, and any MCP-compatible client — see `mcp/README.md`.
- **Spec-driven, zero duplication**: tools are generated at startup from the
  live `GET /api/openapi.json` — 86 tools covering every endpoint, with real
  request schemas. Upgrading GHOST automatically upgrades the toolset.
- **Duplicate protection**: `ghost_create_people` / `ghost_create_businesses`
  check for same-name records first and refuse with a match list unless
  `ignorePossibleDuplicates: true` — guards against LLMs inserting without
  searching. Pattern adapted from @zbyte64's original implementation
  (issue #44), with credit.
- **Transparent session handling**: logs in with `GHOST_USERNAME` /
  `GHOST_PASSWORD` env vars and re-authenticates automatically on expiry.

## [2.7.0] - 2026-07-06

### ✨ Added — Asset, Property & Transaction Tracking (issue #43)

A unified system for recording persistent physical goods (assets), real estate
(properties), and one-off transactions/benefits that flow between people,
businesses, and places. Every change of hands or benefit is one row in a single
`transactions` event log; assets get their chain of custody "for free" from the
same log.

- **New tables** (created in `backend/server.js` `initializeDatabase()`):
  `properties`, `assets`, `transactions` — with indexes, `updated_at` triggers,
  and `ON CONFLICT DO NOTHING` seeds.
- **New `model_options` taxonomies**, editable in Settings → Data Model:
  `transaction_type`, `transaction_item_category`, `asset_category`,
  `asset_status`, `property_type`.
- **Backend routes** (`requireAuth` + `validateIdParam`, list shape
  `{ data, meta }`): `routes/properties.js`, `routes/assets.js`,
  `routes/transactions.js`, `routes/ledger.js`. Convenience sub-routes:
  `GET /api/people/:id/transactions`, `GET /api/people/:id/assets`,
  `GET /api/businesses/:id/transactions`, `GET /api/businesses/:id/venue-stats`,
  `GET /api/properties/:id/transactions`, and the unified entity ledger
  `GET /api/:entityType/:id/ledger`.
- **Polymorphic** giver/receiver (person | business | external), subject
  (free-text item + category | asset | business | property), and event location
  (business venue | property | free-text + geocode).
- **Derived (never stored)** current holder / chain of custody for assets, and
  current owner for businesses & properties (from `sale|purchase|transfer|acquisition`).
- **Asset location model**: `with_holder` (rides the holder's latest known
  position), `fixed_known` (live-linked to a person's `people.locations` entry with
  coordinate snapshot fallback), `fixed_custom` (own geocoded address), `unknown`.
- **Geocoding** of asset/property/transaction free-text addresses via
  `improvedGeocodingService`; failures are non-fatal and surface a reason.
- **Frontend**: new sections (Properties, Assets, Transactions) with list /
  add-edit / detail components, `DataContext` slices, `assetsAPI`/`propertiesAPI`/
  `transactionsAPI`/`ledgerAPI`. Detail panels on Person (Gifts & Transactions,
  Assets Held, Ledger), Business (Venue Activity, Transactions, Ledger), Asset and
  Property (chain-of-custody timelines).
- **Entity Ledger** view (`EntityLedger.js`) + exportable "Entity Ledger" report
  type (markdown / .docx via the existing Report Generator).
- **Global Map**: property / asset / transaction layers with toggles and
  type/category filters.
- **Entity-network graph**: toggleable venue/transaction layer rendering businesses
  and properties as hubs with edge thickness reflecting event count.
- **Tests**: `backend/utils/transactionHelpers.test.js` covering party/subject/
  location resolution, derived custody, geocoding, venue-stats aggregation, ledger
  role/value-direction derivation, and transaction validation rules.

#### Deferred (Phase 2)
- Cross-venue ranked "influence" leaderboard and trend analytics.
- Per-transaction historical coordinates of a moving asset (reconstructable from
  the holder's `travel_history`).
- Auto-mutating `owner_person_id` from the custody chain (current owner stays
  derived for display; the quick field is left untouched).
- Bulk import.

### 🛡️ Added — Zod schema validation (issue #49)

- **New `backend/middleware/schemas.js`**: 20 Zod schemas covering every entity
  (people, businesses, tools, cases, todos, travel history, properties, assets,
  transactions, settings custom-fields and model-options) plus a `validate(schema)`
  middleware factory wired into all POST/PUT routes.
- **Structured validation errors**: bad input now returns
  `{ "error": "Validation failed", "fields": { "email": ["Invalid email"] } }`
  instead of a generic message — machine-readable field-level feedback (groundwork
  for OpenAPI/MCP support, issue #44).
- **Unknown fields stripped** from request bodies before they reach handlers.
- **Removed** the hand-rolled `validatePersonData` / `validateBusinessData` /
  `validateToolData` middleware and the dead in-memory rate limiter from
  `validation.js`.

### ✨ Added — API improvements (PR #45, @zbyte64)

- `GET /api/people/:id` — fetch a single person by ID.
- `GET /api/businesses/:id` — fetch a single business by ID.
- **Tunable login rate limiting** via env vars: `LOGIN_RATE_LIMIT_MAX`,
  `LOGIN_RATE_LIMIT_WINDOW_MS`, `LOGIN_RATE_LIMIT_DISABLE=true` (for automated
  clients). Default remains 10 attempts / 15 min.
- Business API 500 responses include an error `detail` in non-production
  environments to aid debugging (suppressed in production).

### 🔒 Security

- **General API rate limiter**: 300 requests/IP/min applied to all authenticated
  data-access routes (resolves 20 CodeQL missing-rate-limiting alerts).
- **Error detail leakage**: raw database error messages are no longer exposed to
  clients when `NODE_ENV=production`.

### 🐛 Bug Fixes

- **White screen on Wireless Networks / Add Business (issue #47)**:
  `peopleAPI.getAll()` returns `{ data, meta }` but two components treated the
  response as a plain array and crashed on `.map()` — fixed by destructuring.
- **docker-compose overrides `.env` (issue #42)**: `NODE_ENV` was hardcoded to
  `production` in `docker-compose.yml`, silently overriding `.env`. Both
  `NODE_ENV` and `FRONTEND_URL` now use `${VAR:-default}` passthrough.

### 🧹 Cleanup

- **Removed dead `backend/config/initDatabase.js`** — never imported; all table
  creation lives in `initializeDatabase()` in `server.js`. A proper migration
  system is tracked in issue #48.

## [2.6.0] - 2026-06-14

### 🧹 Cleanup

- **Removed `backend/migrations/` directory**: The three SQL files (`001_create_users_table.sql`, `create_wireless_networks.sql`, `add_network_password_and_associations.sql`) were dead code — `initializeDatabase()` in `backend/server.js` already creates all tables, columns, indexes, and the `fk_audit_logs_user` FK on startup via `CREATE TABLE IF NOT EXISTS` / `ADD COLUMN IF NOT EXISTS`.
- **Why this matters**: On bare-metal installs, users were running the wireless SQL file manually as the `postgres` superuser, which left `wireless_networks` owned by `postgres` instead of the app role and caused `permission denied for table wireless_networks` after a `pg_upgrade` (issue #11). With the migration files gone, there is one source of truth for the schema and no footgun.
- **README**: Updated bare-metal install steps — no manual `psql` migration step required.

## [2.5.0] - 2026-05-29

### ♻️ Refactoring & Architecture

#### Backend — Route Extraction
- **server.js split**: Reduced from 3,052 → 1,053 lines by extracting 11 inline route handlers into dedicated modules under `backend/routes/`
- **Error handler wired**: `backend/middleware/errorHandler.js` now registered globally — previously defined but never mounted
- **Input validation**: `validateIdParam` middleware applied to all `/:id` routes across 8 route files

#### Frontend — Component Architecture
- **React Context introduced**: `AuthContext`, `DataContext`, `UIContext` eliminate prop drilling; `App.js` reduced from 511 → 220 lines; 8 components de-propped
- **Large components split** — all files now under 425 lines:
  - `SettingsPage` 1,078 → 65L + 4 tab components (`settings/GeneralTab`, `DataModelTab`, `ImportExportTab`, `ProfileTab`)
  - `AdvancedSearch` 1,129 → ~200L + 2 panel components (`search/SearchFilters`, `SearchResults`)
  - `ReportGenerator` 1,253 → 165L + generation logic in `utils/reportGenerators.js` + 2 UI panels (`reports/ReportOptions`, `ReportPreview`)
  - `GlobalMap` 957 → 421L + `map/AddLocationModal`, `MapLegend`, `MapStats`, `mapUtils`
  - `AddEditPersonForm` 766 → 298L + `person-form/LocationsSection`, `OsintSection`, `ConnectionsSection`, `CustomFieldsSection`
  - `WirelessNetworkDetail` 713 → 159L + `wireless/NetworkInfoSection`, `NetworkAssociation`

### ⚡ Performance

- **Pagination**: People list fetches 100 at a time via `X-Total-Count` / `X-Has-More` headers; Load More button in `PeopleList`
- **Virtualisation**: Lists with ≥150 items rendered with `react-window` `FixedSizeList` to eliminate DOM bloat
- **fetchAPI timeout**: All API calls now abort after 30 seconds via `AbortController`
- **Map icon cache**: Leaflet marker icons built once via `useMemo` / `buildIconCache()` instead of per-render

### 🌙 UI Improvements

- **Dark mode audit**: 22 components updated with missing `dark:` variants — consistent bg, text, border, and badge theming across the whole app
- **Map constants**: Leaflet tile URL and attribution extracted to `utils/mapConstants.js`

### 🧪 Testing

- **Initial test suite added** (62 tests, all passing):
  - `backend/utils/passwordPolicy.test.js` — 16 tests: length, character classes, common passwords, username inclusion
  - `backend/middleware/validation.test.js` — 23 tests: sanitizeString, isValidEmail, isValidUrl, isValidId
  - `frontend/src/utils/reportGenerators.test.js` — 23 tests: getFullName, formatDate/DateTime, generateMarkdown section logic
- Backend test runner: Jest (`npm test` in `backend/`)
- Frontend test runner: `react-scripts test` (CRA built-in)

### 🐛 Bug Fixes

- **Todo checkbox no-op**: Click handler was a no-op due to event propagation — fixed
- **D3 graph invisible edges**: `filteredPeople` passed to Dashboard graph not memoised — edges disappeared on re-render; fixed with `useMemo`
- **ReportGenerator white screen**: `peopleAPI.getAll()` returns `{ data, meta }` (returnMeta hardcoded); ReportGenerator was treating it as a plain array, crashing during React render — fixed with `peopleRaw?.data ?? peopleRaw ?? []`
- **Report type dropdown no effect**: `reportType` option was stored but never read by generators — implemented `resolveOptions()` applying section overrides per type
- **Report businesses section always included**: Business profiles block was not gated by any option — now respects `includeBusinesses` derived from report type
- **nginx stale bundle**: `index.html` had no cache headers, causing browsers to serve old JS after redeploy — fixed with `no-store` on `index.html`, `immutable` on hashed assets

### 🔒 Security (from community audit — Issues #29–#41)

- Session regeneration on login to prevent session fixation
- Password strength policy (12+ chars, mixed case, digits, blocklist of common passwords)
- `requireAdmin` now performs live DB lookup instead of trusting session data
- Rate limiting on auth endpoints (10 req/15min login, 5 req/hour password change)
- Session revocation on password change
- `validateIdParam` on all route parameters
- Input sanitisation (XSS pattern stripping) on all string fields

### 📊 Statistics

- **Backend lines**: server.js 3,052 → 1,053 (+ 11 route modules)
- **Frontend components**: 0 files over 425 lines (was 6 over 700L)
- **Tests added**: 62
- **New sub-component directories**: `settings/`, `search/`, `reports/`, `map/`, `person-form/`, `wireless/`

---

## [2.1.0] - 2026-01-26

### 🔒 Security Improvements

#### Critical Security Enhancements
- **Environment Variable Validation**: Added production-mode validation that requires `DB_PASSWORD` and `SESSION_SECRET` to be set
- **Weak Password Detection**: Application now exits in production if weak passwords are detected (e.g., 'changeme', 'password', 'admin')
- **Session Secret Enforcement**: Requires minimum 32-character `SESSION_SECRET` in production mode
- **Docker Security**: Backend container now runs as non-root user (nodejs:1001) instead of root
- **Database Port Exposure**: Added security warning for exposed PostgreSQL port in docker-compose.yml
- **Environment Documentation**: Updated `.env.example` with security warnings and generation commands

### 🐛 Bug Fixes

#### Database & Authentication
- **Fixed Issue #2**: Users table now created automatically during database initialization
  - Previously required manual migration file execution
  - Users table creation integrated into `initializeDatabase()` function
  - Added foreign key constraint from `audit_logs` to `users` table
  - **Email field made optional**: Users can now be created without an email address
- **Connection Pool Leaks Fixed**: Added try-finally blocks to ensure database connections are always released
  - Fixed in `backend/middleware/audit.js`
  - Fixed in `backend/server.js` audit logging function

### ⚡ Performance Improvements

#### Database Indexing
- **People Table Indexes**: Added indexes on frequently queried fields
  - `idx_people_first_name`, `idx_people_last_name`, `idx_people_full_name`
  - `idx_people_category`, `idx_people_status`, `idx_people_case_name`, `idx_people_dob`
- **Users Table Indexes**: Added for faster lookups
  - `idx_users_username`, `idx_users_email`, `idx_users_role`
- **Audit Logs Indexes**: Improved audit query performance
  - `idx_audit_logs_entity`, `idx_audit_logs_user_id`
  - `idx_audit_logs_created_at`, `idx_audit_logs_action`

### 🎯 Features

#### User Management
- **Optional Email Field**: Admin users can now be created without providing an email address
  - Database schema updated to make email nullable
  - `createAdminUser.js` script updated to accept optional email
  - Migration file updated for existing databases

#### System Stability
- **Graceful Shutdown**: Added proper shutdown handlers for production environments
  - Handles SIGTERM and SIGINT signals
  - Closes HTTP server gracefully
  - Waits for database pool to close before exit
  - 10-second timeout for forced shutdown
- **Uncaught Exception Handling**: Added handlers for uncaught exceptions and unhandled promise rejections
- **Health Check Endpoint**: Added `/api/health` endpoint for monitoring
  - Returns server status, uptime, and database connectivity
  - Used by Docker healthchecks

#### Docker Improvements
- **Service Health Checks**: All Docker services now have health checks
  - Database: PostgreSQL readiness check
  - Backend: HTTP health endpoint check with 40s startup time
  - Frontend: Nginx availability check
- **Dependency Management**: Services start only when dependencies are healthy
  - Backend waits for healthy database
  - Frontend waits for healthy backend

### 📝 Documentation

#### New Documentation
- **CHANGELOG.md**: This file - comprehensive change tracking
- **Setup Instructions**: Updated README.md with complete setup guide including:
  - User creation command
  - Security best practices
  - Environment variable configuration
  - Troubleshooting section

#### Updated Documentation
- **README.md**: Enhanced with security warnings and setup instructions
- **.env.example**: Added detailed comments for all security-related variables
- **Docker Configuration**: Added inline comments explaining security implications

### 🔧 Technical Changes

#### Configuration
- Production mode now validates critical environment variables on startup
- Development mode shows warnings for default/weak credentials
- Added `FRONTEND_URL` environment variable for CORS configuration

#### Database Schema
- Users table email column changed from `NOT NULL` to nullable
- Added automatic `ALTER TABLE` command to update existing databases
- All new tables created with proper indexes from initialization

### 🚀 Migration Guide

#### For Existing Installations

1. **Pull Latest Changes**
   ```bash
   git pull origin main
   ```

2. **Update Environment Variables**
   ```bash
   # Generate a strong session secret
   openssl rand -base64 32

   # Add to .env file
   SESSION_SECRET=<generated-secret>
   FRONTEND_URL=http://localhost:8080
   ```

3. **Rebuild and Restart Containers**
   ```bash
   docker-compose down -v  # Warning: This deletes all data!
   docker-compose up --build
   ```

4. **Create Admin User**
   ```bash
   docker exec -it osint-crm-backend node scripts/createAdminUser.js
   ```

#### Breaking Changes
- **Production Mode**: Application will not start without proper `DB_PASSWORD` and `SESSION_SECRET`
- **Email Field**: Existing code expecting email to always be present should handle NULL values

### 📊 Statistics

- **Files Changed**: 7
- **Security Issues Fixed**: 9 high-priority
- **Performance Improvements**: 13 database indexes added
- **Lines Added**: ~200
- **Lines Removed**: ~50

### 🙏 Acknowledgments

Issues and improvements identified through:
- Community bug reports (Issue #2)
- Implemented two PRs - thx @erLCoder
- Done a small security audit
- Performance profiling
- Docker best practices review

---

## [2.0.0] - 2025-10-XX

Initial release with core OSINT investigation features.

### Features
- People management and tracking
- Entity network visualization
- Global intelligence mapping
- Wireless network intelligence (WiGLE integration)
- Case management
- Business intelligence tracking
- Modern UI with dark mode
- Docker deployment

---

**Legend:**
- 🔒 Security
- 🐛 Bug Fix
- ⚡ Performance
- 🎯 Feature
- 📝 Documentation
- 🔧 Technical
- 🚀 Migration
