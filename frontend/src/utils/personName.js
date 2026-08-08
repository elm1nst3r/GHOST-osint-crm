// File: frontend/src/utils/personName.js
//
// One place to render a person's name for display (issue #61). Russian,
// Ukrainian and several other conventions put a patronymic between the given
// and family name, so the display order is: given · patronymic · family.
// Parts that are absent are skipped rather than leaving double spaces —
// mirrors the CONCAT_WS the backend uses to build `full_name`.
//
// Deliberately NOT used for name *matching* or sorting (BulkRelationshipTool's
// import matcher, AdvancedSearch's filters). Those compare against names the
// user typed elsewhere, and silently widening the string they match on would
// change which records they find.

export const formatPersonName = (person, fallback = '') => {
  if (!person) return fallback;
  const parts = [person.first_name, person.patronymic, person.last_name];
  return parts.map((part) => (part || '').trim()).filter(Boolean).join(' ') || fallback;
};
