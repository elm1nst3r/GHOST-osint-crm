# Spec: Case-Based Data Isolation and Project Selector (issue #83)

**Status:** Draft / not yet approved for build · **Source:** GitHub issue #83 (reporter @hunterghoul1, owner @elm1nst3r)

This spec is a planning document, not an implementation-ready one. It exists to scope
the size of the change and get sign-off on the approach before any code is written.

---

## 1. What already exists

There is a `cases` table (migration `20260708000001_baseline.js`) with `case_name`,
`description`, `status`, plus CRUD at `backend/routes/cases.js` and a UI at
`frontend/src/components/CaseManagement.js` (nav item "Cases" in `App.js`). It was
built for issue #43 (asset/transaction tracking) as an **optional label**, not an
isolation boundary:

- `case_id` exists as a nullable FK on exactly three tables: `properties`, `assets`,
  `transactions`.
- It's an optional filter (`?case_id=`) on those three routes' list endpoints — nothing
  defaults to it, nothing enforces it, and no other entity type has the column.
- `people`, `businesses`, `locations`, `wireless_networks`, `relationships`,
  `travel_history`, `todos` have no case association at all.
- There is no "active case" concept anywhere — no session state, no selector, no
  scoping of queries.

So #83 is not "add a cases table" (that part exists) — it's "make case membership
total across every entity type, and make it the default lens the whole UI works
through." That's a materially bigger change than the existing feature.

## 2. Proposed data model

Add `case_id INTEGER REFERENCES cases(id) ON DELETE SET NULL` to every case-scoped
table, following the existing pattern on `assets`/`properties`/`transactions`:

- `people`, `businesses`, `locations`, `wireless_networks`, `relationships`,
  `travel_history`, `todos`

Nullable, not `NOT NULL`: existing rows and anything the reporter doesn't want to
sort will land in an implicit "Unassigned" bucket rather than requiring a forced
migration/backfill choice at upgrade time.

Deliberately **out of scope**, per the reporter's own framing in the issue — these
stay global, not per-case:

- Data-model definitions (`model_options` — person categories/statuses, connection
  types, location types, etc.) — a category renamed inside one case shouldn't fork
  across cases.
- OSINT tools/integrations (`tools` table), users, audit logs, app settings,
  geocoding cache/API keys.

Open question the reporter's proposal doesn't resolve: **relationships that cross
a case boundary.** If a Person in Case A is connected to a Person in Case B (real
scenario — the same individual turns up in two unrelated investigations), does the
relationship belong to a case, both, or neither? Recommend: a relationship's case_id
is independent of its endpoints' case_id, and the UI warns (not blocks) when linking
across cases — mirrors how the reporter said conflict-of-interest work should
surface, not gate.

## 3. Proposed scoping mechanism

- **Active case is a frontend concern, not a hidden backend default.** Store the
  selected case id in `UIContext` (see `project_context_refactor_2026-05-29` — this
  is exactly the kind of cross-cutting UI state that context was built for) and
  persist it in `localStorage` so it survives reloads, the same way theme/appearance
  state does.
- Every list/create/update request from `DataContext` appends `case_id` — for lists,
  as a filter; for creates, as the value written. This means scoping is enforced
  **per-request from the frontend**, not server-side per-session — consistent with
  this app's threat model (single shared backend, session-authenticated), but worth
  being explicit that a user with API/MCP access and no case_id set sees everything,
  same as today.
- An "All Cases" pseudo-selection (case_id unset) is preserved — it's the only way
  to see the "Unassigned" bucket and to do cross-case admin work (e.g. the COI
  detection work planned for #65 explicitly needs to see across cases).
- MCP tool surface: each case-scoped tool gains an optional `case_id` argument,
  defaulting to none (i.e. unscoped) rather than inheriting a frontend session's
  active case, since MCP calls aren't tied to a browser session.

## 4. Project selector UI

- New control in the top bar (next to the existing hamburger/theme controls — see
  the responsive-layout work in #64), a dropdown: current case name (or "All Cases"),
  opens a list of cases with a "+ New Case" entry inline. Replaces the standalone
  "Cases" nav section's role as the *only* place cases are visible, though
  `CaseManagement.js` stays as the full manage/archive/rename screen.
- Switching cases does not reload the page; it re-fetches through `DataContext`
  the same way pagination/filter changes already do.

## 5. Rollout size — why this should be staged

This touches nearly every list/detail/form component in `frontend/src/components/`
(case_id filter + case_id on create) and every corresponding backend route, plus a
migration backfilling the column onto 7 more tables. Given the responsive-layout
work (#64) was already staged into 4 phases for exactly this reason (surface area),
recommend the same treatment:

1. **Schema + backend filtering** — add columns, wire `?case_id=` into the 7 new
   routes' list/create endpoints, migration. No UI change yet; fully additive and
   safe to ship dark.
2. **UIContext active-case state + top-bar selector**, wired into `DataContext`
   fetch/create calls for `people` and `locations` first (highest-traffic entities) —
   validates the pattern before propagating everywhere.
3. **Propagate to remaining entities** (businesses, wireless networks, relationships,
   travel history, todos) + graph/map/search/report scoping.
4. **Cross-case surfacing** — "Unassigned" bucket UX, cross-case relationship
   warning, admin/export considerations.

## 6. Explicitly not doing (yet)

- Per-case permissions/access control (the reporter didn't ask for it; this repo
  has no multi-tenant auth model at all today — would be a much larger change).
- Copy/move entities between cases beyond a basic case_id edit — the "possible
  additional functionality" list in the issue (case-specific dashboards, sharing
  entities between cases, case statistics) is deferred to a follow-up once the
  core scoping lands and real usage shows what's actually needed.

---

**Recommendation:** approve stage 1 (schema + backend filtering) as a self-contained,
low-risk PR, then re-evaluate stage 2 UI scope once that's in — the selector design
may want to change based on how many cases real users actually run concurrently.
