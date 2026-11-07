// File: frontend/src/components/users/SsoPanel.jsx
//
// Single sign-on in user management (issue #105, admins): whether it is set
// up, and the sign-ins that matched no linked account. An admin links each
// to an existing user or creates a user for it; GHOST never matches an
// identity to an account on its own.
import { useEffect, useState, useTransition } from 'react';
import { useTranslation } from 'react-i18next';
import { KeyRound, Link2, UserPlus, X, AlertCircle } from 'lucide-react';
import { usersAPI } from '../../utils/authAPI';
import { formatDateTime } from '../../utils/format';

const DOCS = 'https://github.com/elm1nst3r/GHOST-osint-crm/blob/main/USER_MANAGEMENT.md#single-sign-on-openid-connect';

const PendingRow = ({ p, users, onDone }) => {
  const { t } = useTranslation();
  const [target, setTarget] = useState('');
  const [role, setRole] = useState('user');
  const [error, setError] = useState('');
  const [busy, start] = useTransition();
  const act = (fn) => { setError(''); start(async () => { try { await fn(); onDone(); } catch (err) { setError(err.message); } }); };

  return (
    <li className="py-3 space-y-2">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className="font-medium text-gray-900 dark:text-white"><bdi>{p.display_name || p.preferred_username || p.subject}</bdi></span>
        {p.email && <span className="text-sm text-gray-600 dark:text-gray-300"><bdi>{p.email}</bdi>{p.email_verified === false && ` (${t('settings.users.sso.unverified')})`}</span>}
        <span className="text-xs text-gray-500 dark:text-gray-400">
          {t(`settings.users.sso.reason_${p.reason}`, { defaultValue: '' })} · {t('settings.users.sso.attempts', { count: p.attempts, date: formatDateTime(p.last_attempt_at) })}
        </span>
      </div>
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <select value={target} onChange={(e) => setTarget(e.target.value)} aria-label={t('settings.users.sso.linkTo')}
          className="px-2 py-1.5 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white">
          <option value="">{t('settings.users.sso.chooseUser')}</option>
          {users.map((u) => <option key={u.id} value={u.id}>{u.username}{u.email ? ` (${u.email})` : ''}</option>)}
        </select>
        <button type="button" disabled={!target || busy} onClick={() => act(() => usersAPI.linkSso(p.id, Number(target)))}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50">
          <Link2 className="h-4 w-4" />{t('settings.users.sso.link')}
        </button>
        <span className="text-gray-400" aria-hidden="true">·</span>
        <select value={role} onChange={(e) => setRole(e.target.value)} aria-label={t('settings.users.sso.newUserRole')}
          className="px-2 py-1.5 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white">
          <option value="user">{t('settings.users.roleUser')}</option>
          <option value="admin">{t('settings.users.roleAdmin')}</option>
        </select>
        <button type="button" disabled={busy} onClick={() => act(() => usersAPI.createFromSso(p.id, role))}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50">
          <UserPlus className="h-4 w-4" />{t('settings.users.sso.createUser')}
        </button>
        <button type="button" disabled={busy} onClick={() => act(() => usersAPI.dismissSso(p.id))} title={t('settings.users.sso.dismiss')} aria-label={t('settings.users.sso.dismiss')}
          className="p-1.5 rounded-md text-gray-500 hover:text-red-600 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50">
          <X className="h-4 w-4" />
        </button>
      </div>
      {error && <p className="text-sm text-red-600 dark:text-red-400 flex items-center gap-1"><AlertCircle className="h-4 w-4" />{error}</p>}
    </li>
  );
};

const SsoPanel = ({ users, onChanged }) => {
  const { t } = useTranslation();
  const [status, setStatus] = useState(null);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let cancelled = false;
    usersAPI.ssoStatus().then((s) => { if (!cancelled) setStatus(s); }).catch(() => {});
    return () => { cancelled = true; };
  }, [reload]);

  if (!status) return null;
  const { config, pending } = status;
  const done = () => { setReload((r) => r + 1); onChanged?.(); };

  return (
    <section className="mb-6 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
      <h2 className="text-base font-semibold text-gray-900 dark:text-white flex items-center gap-2">
        <KeyRound className="h-5 w-5" />{t('settings.users.sso.title')}
      </h2>
      {config.enabled ? (
        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
          {t('settings.users.sso.enabled', { name: config.name, issuer: config.issuer })}
          {' '}{config.autoProvision ? t('settings.users.sso.autoOn') : t('settings.users.sso.autoOff')}
          {config.adminGroup && <> {t('settings.users.sso.adminGroup', { group: config.adminGroup })}</>}
          {!config.localLogin && <> {t('settings.users.sso.localOff')}</>}
        </p>
      ) : config.wanted ? (
        <p className="text-sm text-red-600 dark:text-red-400 mt-1">{t('settings.users.sso.misconfigured', { problems: config.problems.join('; ') })}</p>
      ) : (
        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
          {t('settings.users.sso.notSetUp')} <a href={DOCS} target="_blank" rel="noopener noreferrer" className="text-accent-ink hover:underline">{t('settings.users.sso.howTo')}</a>
        </p>
      )}
      {pending.length > 0 && (
        <>
          <h3 className="mt-4 text-sm font-semibold text-gray-900 dark:text-white">{t('settings.users.sso.waiting', { count: pending.length })}</h3>
          <p className="text-xs text-gray-500 dark:text-gray-400">{t('settings.users.sso.waitingHelp')}</p>
          <ul className="divide-y divide-gray-200 dark:divide-gray-700">
            {pending.map((p) => <PendingRow key={p.id} p={p} users={users} onDone={done} />)}
          </ul>
        </>
      )}
    </section>
  );
};

// A user's linked identities, in the edit dialog. Unlinking signs them out.
export const SsoIdentities = ({ userId, onChanged }) => {
  const { t } = useTranslation();
  const [list, setList] = useState(null);
  const [reload, setReload] = useState(0);
  const [busy, start] = useTransition();
  useEffect(() => {
    let cancelled = false;
    usersAPI.ssoIdentities(userId).then((l) => { if (!cancelled) setList(l); }).catch(() => { if (!cancelled) setList([]); });
    return () => { cancelled = true; };
  }, [userId, reload]);
  if (!list || list.length === 0) return null;
  return (
    <div className="rounded-md border border-gray-200 dark:border-gray-700 p-3">
      <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-1.5"><KeyRound className="h-4 w-4" />{t('settings.users.sso.linked')}</h3>
      <ul className="mt-2 space-y-2">
        {list.map((i) => (
          <li key={i.id} className="flex items-start justify-between gap-2 text-sm">
            <span className="min-w-0">
              <span className="block text-gray-900 dark:text-white break-all"><bdi>{i.email || i.display_name || i.subject}</bdi></span>
              <span className="block text-xs text-gray-500 dark:text-gray-400 break-all">{i.issuer}{i.last_login_at ? ` · ${t('settings.users.sso.lastUsed', { date: formatDateTime(i.last_login_at) })}` : ''}</span>
            </span>
            <button type="button" disabled={busy}
              onClick={() => start(async () => { await usersAPI.unlinkSso(userId, i.id).catch(() => {}); setReload((r) => r + 1); onChanged?.(); })}
              className="shrink-0 text-xs text-red-600 dark:text-red-400 hover:underline disabled:opacity-50">
              {t('settings.users.sso.unlink')}
            </button>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">{t('settings.users.sso.unlinkHelp')}</p>
    </div>
  );
};

export default SsoPanel;
