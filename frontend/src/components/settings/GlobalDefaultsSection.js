// File: frontend/src/components/settings/GlobalDefaultsSection.js
//
// Global defaults for language and theme mode (issue #91) — admin-only,
// stored server-side in app_settings via /settings/branding alongside app
// name/logo. Applies to every user who hasn't set their own override in
// Settings → General (language) / Appearance (theme mode); the cascade is
// user override -> this default -> hardcoded fallback (en / light).
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Check, Globe } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { brandingAPI } from '../../utils/api';
import { SUPPORTED_LANGUAGES } from '../../i18n';

const THEME_MODES = ['light', 'dark', 'system'];

const GlobalDefaultsSection = () => {
  const { t } = useTranslation();
  const { currentUser } = useAuth();
  const isAdmin = currentUser?.role === 'admin';

  const [defaults, setDefaults] = useState({ defaultLanguage: 'en', defaultThemeMode: 'light' });
  const [loading, setLoading] = useState(true);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!isAdmin) return;
    brandingAPI.get()
      .then((branding) => setDefaults({ defaultLanguage: branding.defaultLanguage, defaultThemeMode: branding.defaultThemeMode }))
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [isAdmin]);

  if (!isAdmin || loading) return null;

  const change = async (field, value) => {
    const prev = defaults;
    setDefaults((d) => ({ ...d, [field]: value }));
    setError(false);
    try {
      await brandingAPI.update({ [field]: value });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch {
      setDefaults(prev); // don't let the UI lie
      setError(true);
    }
  };

  return (
    <div className="pt-6 mt-6 border-t">
      <h3 className="text-lg font-semibold mb-1 flex items-center">
        <Globe className="w-5 h-5 mr-2" />
        {t('settings.globalDefaults.title')}
      </h3>
      <p className="text-sm text-gray-500 dark:text-slate-400 mb-4">{t('settings.globalDefaults.description')}</p>

      <div className="max-w-xl space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1.5">
            {t('settings.globalDefaults.language')}
          </label>
          <select
            value={defaults.defaultLanguage}
            onChange={(e) => change('defaultLanguage', e.target.value)}
            className="w-full max-w-xs px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-700 text-gray-900 dark:text-slate-100 text-sm"
          >
            {SUPPORTED_LANGUAGES.map((lang) => (
              <option key={lang.code} value={lang.code}>{lang.label}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1.5">
            {t('settings.globalDefaults.themeMode')}
          </label>
          <select
            value={defaults.defaultThemeMode}
            onChange={(e) => change('defaultThemeMode', e.target.value)}
            className="w-full max-w-xs px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-700 text-gray-900 dark:text-slate-100 text-sm"
          >
            {THEME_MODES.map((mode) => (
              <option key={mode} value={mode}>{t(`appearanceTab.${mode}`)}</option>
            ))}
          </select>
        </div>

        <p className="text-xs text-gray-500 dark:text-slate-400">{t('settings.globalDefaults.overrideHint')}</p>

        {saved && (
          <span className="text-sm text-green-600 dark:text-green-400 flex items-center gap-1">
            <Check className="w-4 h-4" />{t('settings.geocoding.saved')}
          </span>
        )}
        {error && (
          <p className="text-sm text-red-600 dark:text-red-400">{t('settings.geocoding.saveFailed')}</p>
        )}
      </div>
    </div>
  );
};

export default GlobalDefaultsSection;
