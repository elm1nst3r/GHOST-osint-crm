# Changelog

All notable changes to GHOST OSINT CRM will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [3.1.7] - 2026-11-14

### 🔒 Project data stays inside its project

Thanks to Peter Wilfahrt (@p-w) for reporting the first of these (#116).
Looking into his report turned up more places with the same gap.

- **Ledgers check project membership.** The ledger of a person, business
  or property (and its transactions, held assets and venue statistics)
  answered any signed-in user who knew the id, member of that project or
  not. They now follow the same rule as every other page: members of the
  project only. A ledger lists only transactions from projects you are in.
- **Links stay inside the project.** Transactions, assets, properties and
  wireless networks could be pointed at people, businesses, wallets, assets
  or properties in a project you are not a member of, and then showed their
  names, addresses and positions. A new link must now point inside the same
  project; with cross-project links switched on for the project, it may also
  point into another project you are a member of. The same rule now applies
  to person connections, business owners and employees, and relationships.
  Links that are already there are kept, so editing a record a colleague
  linked across projects still works.
- **Hidden even in older data.** Where an older record points into a
  project you are not in, GHOST shows "Person #12" instead of the name and
  leaves out addresses and positions.
- A new test fails when an API route has no access check, so this can't
  slip back in.

Who was affected: instances with more than one project and users who are
not admins. Admins see every project anyway. Please update.

### 🌍 Translations

New and updated strings from Crowdin (#114): Russian (109), and the newest
English strings added to Arabic, German, Persian and Chinese for
translation.

## [3.1.6] - 2026-11-13

### 🔐 Single sign-on behind a reverse proxy

Thanks to c-premus for tracking both of these down (#115).

- **Issuers that end in a slash work.** GHOST removed a trailing `/` from
  `OIDC_ISSUER_URL`, but the provider must name exactly the configured
  issuer, and Authentik's always ends in `/`. Sign-in failed with "SSO is
  unavailable". GHOST now uses the issuer as written. If it differs from
  the provider's only by a trailing slash, GHOST uses the provider's and says
  so in the log; any other difference is still refused, and the log names
  both values.
- **The sign-in sticks behind an HTTPS proxy.** GHOST's own nginx told the
  backend every request came in over plain HTTP, even when the proxy in
  front served HTTPS. With `NODE_ENV=production` the backend then left out
  the session cookie: the sign-in went through and you were back at the
  sign-in page. nginx now passes on what the proxy reports
  (`X-Forwarded-Proto`). This affected password sign-in behind such a proxy
  too. The backend log now warns when a sign-in reaches it over plain HTTP.
- **`TRUST_PROXY`** for a reverse proxy in front of GHOST: set it to `2` so
  the login limits count each user's own address rather than the proxy's
  (the default `1` trusts only GHOST's own nginx). A list of proxy
  addresses works too.

Nothing to do when updating. Behind a reverse proxy, consider
`TRUST_PROXY=2` in `.env`.

## [3.1.5] - 2026-11-12

### ⬆️ How to update, inside GHOST

The update banner said a new version was out but left you to work out the
rest. Admins now get **How to update** in the banner and in Settings →
General:

- The **backup and update commands** for the way this instance runs:
  published Docker images, built from source, or without Docker. GHOST picks
  the right one and you can switch. A pinned `GHOST_VERSION` and your own
  PostgreSQL server are taken into account. Each step has a copy button.
- The **release notes of every version you are about to get**, newest
  first. Anything a release asks you to do beforehand, and major versions,
  are shown at the top.
- GHOST still never updates itself: you run the commands on the server.
  An update button that does it for you would need control over Docker from
  the web app, which turns any security hole into control of the server.
- Investigators keep the banner with the release notes link.

The dialog ships in this release, so you'll first see it when the next
version comes out.

## [3.1.4] - 2026-11-10

### 🔗 Connections from both sides

Thanks to NickSettler for PR #112, which pointed out these problems and
proposed the fix. We built it ourselves from the description.

- A person's connections now show on **both** people. The person dialog
  lists everyone connected once, marked **Two-way**, **Outgoing** or
  **Incoming**, including people in other projects you have access to.
- Connection counts in the people list, table, dashboard and Advanced Search
  count connected people (they used to show the larger of "made" or
  "received").
- The person form lists **who links to this person**, with a **Link back**
  button that picks them and the reverse type (employer ↔ employee).
- A **two-way** box on each connection adds the connection back on the other
  person when you save. It never changes a connection they already have,
  needs access to their project and shows in their history.
- **Save keeps what is still in an add row**: an alias, address, OSINT entry
  or connection you filled in but did not add is saved too.
- Saving a person or a business, connections included, either fully succeeds
  or changes nothing.

### 🧹 Cleaner deletes

- Deleting a person, business or wallet removes its links at both ends.
  Business employees keep the name but lose the link; wireless networks drop
  the reference.
- Deleting a project also removes links into it from other projects.
- An upgrade step cleans up links left behind by earlier deletes.

### 🐛 Fixed

- Advanced Search showed connections from an old copy that stopped updating
  in 2.15; it now shows the current ones.
- Russian file delete confirmation placeholder (again; Crowdin PR #111 brought
  the old text back).

### 🌍 Translations

- Crowdin PR #111 adds the 3.1.3 texts to every language (English until
  translated).

## [3.1.3] - 2026-11-09

### 🧾 Saved records in reports (#96)

Thanks to hunterghoul1 for testing saved records and reporting this.

- Reports have a **Saved records** section, chosen with its own checkbox
  (on for full and person-profile reports, off for summaries). The preview
  shows how many records it will include.
- Records are **normalized**: the records of one tool and search line up in
  one table, with a column for every field any of them has and blanks where
  a record lacks it. Nested data becomes readable fields (`address.city`,
  `phones[1].number`), lists are joined, and fields that differ only in
  letter case are one. Each record says when it was found and how often.
- Groups with too many fields for a page are listed record by record.
- Both Markdown and Word reports.

### 🌍 Translations

- Russian is now 2,502 of 2,599 texts (Crowdin PR #106), Persian 2,258.
  Thanks to the Crowdin translators.
- Fixed a Russian placeholder in the file delete confirmation.

## [3.1.2] - 2026-11-09

Thanks to NickSettler for testing single sign-on against Keycloak and for
reporting #107–#110, and to hunterghoul1 for the OSINT editing request.

### 🔐 Single sign-on

- **Sessions end when the identity provider ends them** (#105). Signing a
  user out at the provider (Keycloak: Sessions → Sign out, or signing out the
  whole user) now ends their GHOST session too:
  - at once through **OpenID Connect back-channel logout**: give the provider
    `https://<GHOST>/api/auth/oidc/backchannel-logout` (Keycloak: client →
    *Backchannel logout URL*, *Backchannel logout session required* on);
  - otherwise within `OIDC_SESSION_CHECK_MINUTES` (default 5, `0` turns it
    off): GHOST checks the session with the provider's refresh token. If the
    provider can't be reached, users stay signed in.
  An open tab returns to the sign-in page ("Your session has ended"). SSO
  sessions now follow the provider's idle and maximum session times.
- **"Require two-step verification" with single sign-on** (#108). An admin
  who signs in through single sign-on can turn it on; the setting says it
  applies to password sign-ins only (the provider handles two-step for
  single sign-on). With password sign-in off (`LOCAL_LOGIN_ENABLED=false`) a
  note replaces the setting.

### ✏️ Editing

- **Everything typed into a list can be edited** (#109), not only deleted
  and re-added: person addresses, OSINT entries, aliases and connections;
  business employees; crypto wallet link types; the note and confidence of
  a wireless network's person link; to-do text (pencil or double-click on
  the dashboard).
- An edited OSINT value found by a tool keeps its findings and shows what
  the tool originally found ("edited · found as …").
- A changed address drops its old map position and is looked up again.

### 🗺️ Geocoding

- **Failures are no longer silent** (#110). Bulk geocoding on the map shows
  a results dialog listing every address that couldn't be placed, with the
  reason (no match, only an uncertain match, provider rate limit, provider
  error such as a rejected API key, timeout) and a link to the person.
- **"N not on the map"** on the map page lists addresses without a position
  and the reason from the last attempt (saved on the address).
- **Person form**: adding or updating an address looks it up right away and
  shows the result; **Find on map**; **Pick on map** (click or drag the pin)
  or type latitude/longitude by hand; the closest uncertain match can be
  used with one click.
- The bulk geocoding button is shown to admins only (the server always
  required an admin).

### 🐛 Fixes

- Audit log: long changes wrap and collapse with Show all / Show less
  instead of being cut off (#107).
- Business employees: deleting one saved employee removed all of them.
- To-dos: changing a status on the dashboard erased the to-do's comment.
- Relationship updates no longer clear the case or note when they aren't
  sent.

## [3.1.1] - 2026-11-07

### 🌍 Translations

- **Russian** is now nearly complete (2,233 of 2,553 texts, up from 1,842),
  covering the 3.x features: integrations, saved records, themes, the menu,
  single sign-on. Thanks to the Crowdin translators.
- Persian, German, Chinese and Arabic catalogues updated with the newest
  texts (still in English where no translation exists yet).
- Persian and Russian translations carried over intact to the Crowdin
  i18next format introduced in 3.0.

## [3.1.0] - 2026-11-07

### ✨ New

- **Single sign-on through OpenID Connect** (issue #105). Users can sign in
  with Keycloak, Authentik, Authelia, Zitadel, Entra ID, Google or any
  other OpenID Connect provider (Authorization Code flow with PKCE, through
  `openid-client`). Configured with `OIDC_*` environment variables; off by
  default. Identities are linked by issuer and the provider's permanent user
  id, never by email. A sign-in without a linked account waits under
  Settings → User Management → Single sign-on for an admin to link it to an
  existing user or create one; `OIDC_AUTO_PROVISION=true` creates users on
  first sign-in instead (except when a local user has the same email).
  `OIDC_ADMIN_GROUP` lets the provider's groups decide who is an
  administrator. Single sign-on is exempt from GHOST's "require two-step
  verification" (the provider handles it), signing out also signs out at
  the provider (`OIDC_LOGOUT`), and `LOCAL_LOGIN_ENABLED=false` turns
  password sign-in off. Users created from single sign-on have no GHOST
  password; they create API tokens for the MCP server after a recent
  sign-in. Keycloak walkthrough in USER_MANAGEMENT.md.
- Single sign-on has its own rate limit (`SSO_RATE_LIMIT_MAX`, 120 requests
  per 15 minutes per IP), so a team behind one address doesn't share the
  ten password attempts.

### 🔧 Changed

- Database: `users.password_hash` may now be empty (single sign-on
  accounts), and new tables `user_identities` and `sso_pending`. Applied
  automatically on start.

## [3.0.5] - 2026-11-06

### ✨ New

- **Colour themes** (Settings → Appearance). Catppuccin (Latte, with
  Frappé, Macchiato or Mocha for dark), Nord, Dracula, Gruvbox, Solarized,
  Tokyo Night and Rosé Pine recolour the whole interface, including the
  relationship graph. Light/dark themes follow the mode switch; Dracula is
  dark only. Each theme brings its own accent; the accent picker still
  overrides it. Admins can set a default theme for users who haven't
  picked one (Settings → General → Global defaults). The standard GHOST
  look is unchanged.
- **Matrix theme**: phosphor green on black, a monospace font, faint
  scanlines, glowing headings, and green rain behind the sign-in screen
  (not shown when the system asks for reduced motion).
- Every theme's text, button and badge shades are generated to meet WCAG AA
  contrast, and a test checks all 16 theme variants.
- **Collapsible menu groups.** Click a group heading (Investigation, Money &
  property, Analysis, Sources) to fold it away; the choice is remembered in
  the browser. A folded group still shows the section you are in, so the
  menu never hides where you are.

## [3.0.4] - 2026-11-06

### ✨ New

- **Grouped menu.** The sidebar sorts its sections under four headings:
  Investigation (Cases, People, Businesses), Money & property
  (Transactions, Assets, Properties, Crypto Wallets), Analysis (Entity
  Network, Locations, Wireless Networks) and Sources (OSINT Tools, Files).
  Advanced Search moved up under the project selector, and Settings and
  Logout are pinned under the menu so they are always in view.
- **Modules** (Settings → General, admins). Switch off sections nobody on
  the instance uses: Transactions, Assets, Properties, Crypto Wallets,
  Entity Network, Locations, Wireless Networks, OSINT Tools, Files. A
  switched-off module leaves the menu for everyone, its address opens the
  dashboard, and its tabs (person and business dialogs), map layers and
  dashboard graph are hidden. Its data stays, the API and MCP server still
  reach it, and switching it back on brings everything back. Everything is
  on by default, so nothing changes on upgrade. Dashboard, Cases, People,
  Businesses and Settings are always on.

### 🐛 Fixed

- **The whole page scrolled instead of the content panel.** Since 2.5 the
  app frame grew with long lists, so the sidebar's bottom (Advanced Search,
  now Settings) ended up far below the window, and sections didn't return
  to their scroll position. The frame is the window's height again; the
  menu and the content each scroll on their own.

### 🔧 Changed

- **Test data:** every asset in `test-data/middle-earth.json` now has a
  chain of custody that matches the story (four more hand-overs: the
  mithril shirt, Andúril, Bill the Pony, the phial), so each asset shows
  its holder. The wiki screenshots use this data set.

## [3.0.3] - 2026-11-06

### ✨ New

- **Test data set** (`test-data/middle-earth.json`): a fictional
  investigation themed on *The Lord of the Rings* with 22 people,
  30 relationships, locations (New Zealand filming locations), travel,
  businesses with an ownership chain, properties, assets, transactions,
  wireless networks, OSINT data, saved records and to-dos. Import it into
  an empty project under Settings → Import / Export.

### 🐛 Fixed

- **Import put people outside their cases.** Imported people kept the case
  name but not the case link, so the Cases view showed them under no case.
  Assets, properties and transactions from an export lost their case too.
- **Importing into a second project touched the first one.** Case names are
  unique across the instance, so importing a file whose cases already
  existed in another project updated that project's cases and linked the
  new records into them. The imported case now gets the project's name
  added instead (`The One Ring (Middle-earth)`).
- **Business employees linked to a person** pointed at the person's id in
  the exported instance, not the imported one.
- **Squeezed avatars on person cards.** A long name or alias list pushed
  the round avatar into an oval.
- The README screenshot shows the 3.0 interface with the Middle-earth data.

## [3.0.2] - 2026-11-06

### ✨ New

- **Saved records** (issue #96). Integrations can keep each result exactly as
  the service returned it, including nested objects, lists and fields only
  some results have (builder: **Keep the full records**, on for new
  searches; manifests: `keepRecords`). In a search, tick **Keep full
  record** to save a result on a person. The person's new **Records** tab
  lists them with the tool, the search, the date and the source the record
  names (builder: **Record source field**, manifests: `recordSource`, such
  as a provider's `database` field). Open a record to see every field, and
  add any value from it to the OSINT data later. The value then links back
  to its record ("from a saved record"). Finding the same record again,
  whatever the order of its fields, refreshes it instead of saving a copy.
  Values added from a search also name the record sources they occurred in
  ("found 3 times · in Sample database A, Sample database B").
- **Search inside saved records**: Advanced Search has a **Saved records**
  option, and `GET /api/records?q=` finds records containing a text anywhere,
  across the project (also available to the MCP server).
- Saved records go with their person (deleting the person deletes them),
  are included in the full export (format 1.4) and restored on import, with
  value-to-record links kept. Records are stored in the database like the
  rest of a case: anything a service returns about a person is now kept if
  an investigator saves it, so treat backups accordingly.

## [3.0.1] - 2026-11-05

### ✨ Improved

- **Repeated values in integration results are counted** (issue #96). When
  a service returns the same value many times (27 entries with one email
  address), GHOST shows it once per search with how often it occurred, as
  `×27`, across all results of that search. Ticking it adds it once. For
  searches that show each list item as a separate result, a new **Merge
  identical results** option in the integration builder (on for new
  searches; manifests: `mergeDuplicates`) shows identical results once with
  their count.
- **Results can be added to any person in the project** (issue #96). A
  search started from the OSINT Tools page now has an "Add to" person
  search under its results; before, only searches started from a person
  could add anything. Each search also has a **Select all** button.
- **The same value from several sources** (issue #96). Adding a value the
  person already has no longer skips it: the new search is recorded as
  another source of that entry, so the person shows every tool that found
  it, with dates and counts ("via Breach search · 2026-11-05 · found 27
  times"). Running the same search again updates its count and date
  instead of adding a duplicate. Values typed in by hand keep their status
  and gain the tool sources. Entries keep `source` (the first finding) as
  before and gain a `sources` list.

## [3.0.0] - 2026-11-05

The technology upgrade: GHOST's frontend rebuilt on React 19, Vite and
Tailwind CSS 4, with a strict security policy, faster loading, and the first
browser and screenshot tests. 2.27.0 (below) was tagged but not released on
its own; its changes ship as part of 3.0. Upgrade notes: see
"Upgrading to 3.0" in the README.

### 🔒 Security

- **Strict Content-Security-Policy on every page.** Only the app's own
  bundled scripts run (`script-src 'self'`, no inline script, no `eval`),
  and the page can only talk to its own server (`connect-src 'self'`). If
  hostile markup ever got into a page, for example through an imported
  record, it could neither run code nor send data to another host.
- **No more CDN requests.** Leaflet's map marker images loaded from cdnjs,
  telling a third party each time an investigator opened a map. They now
  ship with the app.

- **`npm audit` is clean for everything that ships to the browser.** The
  last finding was in React Router 6 (an open redirect through a backslash
  in links), fixed by the move to React Router 8.

### ✨ Improved

- **Sections remember where you were.** Leave People, Cases, Settings or any
  other list and come back: your search, filters, open tabs and scroll
  position are still there (React 19 `<Activity>`). Data is still loaded
  fresh each time a section is shown. The map, the wireless map, the entity
  network and the dashboard (which holds the network graph) start fresh as
  before. Nothing is kept across sign-out or a project switch.
- **Faster first load.** Each section and dialog is downloaded the first
  time it is opened, so the map, graph and report-export code arrive only
  when used, and only the chosen language is downloaded (English is built
  in as the fallback). Before, the first screen loaded 2.5 MB of script with
  every language in it; now it loads about 0.6 MB.
- **Dates and numbers follow the UI language**, not the browser's: a
  Russian UI shows "4 нояб. 2026 г." and "1 234,50" even on an English
  browser, and report percentages use the language's decimal comma. Every
  language keeps the Gregorian calendar and Latin digits, so dates match
  the stored data and can be searched and copied into other tools. A date
  of birth no longer shows the day before for anyone west of UTC.
- **Russian (and later Arabic) plurals.** Counts that need Russian's "few"
  or "many" form (2–4, 5–20…) switched to English mid-sentence ("3 files").
  They now use the Russian text, and Crowdin is set up to ask translators
  for every plural form their language has.
- **An untranslated string shows the English text** instead of an empty
  space.
- Settings → General shows the real version instead of "1.0.0".
- **Three small visual fixes that came with Tailwind 4** (everything else
  looks exactly as before, checked screen by screen): date fields are as
  tall as the other fields; on phones the top bar and the menu drawer sit
  flush with the screen edge instead of as slightly rounded boxes; and a
  disabled field in dark mode (e.g. the username under My Profile) looks
  disabled.
- **Less work for the server at sign-in.** Before a project was chosen,
  GHOST already loaded every list without a project filter (for an admin:
  every project's people, businesses, assets…) behind the "Select a
  project" screen, then loaded them all again for the chosen project. Now
  nothing project-scoped loads until a project is chosen, and the
  data-model dropdowns on a page share one request.
- **Row buttons work on phones and tablets.** Edit/delete buttons that
  appear when you hover a row (assets, wallets, properties, transactions,
  to-dos, projects…) are now always visible on touch screens, where nothing
  can hover, and also appear when you reach them with the keyboard.
- **Open tabs survive an update.** A tab left open while GHOST was updated
  reloads once by itself when it needs a part of the app that changed,
  instead of showing an error.
- **"Load more" can no longer skip or repeat records.** Lists that load in
  pages (people, assets, crypto wallets, the audit log…) were sorted by
  creation time only. Records created in the same moment, as a bulk import
  does, had no fixed order between pages, so the next page could repeat
  some and leave out others. Every list now has a stable order (26 queries).
- **Ages are right in every time zone.** A date of birth was read as
  midnight UTC, so west of UTC the age went up a day early; search results
  also ignored whether the birthday had passed this year.
- **No more debug output in the browser console.** The network views
  printed names and connections to the console on every render.
- **No more sudden sign-in screen when the server is busy.** If the session
  check was rate-limited or the server was restarting, GHOST showed the
  sign-in page to someone who was still signed in. It now waits and asks
  again (as long as the server's `Retry-After` says) before giving up.
- **Long lists fit their content** (issue #64, stage 3). With 150 or more
  records, lists only render what is on screen; rows used a fixed height
  and clipped cards that wrapped onto more lines on narrow screens. Rows are
  now measured, and the list scrolls with the page instead of inside a box
  of its own.
- **Classic network diagram follows dark mode** (React Flow 12).
- **Sections can't take each other down.** Each section has its own error
  screen; a crash in one leaves the others working.

### 🛠 Libraries

- React 18 → **19.2** with the **React Compiler 1.0**, which memoizes
  components at build time (all contexts and the app shell are compiled;
  components it can't compile yet run as before).
- React Router 6 → **8** (`react-router-dom` no longer exists), react-leaflet
  4 → **5**, react-leaflet-cluster 2 → **4**, react-window 1 → **2**,
  reactflow 11 → **@xyflow/react 12** (reactflow is no longer maintained),
  lucide-react → **1.x**.
- Tailwind CSS 3 → **4**: configuration now lives in CSS (`src/index.css`,
  no `tailwind.config.js` or PostCSS config), built by the Tailwind Vite
  plugin. Tailwind 4 needs Safari 16.4, Chrome 111 or Firefox 128 (2023) or
  newer. GHOST's v3 defaults (grey borders, pointer cursor on buttons, grey
  placeholders) are kept, and spacing between items now mirrors in
  right-to-left languages without a workaround.
- i18next 23 → **26**, react-i18next 15 → **17**, docx 8 → **9** (the
  report-export code is about 25% smaller).
- Effects that deliberately ignored some dependencies now use React 19.2's
  `useEffectEvent` instead of disabling the lint rule; the sign-in screen
  uses Actions (`useTransition`) for its pending state.

### 🛠 Developer tooling

- **Vite 8 replaces Create React App**, which is deprecated and carried a
  stack of audit findings in its webpack toolchain. A production build takes
  about 2 seconds. `npm run dev` starts the dev
  server on port 3000 (proxying `/api` to the backend as before);
  `npm run build` still writes to `build/`, so the Docker image and nginx
  config are unchanged. Source maps are still shipped (issue #53).
  Environment variable `REACT_APP_API_URL` is now `VITE_API_URL`.
- **Vitest 5 replaces Jest.** `npm test` runs the unit tests;
  `npm run test:browser` runs component tests in a real Chromium (Vitest
  browser mode with Playwright). The first ones cover the two-step sign-in,
  right-to-left layout measured in the browser, and the Word report export.
  The project never had component tests before.
- **ESLint 10** with a flat config (`npm run lint`) replaces CRA's built-in
  lint setup. Components with JSX are now `.jsx` files; the unneeded
  `import React` lines are gone (the new JSX transform doesn't use them).
- CI now lints, runs the unit and browser tests, and builds the frontend.
- **Tests against the running app** (`npm run test:e2e`, Playwright):
  screenshots of every section and
  the main dialogs in light/dark, English/Persian and desktop/phone,
  compared against screenshots taken earlier on the same machine, and
  checks of what a page load asks the server for. Run them
  around a change that can move pixels; they need a running stack and an
  admin account (see `frontend/playwright.config.js`).

## [2.27.0] - 2026-11-04

Step 0 of the dependency plan: supported runtimes, security headers and
sturdier rate limits.

### 🔒 Security

- **Node.js 26 and nginx 1.30.** The images move to Node 26 LTS (security
  fixes until April 2029; Node 22's end in April 2027) and from nginx 1.25,
  which no longer gets security fixes, to the 1.30 stable line.
- **Security headers** on every page and API response: no framing by other
  sites, `nosniff`, a permissions policy that allows only passkeys, and
  `Referrer-Policy: no-referrer`, so following a link out of GHOST doesn't
  tell the destination where it runs (map tiles still send the origin, as
  OpenStreetMap asks). HSTS is sent when a proxy in front reports HTTPS.
  API responses block all content; the API docs page allows only its own
  scripts. nginx no longer shows its version.
- **IPv6 rate limiting.** Clients are counted per /56 block (express-rate-limit
  8); before, someone with IPv6 could rotate addresses for unlimited login
  attempts.
- **The backend port (3001) listens on localhost only.** A client reaching it
  directly could name its own address in `X-Forwarded-For` and get fresh
  login attempts. The app and the API stay on port 8080
  (`http://<server>:8080/api`); `BACKEND_BIND=0.0.0.0` in `.env` publishes
  3001 on the network again.
- **Rate limits survive restarts.** Login, second-step and tool-search
  counts are stored in PostgreSQL (migration `20261104000002`), so a restart
  no longer resets them, and multiple backend instances share them.

### 🔧 Changed

- Manual (non-Docker) setups need Node.js 22 or newer; 26 is recommended.
- `node-fetch` removed; the backend uses Node's built-in `fetch`.
- Rate-limit responses use the current standard `RateLimit` headers.

### 📝 Docs

- SECURITY.md and USER_MANAGEMENT.md listed a "5 password changes per hour"
  limit that never existed; password changes fall under the general API
  limit and need the current password.

## [2.26.0] - 2026-11-04

Two-step sign-in and API tokens, requested by @hunterghoul1 (#90).

### ✨ Added

- **Two-step verification.** Under **Settings → Security**, add an
  authenticator app (Google Authenticator, Microsoft Authenticator, Authy,
  1Password, …: scan the QR code or type the key) or a passkey. After the
  password, GHOST asks for a code or the passkey. Ten one-time recovery
  codes come with the first method.
- **Passkeys** work when GHOST runs on HTTPS with a domain name, or on
  localhost, at the address in `FRONTEND_URL`; list extra addresses in
  the new `PASSKEY_ORIGINS`. Elsewhere the option is hidden with a note.
- **Require two-step for everyone** (admin, Settings → Security). Users
  without it go to a setup screen at their next sign-in.
- **Admin reset** in Settings → Users for someone who lost their phone,
  plus `node scripts/resetTwoFactor.js <username>` for the only admin.
  User management shows who has two-step on.
- **Personal API tokens** for scripts and the MCP server
  (`Authorization: Bearer ghost_…`). Shown once, stored as a hash,
  optional expiry, revocable. A token acts as its owner and can't change
  the password or security settings.
- **MCP server 1.3**: `GHOST_API_TOKEN`. Accounts with two-step
  verification need it; username and password still work for accounts
  without.

### 🔧 Changed

- Docker images and CI run on Node 22 (Node 18 has had no security
  fixes since April 2025). A manual setup needs Node 20 or newer.
- Library updates. Backend: express 5.3, zod 4.6, pg 8.23,
  express-session 1.19 and others, and multer 2 for uploads (multer 1 is
  deprecated). MCP SDK 1.32. Frontend: react-router 6.30.6 and minor
  updates. A `KML_MAX_BYTES` that isn't a number now falls back to 5 MB.

### 🔒 Security

- The backend and MCP server have no known vulnerable dependencies left
  (`npm audit`): fixed DoS issues in body-parser, path-to-regexp, qs and
  zod, an IP-spoofing issue in proxy-addr, and the known multer 1 issues.
  What remains on the frontend is inside the build tools (Create React
  App), not in the app users load.

## [2.25.0] - 2026-11-04

Feedback from @hunterghoul1 on the integration builder (#96).

### ✨ Added

- **API key inside the address.** For services that take the key as part
  of the URL (`/api/your-key/lookup`), choose **Key in the address path**
  in the builder's Connecting step and put `{{api_key}}` where the key
  goes. A test key found in a pasted example is replaced with
  `{{api_key}}` automatically. The key stays in the encrypted key store:
  it's never written into the integration file, and requests shown or
  logged have it as `***`.
- **Searches without input**, for account balance, service status and
  similar. They run from the tool's **Search** button on the Tools page,
  and **Test connection** uses one when the integration has no other test.
- **Custom search types.** Name your own kind of identifier (e.g.
  "Vehicle registration number") and choose which OSINT data types it
  applies to; a person's entries of those types get a search button for
  it.

### 🐛 Fixed

- In the builder, testing a second search ran the first one, and the
  integration couldn't be saved, when search names had no Latin letters
  (e.g. Russian). Search ids are now unique in any language; saved ones are
  kept.

### 🔒 Security

- API keys are removed from search results too, in case a service echoes
  the request back; before, a shared key could be seen by investigators.

### Upgrading

```
git pull
docker compose pull && docker compose up -d     # amd64
docker compose up -d --build                    # ARM (images are amd64-only)
```

No database changes. Community integration files gain the `url` auth type
and the `text` and `none` input kinds (see `integrations/README.md`).

## [2.24.0] - 2026-11-04

### ✨ Added

- **Right-to-left languages (#99).** Persian, Arabic and other RTL
  languages get a mirrored interface, not just translated text: the
  navigation sits on the right, and forms, tables, tabs, menus, switches and
  arrows run right-to-left. Word reports come out right-to-left too.
  - Case data in mixed scripts stays readable: phone numbers, emails, URLs,
    `@handles`, coordinates and aliases keep their own order inside Persian
    text, and an English value typed into a Persian form is laid out
    left-to-right. Notes take their direction from their own text.
  - The scratchpad docks bottom-left in RTL, away from the navigation.
  - Map and relationship-diagram overlays keep their places, next to the
    controls those libraries draw.
- **Persian (فارسی)** in **Settings → General**. The translation was
  contributed by @RMA1313 (#100) and is maintained on
  [Crowdin](https://crowdin.com/project/ghost-osint-crm) from now on. Arabic
  is open there for translators too.

### 🐛 Fixed

- The person detail view showed OSINT entry types, category and status in
  English whatever the interface language.

### 🧑‍💻 For contributors

- Frontend tests now run in CI. UI code uses logical direction classes
  (`ms-`, `pe-`, `start-`, `text-start`, `border-s`, …) instead of `ml-`,
  `pr-`, `left-`, `text-left`, `border-l`; they look identical in English and
  mirror in RTL, and a test fails on the physical ones.

### Upgrading

```
git pull
docker compose pull && docker compose up -d     # amd64
docker compose up -d --build                    # ARM (images are amd64-only)
```

No database changes. Nothing changes for left-to-right languages.

## [2.23.0] - 2026-11-03

### ✨ Added

- **Scratchpad.** A small floating notepad, on by default, for copying text
  around and quick notes while you work. It stays open across pages and
  projects and keeps its text when closed.
  - Notes are markdown, shown rendered. `- [ ]` tick boxes can be clicked.
    Notes can be edited (double-click), copied, deleted one by one or all
    at once, with a few seconds to undo.
  - Select text anywhere in GHOST and click **Add to scratchpad** (or press
    `Alt+Shift+A`). The note records where it came from, e.g.
    *Op Nightjar · People · Jane Doe*. `Alt+Shift+S` opens and closes it.
  - The active project's open dashboard to-dos appear at the top and can be
    ticked off there. They can be turned off in the scratchpad's settings.
  - Its own settings (gear icon): corner, color, opacity when idle, text
    size, to-dos on/off and the selection button on/off. It can be dragged
    and resized; on phones it opens as a bottom sheet.
  - Turn it off entirely in **Settings → General**.

### 🔒 Security

- Scratchpad notes and settings belong to the user's account only: every
  query is scoped to the logged-in user, they're not project-scoped, and
  they're kept out of the audit log, database export and the MCP toolset.
- Pasted markdown is sanitised, and nothing in a note loads a remote
  resource: images become links and inline styles are removed, so a pasted
  tracking pixel can't reveal the analyst's IP. Links open in a new tab
  without a referrer.

### Upgrading

```
git pull
docker compose pull && docker compose up -d     # amd64
docker compose up -d --build                    # ARM (images are amd64-only)
```

Migration `20261103000001` adds two tables (`scratchpad_entries`,
`scratchpad_settings`) and changes no existing data. The scratchpad is on
for everyone after upgrading; **Settings → General** turns it off.

## [2.22.0] - 2026-11-01

### ✨ Added

- **Integration builder (#96).** Admins can create an integration for a new
  OSINT service without writing JSON. Open it from **Tools → Add Tool →
  Integrated → "Build a new integration…"** or from **Settings → Tools &
  Integrations**. Four steps:
  1. **About the service:** name, description, website, terms of use.
  2. **Connecting:** whether a key is needed and how the service expects it,
     in plain terms, plus an optional key for test calls.
  3. **Searches:** paste an example request from the service's
     documentation and the sample value in it, and the builder works out the
     request. A live test call shows the response; click values to make them
     result fields, rename them, and mark which can be added to a person. A
     preview shows how results will look.
  4. **Review:** install and return to the tool form with the integration
     selected (optionally keeping the test key as the tool's shared key), or
     copy/download the file to share in the community folder.
- Community integrations can be edited in the builder, and built-ins can be
  used as a starting point for a custom copy.

### 🔒 Security

- The builder is admin-only. Test calls go through the same guarded client
  as searches (HTTPS only, no private addresses, no redirects, size and time
  limits), are audit-logged and rate-limited, and the test key is never
  stored unless you choose to keep it.

### Upgrading

No migration. Pull and restart as usual.

## [2.21.0] - 2026-11-01

### ✨ Added

- **Integrated OSINT tools (#96).** The Tools page now has two sections:
  *Generic tools* (links, as before) and *Integrated tools* that GHOST
  searches with directly. Badges show whether a tool is a link, connected,
  needs an API key or is disabled, and who it is shared with.
- **Nine built-in integrations:** crt.sh, Wayback Machine, Gravatar and
  IPinfo and urlscan.io (no key needed), plus Have I Been Pwned, Hunter.io,
  Shodan and VirusTotal (API key needed).
- **Search from a person.** Each OSINT data entry has a search button, and
  "Search with tools" searches several identifiers at once. Pick the
  searches, review the results, and tick values to add to the person. Added
  entries are marked *unverified* and show the tool, query and date.
  Searches that use API quota say so and are not preselected.
- **Community integrations.** An integration is a JSON file, not code. A
  new top-level [`integrations/`](integrations/) folder documents the format,
  holds community contributions and a template, and states what is accepted:
  lawful, legitimate sources only, no leaked-database services. Admins
  install one under **Settings → Tools & Integrations**, after seeing which
  host it will send searches to.
- **Tool management.**
  - Central tools are managed by admins and shared with everyone or with
    selected projects; any tool can be disabled without deleting it.
  - Admins choose whether users may add their own tools. A user's tools
    are private by default and can be shared with their projects.
  - Per integration, one shared API key or each user's own key.
- **Export and import of tool lists**, with or without configuration
  (sharing, enabled, key mode). With a passphrase, API keys are included,
  encrypted with it. Import can place every tool in the current project.

### 🔒 Security

- Integration requests run on the server: HTTPS and GET only, no redirects,
  size and time limits, and private, loopback and link-local addresses are
  refused at connect time (`INTEGRATIONS_ALLOW_PRIVATE=true` allows a LAN
  service). Each provider is rate-paced; searches are audit-logged and have
  their own per-user limit.
- API keys are write-only: stored encrypted (AES-256-GCM, key derived from
  `SECRETS_KEY`, or `SESSION_SECRET` when that isn't set) and never returned
  to the browser, written to logs or recorded in the audit log.
- Searching, testing, key management and export/import are kept out of the
  MCP server.

### ⚠️ Changed

- Non-admins can no longer edit or delete central tools; before, anyone
  could. Every existing tool becomes a central tool shared with everyone, so
  nobody loses access.
- Tools a non-admin adds are now private until they share them.

### Upgrading

```
git pull
docker compose pull && docker compose up -d     # amd64
docker compose up -d --build                    # ARM (images are amd64-only)
```

Migration `20261102000001` adds the integration tables and new tool columns
and changes no existing data.

- **Changing `SESSION_SECRET` makes stored API keys unreadable.** The tools
  then show *Needs key* until the key is entered again. To rotate the
  session secret independently, set `SECRETS_KEY` in `.env` before adding
  keys.
- The full database export under Settings → Import/Export still restores
  tools as plain links; use the Tools page export for integrated tools.

## [2.20.0] - 2026-11-01

### ✨ Added

- **File attachments (#97).** Documents and evidence can be uploaded to a
  person (their new Files tab) or to a project as a whole. The new Files
  page lists every file in the project, including the ones attached to
  people, with the person each belongs to; search by name or description
  and filter by person. Each file records its size, uploader, upload date,
  an optional description and a SHA-256 hash.
- **In-app previews.** PDF, images, plain text, CSV/TSV (as a table) and
  Word `.docx` open inside GHOST; other types download. Text and CSV saved
  in Windows-1251 are detected automatically, with a manual encoding
  picker. The Word preview loads only when a `.docx` is opened.

### 🔒 Security

- Files follow project membership and are never publicly reachable: they
  are stored outside the served `public/` folder under random names and
  only returned through an authenticated, membership-checked download,
  always as an attachment (`nosniff`, sandbox CSP). Previews render those
  bytes in the browser with a type chosen from an allowlist, so an
  uploaded HTML or SVG file can't run as part of GHOST.
- Any project member can upload, view and download; deleting a file is
  limited to its uploader, the project's owners and managers, and admins.
  Uploads, downloads, previews and deletions are audit-logged.
- Deleting a person keeps their files as project files. Deleting a project
  (manually or by the retention policy) removes its files from disk too.

### Upgrading

```
git pull
docker compose pull && docker compose up -d     # amd64
docker compose up -d --build                    # ARM (images are amd64-only)
```

The migration (`20261101000001`) adds a `files` table and changes no
existing data. Files are kept in a new Docker volume, `files_data`, which
Compose creates automatically.

- **Back up the `files_data` volume as well as the database.** A database
  dump does not contain the files.
- The upload limit is 50 MB per file (`FILES_MAX_BYTES` in `.env`). Above
  100 MB, also raise `client_max_body_size` for `/api/files` in
  `frontend/nginx.conf`.
- Export/import does not include files yet.
- Running without Docker: files go to `backend/data/files` unless
  `FILES_DIR` is set.

## [2.19.0] - 2026-10-21

### ✨ Added

- **Project Owner role (#95).** Projects now have three roles: Owner >
  Manager > Investigator. Like the others it is per project, so the same
  person can own one project, manage another and only investigate in a
  third. An owner can do everything a manager can, plus add, promote,
  demote and remove managers. Only an administrator can make someone an
  owner or change or remove one, and deleting a project stays admin-only.
  Existing members keep their role; nobody becomes an owner until an
  administrator makes them one. Migration `20261021000001` widens the
  allowed roles; no data changes.

### 🔒 Changed

- Membership rules are now rank-based: owners and managers can only act
  on members ranked below them and grant roles below their own, and
  nobody but an administrator can change their own membership.

### 📝 Documentation

- Roles and the user hierarchy are documented in a new README section
  (Roles & Permissions) and in full in USER_MANAGEMENT.md, with a
  permission table for every role; QUICK-START, SECURITY.md and the API
  catalogue are updated to match.

### Upgrading

```
git pull
docker compose pull && docker compose up -d     # amd64
docker compose up -d --build                    # ARM (images are amd64-only)
```

The migration runs automatically at startup and changes no data. Existing
managers keep their role; to use the new tier, an administrator adds an
owner from the project's member list.

## [2.18.4] - 2026-10-21

### 🔒 Fixed

- **Project managers could manage other managers, and themselves (#95).**
  The membership endpoints only checked that the caller was a manager on
  the project, never who was being changed or which role was granted. A
  manager could add or promote managers, demote or remove other managers
  (including whoever appointed them), and change or remove their own
  membership. A manager can now only add and remove investigators, and
  cannot change their own membership; only an administrator can assign,
  change or remove a manager. Enforced by the API, and the members dialog
  hides the controls a manager can no longer use.

### Upgrading

```
git pull
docker compose pull && docker compose up -d     # amd64
docker compose up -d --build                    # ARM (images are amd64-only)
```

No database changes.

## [2.18.3] - 2026-10-10

### 🐛 Fixed

- **Upgrading from 2.16 or earlier left the backend "unhealthy" (#94).**
  2.17.0 put the bundled PostgreSQL container behind a `local-db` Compose
  profile, so a `.env` without `COMPOSE_PROFILES=local-db` — every `.env`
  created before 2.17 — started no database at all. The bundled database
  starts by default again. Using your own PostgreSQL server is now an
  opt-in instead: add
  `COMPOSE_FILE=docker-compose.yml:docker-compose.external-db.yml` to
  `.env`. **If you cleared `COMPOSE_PROFILES` on 2.17/2.18 to use an
  external server, add that line** — otherwise an idle bundled database
  container will start alongside (GHOST keeps using the server in
  `DB_HOST`).
- When the backend cannot reach PostgreSQL at startup it now logs the
  host and port it tried and what to check, instead of only a stack trace.

## [2.18.2] - 2026-10-02

### 🐛 Fixed

- **The app had no favicon, and its home-screen icons were broken.** The two
  logo files had a leading space in their names, so `/logo192.png` and
  `/logo512.png` returned the HTML page, and `favicon.ico` was an empty
  file. The logos are renamed and the browser tab now uses the logo.

### 📝 Documentation

- README, QUICK-START, USER_MANAGEMENT and SECURITY brought up to date with
  2.18: project membership and roles, the API reference, ARM hosts (the
  prebuilt images are amd64 only), running the backend without Docker, and
  new troubleshooting entries. QUICK-START's `.env` command was missing
  `COMPOSE_PROFILES=local-db`, without which no database container starts.
- The wiki text was refreshed from v2.8 to v2.18.1.

### 🧹 Removed

- Third-party agent skill files under `.agents/` that had been committed by
  accident, and a design spec for a feature that shipped in 2.17.0.
- Dead code, with no change in behaviour: five frontend packages nothing
  imported (`html2canvas`, `jspdf`, `jspdf-autotable`, `recharts`,
  `web-vitals`), two unused API client objects, and unused imports and
  helpers in the backend — including a leftover `child_process` import in
  `server.js`. The production frontend bundle is byte-identical before and
  after.
- SECURITY.md no longer claims that input is stripped of `<script>` tags
  before storage. No such code exists; output escaping is done by React.

## [2.18.1] - 2026-10-02

### 🐛 Fixed

- **`/api/docs` rendered a blank page behind the bundled nginx (#93).** The
  page's script and stylesheet were served from URLs ending in `.js` and
  `.css`, and the frontend's nginx config routes every such URL to its own
  static files before the `/api` proxy rule is considered — so they
  returned 404. They are now served from extensionless URLs, which are
  proxied like any other API route. No nginx change is needed, so this also
  holds for custom reverse proxies using the same pattern.
- **Advanced search through the MCP server ignored the search term.** The
  spec documented a `q` parameter the endpoint never read (it reads
  `searchText`, `searchIn[]`, `categories[]`, `statuses[]` and date/sort
  options), so `ghost_get_search_advanced` returned every person in scope.
  The real parameters are documented and the MCP server now sends array
  filters correctly.
- **`ghost_delete_wireless_networks_associate` always failed with a 500.**
  The endpoint reads `person_id` / `business_id` from a request body the
  spec did not declare, so the tool sent none.
- **Project create and delete were not marked admin-only** in the spec, and
  delete's `confirm_name` was undocumented, so a non-empty project could
  not be deleted through the MCP server.
- **The export endpoint's description claimed it exports every record.** It
  does not include crypto wallets, relationship rows, or projects and their
  members; the description now says so. Export/import itself is unchanged.

### ✨ Added

- **Previously undocumented filters** are in the spec and therefore usable
  from the API reference and the MCP server: audit logs (entity, user,
  action, date range, paging), assets (category, status, case, search,
  holder, map bounds), transactions (business, wallet, tx hash, subject and
  venue references, case, date range, map bounds), locations, the ledger's
  case and date range, and `case_id` on people.
- **A test workflow.** The backend suite now runs on every push and pull
  request. It checks that every route is documented and that each
  operation's query parameters and admin requirement match its handler.
  2.18.0's notes described this guard as failing the build; until now
  nothing ran it automatically.

### 🔧 Changed

- **MCP server v1.2.1.** A tool-name collision in a future spec is logged
  and the duplicate skipped, instead of stopping the server at startup.

## [2.18.0] - 2026-10-01

### ✨ Added

- **Interactive API reference at `/api/docs` (#93).** Swagger UI over the
  instance's own OpenAPI document, for signed-in users. "Try it out" sends
  requests with your session, so every call runs under your own role and
  project memberships — and writes and deletes are real. There is no
  Authorize step: GHOST authenticates with the session cookie, which the
  browser sends by itself. Set `API_DOCS_ENABLED=false` to remove the page.
- **Public API catalogue.** The same reference for the latest release,
  read-only, at https://elm1nst3r.github.io/GHOST-osint-crm/ — republished
  on every release tag. Each endpoint shows the MCP tool it becomes.
- **MCP server v1.2.** Twelve new tools: crypto wallets (list, get, create,
  update, delete), project members (list, add, change role, remove),
  single-address geocode, nearby wireless networks, and the user directory.
  Lists of project-scoped records accept `project_id`. No existing tool was
  renamed or removed.

### 🔧 Changed

- **The OpenAPI document now covers the whole API** — 127 operations, up
  from 96. Crypto wallets, project membership, export/import, the branding,
  geocoding, update-check and retention settings, and several wireless,
  geocoding and system endpoints had never been added to it. A new test
  compares the document against the Express routes and fails when either
  side has an entry the other lacks.
- **Some endpoints are documented but deliberately not exposed as MCP
  tools**: instance settings, whole-database export/import, bulk delete,
  batch geocoding, health/version probes and file uploads. They carry
  `x-mcp-exclude` in the spec.

### ⚠️ Upgrade note

- **Update `mcp/` when you update GHOST.** MCP server 1.1 and earlier
  assume every request body is JSON; the spec now includes two file-upload
  endpoints, and an old MCP server pointed at a 2.18.0 backend fails at
  startup.

## [2.17.0] - 2026-09-16

### ✨ Added

- **Five new community-translated languages (#59).** French, German,
  Spanish, Chinese (Simplified) and Russian join English in Settings →
  General, via the project's Crowdin integration. The translated catalogs
  had already landed on `main` through Crowdin PRs but weren't wired into
  `frontend/src/i18n.js` yet — that's the step this release completes.
- **Server-side global application settings (#91).** App name, logo,
  default language, and default theme mode move from browser `localStorage`
  into the database — admin-configured once, shared across every user and
  device instead of per-browser. Each user can still set their own
  language/theme, which takes precedence over the admin default
  (`PUT /api/auth/me`). API keys, integrations, the update-check toggle, and
  archived-project retention were already server-side from #62.

### 🔧 Changed

- **External PostgreSQL server support (#75).** `docker-compose.yml`'s
  backend service was hardcoding `DB_HOST`/`DB_PORT` to `db`/`5432`,
  silently overriding whatever was set in `.env`. Fixed so both are read
  from `.env` like the other database variables. The bundled `db` container
  now sits behind a `local-db` Compose profile — clearing
  `COMPOSE_PROFILES` in `.env` skips starting it entirely, for anyone
  pointing GHOST at their own PostgreSQL server. **Existing `.env` files
  need `COMPOSE_PROFILES=local-db` added before the next
  `docker compose up -d`**, or the bundled database will stop starting.
  Full MySQL/MariaDB support remains out of scope — see the issue for why.

## [2.16.0] - 2026-08-31

### ✨ Added

- **Delete a project together with all of its data (#88).** Deleting a
  project used to be refused until every entity inside it had been removed by
  hand. The delete action now opens a confirmation dialog listing what it
  will destroy — people, organizations, relationships, cases, properties,
  assets, transactions, crypto wallets, wireless networks, travel records,
  tasks — and removes all of it plus the project in a single transaction.
  When the project holds data the operator must type its exact name to
  confirm. Data in other projects, and global configuration (data model,
  OSINT tools, integrations), are untouched. `GET /api/projects/:id/stats`
  exposes the per-entity counts.
- **Archived-project retention policy (#88).** A new admin setting
  (Settings → General) can automatically delete projects that have stayed in
  the "Closed" status longer than a chosen window (30 / 90 / 180 / 365 days),
  along with all their data, via a daily background sweep. The default is
  "Never" — the feature does nothing until an operator opts in. A new
  `projects.archived_at` column records when a project was closed and is the
  clock the window counts from.

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
