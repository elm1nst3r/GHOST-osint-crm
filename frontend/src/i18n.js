import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from './locales/en/translation.json';
import ru from './locales/ru/translation.json';

export const SUPPORTED_LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'ru', label: 'Русский' }
];

const STORAGE_KEY = 'ghost_language';
const storedLanguage = localStorage.getItem(STORAGE_KEY);

i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    ru: { translation: ru }
  },
  lng: storedLanguage || 'en',
  fallbackLng: 'en',
  interpolation: {
    escapeValue: false // React already escapes output
  }
});

export function changeLanguage(code) {
  localStorage.setItem(STORAGE_KEY, code);
  return i18n.changeLanguage(code);
}

export default i18n;
