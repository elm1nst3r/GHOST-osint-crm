// Settings → General line for admins: a newer version is out, with the same
// "How to update" dialog as the banner (which can be dismissed).
import { lazy, Suspense, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { versionAPI } from '../../utils/api';

const UpdateDialog = lazy(() => import('./UpdateDialog'));

const UpdateStatus = () => {
  const { t } = useTranslation();
  const [info, setInfo] = useState(null);
  const [showDialog, setShowDialog] = useState(false);

  useEffect(() => {
    versionAPI.get().then((data) => { if (data?.updateAvailable) setInfo(data); }).catch(() => {});
  }, []);

  if (!info) return null;
  return (
    <div className="text-blue-800 dark:text-blue-300">
      {t('updateBanner.available', { version: info.latestVersion })}
      <button type="button" onClick={() => setShowDialog(true)} className="ms-2 font-medium underline hover:no-underline">
        {t('updateBanner.howToUpdate')}
      </button>
      {showDialog && (
        <Suspense fallback={null}>
          <UpdateDialog info={info} onClose={() => setShowDialog(false)} />
        </Suspense>
      )}
    </div>
  );
};

export default UpdateStatus;
