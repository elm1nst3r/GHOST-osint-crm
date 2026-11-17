// Advanced Search → Saved records (issue #120): search the records saved from
// integrated tools on every person, across all the projects the user can see
// (or only the active one), and show the matching records themselves: which
// fields matched, whose record it is, in which project and case, and a way to
// open that person. Phone numbers match however they were written.
import { useState, useTransition } from 'react';
import { useTranslation } from 'react-i18next';
import { Search, Loader2, Folder, Briefcase, ChevronDown, ChevronRight, User, Database } from 'lucide-react';
import { osintRecordsAPI, peopleAPI } from '../../utils/api';
import { useProject } from '../../contexts/ProjectContext';
import { formatPersonName } from '../../utils/personName';
import { formatDateTime } from '../../utils/format';
import { matchedFields, highlightParts, searchRegExp } from '../../utils/recordMatch';
import JsonTree from '../records/JsonTree';
import SearchHeader from './SearchHeader';

const PAGE = 50;
const MAX_FIELDS = 6;

const Highlight = ({ text, query }) => (
  <bdi dir="auto" className="break-all">
    {highlightParts(text, query).map((p, i) => (p.hit
      ? <mark key={i} className="bg-yellow-200 dark:bg-yellow-500/30 text-gray-900 dark:text-yellow-100 rounded-xs px-0.5">{p.text}</mark>
      : <span key={i}>{p.text}</span>))}
  </bdi>
);

const RecordResult = ({ record, query, onOpenPerson, opening }) => {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const fields = matchedFields(record.data, query);
  const re = searchRegExp(query);
  const hitIn = (s) => { if (!re || !s) return false; re.lastIndex = 0; return re.test(s); };
  const person = formatPersonName({
    first_name: record.person_first_name, patronymic: record.person_patronymic, last_name: record.person_last_name,
  }, t('recordSearch.unnamed'));

  return (
    <li className="rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800">
      <div className="px-4 py-3 space-y-2">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <button
            type="button"
            onClick={() => onOpenPerson(record.person_id)}
            disabled={opening}
            className="inline-flex items-center gap-x-1.5 font-semibold text-accent-ink hover:underline disabled:opacity-60"
            title={t('recordSearch.openPerson')}
          >
            {opening ? <Loader2 className="w-4 h-4 animate-spin" /> : <User className="w-4 h-4" />}
            <bdi>{person}</bdi>
          </button>
          <span className="inline-flex items-center gap-x-1 text-xs text-gray-600 dark:text-slate-400">
            <Folder className="w-3.5 h-3.5" /><bdi>{record.project_name}</bdi>
          </span>
          {record.case_name && (
            <span className="inline-flex items-center gap-x-1 text-xs text-gray-600 dark:text-slate-400">
              <Briefcase className="w-3.5 h-3.5" /><bdi>{record.case_name}</bdi>
            </span>
          )}
        </div>
        <p className="text-xs text-gray-500 dark:text-slate-400">
          {record.record_source && <><bdi dir="auto" className="font-medium text-gray-700 dark:text-slate-300">{record.record_source}</bdi> · </>}
          {t('records.provenance', { tool: record.tool_name || record.integration_id || t('records.import'), date: formatDateTime(record.retrieved_at) })}
          {record.query ? <> · {t('records.searchedFor')} <Highlight text={record.query} query={query} /></> : null}
        </p>
        {fields.length > 0 ? (
          <dl className="grid grid-cols-1 sm:grid-cols-[minmax(0,14rem)_1fr] gap-x-4 gap-y-1 text-sm">
            {fields.slice(0, MAX_FIELDS).map((f) => (
              <div key={f.path} className="contents">
                <dt className="font-mono text-xs text-gray-500 dark:text-slate-400 truncate pt-0.5" dir="ltr" title={f.path}>{f.path}</dt>
                <dd className="text-gray-900 dark:text-slate-100 min-w-0"><Highlight text={f.value} query={query} /></dd>
              </div>
            ))}
          </dl>
        ) : (
          <p className="text-xs text-gray-500 dark:text-slate-400 italic">
            {hitIn(record.record_source) ? t('recordSearch.matchedSource') : hitIn(record.query) ? t('recordSearch.matchedQuery') : t('recordSearch.matchedElsewhere')}
          </p>
        )}
        {fields.length > MAX_FIELDS && <p className="text-xs text-gray-500 dark:text-slate-400">{t('recordSearch.moreFields', { count: fields.length - MAX_FIELDS })}</p>}
        <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} className="inline-flex items-center gap-x-1 text-xs font-medium text-gray-600 dark:text-slate-300 hover:text-gray-900 dark:hover:text-slate-100">
          {open ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5 rtl:-scale-x-100" />}
          {open ? t('recordSearch.hideRecord') : t('recordSearch.showRecord')}
        </button>
      </div>
      {open && (
        <div className="px-4 pb-3 pt-2 border-t border-gray-100 dark:border-slate-700 overflow-x-auto">
          <JsonTree value={record.data} />
        </div>
      )}
    </li>
  );
};

