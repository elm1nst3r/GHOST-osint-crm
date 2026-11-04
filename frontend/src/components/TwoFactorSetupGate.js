// File: frontend/src/components/TwoFactorSetupGate.js
// Shown instead of the app when an admin requires two-factor and this
// account has none yet (issue #90). Once a method is added and the recovery
// codes have been seen, the app opens.
import React from 'react';
import { useTranslation } from 'react-i18next';
import { ShieldCheck, LogOut, Loader2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useAccountSecurity } from './settings/SecurityTab';
import TwoFactorSection from './settings/security/TwoFactorSection';
import { ErrorNote } from './settings/security/Dialog';

const TwoFactorSetupGate = () => {
  const { t } = useTranslation();
  const { currentUser, finishMfaSetup, handleLogout } = useAuth();
  const { security, error, reload } = useAccountSecurity();

  return (
    <div className="min-h-[100dvh] bg-slate-50 dark:bg-slate-900 py-12 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-start justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <ShieldCheck className="w-6 h-6 text-blue-600 dark:text-blue-400" />{t('security.gate.title')}
            </h1>
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">{t('security.gate.description')}</p>
          </div>
          <button onClick={handleLogout} className="flex items-center gap-1.5 text-sm text-gray-600 dark:text-gray-300 hover:underline flex-shrink-0">
            <LogOut className="w-4 h-4" />{t('security.gate.signOut')}
          </button>
        </div>
        <div className="glass-card p-6">
          <ErrorNote>{error}</ErrorNote>
          {!security && !error && <Loader2 className="w-5 h-5 animate-spin text-gray-400" />}
          {security && (
            <TwoFactorSection security={security} reload={reload} username={currentUser?.username} onFirstMethod={finishMfaSetup} />
          )}
        </div>
      </div>
    </div>
  );
};

export default TwoFactorSetupGate;
