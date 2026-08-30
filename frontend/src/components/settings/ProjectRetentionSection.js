// File: frontend/src/components/settings/ProjectRetentionSection.js
//
// Archived-project retention policy (issue #88). When set, a project left in
// "Closed" status longer than the chosen window is permanently deleted —
// project row and every project-scoped entity — by a daily backend sweep.
// Default is "Never", and the whole feature is a no-op until an admin picks
// a window here. Admin-only (the endpoint is too).
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Trash2, Check } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { projectRetentionAPI } from '../../utils/api';

const OPTIONS = [0, 30, 90, 180, 365];

const ProjectRetentionSection = () => {
  const { t } = useTranslation();
  const { currentUser } = useAuth();
  const isAdmin = currentUser?.role === 'admin';

  const [retentionDays, setRetentionDays] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!isAdmin) return;
    projectRetentionAPI.get()
      .then((cfg) => setRetentionDays(cfg.retentionDays || 0))
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [isAdmin]);

  if (!isAdmin || loading) return null;

  const change = async (days) => {
    const prev = retentionDays;
    setRetentionDays(days);
    setError(false);
    try {
      await projectRetentionAPI.update(days);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch {
      setRetentionDays(prev); // don't let the UI lie
      setError(true);
    }
  };

  const label = (days) =>
    days === 0 ? t('settings.projectRetention.never') : t('settings.projectRetention.days', { count: days });

  return (
    <div className="pt-6 mt-6 border-t">
      <h3 className="text-lg font-semibold mb-1 flex items-center">
        <Trash2 className="w-5 h-5 mr-2" />
        {t('settings.projectRetention.title')}
      </h3>
      <p className="text-sm text-gray-500 dark:text-slate-400 mb-4">{t('settings.projectRetention.description')}</p>

      <div className="max-w-xl space-y-2">
        <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1.5">
          {t('settings.projectRetention.label')}
        </label>
        <select
          value={retentionDays}
          onChange={(e) => change(Number(e.target.value))}
          className="w-full max-w-xs px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-700 text-gray-900 dark:text-slate-100 text-sm"
        >
          {OPTIONS.map((d) => (
            <option key={d} value={d}>{label(d)}</option>
          ))}
        </select>

        {retentionDays > 0 && (
          <p className="text-xs text-amber-700 dark:text-amber-400">
            {t('settings.projectRetention.warning', { count: retentionDays })}
          </p>
        )}
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

export default ProjectRetentionSection;
