// File: frontend/src/components/settings/security/SecurityPolicySection.jsx
// Admin switch: require two-factor for every user (issue #90). Users without
// it are sent to the setup screen at their next sign-in. It covers password
// sign-ins only; single sign-on leaves it to the identity provider (#108).
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Users, Check, KeyRound } from 'lucide-react';
import { securitySettingsAPI } from '../../../utils/authAPI';
import { securityErrorMessage } from '../../../utils/passkeys';
import { ErrorNote } from './Dialog';

const SecurityPolicySection = () => {
  const { t } = useTranslation();
  const [required, setRequired] = useState(null);
  const [canRequire, setCanRequire] = useState(false);
  const [localLogin, setLocalLogin] = useState(true);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    securitySettingsAPI.get().then((s) => {
      setRequired(s.mfa_required);
      setCanRequire(Boolean(s.can_require));
      setLocalLogin(s.local_login !== false);
    }).catch((err) => setError(securityErrorMessage(t, err)));
  }, [t]);

  const change = async (value) => {
    setError('');
    try {
      const result = await securitySettingsAPI.update(value);
      setRequired(result.mfa_required);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      setError(securityErrorMessage(t, err));
    }
  };

  if (required === null) return error ? <ErrorNote>{error}</ErrorNote> : null;

  // Only single sign-on: nobody signs in with a GHOST password, so the
  // provider's own two-step settings are the ones that count.
  if (!localLogin) {
    return (
      <p className="flex items-start gap-2 text-sm text-gray-600 dark:text-slate-400 max-w-2xl">
        <KeyRound className="w-4 h-4 mt-0.5 shrink-0" />{t('security.policy.ssoOnly')}
      </p>
    );
  }

  return (
    <div className="space-y-2">
      <label className="flex items-start gap-3 cursor-pointer max-w-2xl">
        <input type="checkbox" checked={required} onChange={(e) => change(e.target.checked)}
          disabled={!required && !canRequire}
          className="mt-1 h-4 w-4 rounded-sm border-gray-300 text-blue-600 focus:ring-blue-500" />
        <span>
          <span className="block text-sm font-medium text-gray-900 dark:text-slate-100 flex items-center gap-2">
            <Users className="w-4 h-4" />{t('security.policy.requireLabel')}
          </span>
          <span className="block text-sm text-gray-600 dark:text-slate-400">{t('security.policy.requireDescription')}</span>
          {!required && !canRequire && (
            <span className="block text-xs text-amber-700 dark:text-amber-400 mt-1">{t('security.errors.enableOwnFirst')}</span>
          )}
        </span>
      </label>
      {saved && <span className="text-sm text-green-600 dark:text-green-400 flex items-center gap-1"><Check className="w-4 h-4" />{t('settings.geocoding.saved')}</span>}
      <ErrorNote>{error}</ErrorNote>
    </div>
  );
};

export default SecurityPolicySection;
