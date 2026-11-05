// File: frontend/src/components/settings/ToolsSettingsTab.jsx
//
// Admin settings for OSINT tools (issue #96): whether users may add their own
// tools, which integrations are installed, and installing community ones.
// An integration file is shown (host, operations, key) before it's
// installed, because installing it decides where investigators' queries go.
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { Plug, Upload, Trash2, Eye, X, ExternalLink, AlertTriangle, CheckCircle2, Wand2, Pencil, CopyPlus } from 'lucide-react';
import IntegrationBuilder from '../tools/builder/IntegrationBuilder';
import { toolsAPI, integrationsAPI } from '../../utils/api';

const COMMUNITY_URL = 'https://github.com/elm1nst3r/GHOST-osint-crm/tree/main/integrations';

const ManifestViewer = ({ id, onClose }) => {
  const { t } = useTranslation();
  const [data, setData] = useState(null);
  useEffect(() => { integrationsAPI.get(id).then(setData).catch(() => setData({ error: true })); }, [id]);
  return createPortal(
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-60 p-4" onClick={onClose}>
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <h2 className="font-semibold text-gray-900 dark:text-white">{t('tools.manifestTitle', { id })}</h2>
          <button type="button" onClick={onClose} aria-label={t('common.close')} className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700"><X className="w-5 h-5" /></button>
        </div>
        <pre className="flex-1 overflow-auto p-4 text-xs font-mono text-gray-800 dark:text-gray-200 whitespace-pre-wrap">
          {data ? JSON.stringify(data.manifest || data, null, 2) : t('common.loadingEllipsis')}
        </pre>
      </div>
    </div>,
    document.body
  );
};

