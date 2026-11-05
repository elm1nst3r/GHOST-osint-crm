// Dates and numbers in the UI language, not the browser's.
//
// A bare toLocaleDateString() follows the browser, so a Russian UI on an
// English browser showed "11/4/2026" next to Russian text. Everything here
// follows i18next's resolved language instead.
//
// Two things are kept the same in every language, because GHOST's records
// are compared, searched and copied into other tools:
// - the Gregorian calendar (Intl gives Solar Hijri dates for Persian), and
// - Latin digits (Intl gives Persian or Arabic-Indic digits for fa/ar).
// Month names, word order and separators still follow the language.
import i18n from 'i18next';

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

const formatters = new Map();
const formatter = (Kind, options) => {
  const locale = `${i18n.resolvedLanguage || 'en'}-u-ca-gregory-nu-latn`;
  const key = `${Kind.name}|${locale}|${JSON.stringify(options)}`;
  if (!formatters.has(key)) formatters.set(key, new Kind(locale, options));
  return formatters.get(key);
};

// A date-only value ("1980-05-01", e.g. a date of birth) is a calendar day,
// not midnight UTC: read as a timestamp it shows the day before west of UTC.
const toDate = (value) => {
  if (value instanceof Date) return { date: value, dateOnly: false };
  if (typeof value === 'string' && DATE_ONLY.test(value)) return { date: new Date(`${value}T00:00:00Z`), dateOnly: true };
  return { date: new Date(value), dateOnly: false };
};

const format = (value, options, fallback) => {
  if (value === null || value === undefined || value === '') return fallback;
  const { date, dateOnly } = toDate(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return formatter(Intl.DateTimeFormat, dateOnly ? { ...options, timeZone: 'UTC' } : options).format(date);
};

/** 4 Nov 2026 (style per language). `options` are Intl.DateTimeFormat options. */
export const formatDate = (value, options = { dateStyle: 'medium' }, fallback = '') => format(value, options, fallback);

/** 4 Nov 2026, 18:30 */
export const formatDateTime = (value, options = { dateStyle: 'medium', timeStyle: 'short' }, fallback = '') =>
  format(value, options, fallback);

/** 18:30:05 */
export const formatTime = (value, options = { timeStyle: 'medium' }, fallback = '') => format(value, options, fallback);

/** 1,234.50 / 1 234,50 … `options` are Intl.NumberFormat options. */
export const formatNumber = (value, options) => formatter(Intl.NumberFormat, options).format(value);

/** Age in whole years on `today`, from a date of birth ("1990-05-01" or a
 *  timestamp). The calendar date is used as written, so the age doesn't
 *  depend on the viewer's time zone. null when there is no usable date. */
export const ageFrom = (dateOfBirth, today = new Date()) => {
  if (!dateOfBirth) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(dateOfBirth));
  const birth = m ? { y: +m[1], mo: +m[2] - 1, d: +m[3] } : (() => {
    const d = new Date(dateOfBirth);
    return Number.isNaN(d.getTime()) ? null : { y: d.getFullYear(), mo: d.getMonth(), d: d.getDate() };
  })();
  if (!birth) return null;
  let age = today.getFullYear() - birth.y;
  if (today.getMonth() < birth.mo || (today.getMonth() === birth.mo && today.getDate() < birth.d)) age -= 1;
  return age;
};
