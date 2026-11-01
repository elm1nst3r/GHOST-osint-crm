// File: frontend/src/components/tools/ToolRunModal.js
//
// Search with integrated tools (issue #96). Opened from:
//   - a person's OSINT data: their identifiers are the inputs, and findings
//     can be added back to the person (marked unverified, with their source)
//   - a tool card on the Tools page: one tool, a typed-in value
//
// Searches run one after another, never in parallel, so providers' rate
// limits hold. Nothing is sent until the user clicks Search; operations that
// use API quota say so and are not preselected.
import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { X, Search, Loader2, AlertTriangle, CheckCircle2, ExternalLink, Plus, Info } from 'lucide-react';
import { toolsAPI, peopleAPI } from '../../utils/api';
import { inputKindForOsint, operationsFor, runnableTools, kindsAccepting, INPUT_KINDS } from '../../utils/integrations';

const pairKey = (tool, op) => `${tool.id}:${op.id}`;

const CostBadge = ({ cost }) => {
  const { t } = useTranslation();
  if (!cost || cost === 'free') return null;
  return (
    <span className="ml-2 text-[11px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
      {cost === 'paid' ? t('tools.costPaid') : t('tools.costQuota')}
    </span>
  );
};

const ToolRunModal = ({ tools, person = null, initialEntryIndex = null, initialTool = null, onClose, onAdded }) => {
  const { t } = useTranslation();
  const usable = useMemo(() => runnableTools(initialTool ? [initialTool] : tools), [tools, initialTool]);

  // Inputs: the person's identifiers we can search for, plus a typed-in one.
  const personInputs = useMemo(() => (person?.osint_data || [])
    .map((e, index) => ({ key: `osint-${index}`, index, type: e.type, value: e.value, kind: inputKindForOsint(e.type, e.value) }))
    .filter((e) => e.kind && operationsFor(usable, e.kind).length > 0), [person, usable]);

  const initialKind = initialTool?.integration?.operations?.[0]?.input || 'email';
  const [manual, setManual] = useState({ kind: initialKind, value: '' });
  const [selectedInputs, setSelectedInputs] = useState(() => new Set(
    initialEntryIndex != null ? [`osint-${initialEntryIndex}`] : []
  ));
  const [selectedOps, setSelectedOps] = useState(() => new Set());
  const [runs, setRuns] = useState([]);
  const [running, setRunning] = useState(false);
  const [picks, setPicks] = useState(() => new Set());
  const [adding, setAdding] = useState(false);
  const [addResult, setAddResult] = useState(null);

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape' && !running) onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, running]);

  const inputs = useMemo(() => {
    const list = personInputs.filter((i) => selectedInputs.has(i.key));
    if (manual.value.trim()) list.push({ key: 'manual', kind: manual.kind, value: manual.value.trim(), type: null });
    return list;
  }, [personInputs, selectedInputs, manual]);

  // Operations that accept at least one selected input.
  const availableOps = useMemo(() => {
    const seen = new Map();
    for (const input of inputs) {
      for (const pair of operationsFor(usable, input.kind)) seen.set(pairKey(pair.tool, pair.op), pair);
    }
    return [...seen.values()];
  }, [inputs, usable]);

  // Preselect free operations the first time they become available.
  useEffect(() => {
    setSelectedOps((prev) => {
      const next = new Set(prev);
      let changed = false;
      for (const { tool, op } of availableOps) {
        const k = pairKey(tool, op);
        if (!prev.has(`seen:${k}`)) {
          next.add(`seen:${k}`);
          if ((op.cost || 'free') === 'free') next.add(k);
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [availableOps]);

  const plan = useMemo(() => {
    const out = [];
    for (const input of inputs) {
      for (const { tool, op } of availableOps) {
        if (!selectedOps.has(pairKey(tool, op))) continue;
        if (!kindsAccepting(input.kind).includes(op.input)) continue;
        out.push({ key: `${pairKey(tool, op)}|${input.key}`, tool, op, input });
      }
    }
    return out;
  }, [inputs, availableOps, selectedOps]);

  const quotaCount = plan.filter((p) => (p.op.cost || 'free') !== 'free').length;

  const toggle = (set, setter, key) => {
    const next = new Set(set);
    if (next.has(key)) next.delete(key); else next.add(key);
    setter(next);
  };

  const runAll = async () => {
    if (plan.length === 0) return;
    setRunning(true);
    setAddResult(null);
    setPicks(new Set());
    setRuns(plan.map((p) => ({ ...p, status: 'pending' })));
    for (const p of plan) {
      setRuns((rs) => rs.map((r) => (r.key === p.key ? { ...r, status: 'running' } : r)));
      try {
        const result = await toolsAPI.run(p.tool.id, {
          operation: p.op.id, input: p.input.value, ...(person ? { person_id: person.id } : {}),
        });
        setRuns((rs) => rs.map((r) => (r.key === p.key ? { ...r, status: 'done', result } : r)));
      } catch (err) {
        setRuns((rs) => rs.map((r) => (r.key === p.key ? { ...r, status: 'error', error: err.message } : r)));
      }
    }
    setRunning(false);
  };

  // Every value a manifest marked as OSINT data, so it can be added to the person.
  const pickKey = (run, itemIdx, label, value) => `${run.key}|${itemIdx}|${label}|${value}`;
  const addPicked = async () => {
    const entries = [];
    for (const run of runs) {
      if (run.status !== 'done') continue;
      run.result.items.forEach((item, itemIdx) => item.fields.forEach((f) => f.values.forEach((value) => {
        if (!f.osintType || !picks.has(pickKey(run, itemIdx, f.label, value))) return;
        entries.push({
          type: f.osintType,
          value,
          notes: t('tools.foundNote', { field: f.label, tool: run.tool.name, query: run.result.query }),
          source: {
            tool_id: run.tool.id,
            tool_name: run.tool.name,
            integration_id: run.result.integration_id,
            operation: run.op.id,
            query: run.result.query,
            retrieved_at: run.result.retrieved_at,
          },
        });
      })));
    }
    if (!entries.length) return;
    setAdding(true);
    try {
      const res = await peopleAPI.addOsint(person.id, entries);
      setAddResult({ ok: true, added: res.added, skipped: res.skipped });
      setPicks(new Set());
      onAdded?.(res.osint_data);
    } catch (err) {
      setAddResult({ ok: false, message: err.message });
    } finally {
      setAdding(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[60] p-2 md:p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl border border-gray-200 dark:border-gray-700 w-full max-w-4xl max-h-[95vh] overflow-hidden flex flex-col" role="dialog" aria-modal="true">
        <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <Search className="w-5 h-5" />
              {initialTool ? t('tools.runTitleTool', { name: initialTool.name }) : t('tools.runTitlePerson')}
            </h2>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{t('tools.runSubtitle')}</p>
          </div>
          <button type="button" onClick={onClose} disabled={running} aria-label={t('common.close')} className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-40">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-5">
          {usable.length === 0 ? (
            <p className="text-sm text-gray-600 dark:text-gray-400 flex items-start gap-2"><Info className="w-4 h-4 mt-0.5" />{t('tools.noRunnableTools')}</p>
          ) : (
            <>
              {/* 1. What to search for */}
              <section>
                <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-2">{t('tools.stepInputs')}</h3>
                {personInputs.length > 0 && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mb-3">
                    {personInputs.map((i) => (
                      <label key={i.key} className="flex items-center gap-2 p-2 rounded border border-gray-200 dark:border-gray-700 text-sm cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50">
                        <input type="checkbox" checked={selectedInputs.has(i.key)} onChange={() => toggle(selectedInputs, setSelectedInputs, i.key)} disabled={running} />
                        <span className="text-gray-500 dark:text-gray-400 text-xs w-20 flex-shrink-0 truncate" title={i.type}>{t(`tools.kind_${i.kind}`)}</span>
                        <span className="text-gray-900 dark:text-gray-100 break-all">{i.value}</span>
                      </label>
                    ))}
                  </div>
                )}
                <div className="flex flex-col sm:flex-row gap-2">
                  <select
                    value={manual.kind}
                    onChange={(e) => setManual({ ...manual, kind: e.target.value })}
                    disabled={running}
                    aria-label={t('tools.inputKindLabel')}
                    className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white text-sm"
                  >
                    {INPUT_KINDS.filter((k) => operationsFor(usable, k).length > 0).map((k) => (
                      <option key={k} value={k}>{t(`tools.kind_${k}`)}</option>
                    ))}
                  </select>
                  <input
                    type="text"
                    value={manual.value}
                    onChange={(e) => setManual({ ...manual, value: e.target.value })}
                    onKeyDown={(e) => { if (e.key === 'Enter' && !running) runAll(); }}
                    disabled={running}
                    placeholder={personInputs.length ? t('tools.manualPlaceholderExtra') : t('tools.manualPlaceholder')}
                    className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white text-sm"
                  />
                </div>
              </section>

              {/* 2. Which searches */}
              {availableOps.length > 0 && (
                <section>
                  <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-2">{t('tools.stepOperations')}</h3>
                  <div className="space-y-1.5">
                    {availableOps.map(({ tool, op }) => (
                      <label key={pairKey(tool, op)} className="flex items-start gap-2 text-sm cursor-pointer">
                        <input type="checkbox" className="mt-1" checked={selectedOps.has(pairKey(tool, op))} onChange={() => toggle(selectedOps, setSelectedOps, pairKey(tool, op))} disabled={running} />
                        <span>
                          <span className="font-medium text-gray-900 dark:text-gray-100">{tool.name}</span>
                          <span className="text-gray-600 dark:text-gray-300"> · {op.label}</span>
                          <CostBadge cost={op.cost} />
                          <span className="block text-xs text-gray-500 dark:text-gray-400">{t('tools.sendsTo', { host: tool.integration.host })}</span>
                        </span>
                      </label>
                    ))}
                  </div>
                </section>
              )}

              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={runAll}
                  disabled={running || plan.length === 0}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white text-sm hover:bg-blue-700 disabled:opacity-50"
                >
                  {running ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                  {t('tools.runButton', { count: plan.length })}
                </button>
                {quotaCount > 0 && <span className="text-xs text-amber-700 dark:text-amber-400">{t('tools.quotaWarning', { count: quotaCount })}</span>}
              </div>

              {/* 3. Results */}
              {runs.length > 0 && (
                <section className="space-y-3">
                  {runs.map((run) => (
                    <div key={run.key} className="rounded-lg border border-gray-200 dark:border-gray-700">
                      <div className="px-3 py-2 bg-gray-50 dark:bg-gray-900/40 flex flex-wrap items-center gap-2 text-sm rounded-t-lg">
                        <span className="font-medium text-gray-900 dark:text-gray-100">{run.tool.name}</span>
                        <span className="text-gray-600 dark:text-gray-300">· {run.op.label}</span>
                        <span className="text-gray-500 dark:text-gray-400 break-all">· {run.result?.query || run.input.value}</span>
                        <span className="ml-auto text-xs">
                          {run.status === 'pending' && <span className="text-gray-400">{t('tools.statusQueued')}</span>}
                          {run.status === 'running' && <Loader2 className="w-4 h-4 animate-spin text-blue-600" />}
                          {run.status === 'done' && (
                            <span className="text-green-700 dark:text-green-400">
                              {run.result.not_found || run.result.total === 0 ? t('tools.noResults') : t('tools.resultCount', { count: run.result.total })}
                            </span>
                          )}
                          {run.status === 'error' && <span className="text-red-600 dark:text-red-400">{t('tools.statusFailed')}</span>}
                        </span>
                      </div>
                      {run.status === 'error' && (
                        <p className="px-3 py-2 text-sm text-red-600 dark:text-red-400 flex items-start gap-2"><AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />{run.error}</p>
                      )}
                      {run.status === 'done' && run.result.items.length > 0 && (
                        <div className="divide-y divide-gray-100 dark:divide-gray-700 max-h-80 overflow-y-auto">
                          {run.result.items.map((item, itemIdx) => (
                            <div key={itemIdx} className="px-3 py-2 text-sm">
                              {item.title && (
                                <div className="font-medium text-gray-900 dark:text-gray-100 break-all mb-1 flex items-center gap-1">
                                  {item.title}
                                  {item.link && (
                                    <a href={item.link} target="_blank" rel="noopener noreferrer" className="text-blue-600 dark:text-blue-400" aria-label={t('tools.openSource')}>
                                      <ExternalLink className="w-3.5 h-3.5" />
                                    </a>
                                  )}
                                </div>
                              )}
                              <dl className="grid grid-cols-1 sm:grid-cols-[10rem_1fr] gap-x-3 gap-y-0.5">
                                {item.fields.map((f) => (
                                  <React.Fragment key={f.label}>
                                    <dt className="text-gray-500 dark:text-gray-400 text-xs pt-0.5">{f.label}</dt>
                                    <dd className="text-gray-800 dark:text-gray-200 break-all">
                                      {f.values.map((value) => (
                                        <div key={value} className="flex items-start gap-1.5">
                                          {person && f.osintType && (
                                            <input
                                              type="checkbox"
                                              className="mt-1"
                                              aria-label={t('tools.pickValue', { value })}
                                              checked={picks.has(pickKey(run, itemIdx, f.label, value))}
                                              onChange={() => toggle(picks, setPicks, pickKey(run, itemIdx, f.label, value))}
                                            />
                                          )}
                                          <span>{value}</span>
                                        </div>
                                      ))}
                                    </dd>
                                  </React.Fragment>
                                ))}
                              </dl>
                            </div>
                          ))}
                          {run.result.truncated && <p className="px-3 py-2 text-xs text-gray-500">{t('tools.truncated', { count: run.result.items.length, total: run.result.total })}</p>}
                        </div>
                      )}
                    </div>
                  ))}
                </section>
              )}
            </>
          )}
        </div>

        {person && runs.some((r) => r.status === 'done' && r.result.items.length > 0) && (
          <div className="p-4 border-t border-gray-200 dark:border-gray-700 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={addPicked}
              disabled={adding || picks.size === 0}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-green-600 text-white text-sm hover:bg-green-700 disabled:opacity-50"
            >
              {adding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              {t('tools.addPicked', { count: picks.size })}
            </button>
            <span className="text-xs text-gray-500 dark:text-gray-400">{t('tools.addPickedHint')}</span>
            {addResult?.ok && (
              <span className="text-sm text-green-700 dark:text-green-400 flex items-center gap-1">
                <CheckCircle2 className="w-4 h-4" />{t('tools.addedResult', { added: addResult.added, skipped: addResult.skipped })}
              </span>
            )}
            {addResult && !addResult.ok && <span className="text-sm text-red-600 dark:text-red-400">{addResult.message}</span>}
          </div>
        )}
      </div>
    </div>,
    document.body
  );
};

export default ToolRunModal;
