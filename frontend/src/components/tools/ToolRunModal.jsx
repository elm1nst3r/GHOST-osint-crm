// File: frontend/src/components/tools/ToolRunModal.jsx
//
// Search with integrated tools (issue #96). Opened from:
//   - a person's OSINT data: their identifiers are the inputs, and findings
//     can be added back to the person (marked unverified, with their source)
//   - a tool card on the Tools page: one tool, a typed-in value, and the
//     tool's searches that need no input (account balance, status)
//
// Searches run one after another, never in parallel, so providers' rate
// limits hold. Nothing is sent until the user clicks Search; operations that
// use API quota say so and are not preselected.
import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { X, Search, Loader2, AlertTriangle, CheckCircle2, ExternalLink, Plus, Info } from 'lucide-react';
import { toolsAPI, peopleAPI, osintRecordsAPI } from '../../utils/api';
import {
  inputKindForOsint, operationsFor, operationsForInput, runnableTools, accepts, customSearchTypes, noInputOperations, INPUT_KINDS,
  occurrenceTotals, occurrenceKey, addableValues,
} from '../../utils/integrations';
import { useProject } from '../../contexts/ProjectContext';
import JsonTree from '../records/JsonTree';
import { formatPersonName } from '../../utils/personName';

const pairKey = (tool, op) => `${tool.id}:${op.id}`;

// The typed-in value's kind: an identifier kind, or "custom:<search type>".
const CUSTOM = 'custom:';
const manualKindOf = (op) => {
  if (!op || op.input === 'none') return '';
  return op.input === 'text' ? `${CUSTOM}${op.input_label}` : op.input;
};
const NO_INPUT = { key: 'none', kind: 'none', value: '', type: null };

// Which person results go to when the dialog was opened without one (from
// the Tools page): a search over the active project's people.
const PersonPicker = ({ value, onChange }) => {
  const { t } = useTranslation();
  const { activeProjectId } = useProject();
  const [query, setQuery] = useState('');
  const [hits, setHits] = useState([]);
  const text = query.trim();
  useEffect(() => {
    if (text.length < 2) return undefined;
    let cancelled = false;
    const id = setTimeout(() => {
      peopleAPI.search(text, activeProjectId)
        .then((rows) => { if (!cancelled) setHits(Array.isArray(rows) ? rows : []); })
        .catch(() => { if (!cancelled) setHits([]); });
    }, 250);
    return () => { cancelled = true; clearTimeout(id); };
  }, [text, activeProjectId]);
  const shown = text.length < 2 ? [] : hits;

  if (value) {
    return (
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="text-gray-600 dark:text-gray-300">{t('tools.addTarget')}</span>
        <span className="font-medium text-gray-900 dark:text-gray-100"><bdi>{formatPersonName(value, t('tools.unnamedPerson'))}</bdi></span>
        <button type="button" onClick={() => onChange(null)} className="text-xs text-blue-600 dark:text-blue-400 hover:underline">{t('tools.changeTarget')}</button>
      </div>
    );
  }
  return (
    <div className="space-y-1 w-full sm:w-80">
      <label className="block text-xs text-gray-600 dark:text-gray-300" htmlFor="tool-run-target">{t('tools.addTarget')}</label>
      <input
        id="tool-run-target"
        className="w-full px-2 py-1.5 text-sm rounded-sm border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800"
        placeholder={t('tools.findPerson')}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        autoComplete="off"
      />
      {shown.length > 0 && (
        <ul className="max-h-40 overflow-y-auto rounded-sm border border-gray-200 dark:border-gray-700 divide-y divide-gray-100 dark:divide-gray-700">
          {shown.map((p) => (
            <li key={p.id}>
              <button type="button" onClick={() => { onChange(p); setQuery(''); }} className="w-full text-start px-2 py-1.5 text-sm hover:bg-gray-50 dark:hover:bg-gray-700/50">
                <bdi>{formatPersonName(p, t('tools.unnamedPerson'))}</bdi>
              </button>
            </li>
          ))}
        </ul>
      )}
      {text.length >= 2 && shown.length === 0 && <p className="text-xs text-gray-500 dark:text-gray-400">{t('tools.noPersonFound')}</p>}
    </div>
  );
};

