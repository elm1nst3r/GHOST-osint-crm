import { useRef, useState, useEffect, useEffectEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Trash2, Globe2, Pencil } from 'lucide-react';
import { peopleAPI } from '../../utils/api';

const ConnectionsSection = ({
  connections, connectionTypes, people, currentPersonId, currentPersonProjectId,
  allowCrossLinking = false, otherProjects = [], onChange,
}) => {
  const { t } = useTranslation();
  const defaultType = connectionTypes[0]?.value || 'associate';
  const emptyDraft = () => ({ person_id: '', type: defaultType, note: '' });
  const [draft, setDraft] = useState(emptyDraft);
  // Index of the connection being edited in the form above the list (#109).
  const [editing, setEditing] = useState(null);
  const firstField = useRef(null);
  // Cross-project picking (issue #83): a second project + person picker,
  // only offered when the subject's own project has allow_cross_linking on.
  const [crossMode, setCrossMode] = useState(false);
  const [otherProjectId, setOtherProjectId] = useState('');
  const [otherPeople, setOtherPeople] = useState([]);
  // Names for connections whose target isn't in the (active-project-scoped)
  // `people` list -- covers both a link just picked from another project and
  // a cross-project link that was already saved before this form opened.
  const [peopleCache, setPeopleCache] = useState({});

  const onConnectionsPeopleChange = useEffectEvent(() => {
    const unresolved = [...new Set(connections.map(c => c.person_id))]
      .filter(id => id != null && !people.some(p => p.id === id) && !peopleCache[id]);
    if (unresolved.length === 0) return;
    let cancelled = false;
    Promise.all(unresolved.map(id => peopleAPI.getById(id).catch(() => null)))
      .then(results => {
        if (cancelled) return;
        setPeopleCache(prev => {
          const next = { ...prev };
          results.forEach(p => { if (p) next[p.id] = p; });
          return next;
        });
      });
    return () => { cancelled = true; };
  });
  useEffect(() => onConnectionsPeopleChange(), [connections, people]);

  useEffect(() => {
    if (!otherProjectId) { setOtherPeople([]); return; }
    peopleAPI.getAll({ project_id: otherProjectId, limit: 1000 })
      .then(({ data }) => setOtherPeople(data || []))
      .catch(() => setOtherPeople([]));
  }, [otherProjectId]);

  const resolvePerson = (id) => people.find(p => p.id === id) || peopleCache[id];
  const pickPool = crossMode ? otherPeople : people;

  const reset = () => { setDraft(emptyDraft()); setEditing(null); };

  const submit = () => {
    const personId = parseInt(draft.person_id, 10);
    if (!personId) return;
    const entry = { person_id: personId, type: draft.type, note: draft.note };
    if (editing === null) onChange([...connections, entry]);
    else onChange(connections.map((c, i) => (i === editing ? { ...c, ...entry } : c)));
    // Picked person isn't necessarily in `people` (active project's list) --
    // cache it immediately so it renders correctly below without waiting on
    // the resolve effect's round trip.
    const picked = pickPool.find(p => p.id === personId);
    if (picked) setPeopleCache(prev => ({ ...prev, [personId]: picked }));
    reset();
  };

  const startEdit = (i) => {
    const conn = connections[i];
    setEditing(i);
    setDraft({ person_id: String(conn.person_id ?? ''), type: conn.type || defaultType, note: conn.note || '' });
    firstField.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    firstField.current?.focus({ preventScroll: true });
  };

  const remove = (i) => {
    onChange(connections.filter((_, idx) => idx !== i));
    if (editing === i) reset();
    else if (editing !== null && i < editing) setEditing(editing - 1);
  };

  // While editing, the connected person stays a choice even when they are
  // not in the list being picked from (another project), and so does a
  // connection type no longer in the Data Model.
  const editedPerson = editing !== null ? resolvePerson(parseInt(draft.person_id, 10)) : null;
  const choices = pickPool.filter(p => !currentPersonId || p.id !== currentPersonId);
  if (editedPerson && !choices.some(p => p.id === editedPerson.id)) choices.unshift(editedPerson);
  const types = connectionTypes.some(ct => ct.value === draft.type)
    ? connectionTypes : [...connectionTypes, { value: draft.type, label: draft.type }];
  const inputClass = 'px-3 py-2 border rounded-md focus:outline-hidden focus:ring-2 focus:ring-blue-500 dark:bg-slate-700 dark:text-gray-100 dark:border-gray-600';

  return (
    <div>
      <div className="flex items-center justify-between mb-2 gap-2 flex-wrap">
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">{t('personForm.connections.label')}</label>
        {allowCrossLinking && otherProjects.length > 0 && (
          <button
            type="button"
            onClick={() => { setCrossMode(m => !m); setOtherProjectId(''); }}
            className={`text-xs flex items-center gap-1 px-2 py-1 rounded-md border transition-colors ${
              crossMode
                ? 'bg-blue-50 border-blue-300 text-blue-700 dark:bg-blue-900/30 dark:border-blue-700 dark:text-blue-300'
                : 'border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400'
            }`}
          >
            <Globe2 className="w-3.5 h-3.5" />
            {crossMode ? t('personForm.connections.linkThisProject') : t('personForm.connections.linkOtherProject')}
          </button>
        )}
      </div>

      <div className="space-y-2 mb-2">
        {crossMode && (
          <select
            value={otherProjectId}
            onChange={(e) => setOtherProjectId(e.target.value)}
            className="w-full px-3 py-2 border rounded-md focus:outline-hidden focus:ring-2 focus:ring-blue-500 dark:bg-slate-700 dark:text-gray-100 dark:border-gray-600"
          >
            <option value="">{t('personForm.connections.chooseProject')}</option>
            {otherProjects.map(p => (
              <option key={p.id} value={p.id}>{p.icon ? `${p.icon} ` : ''}{p.name}</option>
            ))}
          </select>
        )}
        <div className={`space-y-2 ${editing !== null ? 'p-2 rounded-lg ring-2 ring-blue-500' : ''}`}>
          <div className="flex flex-wrap gap-2">
            <select
              ref={firstField}
              value={draft.person_id}
              onChange={e => setDraft({ ...draft, person_id: e.target.value })}
              disabled={crossMode && !otherProjectId && editing === null}
              className={`flex-1 ${inputClass} disabled:opacity-50`}
            >
              <option value="">{t('personForm.connections.selectPerson')}</option>
              {choices.map(p => (
                <option key={p.id} value={p.id}>{p.first_name} {p.last_name || ''}</option>
              ))}
            </select>
            <select value={draft.type} onChange={e => setDraft({ ...draft, type: e.target.value })} className={inputClass}>
              {types.map(ct => <option key={ct.value} value={ct.value}>{ct.label}</option>)}
            </select>
          </div>
          <input
            type="text"
            value={draft.note}
            onChange={e => setDraft({ ...draft, note: e.target.value })}
            placeholder={t('personForm.connections.notesPlaceholder')}
            className={`w-full ${inputClass}`}
          />
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={submit} className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700">
              {editing === null ? t('personForm.connections.addConnection') : t('personForm.connections.updateConnection')}
            </button>
            {editing !== null && (
              <button type="button" onClick={reset} className="px-4 py-2 border dark:border-gray-600 rounded-md text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-800">
                {t('common.cancel')}
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="space-y-2">
        {connections.map((conn, i) => {
          const person = resolvePerson(conn.person_id);
          const isOtherProject = person && currentPersonProjectId != null
            && person.project_id != null && person.project_id !== currentPersonProjectId;
          const otherProjectMeta = isOtherProject && otherProjects.find(p => p.id === person.project_id);
          return (
            <div key={i} className={`flex items-center justify-between gap-x-3 p-3 bg-gray-50 dark:bg-slate-900 rounded-lg ${editing === i ? 'ring-1 ring-blue-500' : ''}`}>
              <div className="min-w-0">
                <span className="font-medium">
                  {person ? `${person.first_name} ${person.last_name || ''}` : t('personForm.connections.unknownPerson')}
                </span>
                <span className="text-sm text-gray-600 dark:text-gray-400 ms-2">
                  ({connectionTypes.find(ct => ct.value === conn.type)?.label || conn.type})
                </span>
                {isOtherProject && (
                  <span className="ms-2 text-xs px-1.5 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-400">
                    {t('personForm.connections.fromProject', { project: otherProjectMeta?.name || t('personDetailModal.otherProjectUnknown') })}
                  </span>
                )}
                {conn.note && <p className="text-sm text-gray-600 dark:text-gray-400">{conn.note}</p>}
              </div>
              <div className="flex items-center gap-x-3 shrink-0">
                <button type="button" onClick={() => startEdit(i)} title={t('common.edit')} aria-label={t('common.edit')} className="text-gray-500 hover:text-blue-600 dark:text-gray-400 dark:hover:text-blue-400">
                  <Pencil className="w-4 h-4" />
                </button>
                <button type="button" onClick={() => remove(i)} title={t('common.delete')} aria-label={t('common.delete')} className="text-red-600 hover:text-red-700">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default ConnectionsSection;
