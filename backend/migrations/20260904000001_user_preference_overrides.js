// File: backend/migrations/20260904000001_user_preference_overrides.js
//
// Server-side global application settings (issue #91). Branding (app name,
// logo) and system-wide defaults (default language, default theme mode) move
// out of browser localStorage into `app_settings` (already exists, from #62)
// so they're shared across every user/device instead of configured per
// browser. This migration adds the other half: a per-user OVERRIDE of the
// two defaults that make sense to override — language and theme mode.
//
// NULL means "inherit the global default" — not "unset to a hardcoded
// value" — so an admin changing the global default immediately affects every
// user who hasn't chosen their own.
//
// Deliberately not added here: per-user overrides for accent color/density/
// surface style. Those stay device-local (ThemeContext + localStorage) as
// pure cosmetic taste — issue #91 asked for language/theme/branding/API keys
// to be centrally manageable, not every appearance knob to grow a global vs.
// per-user cascade.

exports.up = async function up(knex) {
  await knex.raw(`
    ALTER TABLE users
      ADD COLUMN IF NOT EXISTS language VARCHAR(10),
      ADD COLUMN IF NOT EXISTS theme_mode VARCHAR(10)
        CHECK (theme_mode IS NULL OR theme_mode IN ('light', 'dark', 'system'))
  `);
};

exports.down = async function down(knex) {
  await knex.raw(`
    ALTER TABLE users
      DROP COLUMN IF EXISTS language,
      DROP COLUMN IF EXISTS theme_mode
  `);
};
