// File: frontend/src/components/tools/builder/BuilderSearchStep.jsx
//
// One search of an integration being built: what it looks for, the request
// (worked out from an example out of the service's docs), a live test call,
// and choosing result fields by clicking the response.
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Wand2, Play, Loader2, AlertTriangle, CheckCircle2, Trash2, Info } from 'lucide-react';
import { integrationsAPI } from '../../../utils/api';
import {
  templateFromExample, requestLine, parseRequestLine, interpretClick, humanizeKey, segmentsToPath, KEY_PLACEHOLDER, usesKeyPlaceholder,
} from '../../../utils/integrationBuilder';
import { INPUT_KINDS } from '../../../utils/integrations';
import JsonPicker, { pickedKey } from './JsonPicker';

const input = 'w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white text-sm';
const button = 'inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50';

const EXAMPLES = { email: 'someone@example.com', domain: 'example.com', ip: '8.8.8.8', username: 'username', phone: '+15555550123', url: 'https://example.com/', text: 'AB123CD', none: '' };
// Identifier kinds, then a search type the admin names, then no input at all.
const BUILDER_KINDS = [...INPUT_KINDS, 'text', 'none'];

// Suggest an OSINT data type for a picked value, if one fits.
function guessOsintType(value, osintTypes) {
  const v = String(Array.isArray(value) ? value[0] : value ?? '');
  const has = (name) => osintTypes.some((o) => o.value === name) && name;
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) return has('Email') || '';
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(v)) return has('IP Address') || '';
  if (/^https?:\/\/(www\.)?(x|twitter|facebook|instagram|linkedin|github|t|vk|tiktok)\.(com|me|ru)\//i.test(v)) return has('Social Media') || '';
  if (/^https?:\/\//i.test(v) || /^[a-z0-9-]+(\.[a-z0-9-]+)+$/i.test(v)) return has('Website') || '';
  return '';
}

const BuilderSearchStep = ({ op, onChange, state, setState, manifest, opIndex, testKey, osintTypes }) => {
  const { t } = useTranslation();
  const [exampleUrl, setExampleUrl] = useState('');
  const [sample, setSample] = useState('');
  const [exampleMsg, setExampleMsg] = useState(null);
  const [line, setLine] = useState(() => (state.baseUrl ? requestLine(state.baseUrl, op.path, op.query) : ''));
  const [testValue, setTestValue] = useState('');
  const [testing, setTesting] = useState(false);
  const [test, setTest] = useState(null);
  const [choice, setChoice] = useState(null);
  const [preview, setPreview] = useState(null);

  useEffect(() => {
    setLine(state.baseUrl ? requestLine(state.baseUrl, op.path, op.query) : '');
  }, [state.baseUrl, op.path, op.query]);

  // Every field is checked against the real mapping rules on the server.
  const resultsSpec = useMemo(() => manifest.operations[opIndex]?.results, [manifest, opIndex]);
  useEffect(() => {
    if (!test?.json || !op.fields.length) { setPreview(null); return undefined; }
    const h = setTimeout(() => {
      integrationsAPI.draftMap({ results: resultsSpec, json: test.json })
        .then(setPreview)
        .catch(() => setPreview(null));
    }, 300);
    return () => clearTimeout(h);
  }, [resultsSpec, test, op.fields.length]);

  const noInput = op.input === 'none';
  const keyInUrl = state.authType === 'url';
  const keyMark = { keyMark: KEY_PLACEHOLDER };

  const applyExample = () => {
    const r = templateFromExample(exampleUrl, noInput ? '' : sample, { authType: state.authType, authName: state.authName, secret: testKey });
    if (r.error) { setExampleMsg({ ok: false, text: t(`builder.example_${r.error}`) }); return; }
    const otherOps = state.operations.filter((_, i) => i !== opIndex && state.operations[i].path !== '/');
    if (state.baseUrl && r.baseUrl !== state.baseUrl && otherOps.length) {
      setExampleMsg({ ok: false, text: t('builder.exampleOtherHost', { host: new URL(state.baseUrl).host }) });
      return;
    }
    setState((s) => ({ ...s, baseUrl: r.baseUrl, homepage: s.homepage || r.baseUrl.replace('//api.', '//') }));
    onChange({ path: r.path, query: r.query });
    if (!testValue && !noInput) setTestValue(sample);
    const notes = [
      r.removedKey && t('builder.exampleKeyRemoved'),
      r.keyMarked && t('builder.exampleKeyMarked', keyMark),
    ].filter(Boolean).join(' ');
    if (keyInUrl && !usesKeyPlaceholder(r)) {
      setExampleMsg({ ok: false, text: t('builder.keyPlaceholderMissing', keyMark) });
    } else if (noInput || r.found) {
      setExampleMsg({ ok: true, text: `${noInput ? t('builder.exampleApplied') : t('builder.exampleFound')}${notes ? ` ${notes}` : ''}` });
    } else {
      setExampleMsg({ ok: false, text: t('builder.exampleNotFound') });
    }
  };

  const applyLine = () => {
    const r = parseRequestLine(line);
    if (r.error) { setExampleMsg({ ok: false, text: t('builder.example_notHttps') }); return; }
    setState((s) => ({ ...s, baseUrl: r.baseUrl }));
    onChange({ path: r.path, query: r.query });
    if (keyInUrl && !usesKeyPlaceholder(r)) setExampleMsg({ ok: false, text: t('builder.keyPlaceholderMissing', keyMark) });
    else setExampleMsg(r.found || noInput ? null : { ok: false, text: t('builder.lineNoInput', { input: '{{input}}' }) });
  };

  const runTest = async () => {
    setTesting(true);
    setTest(null);
    setChoice(null);
    try {
      const res = await integrationsAPI.draftTest({
        manifest, operation_id: manifest.operations[opIndex].id, input: noInput ? '' : testValue, ...(testKey ? { secret: testKey } : {}),
      });
      setTest(res);
    } catch (err) {
      setTest({ ok: false, message: err.message });
    } finally {
      setTesting(false);
    }
  };

  const addField = (path, value, segs, rootPatch) => {
    onChange((current) => {
      if (current.fields.some((f) => f.path === path)) return {};
      return {
        ...(rootPatch !== undefined && current.root === undefined ? { root: rootPatch } : {}),
        fields: [...current.fields, { label: humanizeKey(path), path, osintType: guessOsintType(value, osintTypes), split: '', _segs: segs }],
      };
    });
  };

  const onPick = (segs, value) => {
    setChoice(null);
    const r = interpretClick(segs, op.root);
    if (r.error) { setChoice({ error: t('builder.pickOutsideList', { list: op.root }) }); return; }
    if (r.field !== undefined) { addField(r.field, value, segs, op.root === undefined ? r.root : undefined); return; }
    setChoice({ segs, value, ...r });
  };

  const choose = (option) => {
    addField(option.field, choice.value, choice.segs, option.root);
    setChoice(null);
  };

  const picked = useMemo(() => new Set(op.fields.filter((f) => f._segs).map((f) => pickedKey(f._segs))), [op.fields]);
  const updateField = (i, patch) => onChange((current) => ({ fields: current.fields.map((f, j) => (j === i ? { ...f, ...patch } : f)) }));
  const removeField = (i) => onChange((current) => {
    const fields = current.fields.filter((_, j) => j !== i);
    return { fields, ...(fields.length === 0 ? { root: undefined, title: '', link: '' } : {}) };
  });

  return (
    <div className="space-y-6 text-sm">
      {/* What it searches for */}
      <section className="space-y-3">
        <label className="block">
          <span className="block font-medium text-gray-800 dark:text-gray-200 mb-1">{t('builder.searchLabel')}</span>
          <input className={input} value={op.label} onChange={(e) => onChange({ label: e.target.value })} placeholder={t('builder.searchLabelPlaceholder')} />
        </label>
        <div>
          <span className="block font-medium text-gray-800 dark:text-gray-200 mb-1">{t('builder.inputLabel')}</span>
          <div className="flex flex-wrap gap-2">
            {BUILDER_KINDS.map((k) => (
              <button key={k} type="button" onClick={() => onChange({ input: k })}
                className={`px-3 py-1.5 rounded-lg border text-sm ${op.input === k ? 'border-blue-500 bg-blue-50 text-blue-800 dark:bg-blue-900/30 dark:text-blue-200' : 'border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200'}`}>
                {t(`tools.kind_${k}`)}
              </button>
            ))}
          </div>
        </div>
        {op.input === 'text' && (
          <div className="space-y-3 p-3 rounded-lg border border-gray-200 dark:border-gray-700">
            <label className="block max-w-md">
              <span className="block font-medium text-gray-800 dark:text-gray-200 mb-1">{t('builder.inputCustomName')}</span>
              <input className={input} value={op.inputLabel || ''} onChange={(e) => onChange({ inputLabel: e.target.value })}
                placeholder={t('builder.inputCustomNamePlaceholder')} />
            </label>
            <div>
              <span className="block font-medium text-gray-800 dark:text-gray-200 mb-1">{t('builder.inputCustomTypes')}</span>
              <div className="flex flex-wrap gap-x-4 gap-y-1.5">
                {osintTypes.map((o) => (
                  <label key={o.value} className="flex items-center gap-1.5 text-gray-700 dark:text-gray-200">
                    <input type="checkbox" checked={(op.osintTypes || []).includes(o.value)}
                      onChange={(e) => onChange((current) => ({
                        osintTypes: e.target.checked
                          ? [...(current.osintTypes || []), o.value]
                          : (current.osintTypes || []).filter((v) => v !== o.value),
                      }))} />
                    {o.label}
                  </label>
                ))}
              </div>
              <span className="block text-xs text-gray-500 dark:text-gray-400 mt-1">{t('builder.inputCustomTypesHint')}</span>
            </div>
          </div>
        )}
        {noInput && <p className="text-xs text-gray-600 dark:text-gray-300 flex items-start gap-1"><Info className="w-3.5 h-3.5 mt-0.5 shrink-0" />{t('builder.inputNoneHelp')}</p>}
        <label className="block max-w-xs">
          <span className="block font-medium text-gray-800 dark:text-gray-200 mb-1">{t('builder.costLabel')}</span>
          <select className={input} value={op.cost} onChange={(e) => onChange({ cost: e.target.value })}>
            <option value="free">{t('builder.costFree')}</option>
            <option value="quota">{t('builder.costQuota')}</option>
            <option value="paid">{t('builder.costPaid')}</option>
          </select>
        </label>
      </section>

      {/* The request */}
      <section className="space-y-3 p-4 rounded-lg bg-gray-50 dark:bg-gray-900/40">
        <h4 className="font-semibold text-gray-900 dark:text-gray-100">{t('builder.requestTitle')}</h4>
        <p className="text-gray-600 dark:text-gray-300">{t('builder.requestHelp')}</p>
        <input className={input} value={exampleUrl} onChange={(e) => setExampleUrl(e.target.value)}
          placeholder={`https://api.example.com/v1/lookup?email=${EXAMPLES.email}`} />
        <div className="flex flex-col sm:flex-row gap-2">
          {!noInput && (
            <input className={input} value={sample} onChange={(e) => setSample(e.target.value)}
              placeholder={t('builder.samplePlaceholder', { example: EXAMPLES[op.input] })} />
          )}
          <button type="button" onClick={applyExample} disabled={!exampleUrl.trim() || (!noInput && !sample.trim())} className={button}>
            <Wand2 className="w-4 h-4" />{t('builder.useExample')}
          </button>
        </div>
        {exampleMsg && (
          <p className={`flex items-start gap-1.5 ${exampleMsg.ok ? 'text-green-700 dark:text-green-400' : 'text-amber-700 dark:text-amber-400'}`}>
            {exampleMsg.ok ? <CheckCircle2 className="w-4 h-4 mt-0.5" /> : <AlertTriangle className="w-4 h-4 mt-0.5" />}{exampleMsg.text}
          </p>
        )}
        <label className="block">
          <span className="block text-xs text-gray-500 dark:text-gray-400 mb-1">{t('builder.requestLine', { input: '{{input}}' })}</span>
          {keyInUrl && <span className="block text-xs text-gray-500 dark:text-gray-400 mb-1">{t('builder.keyPlaceholderHint', keyMark)}</span>}
          <input className={`${input} font-mono text-xs`} value={line} onChange={(e) => setLine(e.target.value)} onBlur={applyLine}
            placeholder="https://api.example.com/v1/lookup/{{input}}" />
        </label>
      </section>

      {/* Try it */}
      <section className="space-y-3">
        <h4 className="font-semibold text-gray-900 dark:text-gray-100">{t('builder.tryTitle')}</h4>
        <div className="flex flex-col sm:flex-row gap-2">
          {!noInput && (
            <input className={input} value={testValue} onChange={(e) => setTestValue(e.target.value)}
              placeholder={t('builder.tryPlaceholder', { example: EXAMPLES[op.input] })} />
          )}
          <button type="button" onClick={runTest} disabled={testing || (!noInput && !testValue.trim()) || !state.baseUrl}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50">
            {testing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}{t('builder.tryButton')}
          </button>
        </div>
        {state.authType !== 'none' && !testKey && !state.authOptional && (
          <p className="text-xs text-amber-700 dark:text-amber-400">{t('builder.tryNeedsKey')}</p>
        )}
        {test && (
          <div className="space-y-2">
            {test.request && <p className="text-xs text-gray-500 dark:text-gray-400 break-all">{t('builder.tryRequest')} <span className="font-mono">{test.request}</span></p>}
            {test.ok && <p className="text-green-700 dark:text-green-400 flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4" />{t('builder.tryOk', { status: test.status })}</p>}
            {test.not_found && <p className="text-amber-700 dark:text-amber-400">{t('builder.tryNotFound')}</p>}
            {(test.message || test.details) && !test.ok && (
              <p className="text-red-600 dark:text-red-400 flex items-start gap-1.5"><AlertTriangle className="w-4 h-4 mt-0.5" />
                {test.message}{test.details ? ` ${test.details.join('; ')}` : ''}</p>
            )}
          </div>
        )}
      </section>

      {/* Pick results */}
      {test?.json !== undefined && test?.json !== null && (
        <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div>
            <h4 className="font-semibold text-gray-900 dark:text-gray-100 mb-1">{t('builder.pickTitle')}</h4>
            <p className="text-xs text-gray-600 dark:text-gray-300 mb-2">{t('builder.pickHelp')}</p>
            {test.truncated && <p className="text-xs text-gray-500 mb-2">{t('builder.responseTrimmed')}</p>}
            <div className="max-h-96 overflow-auto p-2 rounded-sm border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
              <JsonPicker json={test.json} onPick={onPick} picked={picked} />
            </div>
          </div>
          <div className="space-y-3">
            {choice?.error && <p className="text-amber-700 dark:text-amber-400 text-xs">{choice.error}</p>}
            {choice?.perItem && (
              <div className="p-3 rounded-lg border border-blue-300 bg-blue-50 dark:bg-blue-900/20 dark:border-blue-700 space-y-2">
                <p className="text-gray-800 dark:text-gray-100">{t('builder.listQuestion')}</p>
                <button type="button" onClick={() => choose(choice.perItem)} className={`${button} w-full justify-start`}>
                  {t('builder.listPerItem', { list: choice.perItem.root || t('builder.theResponse') })}
                </button>
                <button type="button" onClick={() => choose(choice.collected)} className={`${button} w-full justify-start`}>
                  {t('builder.listCollected')}
                </button>
              </div>
            )}

            <div>
              <h4 className="font-semibold text-gray-900 dark:text-gray-100 mb-1">{t('builder.fieldsTitle')}</h4>
              {op.root !== undefined && op.fields.length > 0 && (
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-2 flex items-start gap-1">
                  <Info className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                  {op.root ? t('builder.rootPerItem', { list: op.root }) : t('builder.rootWhole')}
                </p>
              )}
              {op.fields.length === 0 && <p className="text-xs text-gray-500 dark:text-gray-400">{t('builder.noFields')}</p>}
              <div className="space-y-2">
                {op.fields.map((f, i) => (
                  <div key={f.path} className="p-2 rounded-sm border border-gray-200 dark:border-gray-700 space-y-1.5">
                    <div className="flex items-center gap-2">
                      <input className={`${input} py-1`} value={f.label} onChange={(e) => updateField(i, { label: e.target.value })} aria-label={t('builder.fieldLabel')} />
                      <button type="button" onClick={() => removeField(i)} aria-label={t('common.delete')} className="p-1.5 text-gray-500 hover:text-red-600"><Trash2 className="w-4 h-4" /></button>
                    </div>
                    <div className="text-[11px] font-mono text-gray-500 break-all">{f.path || segmentsToPath([])}</div>
                    <div className="flex flex-wrap items-center gap-3 text-xs">
                      <label className="flex items-center gap-1">
                        {t('builder.addAs')}
                        <select className="px-2 py-1 border border-gray-300 dark:border-gray-600 rounded-sm dark:bg-gray-700 dark:text-white" value={f.osintType}
                          onChange={(e) => updateField(i, { osintType: e.target.value })}>
                          <option value="">{t('builder.addAsNone')}</option>
                          {osintTypes.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                        </select>
                      </label>
                      <label className="flex items-center gap-1"><input type="radio" checked={op.title === f.path} onChange={() => onChange({ title: f.path })} />{t('builder.asTitle')}</label>
                      <label className="flex items-center gap-1"><input type="radio" checked={op.link === f.path} onChange={() => onChange({ link: f.path })} />{t('builder.asLink')}</label>
                      <label className="flex items-center gap-1">
                        <input type="checkbox" checked={f.split === '\n'} onChange={(e) => updateField(i, { split: e.target.checked ? '\n' : '' })} />{t('builder.splitLines')}
                      </label>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {preview && (
              <div>
                <h4 className="font-semibold text-gray-900 dark:text-gray-100 mb-1">{t('builder.previewTitle', { count: preview.total })}</h4>
                <div className="rounded-sm border border-gray-200 dark:border-gray-700 divide-y divide-gray-100 dark:divide-gray-700 max-h-60 overflow-auto">
                  {preview.items.slice(0, 3).map((item, idx) => (
                    <div key={idx} className="p-2 text-xs">
                      {item.title && <div className="font-medium text-gray-900 dark:text-gray-100 break-all">{item.title}</div>}
                      {item.fields.map((f) => (
                        <div key={f.label} className="break-all"><span className="text-gray-500">{f.label}:</span> {f.values.join(', ')}
                          {f.osintType && <span className="ms-1 text-[10px] px-1 rounded-sm bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300">{t('builder.addable', { type: f.osintType })}</span>}
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </section>
      )}
    </div>
  );
};

export default BuilderSearchStep;
