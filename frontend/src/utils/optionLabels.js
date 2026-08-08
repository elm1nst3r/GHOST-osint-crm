// File: frontend/src/utils/optionLabels.js
//
// Model options are *data*, not UI strings. The shipped defaults are written
// into Postgres at boot (backend/config/seedDefaults.js) and rendered straight
// off the row, so they can never be wrapped in t() where they're defined — and
// users can add or rename their own on top. The same applies to the enum arrays
// in constants.js, which back the dropdowns whenever the model-options fetch
// fails or a type has no rows.
//
// So they're translated here, at render time, against a catalog keyed by
// option_value. Three rules make that safe:
//
//   1. option_value is never touched. `person.category` stores 'Suspect' and
//      must keep storing 'Suspect' whatever the UI language is — only the
//      display label changes.
//   2. A user who renames a shipped option keeps their wording. We translate
//      only while the stored label still matches the English catalog entry;
//      once it diverges, the stored label wins.
//   3. Options a user invented have no catalog key and fall through unchanged.

const KEY_PREFIX = 'dataModel.optionLabels';

// 'Person of Interest' -> 'person_of_interest', 'IP Address' -> 'ip_address'
export const optionKeySegment = (value) =>
  String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');

// Translate one option's display label. `storedLabel` is the label as it exists
// in the database (or in the constants.js array); it is always the fallback.
export const optionLabel = (t, modelType, value, storedLabel) => {
  const fallback = storedLabel || value || '';
  const segment = optionKeySegment(value);
  if (!modelType || !segment) return fallback;

  const key = `${KEY_PREFIX}.${modelType}.${segment}`;

  // `lng` is the genuine i18next option here — we want the shipped English
  // wording to compare against, not the active language. (Unrelated to issue
  // #69, which was `lng` misused as an *interpolation* placeholder.)
  const english = t(key, { lng: 'en', defaultValue: '' });
  if (!english) return fallback;                                  // rule 3
  if (storedLabel && storedLabel !== english) return storedLabel;  // rule 2
  return t(key, { defaultValue: fallback });
};

// Map a list to translated { value, label } entries. Accepts both raw
// model_options rows (option_value/option_label) and constants.js entries
// (value/label); any other fields on the entry — id, color, display_order —
// are preserved, since callers read those.
export const translateOptions = (t, modelType, options = []) =>
  options.map((option) => {
    const value = option.value ?? option.option_value;
    const label = option.label ?? option.option_label;
    return { ...option, value, label: optionLabel(t, modelType, value, label) };
  });