const ToolsSettingsTab = () => {
  const { t } = useTranslation();
  const fileRef = useRef(null);
  const [allowUserTools, setAllowUserTools] = useState(true);
  const [integrations, setIntegrations] = useState([]);
  const [viewing, setViewing] = useState(null);
  const [pending, setPending] = useState(null);
  const [message, setMessage] = useState(null);
  // { manifest, mode } or { mode: 'new' }
  const [builder, setBuilder] = useState(null);

  const openBuilder = async (integration, mode) => {
    try {
      const { manifest } = await integrationsAPI.get(integration.id);
      setBuilder({ manifest, mode });
    } catch (err) {
      setMessage({ ok: false, text: err.message });
    }
  };

  const load = () => integrationsAPI.getAll().then(setIntegrations).catch((err) => setMessage({ ok: false, text: err.message }));

  useEffect(() => {
    toolsAPI.getSettings().then((s) => setAllowUserTools(Boolean(s.allow_user_tools))).catch(() => {});
    load();
  }, []);

  const savePolicy = async (value) => {
    setAllowUserTools(value);
    try {
      await toolsAPI.updateSettings({ allow_user_tools: value });
    } catch (err) {
      setAllowUserTools(!value);
      setMessage({ ok: false, text: err.message });
    }
  };

  const pickFile = (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const manifest = JSON.parse(reader.result);
        let host = '?';
        try { host = new URL(manifest.baseUrl).host; } catch { /* the server will reject it */ }
        setPending({ manifest, host, exists: integrations.some((i) => i.id === manifest.id) });
        setMessage(null);
      } catch {
        setMessage({ ok: false, text: t('tools.manifestNotJson') });
      }
    };
    reader.readAsText(file);
  };

  const install = async () => {
    try {
      await integrationsAPI.install(pending.manifest, pending.exists);
      setMessage({ ok: true, text: t('tools.manifestInstalled', { name: pending.manifest.name }) });
      setPending(null);
      load();
    } catch (err) {
      setMessage({ ok: false, text: err.message });
    }
  };

  const remove = async (integration) => {
    if (!window.confirm(t('tools.confirmRemoveIntegration', { name: integration.name }))) return;
    try {
      await integrationsAPI.remove(integration.id);
      load();
    } catch (err) {
      setMessage({ ok: false, text: err.message });
    }
  };

  return (
    <div className="space-y-8">
      <section>
        <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-2">{t('tools.settingsPolicyTitle')}</h3>
        <label className="flex items-start gap-3 cursor-pointer">
          <input type="checkbox" className="mt-1" checked={allowUserTools} onChange={(e) => savePolicy(e.target.checked)} />
          <span>
            <span className="font-medium text-slate-900 dark:text-slate-100">{t('tools.allowUserTools')}</span>
            <span className="block text-sm text-slate-500 dark:text-slate-400">{t('tools.allowUserToolsHelp')}</span>
          </span>
        </label>
      </section>

      <section>
        <div className="flex flex-wrap items-center justify-between gap-3 mb-2">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2"><Plug className="w-5 h-5" />{t('tools.integrationsTitle')}</h3>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => setBuilder({ mode: 'new' })} className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-blue-600 text-white text-sm hover:bg-blue-700">
              <Wand2 className="w-4 h-4" />{t('builder.buildButton')}
            </button>
            <button type="button" onClick={() => fileRef.current?.click()} className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700">
              <Upload className="w-4 h-4" />{t('tools.installIntegration')}
            </button>
          </div>
          <input ref={fileRef} type="file" accept=".json,application/json" className="hidden" onChange={pickFile} />
        </div>
        <p className="text-sm text-slate-600 dark:text-slate-400 mb-3">
          {t('tools.integrationsHelp')}{' '}
          <a href={COMMUNITY_URL} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-blue-600 dark:text-blue-400">{t('tools.communityFolder')}<ExternalLink className="w-3 h-3" /></a>
        </p>

        {message && (
          <p className={`mb-3 text-sm flex items-start gap-1.5 ${message.ok ? 'text-green-700 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
            {message.ok ? <CheckCircle2 className="w-4 h-4 mt-0.5" /> : <AlertTriangle className="w-4 h-4 mt-0.5" />}{message.text}
          </p>
        )}

        {pending && (
          <div className="mb-4 p-4 rounded-lg border border-amber-300 bg-amber-50 dark:bg-amber-900/20 dark:border-amber-700 text-sm space-y-2">
            <p className="font-medium text-slate-900 dark:text-slate-100">{t('tools.installReview', { name: pending.manifest.name || pending.manifest.id })}</p>
            <p className="text-slate-700 dark:text-slate-300">{t('tools.installHost', { host: pending.host })}</p>
            {Array.isArray(pending.manifest.operations) && (
              <p className="text-slate-700 dark:text-slate-300">{t('tools.operationsLine', { list: pending.manifest.operations.map((o) => o.label).join(' · ') })}</p>
            )}
            {pending.exists && <p className="text-amber-800 dark:text-amber-300">{t('tools.installReplaces')}</p>}
            <p className="text-xs text-slate-600 dark:text-slate-400">{t('tools.installWarning')}</p>
            <div className="flex gap-2">
              <button type="button" onClick={install} className="px-3 py-1.5 rounded-lg bg-blue-600 text-white text-sm hover:bg-blue-700">{t('tools.installConfirm')}</button>
              <button type="button" onClick={() => setPending(null)} className="px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-600 text-sm">{t('common.cancel')}</button>
            </div>
          </div>
        )}

        <div className="divide-y divide-slate-200 dark:divide-slate-700 border border-slate-200 dark:border-slate-700 rounded-lg">
          {integrations.map((i) => (
            <div key={i.id} className="p-3 flex flex-wrap items-start gap-3">
              <div className="flex-1 min-w-48">
                <div className="font-medium text-slate-900 dark:text-slate-100 flex flex-wrap items-center gap-2">
                  {i.name}
                  <span className={`text-[11px] px-1.5 py-0.5 rounded-sm ${i.source === 'builtin' ? 'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300' : 'bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300'}`}>
                    {i.source === 'builtin' ? t('tools.builtin') : t('tools.community')}
                  </span>
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400">
                  {i.host} · {i.auth.type === 'none' ? t('tools.noKeyNeeded') : i.auth.required ? t('tools.keyRequired') : t('tools.keyOptional')} · {t('tools.usedByCount', { count: i.tool_count })}
                </div>
                {i.description && <p className="text-sm text-slate-600 dark:text-slate-300 mt-1">{i.description}</p>}
              </div>
              <div className="flex gap-1">
                <button type="button" onClick={() => setViewing(i.id)} title={t('tools.viewDefinition')} aria-label={t('tools.viewDefinition')} className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700"><Eye className="w-4 h-4" /></button>
                {i.source === 'imported' ? (
                  <button type="button" onClick={() => openBuilder(i, 'edit')} title={t('builder.editInBuilder')} aria-label={t('builder.editInBuilder')} className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700"><Pencil className="w-4 h-4" /></button>
                ) : (
                  <button type="button" onClick={() => openBuilder(i, 'copy')} title={t('builder.copyInBuilder')} aria-label={t('builder.copyInBuilder')} className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700"><CopyPlus className="w-4 h-4" /></button>
                )}
                {i.source === 'imported' && (
                  <button type="button" onClick={() => remove(i)} title={t('common.delete')} aria-label={t('common.delete')} className="p-2 rounded-lg text-slate-500 hover:text-red-600 hover:bg-slate-100 dark:hover:bg-slate-700"><Trash2 className="w-4 h-4" /></button>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>

      {viewing && <ManifestViewer id={viewing} onClose={() => setViewing(null)} />}
      {builder && (
        <IntegrationBuilder
          initialManifest={builder.manifest || null}
          mode={builder.mode}
          onClose={() => setBuilder(null)}
          onInstalled={(summary) => {
            setBuilder(null);
            setMessage({ ok: true, text: t('builder.installedNextStep', { name: summary.name }) });
            load();
          }}
        />
      )}
    </div>
  );
};

export default ToolsSettingsTab;
