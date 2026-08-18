# Spec: Project-Based Data Isolation, with Cases Nested Inside (issue #83)

**Status:** Draft / not yet approved for build · **Source:** GitHub issue #83 (reporter
@hunterghoul1, owner @elm1nst3r)

This spec is a planning document, not an implementation-ready one. It exists to scope
the size of the change and get sign-off on the approach before any code is written.

**Revision note:** an earlier version of this spec conflated "case" (the issue's title)
with the isolation boundary the reporter actually wants. Roy's correction: the hard
boundary is a **Project** — closer to "a fresh database" per investigation, e.g. a
journalist's two unrelated stories — and **Case** is a lighter grouping *within* a
project, for different angles or hypotheses being worked inside the same story. Cases
already exist in GHOST (see below); they are not the new concept here. Projects are.

---

## 1. What already exists

There is a `cases` table (migration `20260708000001_baseline.js`) with `case_name`,
`description`, `status`, plus CRUD at `backend/routes/cases.js` and a UI at
`frontend/src/components/CaseManagement.js` (nav item "Cases" in `App.js`). It was
built for issue #43 (asset/transaction tracking) as an **optional label**, not an
isolation boundary — `case_id` is a nullable FK on exactly `properties`, `assets`,
`transactions`, used as an optional list filter. Nothing defaults to it, nothing
enforces it, no other entity type has it.

**There is no Project concept at all today.** Everything in GHOST — people,
businesses, locations, relationships, the graph, search, the dashboard — is one
global dataset. That's the actual gap #83 is describing.

## 2. The two-tier model

```
Project "Story 1"                     Project "Story 2"
 ├── Case "Financial angle"             ├── Case "Property angle"
 │    ├── People, Businesses, ...       │    ├── People, Businesses, ...
 ├── Case "Witness angle"               └── (uncased data)
 │    ├── People, Businesses, ...
 └── (uncased data — collected but
      not yet sorted into an angle)
```

- **Project** is the hard boundary. Switching projects should feel like switching to
  a different investigation with nothing bleeding across — dashboard, graph, search,
  map, reports, everything scoped to it. This is what "almost a fresh database" means
  in practice, without the operational cost of literally running separate databases
  (see §5 for why).
- **Case** is unchanged in spirit from what it already is in GHOST: an optional,
  lighter-weight cluster *inside* a project — an angle, a hypothesis, a sub-thread of
  the same story. A project can have zero, one, or many cases. Data doesn't have to
  belong to a case, but it always belongs to a project.

## 3. Proposed data model

New `projects` table, same shape as `cases`:

```sql
CREATE TABLE projects (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL UNIQUE,
  description TEXT,
  status VARCHAR(50) DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);
```

`cases.project_id INTEGER NOT NULL REFERENCES projects(id)` — every case belongs to
exactly one project. Migration backfills a "Default Project" and points all existing
cases at it, so nothing currently in GHOST becomes orphaned on upgrade.

`project_id INTEGER NOT NULL REFERENCES projects(id)` added directly to every
entity table — `people`, `businesses`, `locations`, `wireless_networks`,
`relationships`, `travel_history`, `todos`, plus the three that already have
`case_id` (`properties`, `assets`, `transactions`). **Not derived through case_id** —
most data won't have a case, but everything needs a project, so the column has to be
on the entity directly. Where `case_id` is also set, application logic (and a check
constraint where practical) enforces the case's project matches the entity's project —
a case can't reach across project boundaries.

Backfill: existing rows get `project_id` = the same "Default Project" created for the
cases backfill, so upgrading doesn't require picking a project for old data up front.

**Cross-project linking is a per-project setting, off by default.** Roy's reasoning:
a hard block sounds right in principle ("I want the data to be different"), but in
practice re-entering a person from scratch because they resurfaced in a second,
unrelated story is wasted work — and if the same person genuinely does get entered
independently in two projects, there should be a way to reconcile that later, not just
block it in advance.

- `projects.allow_cross_linking BOOLEAN DEFAULT false`, set at creation (editable
  after). Off means a hard boundary, matching "almost a fresh database." On means
  the person/business picker used when building a relationship in this project can
  also search other projects' entities.
- **No duplication of the entity.** A cross-linked person still lives in, and is
  owned by, their home project (`people.project_id` unchanged) — only the
  *relationship* is created under the active project, same mechanism already used for
  case-crossing relationships. The entity's card shows a small "from Project X" badge
  wherever it appears outside its home project, so provenance is always visible.
- **Severing it is just deleting the relationship** — no new mechanism needed, since
  relationships are already independently deletable. The cross-link was never a copy,
  so removing it doesn't touch the underlying person/business record in either
  project.
- **Enforcement:** app-level check on relationship create — if the two endpoints'
  `project_id`s differ, the relationship's own project must have
  `allow_cross_linking = true`, else reject. Not a blanket DB constraint, since it's
  conditional on the setting.
- Within a project, crossing *case* boundaries stays unconditionally fine, just a UI
  warning — that part of the earlier draft still holds; it's a much lighter grouping
  than a project.

**Deduplication/merge is a related but separate problem, deliberately not in this
spec.** If the same real person ends up as two independent records (one per project,
entered before the reporter realized they were connected), reconciling them is a
*merge people* feature — combine two person rows into one, keeping both projects'
history. GHOST already has a duplicate-name detector (used by the MCP layer and
`BulkRelationshipTool`'s import matcher) that a merge
tool could build on, but actually merging records safely (which project "wins,"
what happens to each one's relationships/locations/attachments) is real complexity in
its own right and unrelated to project isolation specifically — worth its own issue
if the reporter wants it, not bundled into this build.

**Deliberately stays global, not per-project** (same reasoning as the earlier draft,
now scoped one level up):

- Data-model definitions (`model_options` — categories, statuses, connection types).
  Two stories having different vocabularies for "Suspect" vs "Witness" would be a
  much bigger ask (effectively per-project schemas) and isn't what was requested.
- OSINT tools/integrations (`tools` table), users, audit logs, app settings,
  geocoding cache/API keys.

## 4. Proposed scoping mechanism

- **Active project is a frontend concern**, stored in `UIContext` and persisted in
  `localStorage` (same pattern as theme/appearance state) — `activeProjectId`. Every
  list/create/update call from `DataContext` carries it.
- Unlike the case selector (which can reasonably default to "All Cases" and show
  everything), **the project selector should not have a comfortable "all projects"
  default for daily use** — showing all projects' data merged back together defeats
  the reporter's actual complaint. A first-run/fresh-install flow should require
  picking or creating a project before the rest of the app is usable, similar to how
  admin setup already gates on creating the first user.
- An explicit **cross-project admin view** still exists but is a deliberately separate
  mode (not the default lens) — needed for things like the COI detection work planned
  for #65, which by its nature has to look across everything.
- **Case selector becomes secondary, nested inside the active project** — same
  behavior as the earlier draft (dropdown, "All Cases in this project", inline
  "+ New Case"), just re-scoped: it only ever lists cases belonging to the active
  project.
- MCP tool surface: each scoped tool gains optional `project_id` and `case_id`
  arguments, both defaulting to unscoped (MCP calls aren't tied to a browser session's
  active project).

## 5. Why shared schema + `project_id`, not separate databases/schemas per project

Worth stating explicitly since "almost a fresh database" is the reporter's own framing
and a literal per-project Postgres database/schema was considered:

- **Migrations, backups, and the Docker/`docker compose` setup all assume one
  database.** Per-project databases would multiply every operational script by however
  many projects exist, need dynamic connection routing, and break the existing
  `knexfile.js` single-connection model.
- **Global data (users, tools, OSINT integrations, model options) has to live
  somewhere shared regardless** — a pure per-project database still needs a
  cross-database join or a separate "global" database, so the isolation is never
  actually total either way.
- A well-enforced `project_id` boundary — required on every table, checked on every
  query, no UI path that shows unscoped data by accident — gets the *user-facing*
  guarantee ("switching projects shows me nothing from the other story") without the
  ops cost. If real usage later shows this isn't strict enough (e.g. someone wants to
  literally export-and-delete a project's data as an independent file), that's an
  argument for a per-project **export/import + hard delete** feature, not a database
  split.

## 6. Rollout size — why this should be staged

This is larger than the earlier case-only draft: it touches the same surface (every
list/detail/form component and route) plus the new project-vs-case nesting and the
first-run project-selection flow. Staged, mirroring how #64 was:

1. **Schema** — `projects` table, `project_id` on all 10 entity tables, `cases.project_id`,
   backfill migration, cross-project relationship constraint. No UI change; safe to
   ship dark.
2. **Backend filtering** — `project_id` required on all case-scoped routes' list/create
   endpoints; `case_id` filter continues to work as a sub-filter within a project.
3. **UIContext active-project state + top-bar project selector**, first-run
   project-selection gate, wired into `DataContext` for `people`/`locations` first.
4. **Case selector re-scoped to nest inside the active project.**
5. **Propagate to remaining entities** + graph/map/search/report/export scoping.
6. **Cross-project admin view** for things like future COI detection (#65).

## 7. Explicitly not doing (yet)

- Per-project permissions/access control — this repo has no multi-tenant auth model
  today; a much larger change than what's being asked here.
- Per-project data-model definitions (custom categories/statuses per project) — see §3.
- A literal database-per-project split — see §5.
- The "possible additional functionality" list from the issue (project statistics,
  sharing entities between projects) — deferred to a follow-up once core scoping lands.

---

**Recommendation:** approve stage 1 (schema) as a self-contained, low-risk PR — it's
fully additive and backfills cleanly — then re-evaluate the first-run/selector UX in
stage 3 once real usage patterns (how many projects, how often people switch) are
visible.