const RecordSearch = ({ mode, onModeChange, onClose, onSelectPerson }) => {
  const { t } = useTranslation();
  const { activeProjectId } = useProject();
  const [text, setText] = useState('');
  const [scope, setScope] = useState('all');
  // What the shown results were searched for (the box may have changed since).
  const [result, setResult] = useState(null); // { query, scope, records, total }
  const [error, setError] = useState(null);
  const [openingId, setOpeningId] = useState(null);
  const [searching, startSearch] = useTransition();

  const load = (query, where, offset) => startSearch(async () => {
    try {
      const res = await osintRecordsAPI.list({
        q: query, limit: PAGE, offset,
        ...(where === 'project' && activeProjectId ? { project_id: activeProjectId } : {}),
      });
      setError(null);
      setResult((prev) => ({
        query, scope: where,
        records: offset && prev ? [...prev.records, ...(res.data || [])] : (res.data || []),
        total: res.meta?.total ?? 0,
      }));
    } catch (err) {
      setError(err.message);
    }
  });

  const submit = (e) => {
    e.preventDefault();
    const query = text.trim();
    if (query) load(query, scope, 0);
  };

  const openPerson = (id) => {
    setOpeningId(id);
    peopleAPI.getById(id)
      .then((person) => { setOpeningId(null); onSelectPerson(person); })
      .catch((err) => { setOpeningId(null); setError(err.message); });
  };

  return (
    <div className="w-full flex flex-col min-h-0 md:h-[85vh]">
      <SearchHeader mode={mode} onModeChange={onModeChange} onClose={onClose} />
      <form onSubmit={submit} className="px-6 py-4 border-b border-gray-200 dark:border-slate-700 space-y-2">
        <div className="flex flex-wrap gap-2">
          <div className="relative grow min-w-60">
            <Search className="w-4 h-4 absolute top-3 start-3 text-gray-400" />
            <input
              autoFocus
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={t('recordSearch.placeholder')}
              aria-label={t('recordSearch.placeholder')}
              className="w-full ps-9 pe-3 py-2 rounded-md border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100"
            />
          </div>
          <select
            value={scope}
            onChange={(e) => setScope(e.target.value)}
            aria-label={t('recordSearch.scopeLabel')}
            className="px-3 py-2 rounded-md border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100 text-sm"
          >
            <option value="all">{t('recordSearch.scopeAll')}</option>
            {activeProjectId && <option value="project">{t('recordSearch.scopeProject')}</option>}
          </select>
          <button type="submit" disabled={searching || !text.trim()} className="inline-flex items-center gap-x-1.5 px-4 py-2 rounded-md bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50">
            {searching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            {t('recordSearch.search')}
          </button>
        </div>
        <p className="text-xs text-gray-500 dark:text-slate-400">{t('recordSearch.help')}</p>
      </form>

      <div className="flex-1 overflow-y-auto px-6 py-4 bg-gray-50 dark:bg-slate-900">
        {error && <p className="text-sm text-red-600 dark:text-red-400 mb-3">{error}</p>}
        {!result && !error && (
          <div className="h-full flex flex-col items-center justify-center text-center text-gray-500 dark:text-slate-400 gap-2 py-12">
            <Database className="w-8 h-8" />
            <p className="text-sm max-w-md">{t('recordSearch.empty')}</p>
          </div>
        )}
        {result && (
          <>
            <p className="text-sm text-gray-700 dark:text-slate-300 mb-3" aria-live="polite">
              {t('recordSearch.found', { count: result.total, query: result.query })}
            </p>
            <ul className="space-y-3">
              {result.records.map((r) => (
                <RecordResult key={r.id} record={r} query={result.query} onOpenPerson={openPerson} opening={openingId === r.person_id} />
              ))}
            </ul>
            {result.records.length < result.total && (
              <div className="mt-4 text-center">
                <button
                  type="button"
                  onClick={() => load(result.query, result.scope, result.records.length)}
                  disabled={searching}
                  className="px-4 py-2 rounded-md text-sm bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-600 text-gray-700 dark:text-slate-200 hover:bg-gray-100 dark:hover:bg-slate-700 disabled:opacity-50"
                >
                  {t('recordSearch.loadMore', { shown: result.records.length, total: result.total })}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default RecordSearch;
