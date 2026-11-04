// File: frontend/src/components/tools/builder/IntegrationBuilder.js
//
// Integration builder: build a ghost-integration/v1 file by answering plain
// questions instead of writing JSON (issue #96 follow-up). Admins only, since
// test calls reach outside services and installing decides where searches go.
//
//   1. About the service   name, website, terms
//   2. Connecting          how the API key is sent; a key for test calls
//   3. Searches            per search: what it looks for, the request (from
//                          an example in the docs), a live test, and picking
//                          result fields by clicking the response
//   4. Review              the generated file; install it, copy or download
import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { X, ChevronLeft, ChevronRight, Loader2, Download, Copy, Check, Plus, Wand2, AlertTriangle, KeyRound } from 'lucide-react';
import { integrationsAPI, saveBlob } from '../../../utils/api';
import { useModelOptions } from '../../../utils/useModelOptions';
import { OSINT_DATA_TYPES } from '../../../utils/constants';
import { buildManifest, emptyOperation, emptyState, slugify, stateFromManifest, usesKeyPlaceholder, KEY_PLACEHOLDER } from '../../../utils/integrationBuilder';
import BuilderSearchStep from './BuilderSearchStep';

const input = 'w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white text-sm';

const AUTH_CHOICES = ['none', 'header', 'query', 'bearer', 'url'];
const NAMED_AUTH = ['header', 'query'];

