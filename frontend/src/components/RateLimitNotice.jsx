// One notice when the server says "too many requests" while you work,
// instead of each list failing on its own with no explanation. Disappears
// when the server's wait is over.
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Hourglass, X } from 'lucide-react';
import { RATE_LIMITED_EVENT } from '../utils/api';

const RateLimitNotice = () => {
  const { t } = useTranslation();
  const [until, setUntil] = useState(null);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const onLimited = (e) => {
      const seconds = Math.min(Math.max(Number(e.detail?.retryAfter) || 10, 1), 120);
      setNow(Date.now());
      setUntil((prev) => Math.max(prev || 0, Date.now() + seconds * 1000));
    };
    window.addEventListener(RATE_LIMITED_EVENT, onLimited);
    return () => window.removeEventListener(RATE_LIMITED_EVENT, onLimited);
  }, []);

  useEffect(() => {
    if (!until) return undefined;
    const timer = setInterval(() => {
      const t2 = Date.now();
      setNow(t2);
      if (t2 >= until) setUntil(null);
    }, 1000);
    return () => clearInterval(timer);
  }, [until]);

  if (!until) return null;
  const seconds = Math.max(0, Math.ceil((until - now) / 1000));
  return (
    <div role="status" aria-live="polite" className="fixed bottom-4 inset-x-4 sm:inset-x-0 sm:mx-auto sm:w-fit sm:max-w-md z-60 flex items-start gap-x-3 rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950 px-4 py-3 shadow-lg">
      <Hourglass className="w-5 h-5 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" aria-hidden="true" />
      <p className="flex-1 text-sm text-amber-900 dark:text-amber-100">{t('sessionWait.inAppLimited', { count: seconds })}</p>
      <button type="button" onClick={() => setUntil(null)} aria-label={t('common.close')} className="p-0.5 rounded-sm text-amber-700 hover:bg-amber-100 dark:text-amber-300 dark:hover:bg-amber-900">
        <X className="w-4 h-4" />
      </button>
    </div>
  );
};

export default RateLimitNotice;
