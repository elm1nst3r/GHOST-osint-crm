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

i18n.use(initReactI18next).init({
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
  interpolation: {
    escapeValue: false // React already escapes output
  }
});

export function changeLanguage(code) {
  localStorage.setItem(STORAGE_KEY, code);
  return i18n.changeLanguage(code);
}

export default i18n;
