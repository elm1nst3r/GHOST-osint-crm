// File: frontend/src/utils/personName.js
//
// One place to render a person's name for display (issue #61). Parts that are
// absent are skipped rather than leaving double spaces — mirrors the CONCAT_WS
// the backend uses to build `full_name`.
//
// Order is language-dependent. English convention is given · patronymic ·
// family; Russian and neighbouring conventions put the family name first
// (Фамилия Имя Отчество), which is what hunterghoul1 pointed out after the
// field shipped. It's a display convention, not a data change — the stored
// fields are identical either way.
//
// Deliberately NOT used for name *matching* or sorting (BulkRelationshipTool's
// import matcher, AdvancedSearch's filters). Those compare against names the
// user typed elsewhere, and silently reordering the string they match on would
// change which records they find.

import i18n from '../i18n';

// Languages that conventionally lead with the family name.
const FAMILY_NAME_FIRST = ['ru', 'uk', 'be', 'bg', 'kk'];

export const isFamilyNameFirst = (language) => {
  const lang = String(language || '').toLowerCase().split('-')[0];
  return FAMILY_NAME_FIRST.includes(lang);
};

// Field order for forms and display: [given, patronymic, family] or
// [family, given, patronymic]. Exported so the person form can lay its inputs
// out in the same order the name will be shown in.
export const personNameOrder = (language = i18n.language) =>
  isFamilyNameFirst(language)
    ? ['last_name', 'first_name', 'patronymic']
    : ['first_name', 'patronymic', 'last_name'];

// Everything a person could reasonably be searched by: each name part on its
// own, plus both conventional orderings. Search has to match the name the user
// can see, and which ordering that is depends on their language — someone
// looking at "Иван Петрович Сидоров" must find them by typing exactly that
// (issue #78). Distinct from formatPersonName, which picks ONE ordering.
export const personSearchHaystack = (person) => {
  if (!person) return '';
  const clean = (v) => (v || '').trim();
  const [first, patronymic, last] = [person.first_name, person.patronymic, person.last_name].map(clean);
  const parts = [first, patronymic, last].filter(Boolean);
  return [
    ...parts,
    parts.join(' '),
    [last, first, patronymic].filter(Boolean).join(' '),
    [first, last].filter(Boolean).join(' '),
  ]
    .filter(Boolean)   // a nameless person must yield '', not stray whitespace
    .join(' ')
    .toLowerCase();
};

export const formatPersonName = (person, fallback = '', language = i18n.language) => {
  if (!person) return fallback;
  return (
    personNameOrder(language)
      .map((field) => (person[field] || '').trim())
      .filter(Boolean)
      .join(' ') || fallback
  );
};
