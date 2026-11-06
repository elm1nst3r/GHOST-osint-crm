// File: frontend/src/components/records/PersonRecordsPanel.jsx
//
// A person's saved records (issue #96): results integrations returned, kept
// exactly as the provider sent them. Each shows where it came from (tool,
// the source the record names, search, date, count); any value in it can be
// added to the person's OSINT data later, keeping a link to the record.
import { useEffect, useEffectEvent, useMemo, useState, useTransition } from 'react';
import { useTranslation } from 'react-i18next';
import { Search, Trash2, Loader2, Plus, X, Database, ChevronDown, ChevronRight } from 'lucide-react';
import { osintRecordsAPI, peopleAPI } from '../../utils/api';
import { useModelOptions } from '../../utils/useModelOptions';
import { OSINT_DATA_TYPES } from '../../utils/constants';
import { translateOptions } from '../../utils/optionLabels';
import { guessOsintType } from '../../utils/integrations';
import { formatDateTime } from '../../utils/format';
import JsonTree from './JsonTree';

const LIMIT = 500;

const AddValueForm = ({ pick, types, onCancel, onAdd, busy }) => {
  const { t } = useTranslation();
  const [type, setType] = useState(() => {
    const guess = guessOsintType(pick.path, pick.value);
    return types.some((o) => o.value === guess) ? guess : (types[0]?.value || 'Other');
  });
  const [value, setValue] = useState(pick.value);
  return (
    <form
      className="mt-2 p-3 rounded-lg border border-blue-200 dark:border-blue-900 bg-blue-50/50 dark:bg-blue-950/20 flex flex-wrap items-end gap-2"
      onSubmit={(e) => { e.preventDefault(); onAdd(type, value.trim()); }}
    >
      <div className="text-xs text-gray-600 dark:text-gray-300 basis-full">
        {t('records.addFromPath')} <code dir="ltr" className="font-mono">{pick.path}</code>
      </div>
      <label className="text-xs text-gray-600 dark:text-gray-300">
        {t('records.osintType')}
        <select value={type} onChange={(e) => setType(e.target.value)} className="block mt-1 px-2 py-1.5 text-sm rounded-sm border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800">
          {types.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </label>
      <label className="text-xs text-gray-600 dark:text-gray-300 grow min-w-48">
        {t('records.value')}
        <input value={value} onChange={(e) => setValue(e.target.value)} className="block w-full mt-1 px-2 py-1.5 text-sm rounded-sm border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800" />
      </label>
      <button type="submit" disabled={busy || !value.trim()} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-600 text-white text-sm hover:bg-green-700 disabled:opacity-50">
        {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}{t('records.addToOsint')}
      </button>
      <button type="button" onClick={onCancel} className="px-3 py-1.5 rounded-lg text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700">{t('common.cancel')}</button>
    </form>
  );
};

const RecordCard = ({ record, types, personId, onDeleted, onOsintAdded }) => {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [pick, setPick] = useState(null);
  const [confirming, setConfirming] = useState(false);
  const [message, setMessage] = useState(null);
  const [busy, startAction] = useTransition();

  const add = (type, value) => startAction(async () => {
    try {
      const res = await peopleAPI.addOsint(personId, [{
        type,
        value,
        notes: t('records.foundNote', { path: pick.path, tool: record.tool_name || record.integration_id || t('records.import') }),
        source: {
          ...(record.tool_id ? { tool_id: record.tool_id } : {}),
          ...(record.tool_name ? { tool_name: record.tool_name } : {}),
          ...(record.integration_id ? { integration_id: record.integration_id } : {}),
          ...(record.operation ? { operation: record.operation } : {}),
          ...(record.query ? { query: record.query } : {}),
          ...(record.retrieved_at ? { retrieved_at: new Date(record.retrieved_at).toISOString() } : {}),
          ...(record.record_source ? { record_sources: [record.record_source] } : {}),
          record_id: record.id,
          record_path: pick.path,
        },
      }]);
      setPick(null);
      setMessage({ ok: true, text: res.added ? t('records.addedNew', { value }) : t('records.addedExisting', { value }) });
      onOsintAdded?.(res.osint_data);
    } catch (err) {
      setMessage({ ok: false, text: err.message });
    }
  });

  const remove = () => startAction(async () => {
    try {
      await osintRecordsAPI.remove(record.id);
      onDeleted(record.id);
    } catch (err) {
      setConfirming(false);
      setMessage({ ok: false, text: err.message });
    }
  });

  return (
    <div className="rounded-lg border border-gray-200 dark:border-gray-700">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2">
        <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} className="flex items-center gap-1.5 font-medium text-gray-900 dark:text-gray-100 text-sm text-start">
          {open ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4 rtl:-scale-x-100" />}
          {record.record_source ? <bdi dir="auto">{record.record_source}</bdi> : t('records.untitled')}
        </button>
        <span className="text-xs text-gray-500 dark:text-gray-400">
          {t('records.provenance', { tool: record.tool_name || record.integration_id || t('records.import'), date: formatDateTime(record.retrieved_at) })}
          {record.query ? <> · {t('records.searchedFor')} <bdi>{record.query}</bdi></> : null}
          {record.occurrences > 1 && <> · {t('tools.occurrencesTitle', { count: record.occurrences })}</>}
        </span>
        <span className="ms-auto flex items-center gap-1">
          {confirming ? (
            <>
              <span className="text-xs text-gray-600 dark:text-gray-300">{t('records.deleteConfirm')}</span>
              <button type="button" onClick={remove} disabled={busy} className="px-2 py-1 rounded-sm text-xs bg-red-600 text-white hover:bg-red-700">{t('common.delete')}</button>
              <button type="button" onClick={() => setConfirming(false)} className="p-1 rounded-sm text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700" aria-label={t('common.cancel')}><X className="w-4 h-4" /></button>
            </>
          ) : (
            <button type="button" onClick={() => setConfirming(true)} className="p-1.5 rounded-lg text-gray-500 hover:text-red-600 hover:bg-gray-100 dark:hover:bg-gray-700" title={t('records.delete')} aria-label={t('records.delete')}>
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </span>
      </div>
      {open && (
        <div className="px-3 pb-3 border-t border-gray-100 dark:border-gray-700 pt-2 overflow-x-auto">
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">{t('records.pickHint')}</p>
          <JsonTree value={record.data} onPick={(path, value) => { setMessage(null); setPick({ path, value }); }} />
          {pick && <AddValueForm key={pick.path} pick={pick} types={types} busy={busy} onCancel={() => setPick(null)} onAdd={add} />}
        </div>
      )}
      {message && <p className={`px-3 pb-2 text-xs ${message.ok ? 'text-green-700 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>{message.text}</p>}
    </div>
  );
};

const PersonRecordsPanel = ({ personId, onOsintAdded, onCount }) => {
  const { t } = useTranslation();
  const [state, setState] = useState({ personId: null, records: [], total: 0, error: null });
  const [filter, setFilter] = useState('');
  const osintTypes = useModelOptions('osint_data_type', OSINT_DATA_TYPES);
  const types = useMemo(() => translateOptions(t, 'osint_data_type', osintTypes), [t, osintTypes]);

  const reportCount = useEffectEvent((count) => onCount?.(count));
  useEffect(() => {
    let cancelled = false;
    osintRecordsAPI.list({ person_id: personId, limit: LIMIT })
      .then((res) => {
        if (cancelled) return;
        setState({ personId, records: res.data || [], total: res.meta?.total ?? 0, error: null });
        reportCount(res.meta?.total ?? 0);
      })
      .catch((err) => { if (!cancelled) setState({ personId, records: [], total: 0, error: err.message }); });
    return () => { cancelled = true; };
  }, [personId]);

  const loading = state.personId !== personId;
  const needle = filter.trim().toLowerCase();
  const shown = needle
    ? state.records.filter((r) => `${JSON.stringify(r.data)} ${r.record_source || ''} ${r.query || ''} ${r.tool_name || ''}`.toLowerCase().includes(needle))
    : state.records;

  const removed = (id) => {
    setState((s) => ({ ...s, records: s.records.filter((r) => r.id !== id), total: s.total - 1 }));
    onCount?.(state.total - 1);
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2"><Database className="w-5 h-5" />{t('records.title')}</h3>
        {state.records.length > 0 && (
          <div className="relative ms-auto w-full sm:w-72">
            <Search className="w-4 h-4 absolute top-2.5 start-2.5 text-gray-400" />
            <input
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder={t('records.filter')}
              aria-label={t('records.filter')}
              className="w-full ps-8 pe-2 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800"
            />
          </div>
        )}
      </div>
      <p className="text-sm text-gray-600 dark:text-gray-400">{t('records.help')}</p>
      {loading && <p className="text-sm text-gray-500 flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" />{t('records.loading')}</p>}
      {!loading && state.error && <p className="text-sm text-red-600 dark:text-red-400">{state.error}</p>}
      {!loading && !state.error && state.records.length === 0 && <p className="text-sm text-gray-500 dark:text-gray-400">{t('records.empty')}</p>}
      {!loading && needle && shown.length === 0 && state.records.length > 0 && <p className="text-sm text-gray-500 dark:text-gray-400">{t('records.noMatch')}</p>}
      {shown.map((r) => (
        <RecordCard key={r.id} record={r} types={types} personId={personId} onDeleted={removed} onOsintAdded={onOsintAdded} />
      ))}
      {state.total > state.records.length && <p className="text-xs text-gray-500">{t('records.more', { count: state.records.length, total: state.total })}</p>}
    </div>
  );
};

export default PersonRecordsPanel;
