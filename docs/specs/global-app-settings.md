# Server-side global application settings (#91)

## Scope shipped in v1

Branding and two defaults move from browser `localStorage` (per-browser,
never shared) to the server, alongside the API-key/geocoding/update-check/
project-retention settings issue #62 already put there:

- **Global, admin-only** (`app_settings` key/value table, `GET/PUT
  /api/settings/branding`): app name, app logo, default language, default
  theme mode. `GET` is intentionally unauthenticated — the login screen and
  the very first app paint need it before anyone is signed in, and none of
  these four values are sensitive.
- **Per-user override, self-service** (`users.language`, `users.theme_mode`,
  via `PUT /api/auth/me`): a user's own choice in Settings → General
  (language) / Appearance (theme mode) always wins over the admin default,
  and follows their account to another device/browser.

**Cascade:** user override → global default → hardcoded fallback (`en` /
`light`). `frontend/src/App.js`'s `AppShell` reconciles this once
`currentUser` and the branding fetch are both available, calling
`changeLanguage`/`setThemeMode` only when the resolved value differs from
what's currently applied. `localStorage` (`ghost_language`,
`ghost-appearance`, `appSettings`) is kept only as a paint-before-fetch
cache to avoid a flash on load — it is never the source of truth once the
network responses land.

## What's already server-side (issue #62, unchanged here)

API keys and integration settings (geocoding provider + keys), update-check
toggle, and archived-project retention were already moved server-side before
this issue was filed — #91's request for those was already satisfied.

## Deliberately NOT in v1

- **Accent color / density / surface style** stay device-local only
  (`ThemeContext` + `localStorage`). These are cosmetic taste, not something
  that needs a global-default-vs-per-user-override cascade — scoping that in
  for every appearance knob was a much bigger ask than the issue's actual
  examples (branding, language, theme, API keys).
- **"Lock this setting so users can't override it"** — the issue mentioned
  wanting admin settings to sometimes be non-overridable. v1 always lets a
  user's language/theme choice win. A `lock_language` / `lock_theme` toggle
  on the global settings is a clean, separable follow-up if it turns out to
  matter in practice.
- **Explicit "clear my override" UI** — a user can pick a language, but
  there's no button to revert to "inherit the admin default" once they have.
  The backend supports it (`PUT /me` with `language: null`); no UI calls it
  yet.

## Files touched

- `backend/migrations/20260904000001_user_preference_overrides.js` — adds
  `users.language`, `users.theme_mode` (both nullable).
- `backend/routes/settings.js` — `GET/PUT /settings/branding`.
- `backend/routes/auth.js` — `/session`, `/me` GET/PUT, and the `/login`
  response all carry `language`/`theme_mode` now.
- `backend/middleware/schemas.js` — `SettingsBrandingUpdateSchema`.
- `frontend/src/utils/api.js` — `brandingAPI`.
- `frontend/src/contexts/DataContext.js` — `appSettings` now fetched from
  the server on mount; `handleAppNameChange`/`setAppSettings` write through
  to `PUT /settings/branding`.
- `frontend/src/components/settings/GeneralTab.js` — app name/logo editing
  gated to admins; personal language picker persists to `/me`.
- `frontend/src/components/settings/AppearanceTab.js` — theme mode picker
  persists to `/me` alongside the existing local apply.
- `frontend/src/components/settings/GlobalDefaultsSection.js` (new) —
  admin-only default-language/default-theme-mode editor.
- `frontend/src/App.js` — the reconciliation effect described above.
