// File: frontend/src/components/settings/SecurityTab.jsx
// Settings → Security (issue #90): two-step sign-in, personal API tokens,
// and for admins the "require two-factor" switch.
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ShieldCheck, KeySquare, Users, Loader2 } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { accountAPI } from '../../utils/authAPI';
import { securityErrorMessage } from '../../utils/passkeys';
import TwoFactorSection from './security/TwoFactorSection';
import ApiTokensSection from './security/ApiTokensSection';
import SecurityPolicySection from './security/SecurityPolicySection';
import { ErrorNote } from './security/Dialog';

const Section = ({ icon: Icon, title, description, children, first = false }) => (
  <section className={first ? '' : 'pt-6 mt-6 border-t border-gray-200 dark:border-slate-700'}>
    <h3 className="text-lg font-semibold mb-1 flex items-center"><Icon className="w-5 h-5 me-2" />{title}</h3>
    {description && <p className="text-sm text-gray-500 dark:text-slate-400 mb-4 max-w-2xl">{description}</p>}
    {children}
  </section>
);

export function useAccountSecurity() {
  const { t } = useTranslation();
  const [security, setSecurity] = useState(null);
  const [error, setError] = useState('');
  const reload = useCallback(() => {
    accountAPI.getSecurity().then((s) => { setSecurity(s); setError(''); }).catch((err) => setError(securityErrorMessage(t, err)));
  }, [t]);
  useEffect(() => { reload(); }, [reload]);
  return { security, error, reload };
}

const SecurityTab = () => {
  const { t } = useTranslation();
  const { currentUser } = useAuth();
  const { security, error, reload } = useAccountSecurity();

  return (
    <div>
      <Section icon={ShieldCheck} title={t('security.twoFactorTitle')} description={t('security.twoFactorDescription')} first>
        <ErrorNote>{error}</ErrorNote>
        {!security && !error && <Loader2 className="w-5 h-5 animate-spin text-gray-400" />}
        {security && (
          <div className="max-w-3xl">
            {security.required_by_policy && !security.enabled && (
              <p className="text-sm text-amber-700 dark:text-amber-400 mb-3">{t('security.policy.requiredNotice')}</p>
            )}
            <TwoFactorSection security={security} reload={reload} username={currentUser?.username} />
          </div>
        )}
      </Section>

      <Section icon={KeySquare} title={t('security.tokens.title')}>
        <ApiTokensSection />
      </Section>

      {currentUser?.role === 'admin' && security && (
        <Section icon={Users} title={t('security.policy.title')}>
          <SecurityPolicySection ownTwoFactorEnabled={security.enabled} />
        </Section>
      )}
    </div>
  );
};

export default SecurityTab;
