// File: frontend/src/components/tools/ExportToolsModal.jsx
//
// Export the tool list to a JSON file (issue #96). "With configuration" adds
// sharing settings for tools the user manages; a passphrase additionally
// includes their API keys, encrypted with it. Without a passphrase the keys
// are left out and must be re-entered after import.
import { useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { X, Download, Loader2, ShieldCheck, AlertTriangle } from 'lucide-react';
import { toolsAPI, saveBlob } from '../../utils/api';

const ExportToolsModal = ({ onClose }) => {
  const { t } = useTranslation();
  const [includeConfig, setIncludeConfig] = useState(false);
  const [passphrase, setPassphrase] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(null);

  const mismatch = includeConfig && passphrase && passphrase !== confirm;
  const tooShort = includeConfig && passphrase && passphrase.length < 8;

  const doExport = async () => {
    setBusy(true);
    setError('');
    try {
      const res = await toolsAPI.exportFile({
        include_config: includeConfig,
        ...(includeConfig && passphrase ? { passphrase } : {}),
      });
      const date = new Date().toISOString().slice(0, 10);
      const name = `ghost-tools-${includeConfig ? 'with-config-' : ''}${date}.json`;
      saveBlob(new Blob([JSON.stringify(res.file, null, 2)], { type: 'application/json' }), name);
      setDone({ tools: res.file.tools.length, keysIncluded: res.keys_included, keysOmitted: res.keys_omitted });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-60 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl border border-gray-200 dark:border-gray-700 w-full max-w-md" role="dialog" aria-modal="true">
        <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <h2 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2"><Download className="w-5 h-5" />{t('tools.exportTitle')}</h2>
          <button type="button" onClick={onClose} aria-label={t('common.close')} className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-4 space-y-3 text-sm">
          <p className="text-gray-600 dark:text-gray-300">{t('tools.exportHelp')}</p>
          <fieldset className="space-y-2">
            <label className="flex items-start gap-2 cursor-pointer">
              <input type="radio" className="mt-1" checked={!includeConfig} onChange={() => setIncludeConfig(false)} />
              <span><span className="font-medium text-gray-900 dark:text-gray-100">{t('tools.exportWithoutConfig')}</span>
                <span className="block text-xs text-gray-500 dark:text-gray-400">{t('tools.exportWithoutConfigHelp')}</span></span>
            </label>
            <label className="flex items-start gap-2 cursor-pointer">
              <input type="radio" className="mt-1" checked={includeConfig} onChange={() => setIncludeConfig(true)} />
              <span><span className="font-medium text-gray-900 dark:text-gray-100">{t('tools.exportWithConfig')}</span>
                <span className="block text-xs text-gray-500 dark:text-gray-400">{t('tools.exportWithConfigHelp')}</span></span>
            </label>
          </fieldset>
          {includeConfig && (
            <div className="space-y-2 p-3 rounded-lg bg-gray-50 dark:bg-gray-900/40">
              <p className="text-xs text-gray-600 dark:text-gray-300 flex items-start gap-1.5"><ShieldCheck className="w-4 h-4 shrink-0" />{t('tools.passphraseHelp')}</p>
              <input type="password" autoComplete="new-password" value={passphrase} onChange={(e) => setPassphrase(e.target.value)}
                placeholder={t('tools.passphrasePlaceholder')} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white" />
              {passphrase && (
                <input type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)}
                  placeholder={t('tools.passphraseConfirm')} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white" />
              )}
              {tooShort && <p className="text-xs text-red-600">{t('tools.passphraseTooShort')}</p>}
              {mismatch && !tooShort && <p className="text-xs text-red-600">{t('tools.passphraseMismatch')}</p>}
            </div>
          )}
          {error && <p className="text-red-600 dark:text-red-400 flex items-start gap-1.5"><AlertTriangle className="w-4 h-4 mt-0.5" />{error}</p>}
          {done && (
            <p className="text-green-700 dark:text-green-400">
              {t('tools.exportDone', { count: done.tools })}
              {done.keysIncluded > 0 && ` ${t('tools.exportKeysIncluded', { count: done.keysIncluded })}`}
              {done.keysOmitted > 0 && ` ${t('tools.exportKeysOmitted', { count: done.keysOmitted })}`}
            </p>
          )}
        </div>
        <div className="p-4 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg text-sm border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200">{t('common.close')}</button>
          <button type="button" onClick={doExport} disabled={busy || mismatch || tooShort} className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50">
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}{t('tools.export')}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default ExportToolsModal;
