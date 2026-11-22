// Shown while the session check can't get an answer (rate limited, or the
// server is restarting / unreachable), instead of a bare "Loading…" or,
// worse, the sign-in screen. Counts down to the next try; "Try again now"
// asks at once.
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Hourglass, WifiOff, RefreshCw } from 'lucide-react';

const SessionWait = ({ wait, onRetry }) => {
  const { t } = useTranslation();
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  const seconds = Math.max(0, Math.ceil((wait.until - now) / 1000));
  const limited = wait.reason === 'rate_limited';
  const Icon = limited ? Hourglass : WifiOff;
  return (
    <div className="flex items-center justify-center min-h-dvh bg-slate-50 dark:bg-slate-900 p-4">
      <div role="status" aria-live="polite" className="max-w-sm text-center space-y-3">
        <Icon className="w-8 h-8 mx-auto text-slate-400" aria-hidden="true" />
        <h1 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
          {limited ? t('sessionWait.limitedTitle') : t('sessionWait.unreachableTitle')}
        </h1>
        <p className="text-sm text-slate-600 dark:text-slate-400">
          {limited ? t('sessionWait.limitedText') : t('sessionWait.unreachableText')}
        </p>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          {seconds > 0 ? t('sessionWait.retryIn', { count: seconds }) : t('sessionWait.retrying')}
        </p>
        <button
          type="button"
          onClick={onRetry}
          className="inline-flex items-center gap-x-1.5 px-3 py-1.5 text-sm rounded-md border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
        >
          <RefreshCw className="w-4 h-4" />{t('sessionWait.retryNow')}
        </button>
      </div>
    </div>
  );
};

export default SessionWait;
