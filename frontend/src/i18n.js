import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from './locales/en/translation.json';

// English ships in the main bundle: it is the source language and the
// fallback for any string a catalog doesn't have. Every other catalog is a
// separate file, downloaded only when someone picks that language.
const catalogs = import.meta.glob(['./locales/*/translation.json', '!./locales/en/translation.json']);

// Plural forms a language needs but its catalog doesn't have are filled from
// the same language's `_other` text. Russian needs one/few/many/other, and
// Crowdin's plain-JSON setup only ever produced _one and _other, so "3 files"
// fell back to English mid-sentence. A real _few/_many in the catalog wins.
const PLURAL = /_(zero|one|two|few|many|other)$/;
export function fillPluralForms(catalog, language) {
  const forms = new Intl.PluralRules(language).resolvedOptions().pluralCategories;
  const walk = (node) => {
    if (!node || typeof node !== 'object') return node;
    const out = {};
    for (const [key, value] of Object.entries(node)) out[key] = walk(value);
    for (const key of Object.keys(out)) {
      if (!key.endsWith('_other') || typeof out[key] !== 'string') continue;
      const base = key.replace(PLURAL, '');
      for (const form of forms) if (!(`${base}_${form}` in out)) out[`${base}_${form}`] = out[key];
    }
    return out;
  };
  return walk(catalog);
}

const lazyCatalogs = {
  type: 'backend',
  callbackApi: false, // read() returns a promise (the i18next v27 style)
  init() {},
  async read(language) {
    const load = catalogs[`./locales/${language}/translation.json`];
    return load ? fillPluralForms((await load()).default, language) : {};
  },
};

export const SUPPORTED_LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'ru', label: 'Русский' },
  { code: 'de', label: 'Deutsch' },
  { code: 'es', label: 'Español' },
  { code: 'fr', label: 'Français' },
  { code: 'zh', label: '中文（简体）' },
  { code: 'fa', label: 'فارسی' }
];

const STORAGE_KEY = 'ghost_language';
const storedLanguage = localStorage.getItem(STORAGE_KEY);

// "→" in UI text means onward / from → to. Read right-to-left it points
// backwards, and translators usually keep the source's arrow, so in an RTL
// language every "→" is shown as "←" (issue #99).
export const rtlArrows = {
  type: 'postProcessor',
  name: 'rtlArrows',
  process(value, key, options, translator) {
    if (typeof value !== 'string' || !value.includes('→')) return value;
    return i18n.dir(options?.lng || translator?.language) === 'rtl' ? value.replace(/→/g, '←') : value;
  }
};

i18n.use(initReactI18next).use(lazyCatalogs).use(rtlArrows).init({
  resources: { en: { translation: en } },
  partialBundledLanguages: true, // the others come from lazyCatalogs
  lng: storedLanguage || 'en',
  fallbackLng: 'en',
  // An empty string in a catalog (untranslated in Crowdin) shows the English
  // text instead of nothing; i18next v27 makes this the default.
  returnEmptyString: false,
  postProcess: ['rtlArrows'],
  interpolation: {
    escapeValue: false // React already escapes output
  }
});

// Right-to-left languages (Persian, Arabic, Hebrew, Urdu…) need the whole page
// mirrored, not just translated (issue #99). i18next knows which codes are RTL,
// so there is no list to keep here; the layout itself mirrors because it uses
// logical utilities (see the RTL section at the end of index.css).
//
// resolvedLanguage, not the requested code: a stored language with no catalog
// renders English, and must not leave an English page laid out right-to-left.
export const isRtl = () => i18n.dir(i18n.resolvedLanguage || 'en') === 'rtl';

// For arrows written in JSX rather than in a catalog string.
export const forwardArrow = () => (isRtl() ? '←' : '→');

export function applyDocumentLanguage() {
  const lng = i18n.resolvedLanguage || 'en';
  const root = document.documentElement;
  root.lang = lng;
  root.dir = i18n.dir(lng);
}

i18n.on('languageChanged', applyDocumentLanguage);
applyDocumentLanguage();

export function changeLanguage(code) {
  localStorage.setItem(STORAGE_KEY, code);
  return i18n.changeLanguage(code);
}

export default i18n;
