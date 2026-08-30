# Changelog

All notable changes to GHOST OSINT CRM will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.15.0] - 2026-08-30

### ✨ Added

- **Project-based data isolation (#83).** A *Project* is now the hard boundary
  around an investigation — effectively a separate database per investigation.
  Every entity (people, businesses, locations, assets, transactions, wireless
  networks, wallets, relationships, todos, cases) belongs to exactly one
  project, and the app works within one active project at a time via a
  top-bar switcher. *Cases* become a lighter optional grouping nested inside
  a project. Cross-project linking is off by default and enabled per project.
  Existing data is migrated onto an auto-created "Default Project" — no data
  is lost on upgrade.
- **Project membership and per-project roles (#84).** A `project_members`
  table gives each user a role *per project* — `manager` (edits project
  settings, manages membership) or `investigator` (full CRUD on that
  project's data). Admins stay global. Non-admins now only see and can reach
  projects they're a member of, enforced on every project-scoped route — not
  just hidden in the selector.
- **Cryptocurrency wallet entities (#82).** `crypto_wallet` is a first-class
  entity (address, network, label, tags like suspicious/exchange/mixer/scam,
  and an external-reference URL for linking out to a specialist tool such as
  GraphSense). Manual wallet-to-wallet transactions (hash, amount, timestamp)
  and wallet↔wallet/person/business relationships show up in the relationship
  graph alongside everyone else. GHOST does no chain analysis itself — this is
  the entity/citation layer only.
- **Relationships are a real table.** Connections used to live only as JSONB
  arrays on `people` rows; they're now independently addressable rows with
  their own project/case scope, which is what made project isolation and
  cross-project linking tractable.

### 🐛 Fixed

- **The project-members dialog is no longer clipped to the sidebar (#84).** It
  rendered as a fixed-position modal mounted inside the sidebar, whose
  off-canvas transform made it the containing block — pinning the modal to a
  ~256px column and cutting the member-remove buttons off the right edge. It
  now renders through a portal.
- **Audit log entries for people and businesses show who made the change
  (#84).** The audit helper used by those routes never recorded the user id,
  so every person/business edit displayed as "System".
- **Dark mode: inputs, selects and textareas written with only light-mode
  styling no longer render white (or white-on-white) (#87).** A base-layer
  fallback gives every native form control a sane dark appearance; components
  with explicit dark styling are unaffected.
- **Person-card locations kept only their coordinates (#62).** Type, city,
  state, country and notes entered on a person's location were dropped on
  save.
- **Advanced Search could not be closed on mobile (#64).**
- **Selecting a Yandex or LocationIQ address suggestion crashed the form
  (#62).**
- Addressed a batch of CodeQL findings — query-parameter type confusion,
  missing rate limiting on a route, a dead XSS filter, and log injection.

### 🌍 Translations

- German, Spanish, French and Chinese catalogs are now mirrored from Crowdin
  but not yet enabled in the language picker — they're still largely
  untranslated. Russian and English remain the shipped languages.

## [2.14.2] - 2026-08-11

### 🐛 Fixed

- **Fresh installs of v2.13.0+ no longer crash-loop.** Migration
  `20260809000002` (introduced with per-provider geocoding caches in #62) ran
  an `UPDATE` against `geocoding_cache` before that table existed — it's
  created lazily at runtime by the geocoding service, after migrations run.
  On any virgin database this made `initializeDatabase()` fail and the
  backend container restart-loop forever. Existing installs were unaffected
  since the table already existed from prior runtime use, which is why this
  went unnoticed until a brand-new install hit it. The migration is now a
  no-op when the table isn't there yet. (#81, reported with root cause and a
  verified patch by @JakeTheRabbit)
- Added `.gitattributes` to force LF line endings on shell scripts, so
  `docker-entrypoint.sh` doesn't get CRLF'd on a Windows checkout and fail to
  exec in the alpine container.

## [2.14.1] - 2026-08-09

### 🐛 Fixed

- **Geocoding errors now say what the provider actually reported.** Configuring
  a Yandex or LocationIQ key and having it rejected produced a generic "check
  it in Settings", when the provider had explained the reason — an invalid key,
  an inactive key, and a key issued for a different API product each need a
  different fix. The provider's own message is now shown in the app and written
  to the backend log. API keys are never logged.
- The fallback message also names the most common cause: a key issued for
  Yandex's JavaScript API rather than the **Geocoder HTTP API**.

### 🌍 Translations

- **Russian is now complete** — every interface string, including the report
  output and everything added in 2.11–2.14, courtesy of @hunterghoul1 via
  Crowdin. German, Spanish, French and Chinese catalogs updated too.

## [2.14.0] - 2026-08-09

### 🧰 Added — Bulk import for OSINT tools

- Tools could only be added one at a time, which is the wrong shape for the
  problem: people keep tool lists in spreadsheets and shared repos. The Tools
  page now has an **Import** button accepting pasted or uploaded **CSV, TSV or
  JSON**.
- Built for other people's files. `URL` / `Link` / `Website` and `Tool Name` /
  `Name` are all recognised, unrecognised columns are ignored rather than
  failing the file, bare domains like `shodan.io` are turned into URLs, and
  tags split on `;`, `,` or `|`.
- **Preview before anything is written**: how many will be added, how many
  already exist, and which rows have problems — with row numbers matching your
  spreadsheet. Existing tools are skipped by default, or can be updated.
- Updating only overwrites the fields a row actually supplies, so importing a
  partial file can't blank out the links, categories and tags of the tools it
  touches.
- Available to the **MCP tools** as `ghost_create_tools_bulk_import`, so an
  assistant importing a tool list makes one request instead of one per row.

### 🗺️ Added — LocationIQ geocoding provider

- A third geocoding option alongside OpenStreetMap and Yandex, selectable in
  Settings → General → Geocoding with your own API key. Commercial-grade
  coverage, a free tier that needs no payment details, and no restriction on
  which map the results are displayed on.
- Geocoding providers now live in a registry, so each has its own request queue
  and its own stored API key. Configuring or switching one no longer disturbs
  another, and adding a further provider needs no changes to the API, the
  validation schema or the settings screen.

### 🐛 Fixed

- **A Yandex API key configured in 2.13.0 is preserved on upgrade.** Keys are
  now namespaced per provider; without the migration the key would have been
  silently dropped, leaving Yandex selected but quietly falling back to
  OpenStreetMap.

## [2.13.0] - 2026-08-09

### 🔄 Added — Update notifications and prebuilt images

- GHOST now tells you when a new version is released. The **server** checks the
  public release list (the browser never contacts GitHub), caches the result for
  six hours, and shows a dismissible banner. Nothing is downloaded or installed
  automatically — updating stays a deliberate operator action.
- **On by default, switchable off** in Settings → General → Updates. When
  disabled the server makes no outbound request at all, not merely a hidden
  banner, for isolated deployments.
- **Container images are published to GHCR on every release**, so updating is
  `docker compose pull && docker compose up -d` — seconds, with no local build
  and no build toolchain. `GHOST_VERSION` pins a release; the default tracks
  latest. Building from source still works for development.

### 🗺️ Added — Yandex as an optional geocoding provider (issue #62)

- OpenStreetMap/Nominatim handles informal Russian address forms poorly, so
  **Yandex Maps can be selected** in Settings → General → Geocoding with an
  operator-supplied API key. Nominatim stays the default and needs no
  configuration.
- The API key is stored server-side and is **write-only** — the app reports
  only that a key exists, never its value. Selecting Yandex without a key falls
  back to Nominatim rather than failing every lookup, and says so.
- The address cache is now kept **per provider**. Previously it was keyed on the
  address alone, so switching provider kept serving the previous provider's
  results — including the poor matches that prompted the switch.

### 🐛 Fixed — Report configuration didn't describe the report (issue #77)

- **The section checkboxes did nothing** for any report type except
  Comprehensive: the type overrode them at generation time, and the preview
  applied the same override. A report type is now a *preset* that fills in the
  checkboxes, which you can then adjust — what's ticked is what's generated.
- **Report scope is now selectable** (all data / one case / one person). It used
  to be fixed by wherever the dialog was opened from, so from the dashboard it
  was permanently "All data" and choosing Person Profile did nothing.
- **OSINT data now actually appears in reports.** The switch existed from the
  start but no generator ever read it, so OSINT findings were absent from every
  report ever produced. Timeline and Audit Trail were likewise wired to nothing
  and have been removed; Businesses gained the checkbox it never had.

### 🐛 Fixed — Mobile problems found on a real device (issue #64)

- Case cards no longer run off the side of the screen.
- Person card action buttons no longer sit on top of the name with the delete
  button clipped — they're always visible on touch screens.
- **The person detail window can be closed again**: labelling the Generate
  Report button in 2.12.0 pushed the close button off a phone screen. The seven
  detail tabs now scroll rather than overflowing.
- The relationship graph legend showed raw internal names for the two
  relationship types added in 2.12.0; the person detail view never displayed the
  patronymic.

### 🐛 Fixed — Other

- **Advanced Search could not find people by patronymic** (issue #78), or by the
  full name as displayed. Search now matches any name part and both conventional
  orderings.
- **The relationship layout selector kept showing "Hierarchical"** after
  switching layouts, making it impossible to switch back (issue #76).
- **The dashboard relationship panel showed a Close button that did nothing**
  instead of a Fullscreen button (issue #79).

## [2.12.0] - 2026-08-08

### 🐛 Fixed — Data Model options never reached the person dropdowns (issue #67)

- Person **categories and statuses rendered from a hardcoded list**, not from
  `model_options`. The person form fetched model options but only picked
  connection, location, CRM and OSINT types — so an option added under
  Settings → Data Model genuinely never appeared anywhere. Now read from the
  database in the person form, both people list filters, and Advanced Search,
  with the static list kept as a fallback so a type with no rows can't produce
  an empty dropdown.
- Status badge colours are preserved when options load from the database
  (`mergeOptionMeta`), and the seeded **"Related to Person of Interest"**
  category — which was missing from the hardcoded list entirely — now shows up.

### 🐛 Fixed — "Export All Data" was incomplete (issue #74)

- The export omitted **assets, transactions, properties and wireless
  networks**, making the file unusable for backup, migration or disaster
  recovery. Export is now version 1.3 and covers them; import restores them,
  remapping owner and party references onto the newly-inserted ids the same
  way people and businesses already were.
- Import also gained `patronymic` and `owner_business_id` — the latter
  resolved in a second pass, since a business may be owned by one imported
  later in the file.

### 🌍 Added — Report output is translatable (issue #63)

- The generated `.md` and `.docx` reports and the entity ledger were the last
  content still hardcoded in English. All headings, table columns, stat
  labels, task states and summary sentences now come from the translation
  catalog (127 new keys). Dates in reports follow the report's language
  instead of being pinned to US English.

### 👤 Changed — Name order follows the language (issue #61)

- Russian, Ukrainian, Belarusian, Bulgarian and Kazakh conventionally lead
  with the family name (*Фамилия Имя Отчество*). Person names now display —
  and the person form lays its fields out — in the order the active language
  expects. Display convention only; stored data is unchanged.

### 🕸️ Added — Conflict-of-interest groundwork (issue #65)

Built from a contributor's real use case: tracking board members of councils
against the private interests of those same people.

- **Board members are distinct from employees.** Employee entries can be
  marked as a decision maker and draw as a separate governance relationship.
- **Employee entries link to a real person record** via a picker, instead of
  being matched by name. Name matching remains only as a fallback for existing
  entries — it collides between people who share a name, which is exactly the
  false positive a conflict view must not invent.
- **Ownership chains** — a business can be owned by another business, so
  holding and shell structures are representable instead of collapsing to a
  single hop.
- **Transaction tags** — free-form labels with a filter built from the tags in
  use, usable from the MCP tools for automated passes over a tagged subset.
  Adds an *Endorsement / Promotion* transaction type.
- **Relationship layers** — the entity network's three edge toggles become six
  named layers (governance, employment, financial, social, investigative,
  other), each independently toggleable with a solo button.

## [2.11.0] - 2026-08-08

### 🌍 Added — Data-model and enum labels are translatable (issue #67)

- The option labels behind every dropdown — person categories and statuses,
  CRM statuses, connection and location types, transaction/asset/property
  types, OSINT data types — now render in the selected language. They had been
  stuck in English regardless: the shipped defaults are seeded into Postgres at
  boot (`backend/config/seedDefaults.js`) and rendered straight off the row, so
  they never passed through `t()` and never reached the translation catalog.
  128 new keys across 17 namespaces, wired into 18 components.
- Translation happens at render time and never touches stored values, so
  `person.category` still holds `'Suspect'` in every language — no migration,
  no risk to existing records.
- **Options you rename keep your wording**, and options you create yourself are
  left exactly as typed — only untouched built-in labels are translated.
  Settings → Data Model deliberately still shows raw stored labels, since
  that's where the stored value is edited.

### 👤 Added — Patronymic on people (issue #61)

- People have a proper `patronymic` field, shown between the given and family
  name (*Иван Петрович Сидоров*) across the person view, lists, case view,
  relationship diagram and reports, and searchable both on its own and as part
  of the full name. Optional, so existing records are unaffected.
- Full-name construction moved to `CONCAT_WS`, which also fixes a latent
  trailing space for people with no surname.

### 📄 Added — Person reports actually scope to the person (issue #63)

- A report generated from a person now covers *that person* — profile,
  connections, locations, OSINT data — and opens on the Person Profile type.
  Previously the selected person was used only for the report title while the
  body listed everyone in their case, making the output indistinguishable from
  a case report. The button on the person view is now labelled rather than a
  bare icon.
- The **.docx export had no connections section at all**, so connections were
  silently dropped from every Word report. Added, along with date of birth and
  aliases in Word person profiles.

### 📱 Added — Responsive layout, stages 1–2 (issue #64)

- **The sidebar is now an off-canvas drawer** below tablet width, behind a top
  bar, dismissed by tapping outside, Escape, the close button, or picking a
  section. Its widths had been written desktop-first, which under Tailwind's
  mobile-first breakpoints meant the sidebar was at its *widest* on the
  narrowest screen — 288px of navigation on a 375px phone.
- 50 fixed multi-column grids stack on phones; dialogs cap at 90% viewport
  height and scroll; page headers, list filter rows and the person form's
  repeat-entry rows wrap instead of forcing the page to scroll sideways.
- Desktop is unchanged by design: each existing grid value is pinned at a
  breakpoint, so the rendered CSS at and above it is identical.
- Still to come: data tables and virtualised lists (stage 3), map and
  relationship graph touch handling (stage 4).

### 🐛 Fixed

- **Advanced Search filters rendered blank and filtered on nothing** — the
  CRM-status, location-type and connection-type filters read `option_value` /
  `option_label` off getters that only ever returned `{ value, label }`. Broken
  in English too, unrelated to translation.
- **Restored four Russian coordinate strings** that a Crowdin sync reverted to
  English: the `lng`→`lon` placeholder rename that fixed #69 invalidated their
  translations upstream.
- **MCP duplicate detection accounts for the patronymic**, so two people
  differing only in patronymic are no longer flagged as duplicates of each
  other.

## [2.10.0] - 2026-07-24

### 🌍 Added — Internationalization & community translations (issue #59)

- The entire frontend now renders through **react-i18next**. Every UI string
  lives in a translation catalog (`frontend/src/locales/en/translation.json`,
  ~1,380 keys) instead of being hardcoded.
- **Crowdin integration** (`crowdin.yml`) connects the source catalog to
  community translators and mirrors per-language files back into the repo;
  Settings → General has a language picker (`SUPPORTED_LANGUAGES` in
  `i18n.js`). Wiring a newly translated language in is a one-line manual step.
- Deliberately out of scope this pass: backend error messages, report/PDF
  output content, MCP tool descriptions, and RTL language support.

### 🎨 Added — Appearance & theming

- New **Appearance settings tab**: theme mode (light / dark / system), accent
  color, layout density, and surface style, backed by a runtime design-token
  system and a `ThemeContext`.
- Streamlined visual language throughout — quieter surfaces, removed gradient
  glow effects, accent-driven controls.

### 🕸️ Added — Employer/employee edges in the Entity Network

- A business's employees are matched to existing people by exact,
  case-insensitive full name and drawn as edges. The relationship is split into
  two directed connection types (`employer` and `employee`); the derived edge
  runs business → person so the employer is ranked at the top in hierarchical
  layout. Deduplicates against an existing owner link.
- A Knex migration relabels the old `Employer/Employee` option to `Employer`
  and adds the `Employee` type on existing databases at startup.

### 🐛 Fixed

- **Adding a holder to an asset silently did nothing** — `initial_holder` was
  stripped by the create schema's unknown-field validation before the route
  could read it, and the holder picker was missing from the edit form
  entirely. The schema now declares the field and the edit form offers
  "Transfer to New Holder".
- **Created/edited tools didn't appear until reload** — the tool form now
  refetches on save (the same stale-list pattern fixed for businesses in
  #55). Removed a dead, unthrottled geocoding service that bypassed the
  Nominatim rate-limit queue added in 2.9.1 (#57).

## [2.9.1] - 2026-07-08

### 🐛 Fixed

- **Regular (non-admin) users locked out with "System Offline"** (issue #58):
  the frontend requested two admin-only endpoints during startup for every
  user and treated the expected 403s as an outage.
  - `GET /settings/custom-fields` is now readable by any authenticated user
    (every user needs the definitions to render person profiles); writes stay
    admin-only. The OpenAPI spec reflects the change.
  - The System Health widget is admin-only in the UI and additionally hides
    itself (and stops polling) on 403 instead of declaring the system offline.
  - `fetchAPI` errors now carry the HTTP status so "no permission" can never
    again be conflated with "backend down".
- **Adding an address failed with "Geocoding service returned 429"**
  (issue #57): nothing throttled outbound calls to Nominatim, whose public
  API allows 1 request/second — address-autocomplete fired per keystroke and
  batch geocoding ran 3 concurrent, getting the instance rate-limited so even
  single saves failed.
  - All Nominatim requests are now serialized through a queue with 1.1s
    spacing, and a provider 429 gets one automatic retry after backing off.
  - Autocomplete is debounced client-side (one request per typing pause).
  - Provider rate-limiting is reported as its own failure reason
    (`rate_limited`) with a clear "wait a few seconds" message in every
    geocoding dialog, instead of a raw status code.

## [2.9.0] - 2026-07-08

### ✨ Added — URL routing in the frontend (issue #52)

- The UI now uses **react-router**: every section has a URL (`/people`,
  `/businesses`, `/relationships`, `/map`, …), the browser back/forward
  buttons navigate between views instead of leaving the site, and views can
  be bookmarked or shared.
- **Deep links to entities**: `/people/:id` and `/businesses/:id` open the
  corresponding detail modal directly.
- No web-server changes needed — the existing nginx SPA fallback serves all
  routes.

### ✨ Added — Knex schema migrations (issue #48)

- The database schema is now managed by **Knex migrations** in
  `backend/migrations/`, run automatically at startup (or manually with
  `npx knex migrate:latest`). Future schema changes ship as new migration
  files instead of edits to startup code.
- **Existing databases are adopted seamlessly**: the baseline migration is
  the previous idempotent DDL, so on upgrade it simply records itself and
  changes nothing. Fresh installs get the full schema from the baseline.
- Default model options are seeded on every boot (outside migrations) so
  upgrades can introduce new defaults; user edits are never overwritten.
- `initializeDatabase()` in `server.js` (600 lines of DDL) is gone;
  `server.js` shrinks to ~650 lines total.

### ✨ Added — Entity Network improvements (issues #50, #56)

- **Ownership edges**: businesses are connected to their owner in both graph
  views (from `owner_person_id`), so they're no longer isolated islands.
- **Transaction edges**: a new toggle draws aggregated giver→receiver edges
  from the transaction log (gifts, purchases, transfers…) between people and
  businesses, labelled with the transaction types and counts.
- **Edge-class toggles** in the Obsidian view: People / Ownership /
  Transactions can be switched independently.
- **Crash-loop fixed** (issue #56): creating a graph connection to a business
  node used to persist `person_id: null`, which crashed every subsequent
  render of the Entity Network and drove a reload/request storm into the rate
  limiter ("System Offline", HTTP 403s). Person↔business ad-hoc connections
  are now blocked with a clear message, all graph components skip null
  connection targets, and the person schema drops such entries on write so
  affected databases **self-heal on the next save**.
- New **section-level error boundary**: a render error in one view shows an
  inline error with a retry button instead of white-screening the whole app.

### ✨ Added — MCP server v1.1 (issues #43, #44)

- **Respawn cache**: session cookie and OpenAPI spec are cached in
  `~/.ghost-mcp/` (0600 perms), so clients that spawn a fresh process per
  tool call skip the ~0.4s login + spec fetch. Stale cookies self-correct via
  re-login-on-401; disable with `GHOST_MCP_CACHE=off`, tune spec TTL with
  `GHOST_MCP_SPEC_TTL` (default 600s).
- **Transaction duplicate detection**: `ghost_create_transactions` refuses
  creates matching an existing transaction on type, date, both parties and
  value — guards repeated document imports (e.g. Form 700 batches). Same
  `ignorePossibleDuplicates: true` escape hatch as people/businesses.

### 🐛 Fixed

- **Businesses could not be edited** (issues #53, #55): Postgres returns
  `DECIMAL` lat/lng columns as strings and `.toFixed()` on them white-screened
  the edit form. Same latent crash fixed in the travel-history edit form.
- **Business owner and employee count never displayed** (issue #55): the list
  read fields the API doesn't return (`owner_first_name`, `employee_count`)
  instead of `owner_name` and the `employees` array.
- **Businesses list refreshes after create/edit** instead of showing stale data.
- **OSINT tool tags invisible in the light theme** (issue #54): chips combined
  `text-white` with a `.glass` background that wiped their gradient; replaced
  with explicit light/dark badge colors.
- **Custom location types now show on the Locations map** (issue #51): active
  `location_type` options from Settings get deterministic colors, filter
  chips, legend entries and icons; untyped locations fall back to "Other"
  instead of silently disappearing.

### 🔧 Improved

- **Transaction validation errors name the conflicting fields** (issue #43
  feedback), e.g. `from_person_id (63) and from_external ("…") are both set;
  include at most one of from_person_id, from_business_id, from_external as
  the giver`. The OpenAPI spec documents the same rules via a machine-readable
  `x-mutually-exclusive` extension and schema descriptions.
- **Source maps ship with the production frontend build** (issue #53
  side-request) so browser consoles show real component names and lines.

## [2.8.0] - 2026-07-06

### ⚠️ CRITICAL — data-loss bug in v2.7.0, upgrade immediately

v2.7.0 introduced Zod validation whose `validate()` middleware strips unknown
fields from request bodies. Several schemas were missing fields that routes
actually read, causing **silent data loss**:

- **Editing a person WIPED its `connections`, `osint_data`, `attachments`,
  and `custom_fields`** — the fields were stripped, and the update writes
  `field || []`, overwriting stored values with empty. If you edited people
  while on v2.7.0, that data is gone unless you have a database backup.
- **Asset holders never saved** — `initial_holder` was stripped before the
  acquisition transaction could be seeded.
- **Editing any entity could fail validation** — edit forms send `null` for
  cleared fields and numeric strings from selects; the schemas rejected both
  ("Validation failed" on transactions, businesses, assets, properties…).
- **Marking a todo done and creating a case were rejected** — the status
  enums didn't match the UI vocabulary (`done`/`cancelled`/`attention` and
  `active`/`on_hold` were not accepted).

All fixed in this release. To prevent recurrence,
`backend/middleware/schemaRouteConsistency.test.js` statically checks that
every body field a route (or its helpers) reads is declared in its schema —
mutation-tested, runs with `npm test`.

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

### 🔒 Security

- **Entity network routes were unauthenticated**: `/api/entity-relationships`
  (GET/POST/DELETE), `/api/relationship-types`, and `/api/entity-network`
  had no `requireAuth`, exposing the full relationship graph (names,
  connections, locations) without login. All five routes now require an
  authenticated session.

### 🐛 Bug Fixes

- **White screen on Add Network form**: `AddNetworkForm` treated
  `peopleAPI.getAll()`'s `{ data, meta }` envelope as a plain array — same
  class of crash as issue #47, missed in that fix.

### 🐛 Bug Fixes — validation layer (see CRITICAL section above)

- Schema field primitives rewritten as union types: optional strings accept
  `null`, numeric fields accept numbers, numeric strings (coerced), `''` and
  `null`; list fields treat `null` as empty. Range/format checks still apply
  after coercion; required fields unchanged. Unions keep the generated
  OpenAPI spec representable (no untyped fields).
- `initial_holder` declared on asset create; person schemas declare
  `connections` / `osintData` / `attachments` / `custom_fields`.
- Case status enum corrected to `active`/`on_hold`/`closed`; todo status enum
  corrected to `open`/`in_progress`/`on_hold`/`attention`/`done`/`cancelled`.
- Asset edit form gained "Transfer to New Holder" — records a transfer
  transaction, consistent with holders being derived from the ledger.
- 23 new tests: form-shaped payload regressions + the schema↔route
  consistency guard.

### 🧹 Cleanup

- Removed debug `console.log` of user-creation payloads from the users route.
- Removed ~90 unused imports/variables and 4 dead helper functions across
  22 frontend components; added missing `default` cases to two `switch`
  statements. Frontend now builds with zero `no-unused-vars` warnings.

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
