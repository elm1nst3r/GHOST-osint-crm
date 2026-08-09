// File: frontend/src/components/UpdateBanner.js
//
// Tells the operator a newer release exists. The check happens server-side —
// the browser never contacts GitHub — and nothing here downloads or installs
// anything; updating stays a deliberate command the operator runs.
//
// Dismissal is per version, so declining 2.13.0 doesn't silence 2.14.0.

import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowUpCircle, X } from 'lucide-react';
import { versionAPI } from '../utils/api';

const DISMISSED_KEY = 'ghost_dismissed_update';

const UpdateBanner = () => {
  const { t } = useTranslation();
  const [info, setInfo] = useState(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    versionAPI.get()
      .then((data) => {
        if (!data?.updateAvailable) return;
        if (localStorage.getItem(DISMISSED_KEY) === data.latestVersion) return;
        setInfo(data);
      })
      // A failed check is not an error worth showing anyone.
      .catch(() => {});
  }, []);

  if (!info || dismissed) return null;

  const dismiss = () => {
    localStorage.setItem(DISMISSED_KEY, info.latestVersion);
    setDismissed(true);
  };

  return (
    <div className="flex items-start gap-3 px-4 py-2.5 bg-blue-50 dark:bg-blue-900/20 border-b border-blue-200 dark:border-blue-800">
      <ArrowUpCircle className="w-5 h-5 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0 text-sm text-blue-900 dark:text-blue-200">
        <span className="font-medium">
          {t('updateBanner.available', { version: info.latestVersion })}
        </span>
        <span className="text-blue-800/80 dark:text-blue-300/80">
          {' '}{t('updateBanner.running', { version: info.currentVersion })}
        </span>
        {info.releaseUrl && (
          <a
            href={info.releaseUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="ml-2 underline hover:no-underline"
          >
            {t('updateBanner.viewRelease')}
          </a>
        )}
      </div>
      <button
        onClick={dismiss}
        className="shrink-0 p-1 rounded text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-800/40"
        aria-label={t('updateBanner.dismiss')}
        title={t('updateBanner.dismiss')}
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
};

export default UpdateBanner;
