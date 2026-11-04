import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from './locales/en/translation.json';
import ru from './locales/ru/translation.json';
import de from './locales/de/translation.json';
import es from './locales/es/translation.json';
import fr from './locales/fr/translation.json';
import zh from './locales/zh/translation.json';

export const SUPPORTED_LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'ru', label: 'Русский' },
  { code: 'de', label: 'Deutsch' },
  { code: 'es', label: 'Español' },
  { code: 'fr', label: 'Français' },
  { code: 'zh', label: '中文（简体）' }
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

i18n.use(initReactI18next).use(rtlArrows).init({
  resources: {
    en: { translation: en },
    ru: { translation: ru },
    de: { translation: de },
    es: { translation: es },
    fr: { translation: fr },
    zh: { translation: zh }
  },
  lng: storedLanguage || 'en',
  fallbackLng: 'en',
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
