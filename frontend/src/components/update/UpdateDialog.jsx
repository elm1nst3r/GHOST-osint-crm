// How to update this instance: what to read first, the commands for the way
// GHOST runs here, and the notes of every release being skipped. GHOST never
// runs the commands itself (see backend/services/updateCheckService.js).
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, Check, Copy, ExternalLink, X } from 'lucide-react';
import { UPDATE_METHODS, needsAttention, updateSteps } from '../../utils/updateSteps';
import { renderMarkdown } from '../../utils/scratchpadMarkdown';
import { formatDate } from '../../utils/format';

const STEP_HINTS = new Set(['backup', 'backupExternal', 'backupManual', 'pin', 'check']);

const CopyButton = ({ text }) => {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard?.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }).catch(() => {});
  };
  return (
    <button type="button" onClick={copy}
      className="shrink-0 inline-flex items-center gap-1 px-2 py-1 text-xs rounded-sm text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-slate-700">
      {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
      {copied ? t('updateDialog.copied') : t('updateDialog.copy')}
    </button>
  );
};

// Release notes come from GitHub and are sanitised the same way as
// scratchpad notes (no remote images, no scripts).
const Notes = ({ source }) => (
  <div className="scratchpad-md text-sm text-gray-800 dark:text-gray-200"
    dangerouslySetInnerHTML={{ __html: renderMarkdown(source, { breaks: false }) }} />
);

const UpdateDialog = ({ info, onClose }) => {
  const { t } = useTranslation();
  const install = info.install || {};
  const detected = UPDATE_METHODS.includes(install.method) ? install.method : 'images';
  const [method, setMethod] = useState(detected);
  const releases = info.releases || [];
  const attention = needsAttention(releases);
  const steps = updateSteps({ install, method, current: info.currentVersion, latest: info.latestVersion });

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-2000 p-4" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-labelledby="update-dialog-title" onClick={(e) => e.stopPropagation()}
        className="bg-white dark:bg-slate-800 rounded-lg shadow-xl w-full max-w-3xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-gray-700">
          <h2 id="update-dialog-title" className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            {t('updateDialog.title', { version: info.latestVersion })}
          </h2>
          <button type="button" onClick={onClose} aria-label={t('updateDialog.close')} className="p-1 rounded-sm text-gray-500 hover:bg-gray-100 dark:hover:bg-slate-700">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="overflow-y-auto px-5 py-4 space-y-5">
          <p className="text-sm text-gray-700 dark:text-gray-300">{t('updateDialog.intro', { version: info.currentVersion })}</p>

          {attention.length > 0 && (
            <section className="rounded-md border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/20 p-3 space-y-3">
              <h3 className="text-sm font-semibold text-amber-900 dark:text-amber-200 flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4" />{t('updateDialog.attentionTitle')}
              </h3>
              {attention.map((r) => (
                <div key={r.version} className="space-y-1">
                  <p className="text-sm font-medium text-amber-900 dark:text-amber-200">
                    {r.beforeUpgrade ? t('updateDialog.beforeUpgrade', { version: r.version }) : t('updateDialog.major', { version: r.version })}
                  </p>
                  {r.beforeUpgrade && <Notes source={r.beforeUpgrade} />}
                </div>
              ))}
            </section>
          )}

          <fieldset>
            <legend className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-2">{t('updateDialog.methodLabel')}</legend>
            <div className="flex flex-wrap gap-2">
              {UPDATE_METHODS.map((m) => (
                <label key={m} className={`flex items-center gap-2 px-3 py-1.5 rounded-md border text-sm cursor-pointer has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-blue-500 ${method === m
                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30 text-blue-900 dark:text-blue-100'
                  : 'border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300'}`}>
                  <input type="radio" name="update-method" value={m} checked={method === m} onChange={() => setMethod(m)} className="sr-only" />
                  {t(`updateDialog.method.${m}`)}
                  {m === detected && info.install && <span className="text-xs text-gray-500 dark:text-gray-400">({t('updateDialog.detected')})</span>}
                </label>
              ))}
            </div>
          </fieldset>

          <ol className="space-y-4">
            {steps.map((step, i) => (
              <li key={step.key} className="flex gap-3">
                <span className="shrink-0 w-6 h-6 rounded-full bg-blue-600 text-white text-xs font-semibold flex items-center justify-center">{i + 1}</span>
                <div className="min-w-0 flex-1 space-y-1.5">
                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{t(`updateDialog.steps.${step.key}`)}</p>
                  {STEP_HINTS.has(step.key) && <p className="text-xs text-gray-600 dark:text-gray-400">{t(`updateDialog.steps.${step.key}Hint`)}</p>}
                  {step.commands.length > 0 && (
                    <div className="flex items-start gap-2 rounded-md bg-gray-100 dark:bg-slate-900 p-2">
                      <pre dir="ltr" className="flex-1 min-w-0 overflow-x-auto text-xs font-mono text-gray-900 dark:text-gray-100 whitespace-pre">{step.commands.join('\n')}</pre>
                      <CopyButton text={step.commands.join('\n')} />
                    </div>
                  )}
                </div>
              </li>
            ))}
          </ol>

          {releases.length > 0 && (
            <section className="space-y-2">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">{t('updateDialog.whatsNew')}</h3>
              {releases.map((r, i) => (
                <details key={r.version} open={i === 0} className="rounded-md border border-gray-200 dark:border-gray-700">
                  <summary className="px-3 py-2 cursor-pointer text-sm font-medium text-gray-900 dark:text-gray-100">
                    {r.name || r.version}
                    {r.publishedAt && <span className="ms-2 text-xs font-normal text-gray-500 dark:text-gray-400">{formatDate(r.publishedAt)}</span>}
                  </summary>
                  <div className="px-3 pb-3 space-y-2">
                    <Notes source={r.notes} />
                    {r.url && (
                      <a href={r.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-sm text-blue-600 dark:text-blue-400 hover:underline">
                        {t('updateDialog.viewOnGitHub')}<ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    )}
                  </div>
                </details>
              ))}
            </section>
          )}
        </div>

        <div className="px-5 py-3 border-t border-gray-200 dark:border-gray-700 flex justify-end">
          <button type="button" onClick={onClose} className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700">{t('updateDialog.close')}</button>
        </div>
      </div>
    </div>
  );
};

export default UpdateDialog;
