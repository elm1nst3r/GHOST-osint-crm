// File: frontend/src/components/tools/GhostToolsImport.js
//
// Import a tool list exported by GHOST (issue #96). Shown by
// ImportToolsModal when the chosen file is a GHOST export rather than a
// spreadsheet. "With configuration" applies the file's sharing settings and,
// with the passphrase, its API keys; without it, tools arrive with default
// sharing and no keys. Either way the user can put every tool into the
// current project instead.
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { X, Upload, Loader2, AlertTriangle, Check, Plug, Link2, KeyRound } from 'lucide-react';
import { toolsAPI } from '../../utils/api';
import { useData } from '../../contexts/DataContext';
import { useAuth } from '../../contexts/AuthContext';
import { useProject } from '../../contexts/ProjectContext';

const GhostToolsImport = ({ file, onClose, onBack }) => {
  const { t } = useTranslation();
  const { fetchTools } = useData();
  const { currentUser } = useAuth();
  const { activeProject } = useProject();
  const isAdmin = currentUser?.role === 'admin';

  const hasConfig = Boolean(file.includes_config && file.tools.some((x) => x.config));
  const hasKeys = Boolean(file.secrets);
  const [includeConfig, setIncludeConfig] = useState(hasConfig);
  const [passphrase, setPassphrase] = useState('');
  const [onlyProject, setOnlyProject] = useState(false);
  const [mode, setMode] = useState('skip');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [report, setReport] = useState(null);

  const counts = useMemo(() => ({
    integrated: file.tools.filter((x) => x.kind === 'integration').length,
    links: file.tools.filter((x) => x.kind !== 'integration').length,
  }), [file]);
  const integrations = (file.integrations || []).map((i) => i.manifest).filter(Boolean);

  const run = async () => {
    setBusy(true);
    setError('');
    try {
      const res = await toolsAPI.importFile({
        data: file,
        include_config: includeConfig,
        mode,
        ...(includeConfig && hasKeys && passphrase ? { passphrase } : {}),
        ...(onlyProject && activeProject ? { project_id: activeProject.id } : {}),
      });
      setReport(res);
      fetchTools();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col" role="dialog" aria-modal="true">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-slate-700 flex items-center justify-between">
          <h2 className="text-lg font-semibold flex items-center gap-2 text-gray-900 dark:text-slate-100"><Upload className="w-5 h-5" />{t('tools.importTitle')}</h2>
          <button onClick={onClose} aria-label={t('common.close')} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-4 text-sm">
          {!report ? (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <div className="p-3 rounded-md bg-gray-50 dark:bg-slate-700/50"><Plug className="w-4 h-4 inline mr-1" />{t('tools.importIntegratedCount', { count: counts.integrated })}</div>
                <div className="p-3 rounded-md bg-gray-50 dark:bg-slate-700/50"><Link2 className="w-4 h-4 inline mr-1" />{t('tools.importLinkCount', { count: counts.links })}</div>
                <div className="p-3 rounded-md bg-gray-50 dark:bg-slate-700/50"><KeyRound className="w-4 h-4 inline mr-1" />{hasKeys ? t('tools.importHasKeys') : t('tools.importNoKeys')}</div>
              </div>
              <p className="text-xs text-gray-500 dark:text-slate-400">
                {t('tools.importFrom', { version: file.app_version || '?', date: (file.exported_at || '').slice(0, 10) })}
              </p>
              {integrations.length > 0 && (
                <p className="text-xs text-gray-600 dark:text-slate-300">
                  {t('tools.importIntegrations', { list: integrations.map((m) => `${m.name} (${new URL(m.baseUrl).host})`).join(', ') })}
                  {!isAdmin && ` ${t('tools.importIntegrationsNonAdmin')}`}
                </p>
              )}

              <fieldset className="space-y-2">
                <label className={`flex items-start gap-2 ${hasConfig ? 'cursor-pointer' : 'opacity-60'}`}>
                  <input type="radio" className="mt-1" checked={includeConfig} disabled={!hasConfig} onChange={() => setIncludeConfig(true)} />
                  <span><span className="font-medium text-gray-900 dark:text-slate-100">{t('tools.importWithConfig')}</span>
                    <span className="block text-xs text-gray-500 dark:text-slate-400">{hasConfig ? t('tools.importWithConfigHelp') : t('tools.importNoConfigInFile')}</span></span>
                </label>
                <label className="flex items-start gap-2 cursor-pointer">
                  <input type="radio" className="mt-1" checked={!includeConfig} onChange={() => setIncludeConfig(false)} />
                  <span><span className="font-medium text-gray-900 dark:text-slate-100">{t('tools.importWithoutConfig')}</span>
                    <span className="block text-xs text-gray-500 dark:text-slate-400">{isAdmin ? t('tools.importWithoutConfigHelpAdmin') : t('tools.importWithoutConfigHelpUser')}</span></span>
                </label>
              </fieldset>

              {includeConfig && hasKeys && (
                <label className="block">
                  <span className="block text-gray-700 dark:text-slate-300 mb-1">{t('tools.importPassphrase')}</span>
                  <input type="password" autoComplete="off" value={passphrase} onChange={(e) => setPassphrase(e.target.value)}
                    placeholder={t('tools.importPassphrasePlaceholder')} className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-md dark:bg-slate-700 dark:text-white" />
                </label>
              )}

              {activeProject && (
                <label className="flex items-start gap-2 cursor-pointer">
                  <input type="checkbox" className="mt-1" checked={onlyProject} onChange={(e) => setOnlyProject(e.target.checked)} />
                  <span>{t('tools.importOnlyProject', { project: activeProject.name })}</span>
                </label>
              )}

              <div className="flex flex-wrap items-center gap-4">
                <span className="text-gray-700 dark:text-slate-300">{t('tools.existingLabel')}</span>
                <label className="flex items-center gap-1.5"><input type="radio" checked={mode === 'skip'} onChange={() => setMode('skip')} />{t('tools.modeSkip')}</label>
                <label className="flex items-center gap-1.5"><input type="radio" checked={mode === 'update'} onChange={() => setMode('update')} />{t('tools.modeUpdate')}</label>
              </div>

              {error && <p className="text-red-600 dark:text-red-400 flex items-start gap-1.5"><AlertTriangle className="w-4 h-4 mt-0.5" />{error}</p>}
            </>
          ) : (
            <div className="space-y-2">
              <p className="font-medium text-green-700 dark:text-green-400 flex items-center gap-2"><Check className="w-4 h-4" />{t('tools.importDone')}</p>
              <ul className="list-disc pl-5 text-gray-700 dark:text-slate-300">
                <li>{t('toolImport.resultCreated', { count: report.created })}</li>
                <li>{t('toolImport.resultUpdated', { count: report.updated })}</li>
                <li>{t('toolImport.resultSkipped', { count: report.skipped })}</li>
                {report.keys_imported > 0 && <li>{t('tools.importKeysResult', { count: report.keys_imported })}</li>}
                {report.integrations_installed?.length > 0 && <li>{t('tools.importInstalledResult', { list: report.integrations_installed.join(', ') })}</li>}
              </ul>
              {report.warnings?.length > 0 && (
                <ul className="text-xs text-amber-700 dark:text-amber-400 list-disc pl-5">{report.warnings.map((w) => <li key={w}>{w}</li>)}</ul>
              )}
              {report.errors?.length > 0 && (
                <ul className="text-xs text-red-600 dark:text-red-400 list-disc pl-5">{report.errors.map((e) => <li key={`${e.index}-${e.name}`}>{e.name}: {e.message}</li>)}</ul>
              )}
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t border-gray-200 dark:border-slate-700 flex justify-end gap-3">
          {!report && <button onClick={onBack} className="px-4 py-2 text-sm text-gray-700 dark:text-slate-300 bg-gray-100 dark:bg-slate-700 rounded-md">{t('tools.chooseAnotherFile')}</button>}
          {report
            ? <button onClick={onClose} className="px-4 py-2 text-sm bg-blue-600 text-white rounded-md">{t('common.close')}</button>
            : (
              <button onClick={run} disabled={busy} className="inline-flex items-center gap-2 px-4 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50">
                {busy && <Loader2 className="w-4 h-4 animate-spin" />}{t('tools.importButton', { count: file.tools.length })}
              </button>
            )}
        </div>
      </div>
    </div>
  );
};

export default GhostToolsImport;
