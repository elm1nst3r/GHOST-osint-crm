// File: frontend/src/components/settings/GeocodingSection.js
//
// Choose which service turns addresses into coordinates (issue #62).
//
// Nominatim (OpenStreetMap) is the default and needs nothing. Yandex is opt-in
// and needs an operator-supplied API key; it's offered because Nominatim
// handles informal Russian address forms poorly.
//
// The key is write-only: the server never sends it back, so this form shows
// only whether one is stored. Leaving the field blank keeps the existing key.

import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { MapPin, Save, Check, AlertTriangle, ArrowUpCircle } from 'lucide-react';
import { geocodingSettingsAPI, updateSettingsAPI } from '../../utils/api';

const GeocodingSection = () => {
  const { t } = useTranslation();
  const [provider, setProvider] = useState('nominatim');
  // Provider capabilities come from the server registry, so a new provider
  // appears here without a frontend change.
  const [providers, setProviders] = useState([]);
  const [keyInputs, setKeyInputs] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState(null);
  const [updateCheck, setUpdateCheck] = useState(true);

  useEffect(() => {
    Promise.all([
      geocodingSettingsAPI.get().then((cfg) => { setProvider(cfg.provider); setProviders(cfg.providers || []); }),
      updateSettingsAPI.get().then((cfg) => setUpdateCheck(cfg.updateCheckEnabled)).catch(() => {}),
    ])
      .catch(() => setError('load'))
      .finally(() => setLoading(false));
  }, []);

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      // Only send keys that were actually typed, so saving the provider alone
      // can't wipe a stored key.
      const apiKeys = {};
      Object.entries(keyInputs).forEach(([id, value]) => {
        if (value && value.trim() !== '') apiKeys[id] = value.trim();
      });
      const payload = { provider };
      if (Object.keys(apiKeys).length > 0) payload.apiKeys = apiKeys;
      const result = await geocodingSettingsAPI.update(payload);
      setProvider(result.provider);
      setProviders(result.providers || []);
      setKeyInputs({});
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      setError(err.message || 'save');
    } finally {
      setSaving(false);
    }
  };

  const clearKey = async (id) => {
    setSaving(true);
    try {
      const result = await geocodingSettingsAPI.update({ apiKeys: { [id]: '' } });
      setProviders(result.providers || []);
    } catch (err) {
      setError(err.message || 'save');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return null;

  const active = providers.find((p) => p.id === provider);
  const needsKey = Boolean(active?.requiresKey);
  const missingKey = needsKey && !active?.hasApiKey && !(keyInputs[provider] || '').trim();

  return (
    <>
      <div className="pt-6 border-t">
      <h3 className="text-lg font-semibold mb-1 flex items-center">
        <MapPin className="w-5 h-5 mr-2" />
        {t('settings.geocoding.title')}
      </h3>
      <p className="text-sm text-gray-500 dark:text-slate-400 mb-4">{t('settings.geocoding.description')}</p>

      <div className="max-w-xl space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1.5">
            {t('settings.geocoding.providerLabel')}
          </label>
          <select
            value={provider}
            onChange={(e) => setProvider(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-700 text-gray-900 dark:text-slate-100 text-sm"
          >
            {providers.map((p) => (
              <option key={p.id} value={p.id}>{t(`settings.geocoding.provider_${p.id}`)}</option>
            ))}
          </select>
        </div>

        {needsKey && (
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1.5">
              {t('settings.geocoding.apiKeyLabelFor', { provider: t(`settings.geocoding.providerName_${provider}`) })}
            </label>
            <div className="flex gap-2">
              <input
                type="password"
                value={keyInputs[provider] || ''}
                onChange={(e) => setKeyInputs({ ...keyInputs, [provider]: e.target.value })}
                placeholder={active?.hasApiKey ? t('settings.geocoding.apiKeyStoredPlaceholder') : t('settings.geocoding.apiKeyPlaceholder')}
                autoComplete="off"
                className="flex-1 px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-700 text-gray-900 dark:text-slate-100 text-sm"
              />
              {active?.hasApiKey && (
                <button
                  type="button"
                  onClick={() => clearKey(provider)}
                  disabled={saving}
                  className="px-3 py-2 text-sm rounded-md border border-gray-300 dark:border-slate-600 text-gray-700 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-700"
                >
                  {t('settings.geocoding.clearKey')}
                </button>
              )}
            </div>
            <p className="text-xs text-gray-500 dark:text-slate-400 mt-1">
              {active?.hasApiKey
                ? t('settings.geocoding.apiKeyStoredHint')
                : t(`settings.geocoding.apiKeyHint_${provider}`, { defaultValue: t('settings.geocoding.apiKeyHint') })}
            </p>
          </div>
        )}

        {missingKey && (
          <div className="flex items-start gap-2 p-3 rounded-md bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
            <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <p className="text-sm text-amber-800 dark:text-amber-300">{t('settings.geocoding.noKeyWarning', { provider: t(`settings.geocoding.providerName_${provider}`) })}</p>
          </div>
        )}

        {error && (
          <p className="text-sm text-red-600 dark:text-red-400">{t('settings.geocoding.saveFailed')}</p>
        )}

        <div className="flex items-center gap-3">
          <button
            onClick={save}
            disabled={saving}
            className="px-4 py-2 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
          >
            <Save className="w-4 h-4" />
            {t('common.save')}
          </button>
          {saved && (
            <span className="text-sm text-green-600 dark:text-green-400 flex items-center gap-1">
              <Check className="w-4 h-4" />
              {t('settings.geocoding.saved')}
            </span>
          )}
        </div>
      </div>
      </div>

      {/* Update check — on by default, fully switchable off for deployments
          that must make no outbound connections. */}
      <div className="pt-6 mt-6 border-t">
        <h3 className="text-lg font-semibold mb-1 flex items-center">
          <ArrowUpCircle className="w-5 h-5 mr-2" />
          {t('settings.updates.title')}
        </h3>
        <p className="text-sm text-gray-500 dark:text-slate-400 mb-4">{t('settings.updates.description')}</p>
        <label className="flex items-start gap-3 cursor-pointer max-w-xl">
          <input
            type="checkbox"
            checked={updateCheck}
            onChange={async (e) => {
              const next = e.target.checked;
              setUpdateCheck(next);
              try {
                await updateSettingsAPI.update({ updateCheckEnabled: next });
              } catch {
                setUpdateCheck(!next); // roll back so the UI can't lie
                setError('save');
              }
            }}
            className="h-4 w-4 mt-0.5 text-blue-600 rounded border-gray-300 dark:border-slate-600"
          />
          <span>
            <span className="text-sm text-gray-700 dark:text-slate-300">{t('settings.updates.enableLabel')}</span>
            <span className="block text-xs text-gray-500 dark:text-slate-400 mt-0.5">
              {updateCheck ? t('settings.updates.enableHint') : t('settings.updates.disabledHint')}
            </span>
          </span>
        </label>
      </div>
    </>
  );
};

export default GeocodingSection;
