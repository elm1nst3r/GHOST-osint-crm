// What a geocoding run found, or which addresses aren't on the map and why
// (issue #110). Replaces the alert() that only showed counts.
import { useTranslation } from 'react-i18next';
import { AlertTriangle, CheckCircle2, X } from 'lucide-react';
import { geocodeDetail, geocodeReason } from '../../utils/geocodeReasons';

const GeocodeReport = ({ title, summary, failures, message, onOpenPerson, onClose }) => {
  const { t } = useTranslation();
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-2000 p-4" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-labelledby="geocode-report-title" onClick={(e) => e.stopPropagation()}
        className="bg-white dark:bg-slate-800 rounded-lg shadow-xl w-full max-w-2xl max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-gray-700">
          <h2 id="geocode-report-title" className="text-lg font-semibold text-gray-900 dark:text-gray-100">{title}</h2>
          <button type="button" onClick={onClose} aria-label={t('globalMap.report.close')} className="p-1 rounded-sm text-gray-500 hover:bg-gray-100 dark:hover:bg-slate-700">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="overflow-y-auto px-5 py-4 space-y-3">
          {message && <p className="text-sm text-gray-700 dark:text-gray-300">{message}</p>}
          {summary && <p className="text-sm text-gray-700 dark:text-gray-300">{t('globalMap.report.summary', { geocoded: summary.geocoded, total: summary.total })}</p>}
          {summary && failures.length === 0 && (
            <p className="text-sm text-green-700 dark:text-green-400 flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4" />{t('globalMap.report.allFound')}</p>
          )}
          {failures.length > 0 && (
            <>
              <h3 className="text-sm font-semibold text-amber-800 dark:text-amber-300 flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4" />{t('globalMap.report.failedHeading', { count: failures.length })}
              </h3>
              <ul className="divide-y divide-gray-200 dark:divide-gray-700 border border-gray-200 dark:border-gray-700 rounded-md">
                {failures.map((f, i) => (
                  <li key={i} className="px-3 py-2 flex items-start justify-between gap-3">
                    <div className="min-w-0 text-sm">
                      {f.person_name && <p className="font-medium text-gray-900 dark:text-gray-100">{f.person_name}</p>}
                      <p className="text-gray-700 dark:text-gray-300"><bdi>{f.address}</bdi></p>
                      <p className="text-amber-800 dark:text-amber-300">{f.reason ? geocodeReason(t, f.reason) : t('globalMap.report.notTriedYet')}</p>
                      {geocodeDetail(f.reason, f.message) && <p className="text-xs text-gray-600 dark:text-gray-400">{geocodeDetail(f.reason, f.message)}</p>}
                      {f.best_match?.display_name && (
                        <p className="text-xs text-gray-600 dark:text-gray-400">{t('globalMap.report.closestMatch', { place: f.best_match.display_name, confidence: f.best_match.confidence })}</p>
                      )}
                    </div>
                    {f.person_id && onOpenPerson && (
                      <button type="button" onClick={() => onOpenPerson(f.person_id)} className="shrink-0 text-sm text-blue-600 dark:text-blue-400 hover:underline">
                        {t('globalMap.report.openPerson')}
                      </button>
                    )}
                  </li>
                ))}
              </ul>
              <p className="text-xs text-gray-500 dark:text-gray-400">{t('globalMap.report.fixHint')}</p>
            </>
          )}
        </div>
        <div className="px-5 py-3 border-t border-gray-200 dark:border-gray-700 flex justify-end">
          <button type="button" onClick={onClose} className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700">{t('globalMap.report.close')}</button>
        </div>
      </div>
    </div>
  );
};

export default GeocodeReport;