// mode: 'new' | 'edit' (an imported integration, replaced on install) |
// 'copy' (a built-in as a starting point, saved under a new id)
const IntegrationBuilder = ({ initialManifest = null, mode = 'new', onClose, onInstalled }) => {
  const { t } = useTranslation();
  const osintTypes = useModelOptions('osint_data_type', OSINT_DATA_TYPES);
  const [state, setState] = useState(() => {
    if (!initialManifest) return emptyState();
    const s = stateFromManifest(initialManifest);
    return mode === 'copy' ? { ...s, id: `${s.id}-custom`.slice(0, 60), name: `${s.name} (custom)` } : s;
  });
  const [step, setStep] = useState(0);
  const [opIndex, setOpIndex] = useState(0);
  const [testKey, setTestKey] = useState('');
  const [keepKey, setKeepKey] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape' && !busy) onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, busy]);

  // The id follows the name until someone edits it.
  const setName = (name) => setState((s) => ({ ...s, name, ...(s.idTouched ? {} : { id: slugify(name) }) }));

  const manifest = useMemo(() => buildManifest(state), [state]);
  const json = useMemo(() => JSON.stringify(manifest, null, 2), [manifest]);
  const op = state.operations[opIndex] || state.operations[0];

  // patch may be a function of the current search, so quick successive
  // changes (several clicks in a row) never work from a stale copy.
  const updateOp = (patch) => setState((s) => ({
    ...s,
    operations: s.operations.map((o, i) => (i === opIndex ? { ...o, ...(typeof patch === 'function' ? patch(o) : patch) } : o)),
  }));
  const addOp = () => {
    setState((s) => ({ ...s, operations: [...s.operations, emptyOperation()] }));
    setOpIndex(state.operations.length);
  };
  const removeOp = (i) => {
    if (state.operations.length === 1) return;
    setState((s) => ({ ...s, operations: s.operations.filter((_, j) => j !== i) }));
    setOpIndex(0);
  };

  const steps = [t('builder.stepAbout'), t('builder.stepConnect'), t('builder.stepSearches'), t('builder.stepReview')];
  const keyMark = { keyMark: KEY_PLACEHOLDER };
  // What still stops the Searches step, first problem first.
  const searchesProblem = !state.baseUrl || state.operations.some((o) => o.fields.length === 0) ? t('builder.needFields')
    : state.operations.some((o) => o.input === 'text' && !(o.inputLabel || '').trim()) ? t('builder.needInputLabel')
      : state.authType === 'url' && state.operations.some((o) => !usesKeyPlaceholder(o)) ? t('builder.needKeyPlaceholder', keyMark)
        : null;
  const canNext = [
    state.name.trim().length > 0,
    !NAMED_AUTH.includes(state.authType) || state.authName.trim().length > 0,
    !searchesProblem,
    true,
  ][step];
  const blockedReason = [
    t('builder.needName'),
    t('builder.needKeyName'),
    searchesProblem,
    null,
  ][step];

  const install = async () => {
    setBusy(true);
    setError(null);
    try {
      const summary = await integrationsAPI.install(manifest, mode === 'edit');
      onInstalled?.(summary, keepKey && testKey ? testKey : null);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const copy = async () => {
    try { await navigator.clipboard.writeText(json); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { /* ignore */ }
  };

  const authHelp = {
    none: t('builder.authNoneHelp'),
    header: t('builder.authHeaderHelp'),
    query: t('builder.authQueryHelp'),
    bearer: t('builder.authBearerHelp'),
    url: t('builder.authUrlHelp', keyMark),
  };

  return createPortal(
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[70] p-2 md:p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl border border-gray-200 dark:border-gray-700 w-full max-w-6xl max-h-[95vh] overflow-hidden flex flex-col" role="dialog" aria-modal="true">
        <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <Wand2 className="w-5 h-5" />{mode === 'edit' ? t('builder.titleEdit', { name: state.name }) : t('builder.title')}
            </h2>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{t('builder.subtitle')}</p>
          </div>
          <button type="button" onClick={onClose} aria-label={t('common.close')} className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700"><X className="w-5 h-5" /></button>
        </div>

        {/* Steps */}
        <ol className="flex flex-wrap gap-2 px-4 pt-3">
          {steps.map((label, i) => (
            <li key={label}>
              <button type="button" onClick={() => (i < step ? setStep(i) : null)} disabled={i > step}
                className={`px-3 py-1 rounded-full text-xs font-medium ${i === step ? 'bg-blue-600 text-white' : i < step ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200' : 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400'}`}>
                {i + 1}. {label}
              </button>
            </li>
          ))}
        </ol>

        <div className="flex-1 min-h-0 overflow-y-auto p-4">
          {step === 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm max-w-3xl">
              <label className="block md:col-span-2">
                <span className="block font-medium text-gray-800 dark:text-gray-200 mb-1">{t('builder.nameLabel')}</span>
                <input className={input} value={state.name} onChange={(e) => setName(e.target.value)} placeholder={t('builder.namePlaceholder')} autoFocus />
                <span className="block text-xs text-gray-500 mt-1">
                  {t('builder.idLabel')}{' '}
                  <input className="px-1 py-0.5 border-b border-dashed border-gray-400 bg-transparent font-mono text-xs w-48" value={state.id} disabled={mode === 'edit'}
                    onChange={(e) => setState((s) => ({ ...s, id: slugify(e.target.value), idTouched: true }))} aria-label={t('builder.idLabel')} />
                </span>
              </label>
              <label className="block md:col-span-2">
                <span className="block font-medium text-gray-800 dark:text-gray-200 mb-1">{t('builder.descriptionLabel')}</span>
                <textarea className={input} rows={2} value={state.description} onChange={(e) => setState((s) => ({ ...s, description: e.target.value }))} placeholder={t('builder.descriptionPlaceholder')} />
              </label>
              <label className="block">
                <span className="block font-medium text-gray-800 dark:text-gray-200 mb-1">{t('builder.homepageLabel')}</span>
                <input className={input} value={state.homepage} onChange={(e) => setState((s) => ({ ...s, homepage: e.target.value }))} placeholder="https://example.com" />
              </label>
              <label className="block">
                <span className="block font-medium text-gray-800 dark:text-gray-200 mb-1">{t('builder.termsLabel')}</span>
                <input className={input} value={state.terms} onChange={(e) => setState((s) => ({ ...s, terms: e.target.value }))} placeholder="https://example.com/terms" />
              </label>
              <label className="block">
                <span className="block font-medium text-gray-800 dark:text-gray-200 mb-1">{t('builder.categoryLabel')}</span>
                <input className={input} value={state.category} onChange={(e) => setState((s) => ({ ...s, category: e.target.value }))} placeholder={t('builder.categoryPlaceholder')} />
              </label>
              <p className="md:col-span-2 text-xs text-gray-500 dark:text-gray-400">{t('builder.legalNote')}</p>
            </div>
          )}

          {step === 1 && (
            <div className="space-y-4 text-sm max-w-3xl">
              <p className="text-gray-600 dark:text-gray-300">{t('builder.authIntro')}</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {AUTH_CHOICES.map((a) => (
                  <label key={a} className={`flex items-start gap-2 p-3 rounded-lg border cursor-pointer ${state.authType === a ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' : 'border-gray-200 dark:border-gray-700'}`}>
                    <input type="radio" className="mt-1" checked={state.authType === a} onChange={() => setState((s) => ({ ...s, authType: a }))} />
                    <span><span className="font-medium text-gray-900 dark:text-gray-100">{t(`builder.auth_${a}`)}</span>
                      <span className="block text-xs text-gray-500 dark:text-gray-400">{authHelp[a]}</span></span>
                  </label>
                ))}
              </div>
              {state.authType !== 'none' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {NAMED_AUTH.includes(state.authType) && (
                    <label className="block">
                      <span className="block font-medium text-gray-800 dark:text-gray-200 mb-1">
                        {state.authType === 'header' ? t('builder.headerName') : t('builder.paramName')}
                      </span>
                      <input className={input} value={state.authName} onChange={(e) => setState((s) => ({ ...s, authName: e.target.value.trim() }))}
                        placeholder={state.authType === 'header' ? 'X-Api-Key' : 'api_key'} />
                      <span className="block text-xs text-gray-500 mt-1">{t('builder.nameHint')}</span>
                    </label>
                  )}
                  <label className="block">
                    <span className="block font-medium text-gray-800 dark:text-gray-200 mb-1">{t('builder.signupLabel')}</span>
                    <input className={input} value={state.signupUrl} onChange={(e) => setState((s) => ({ ...s, signupUrl: e.target.value }))} placeholder="https://example.com/account/api" />
                  </label>
                  <label className="flex items-start gap-2 md:col-span-2 cursor-pointer">
                    <input type="checkbox" className="mt-1" checked={state.authOptional} onChange={(e) => setState((s) => ({ ...s, authOptional: e.target.checked }))} />
                    <span>{t('builder.optionalKey')}</span>
                  </label>
                  <label className="block md:col-span-2">
                    <span className="flex items-center gap-1.5 font-medium text-gray-800 dark:text-gray-200 mb-1"><KeyRound className="w-4 h-4" />{t('builder.testKeyLabel')}</span>
                    <input type="password" autoComplete="off" className={input} value={testKey} onChange={(e) => setTestKey(e.target.value)} />
                    <span className="block text-xs text-gray-500 mt-1">{t('builder.testKeyHelp')}</span>
                  </label>
                </div>
              )}
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                {state.operations.map((o, i) => (
                  <span key={i} className={`inline-flex items-center rounded-lg border text-sm ${i === opIndex ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' : 'border-gray-300 dark:border-gray-600'}`}>
                    <button type="button" onClick={() => setOpIndex(i)} className="px-3 py-1.5 text-gray-800 dark:text-gray-100">
                      {o.label || t('builder.searchN', { n: i + 1 })}{o.fields.length ? '' : ' •'}
                    </button>
                    {state.operations.length > 1 && (
                      <button type="button" onClick={() => removeOp(i)} aria-label={t('common.delete')} className="pe-2 text-gray-400 hover:text-red-600"><X className="w-3.5 h-3.5" /></button>
                    )}
                  </span>
                ))}
                <button type="button" onClick={addOp} className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm text-blue-700 dark:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-900/20">
                  <Plus className="w-4 h-4" />{t('builder.addSearch')}
                </button>
              </div>
              <BuilderSearchStep
                key={opIndex}
                op={op}
                onChange={updateOp}
                state={state}
                setState={setState}
                manifest={manifest}
                opIndex={opIndex}
                testKey={testKey}
                osintTypes={osintTypes}
              />
            </div>
          )}

          {step === 3 && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 text-sm">
              <div className="space-y-3">
                <h4 className="font-semibold text-gray-900 dark:text-gray-100">{t('builder.reviewTitle', { name: manifest.name })}</h4>
                <ul className="space-y-1 text-gray-700 dark:text-gray-300">
                  <li>{t('builder.reviewHost', { host: (() => { try { return new URL(manifest.baseUrl).host; } catch { return '?'; } })() })}</li>
                  <li>{manifest.auth.type === 'none' ? t('tools.noKeyNeeded') : t(`builder.auth_${manifest.auth.type}`)}</li>
                  {manifest.operations.map((o) => (
                    <li key={o.id}>• {o.label} ({o.input === 'text' ? o.inputLabel : t(`tools.kind_${o.input}`)}) — {t('builder.reviewFields', { count: o.results.fields.length })}</li>
                  ))}
                </ul>
                {testKey && (
                  <label className="flex items-start gap-2 cursor-pointer">
                    <input type="checkbox" className="mt-1" checked={keepKey} onChange={(e) => setKeepKey(e.target.checked)} />
                    <span>{t('builder.keepKey')}</span>
                  </label>
                )}
                <p className="text-xs text-gray-500 dark:text-gray-400">{t('builder.shareNote')}</p>
                {error && <p className="text-red-600 dark:text-red-400 flex items-start gap-1.5"><AlertTriangle className="w-4 h-4 mt-0.5" />{error}</p>}
                <div className="flex flex-wrap gap-2">
                  <button type="button" onClick={install} disabled={busy} className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-green-600 text-white hover:bg-green-700 disabled:opacity-50">
                    {busy && <Loader2 className="w-4 h-4 animate-spin" />}{mode === 'edit' ? t('builder.saveChanges') : t('builder.install')}
                  </button>
                  <button type="button" onClick={copy} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200">
                    {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}{t('builder.copyJson')}
                  </button>
                  <button type="button" onClick={() => saveBlob(new Blob([`${json}\n`], { type: 'application/json' }), `${manifest.id}.json`)}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200">
                    <Download className="w-4 h-4" />{t('builder.downloadJson')}
                  </button>
                </div>
              </div>
              <pre className="max-h-[60vh] overflow-auto p-3 rounded bg-gray-50 dark:bg-gray-900 text-xs font-mono text-gray-800 dark:text-gray-200">{json}</pre>
            </div>
          )}
        </div>

        <div className="p-4 border-t border-gray-200 dark:border-gray-700 flex flex-wrap items-center justify-between gap-3">
          <button type="button" onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0}
            className="inline-flex items-center gap-1 px-3 py-2 rounded-lg text-sm border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 disabled:opacity-40">
            <ChevronLeft className="rtl:-scale-x-100 w-4 h-4" />{t('builder.back')}
          </button>
          {step < 3 && (
            <div className="flex items-center gap-3">
              {!canNext && blockedReason && <span className="text-xs text-gray-500 dark:text-gray-400">{blockedReason}</span>}
              <button type="button" onClick={() => setStep((s) => s + 1)} disabled={!canNext}
                className="inline-flex items-center gap-1 px-4 py-2 rounded-lg text-sm bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50">
                {t('builder.next')}<ChevronRight className="rtl:-scale-x-100 w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
};

export default IntegrationBuilder;