const CostBadge = ({ cost }) => {
  const { t } = useTranslation();
  if (!cost || cost === 'free') return null;
  return (
    <span className="ms-2 text-[11px] px-1.5 py-0.5 rounded-sm bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
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
    .filter((e) => operationsForInput(usable, e).length > 0), [person, usable]);

  // What can be typed in: identifier kinds and custom search types some tool takes.
  const manualKinds = useMemo(() => [
    ...INPUT_KINDS.filter((k) => operationsFor(usable, k).length > 0).map((k) => ({ value: k, label: t(`tools.kind_${k}`) })),
    ...customSearchTypes(usable).map((label) => ({ value: `${CUSTOM}${label}`, label })),
  ], [usable, t]);
  // Searches without input belong to a tool, not a person.
  const noInputOps = useMemo(() => (person ? [] : noInputOperations(usable)), [person, usable]);

  const initialKind = manualKindOf((initialTool?.integration?.operations || []).find((op) => op.input !== 'none')) || manualKinds[0]?.value || 'email';
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
  // Opened from a person: results go to them. From the Tools page: to the
  // person picked below.
  const [chosenTarget, setChosenTarget] = useState(null);
  const target = person || chosenTarget;

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape' && !running) onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, running]);

  const inputs = useMemo(() => {
    const list = personInputs.filter((i) => selectedInputs.has(i.key));
    if (manual.value.trim()) {
      list.push(manual.kind.startsWith(CUSTOM)
        ? { key: 'manual', custom: manual.kind.slice(CUSTOM.length), value: manual.value.trim(), type: null }
        : { key: 'manual', kind: manual.kind, value: manual.value.trim(), type: null });
    }
    return list;
  }, [personInputs, selectedInputs, manual]);

  // Operations that accept at least one selected input, then the tool's
  // searches that need none.
  const availableOps = useMemo(() => {
    const seen = new Map();
    for (const input of inputs) {
      for (const pair of operationsForInput(usable, input)) seen.set(pairKey(pair.tool, pair.op), pair);
    }
    noInputOps.forEach((pair) => seen.set(pairKey(pair.tool, pair.op), pair));
    return [...seen.values()];
  }, [inputs, usable, noInputOps]);

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
        if (!accepts(op, input)) continue;
        out.push({ key: `${pairKey(tool, op)}|${input.key}`, tool, op, input });
      }
    }
    for (const { tool, op } of availableOps) {
      if (op.input === 'none' && selectedOps.has(pairKey(tool, op))) {
        out.push({ key: `${pairKey(tool, op)}|none`, tool, op, input: NO_INPUT });
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

  // Every value a manifest marked as OSINT data can be added to the person,
  // once per search: ticking it ticks every row it appears in (#96).
  const pickKey = (run, f, value) => `${run.key}|${occurrenceKey(f, value)}`;
  // How many times each value occurred in each search's results (#96).
  const totalsByRun = useMemo(() => new Map(runs.filter((r) => r.status === 'done').map((r) => [r.key, occurrenceTotals(r.result)])), [runs]);
  const occurrencesOf = (run, f, value) => totalsByRun.get(run.key)?.get(occurrenceKey(f, value)) ?? 1;
  const addableOf = (run) => (run.status === 'done' ? addableValues(run.result) : []);
  // Full records a search returned (results.keepRecords), saved on the person
  // as the provider sent them.
  const recordKey = (run, itemIdx) => `${run.key}|record|${itemIdx}`;
  const recordsOf = (run) => (run.status === 'done' ? run.result.items.map((item, i) => ({ item, i })).filter(({ item }) => item.record) : []);
  const selectableOf = (run) => [...addableOf(run).map((v) => `${run.key}|${v.key}`), ...recordsOf(run).map(({ i }) => recordKey(run, i))];
  const [openRecords, setOpenRecords] = useState(() => new Set());
  const toggleAll = (run) => {
    const keys = selectableOf(run);
    const all = keys.every((k) => picks.has(k));
    const next = new Set(picks);
    keys.forEach((k) => (all ? next.delete(k) : next.add(k)));
    setPicks(next);
  };
  const addPicked = async () => {
    const entries = [];
    const records = [];
    for (const run of runs) {
      const source = {
        tool_id: run.tool.id,
        tool_name: run.tool.name,
        integration_id: run.result?.integration_id,
        operation: run.op.id,
        query: run.result?.query,
        retrieved_at: run.result?.retrieved_at,
      };
      for (const v of addableOf(run)) {
        if (!picks.has(`${run.key}|${v.key}`)) continue;
        const occurrences = totalsByRun.get(run.key)?.get(v.key) ?? 1;
        entries.push({
          type: v.osintType,
          value: v.value,
          notes: t('tools.foundNote', { field: v.label, tool: run.tool.name, query: run.result.query }),
          source: {
            ...source,
            ...(occurrences > 1 ? { occurrences } : {}),
            ...(v.recordSources.length ? { record_sources: v.recordSources } : {}),
          },
        });
      }
      for (const { item, i } of recordsOf(run)) {
        if (!picks.has(recordKey(run, i))) continue;
        records.push({
          data: item.record,
          ...(item.recordSource ? { record_source: item.recordSource } : {}),
          ...(item.count > 1 ? { occurrences: item.count } : {}),
          source,
        });
      }
    }
    if ((!entries.length && !records.length) || !target) return;
    setAdding(true);
    try {
      const saved = records.length ? await osintRecordsAPI.add(target.id, records) : null;
      const res = entries.length ? await peopleAPI.addOsint(target.id, entries) : null;
      setAddResult({
        ok: true,
        name: formatPersonName(target, t('tools.unnamedPerson')),
        values: res && { added: res.added, updated: res.updated ?? 0, unchanged: res.unchanged ?? res.skipped },
        records: saved && { added: saved.added, updated: saved.updated, unchanged: saved.unchanged, rejected: saved.rejected?.length || 0 },
      });
      setPicks(new Set());
      if (person && res) onAdded?.(res.osint_data);
    } catch (err) {
      setAddResult({ ok: false, message: err.message });
    } finally {
      setAdding(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-60 p-2 md:p-4">
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
                      <label key={i.key} className="flex items-center gap-2 p-2 rounded-sm border border-gray-200 dark:border-gray-700 text-sm cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50">
                        <input type="checkbox" checked={selectedInputs.has(i.key)} onChange={() => toggle(selectedInputs, setSelectedInputs, i.key)} disabled={running} />
                        <span className="text-gray-500 dark:text-gray-400 text-xs w-20 shrink-0 truncate" title={i.type}>{i.kind ? t(`tools.kind_${i.kind}`) : i.type}</span>
                        <bdi className="text-gray-900 dark:text-gray-100 break-all">{i.value}</bdi>
                      </label>
                    ))}
                  </div>
                )}
                {manualKinds.length === 0 && noInputOps.length > 0 && (
                  <p className="text-sm text-gray-600 dark:text-gray-400">{t('tools.noInputOnly')}</p>
                )}
                {manualKinds.length > 0 && (
                <div className="flex flex-col sm:flex-row gap-2">
                  <select
                    value={manual.kind}
                    onChange={(e) => setManual({ ...manual, kind: e.target.value })}
                    disabled={running}
                    aria-label={t('tools.inputKindLabel')}
                    className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white text-sm"
                  >
                    {manualKinds.map((k) => (
                      <option key={k.value} value={k.value}>{k.label}</option>
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
                )}
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
                          {op.input === 'none' && <span className="ms-2 text-[11px] text-gray-500 dark:text-gray-400">{t('tools.noInputTag')}</span>}
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
                        {(run.result?.query || run.input.value) && (
                          <span className="text-gray-500 dark:text-gray-400 break-all">· <bdi>{run.result?.query || run.input.value}</bdi></span>
                        )}
                        {selectableOf(run).length > 1 && (
                          <button type="button" onClick={() => toggleAll(run)} className="text-xs text-blue-600 dark:text-blue-400 hover:underline">
                            {selectableOf(run).every((k) => picks.has(k)) ? t('tools.clearSelection') : t('tools.selectAll', { count: selectableOf(run).length })}
                          </button>
                        )}
                        <span className="ms-auto text-xs">
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
                        <p className="px-3 py-2 text-sm text-red-600 dark:text-red-400 flex items-start gap-2"><AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />{run.error}</p>
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
                              {(item.recordSource || item.record) && (
                                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mb-1 text-xs">
                                  {item.recordSource && (
                                    <span className="px-1.5 py-0.5 rounded-sm bg-indigo-50 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300" title={t('tools.recordSourceTitle')}>
                                      <bdi dir="auto">{item.recordSource}</bdi>
                                    </span>
                                  )}
                                  {item.record && (
                                    <>
                                      <label className="inline-flex items-center gap-1.5 text-gray-700 dark:text-gray-300">
                                        <input
                                          type="checkbox"
                                          checked={picks.has(recordKey(run, itemIdx))}
                                          onChange={() => toggle(picks, setPicks, recordKey(run, itemIdx))}
                                        />
                                        {t('tools.keepRecord')}
                                      </label>
                                      <button
                                        type="button"
                                        onClick={() => toggle(openRecords, setOpenRecords, recordKey(run, itemIdx))}
                                        aria-expanded={openRecords.has(recordKey(run, itemIdx))}
                                        className="text-blue-600 dark:text-blue-400 hover:underline"
                                      >
                                        {openRecords.has(recordKey(run, itemIdx)) ? t('tools.hideRecord') : t('tools.showRecord')}
                                      </button>
                                    </>
                                  )}
                                </div>
                              )}
                              {item.record && openRecords.has(recordKey(run, itemIdx)) && (
                                <div className="mb-2 p-2 rounded-sm bg-gray-50 dark:bg-gray-900/40 overflow-x-auto">
                                  <JsonTree value={item.record} />
                                </div>
                              )}
                              <dl className="grid grid-cols-1 sm:grid-cols-[10rem_1fr] gap-x-3 gap-y-0.5">
                                {item.fields.map((f) => (
                                  <React.Fragment key={f.label}>
                                    <dt className="text-gray-500 dark:text-gray-400 text-xs pt-0.5">{f.label}</dt>
                                    <dd className="text-gray-800 dark:text-gray-200 break-all">
                                      {f.values.map((value) => (
                                        <div key={value} className="flex items-start gap-1.5">
                                          {f.osintType && (
                                            <input
                                              type="checkbox"
                                              className="mt-1"
                                              aria-label={t('tools.pickValue', { value })}
                                              checked={picks.has(pickKey(run, f, value))}
                                              onChange={() => toggle(picks, setPicks, pickKey(run, f, value))}
                                            />
                                          )}
                                          <span>{value}</span>
                                          {occurrencesOf(run, f, value) > 1 && (
                                            <span
                                              className="shrink-0 px-1.5 rounded-sm bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300 text-xs tabular-nums"
                                              title={t('tools.occurrencesTitle', { count: occurrencesOf(run, f, value) })}
                                            >
                                              {t('tools.occurrences', { count: occurrencesOf(run, f, value) })}
                                            </span>
                                          )}
                                        </div>
                                      ))}
                                    </dd>
                                  </React.Fragment>
                                ))}
                              </dl>
                            </div>
                          ))}
                          {run.result.truncated && <p className="px-3 py-2 text-xs text-gray-500">{t('tools.truncated', { count: run.result.items.length, total: run.result.total })}</p>}
                          {run.result.recordsOmitted > 0 && <p className="px-3 py-2 text-xs text-gray-500">{t('tools.recordsOmitted', { count: run.result.recordsOmitted })}</p>}
                        </div>
                      )}
                    </div>
                  ))}
                </section>
              )}
            </>
          )}
        </div>

        {runs.some((r) => selectableOf(r).length > 0) && (
          <div className="p-4 border-t border-gray-200 dark:border-gray-700 flex flex-wrap items-center gap-3">
            {!person && <PersonPicker value={chosenTarget} onChange={(p) => { setChosenTarget(p); setAddResult(null); }} />}
            <button
              type="button"
              onClick={addPicked}
              disabled={adding || picks.size === 0 || !target}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-green-600 text-white text-sm hover:bg-green-700 disabled:opacity-50"
            >
              {adding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              {t('tools.addPicked', { count: picks.size })}
            </button>
            <span className="text-xs text-gray-500 dark:text-gray-400">{t('tools.addPickedHint')}</span>
            {addResult?.ok && (
              <span className="text-sm text-green-700 dark:text-green-400 flex items-center gap-1">
                <CheckCircle2 className="w-4 h-4" />
                {[
                  addResult.values && t('tools.addedToPerson', { name: addResult.name, ...addResult.values }),
                  addResult.records && t('tools.recordsSaved', { name: addResult.name, ...addResult.records }),
                  addResult.records?.rejected > 0 && t('tools.recordsRejected', { count: addResult.records.rejected }),
                ].filter(Boolean).join(' ')}
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
