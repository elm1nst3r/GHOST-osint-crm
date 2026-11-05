// File: frontend/src/components/settings/security/ApiTokensSection.jsx
//
// Personal API tokens (issue #90), for the MCP server and scripts. A token
// acts as this user, with their role and project access. It is shown once;
// GHOST keeps only a hash.
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { KeySquare, Plus, Trash2, Loader2, Copy, Check, AlertTriangle } from 'lucide-react';
import { accountAPI } from '../../../utils/authAPI';
import { securityErrorMessage } from '../../../utils/passkeys';
import Dialog, { buttonClass, inputClass, ErrorNote } from './Dialog';
import { formatDate } from '../../../utils/format';

const EXPIRY_OPTIONS = [30, 90, 365, null];

const CreateTokenDialog = ({ onClose, onCreated }) => {
  const { t } = useTranslation();
  const [name, setName] = useState('');
  const [expiresInDays, setExpiresInDays] = useState(90);
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      onCreated(await accountAPI.createToken({ name: name.trim(), expiresInDays, password }));
    } catch (err) {
      setError(securityErrorMessage(t, err));
      setBusy(false);
    }
  };

  return (
    <Dialog title={t('security.tokens.createTitle')} icon={KeySquare} onClose={busy ? undefined : onClose}>
      <form onSubmit={submit} className="space-y-4">
        <div>
          <label htmlFor="token-name" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('security.tokens.nameLabel')}</label>
          <input id="token-name" type="text" maxLength={100} autoFocus required value={name}
            onChange={(e) => setName(e.target.value)} placeholder={t('security.tokens.namePlaceholder')} className={inputClass} />
        </div>
        <div>
          <label htmlFor="token-expiry" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('security.tokens.expiryLabel')}</label>
          <select id="token-expiry" value={expiresInDays ?? 'never'}
            onChange={(e) => setExpiresInDays(e.target.value === 'never' ? null : Number(e.target.value))} className={inputClass}>
            {EXPIRY_OPTIONS.map((d) => (
              <option key={d ?? 'never'} value={d ?? 'never'}>
                {d ? t('security.tokens.expiresInDays', { count: d }) : t('security.tokens.noExpiry')}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="token-password" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('security.currentPassword')}</label>
          <input id="token-password" type="password" autoComplete="current-password" required value={password}
            onChange={(e) => setPassword(e.target.value)} className={inputClass} />
        </div>
        <ErrorNote>{error}</ErrorNote>
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} disabled={busy} className={buttonClass.secondary}>{t('common.cancel')}</button>
          <button type="submit" disabled={busy || !name.trim() || !password} className={buttonClass.primary}>
            {busy && <Loader2 className="w-4 h-4 animate-spin" />}{t('security.tokens.create')}
          </button>
        </div>
      </form>
    </Dialog>
  );
};

const NewTokenDialog = ({ created, onDone }) => {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(created.token);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* still on screen */ }
  };
  return (
    <Dialog title={t('security.tokens.newTitle', { name: created.name })} icon={KeySquare}
      footer={<button onClick={onDone} className={buttonClass.primary}><Check className="w-4 h-4" />{t('security.tokens.done')}</button>}>
      <p className="text-sm text-gray-700 dark:text-gray-300">{t('security.tokens.newIntro')}</p>
      <code dir="ltr" className="block font-mono text-sm break-all bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-md p-3 text-gray-900 dark:text-gray-100 select-all">
        {created.token}
      </code>
      <button onClick={copy} className={buttonClass.small}>
        {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}{copied ? t('security.copied') : t('security.copy')}
      </button>
      <p className="text-xs text-amber-700 dark:text-amber-400 flex items-start gap-1.5">
        <AlertTriangle className="w-4 h-4 shrink-0" />{t('security.tokens.newWarning')}
      </p>
      <p className="text-xs text-gray-500 dark:text-gray-400">{t('security.tokens.mcpHint')}</p>
    </Dialog>
  );
};

const ApiTokensSection = () => {
  const { t } = useTranslation();
  const [tokens, setTokens] = useState(null);
  const [error, setError] = useState('');
  const [creating, setCreating] = useState(false);
  const [created, setCreated] = useState(null);
  const [revoking, setRevoking] = useState(null);

  const load = useCallback(() => {
    accountAPI.getTokens().then(setTokens).catch((err) => setError(securityErrorMessage(t, err)));
  }, [t]);
  useEffect(() => { load(); }, [load]);

  const date = (value) => formatDate(value);
  const expired = (tok) => tok.expires_at && new Date(tok.expires_at) < new Date();

  const revoke = async (tok) => {
    setRevoking(tok.id);
    setError('');
    try {
      await accountAPI.revokeToken(tok.id);
      load();
    } catch (err) {
      setError(securityErrorMessage(t, err));
    } finally {
      setRevoking(null);
    }
  };

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-2">
        <p className="text-sm text-gray-600 dark:text-slate-400 max-w-2xl">{t('security.tokens.description')}</p>
        <button onClick={() => setCreating(true)} className={buttonClass.small}><Plus className="w-4 h-4" />{t('security.tokens.create')}</button>
      </div>
      <ErrorNote>{error}</ErrorNote>
      {tokens === null && !error && <Loader2 className="w-4 h-4 animate-spin text-gray-400" />}
      {tokens && tokens.length === 0 && <p className="text-sm text-gray-500 dark:text-slate-400">{t('security.tokens.none')}</p>}
      {tokens && tokens.length > 0 && (
        <ul className="divide-y divide-gray-100 dark:divide-slate-700 border border-gray-200 dark:border-slate-700 rounded-lg">
          {tokens.map((tok) => (
            <li key={tok.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
              <div className="min-w-0">
                <div className="text-sm font-medium text-gray-900 dark:text-slate-100 flex items-center gap-2">
                  <bdi className="truncate">{tok.name}</bdi>
                  <code dir="ltr" className="text-xs font-mono text-gray-500 dark:text-slate-400">{tok.hint}…</code>
                  {expired(tok) && <span className="text-xs px-1.5 py-0.5 rounded-sm bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300">{t('security.tokens.expired')}</span>}
                </div>
                <div className="text-xs text-gray-500 dark:text-slate-400">
                  {t('security.tokens.created', { date: date(tok.created_at) })}
                  {' · '}
                  {tok.expires_at ? t('security.tokens.expires', { date: date(tok.expires_at) }) : t('security.tokens.noExpiry')}
                  {' · '}
                  {tok.last_used_at ? t('security.tokens.lastUsed', { date: date(tok.last_used_at) }) : t('security.tokens.neverUsed')}
                </div>
              </div>
              <button onClick={() => revoke(tok)} disabled={revoking === tok.id} className={buttonClass.smallDanger}>
                {revoking === tok.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}{t('security.tokens.revoke')}
              </button>
            </li>
          ))}
        </ul>
      )}
      {creating && <CreateTokenDialog onClose={() => setCreating(false)} onCreated={(c) => { setCreating(false); setCreated(c); load(); }} />}
      {created && <NewTokenDialog created={created} onDone={() => setCreated(null)} />}
    </div>
  );
};

export default ApiTokensSection;
