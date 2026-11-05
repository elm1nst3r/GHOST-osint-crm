// File: frontend/src/components/tools/ToolKeyDialog.jsx
//
// Add, replace, remove and test an integrated tool's API key (issue #96).
// scope 'shared' is the tool's key for everyone; 'mine' is the user's own key
// for tools set to per-user keys. Keys are write-only: once saved they are
// never shown again, only whether one is stored.
import { useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { X, KeyRound, Loader2, CheckCircle2, AlertTriangle, ExternalLink } from 'lucide-react';
import { toolsAPI } from '../../utils/api';

const ToolKeyDialog = ({ tool, scope, onClose, onChanged }) => {
  const { t } = useTranslation();
  const auth = tool.integration?.auth || {};
  const hasKey = scope === 'shared' ? tool.has_shared_key : tool.has_my_key;
  const [secret, setSecret] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(null);

  const run = async (fn) => {
    setBusy(true);
    setMessage(null);
    try { await fn(); } catch (err) { setMessage({ ok: false, text: err.message }); } finally { setBusy(false); }
  };

  const save = () => run(async () => {
    await toolsAPI.setKey(tool.id, scope, secret);
    setSecret('');
    const test = await toolsAPI.test(tool.id);
    setMessage({ ok: test.ok, text: test.ok ? `${t('tools.keySaved')} ${test.message}` : `${t('tools.keySaved')} ${test.message}` });
    onChanged?.();
  });

  const remove = () => run(async () => {
    if (!window.confirm(t('tools.confirmRemoveKey'))) return;
    await toolsAPI.removeKey(tool.id, scope);
    setMessage({ ok: true, text: t('tools.keyRemoved') });
    onChanged?.();
  });

  const test = () => run(async () => {
    const r = await toolsAPI.test(tool.id);
    setMessage({ ok: r.ok, text: r.message });
  });

  return createPortal(
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-60 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl border border-gray-200 dark:border-gray-700 w-full max-w-md" role="dialog" aria-modal="true">
        <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <h2 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <KeyRound className="w-5 h-5" />
            {scope === 'shared' ? t('tools.sharedKeyTitle', { name: tool.name }) : t('tools.myKeyTitle', { name: tool.name })}
          </h2>
          <button type="button" onClick={onClose} aria-label={t('common.close')} className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-4 space-y-3 text-sm">
          <p className="text-gray-600 dark:text-gray-300">
            {scope === 'shared' ? t('tools.sharedKeyHelp') : t('tools.myKeyHelp')}
          </p>
          {auth.help && <p className="text-gray-600 dark:text-gray-300">{auth.help}</p>}
          {auth.signupUrl && (
            <a href={auth.signupUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-blue-600 dark:text-blue-400">
              {t('tools.getKey')}<ExternalLink className="w-3.5 h-3.5" />
            </a>
          )}
          <p className={hasKey ? 'text-green-700 dark:text-green-400' : 'text-gray-500 dark:text-gray-400'}>
            {hasKey ? t('tools.keyStored') : t('tools.keyNotStored')}
          </p>
          <label className="block">
            <span className="block text-gray-700 dark:text-gray-300 mb-1">{auth.label || t('tools.apiKey')}</span>
            <input
              type="password"
              autoComplete="off"
              value={secret}
              onChange={(e) => setSecret(e.target.value)}
              placeholder={hasKey ? t('tools.replaceKeyPlaceholder') : ''}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
            />
          </label>
          {message && (
            <p className={`flex items-start gap-1.5 ${message.ok ? 'text-green-700 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
              {message.ok ? <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" /> : <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />}
              {message.text}
            </p>
          )}
        </div>
        <div className="p-4 border-t border-gray-200 dark:border-gray-700 flex flex-wrap gap-2 justify-end">
          {hasKey && (
            <>
              <button type="button" onClick={remove} disabled={busy} className="px-3 py-2 rounded-lg text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20">{t('tools.removeKey')}</button>
              <button type="button" onClick={test} disabled={busy} className="px-3 py-2 rounded-lg text-sm border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200">{t('tools.testConnection')}</button>
            </>
          )}
          <button type="button" onClick={save} disabled={busy || !secret.trim()} className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50">
            {busy && <Loader2 className="w-4 h-4 animate-spin" />}{t('common.save')}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default ToolKeyDialog;
