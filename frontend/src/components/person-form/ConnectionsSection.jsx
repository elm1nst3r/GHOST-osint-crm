import { useRef, useState, useEffect, useEffectEvent, useImperativeHandle } from 'react';
import { useTranslation } from 'react-i18next';
import { Trash2, Globe2, Pencil, ArrowLeftRight, ArrowRight, ArrowLeft, Plus } from 'lucide-react';
import { peopleAPI } from '../../utils/api';
import { connectionLinks, isTwoWayByDefault, reverseConnectionType } from '../../utils/personConnections';

const ConnectionsSection = ({
  connections, connectionTypes, people, currentPersonId, currentPersonProjectId,
  allowCrossLinking = false, otherProjects = [], onChange, ref,
}) => {
  const { t } = useTranslation();
  const defaultType = connectionTypes[0]?.value || 'associate';
  const emptyDraft = () => ({ person_id: '', type: defaultType, note: '', mutual: isTwoWayByDefault(defaultType) });
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
  const personName = (p) => (p ? `${p.first_name} ${p.last_name || ''}`.trim() : t('personForm.connections.unknownPerson'));
  const pickPool = crossMode ? otherPeople : people;

  const reset = () => { setDraft(emptyDraft()); setEditing(null); };

  // Who already links to this person (saved data), keyed by their id.
  const incomingById = new Map(
    (currentPersonId ? connectionLinks(currentPersonId, people, []) : [])
      .map(link => [link.personId, link.incoming])
  );
  // People linking here whom this person doesn't link back to (yet).
  const incomingOnly = [...incomingById.entries()]
    .filter(([id]) => !connections.some(c => c.person_id === id));
  const draftPersonId = parseInt(draft.person_id, 10) || null;
  const draftHasReverse = draftPersonId != null && incomingById.has(draftPersonId);

  const entryFromDraft = () => {
    const personId = parseInt(draft.person_id, 10);
    if (!personId) return null;
    const entry = { person_id: personId, type: draft.type, note: draft.note };
    // Asks the server to add the connection back on the other person too;
    // pointless (and ignored) when they already have one.
    if (draft.mutual && !incomingById.has(personId)) {
      entry.mutual = true;
      entry.reverse_type = reverseConnectionType(draft.type);
    }
    return entry;
  };
  // An edit replaces the two-way request too: unticking it must not leave
  // the old mutual/reverse_type behind on the entry.
  const mergeEntry = (list, entry) => (editing === null
    ? [...list, entry]
    : list.map((c, i) => {
        if (i !== editing) return c;
        const { mutual: _mutual, reverse_type: _reverseType, ...rest } = c;
        return { ...rest, ...entry };
      }));

  // A person picked but never added used to be dropped silently on Save; the
  // form asks for it here and keeps it.
  useImperativeHandle(ref, () => ({
    withPending: (list) => {
      const entry = entryFromDraft();
      return entry ? mergeEntry(list, entry) : list;
    },
  }));

  const submit = () => {
    const entry = entryFromDraft();
    if (!entry) return;
    const personId = entry.person_id;
    onChange(mergeEntry(connections, entry));
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
    setDraft({ person_id: String(conn.person_id ?? ''), type: conn.type || defaultType, note: conn.note || '', mutual: !!conn.mutual });
    firstField.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    firstField.current?.focus({ preventScroll: true });
  };

  const connectBack = (personId, incoming) => {
    onChange([...connections, { person_id: personId, type: reverseConnectionType(incoming.type || defaultType), note: '' }]);
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
            <select value={draft.type} onChange={e => setDraft({ ...draft, type: e.target.value, mutual: isTwoWayByDefault(e.target.value) })} className={inputClass}>
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
          {draftHasReverse ? (
            <p className="flex items-center gap-1.5 text-sm text-green-700 dark:text-green-400">
              <ArrowLeftRight className="w-4 h-4 shrink-0" />
              {t('personForm.connections.alreadyConnectedBack', { name: personName(resolvePerson(draftPersonId)) })}
            </p>
          ) : (
            <label className="flex items-start gap-2 text-sm text-gray-700 dark:text-gray-300 cursor-pointer">
              <input
                type="checkbox"
                checked={!!draft.mutual}
                onChange={e => setDraft({ ...draft, mutual: e.target.checked })}
                className="mt-0.5"
              />
              <span>
                {t('personForm.connections.twoWay')}
                <span className="block text-xs text-gray-500 dark:text-gray-400">
                  {draft.mutual
                    ? t('personForm.connections.twoWayHint', {
                        name: draftPersonId ? personName(resolvePerson(draftPersonId) || choices.find(p => p.id === draftPersonId)) : t('personForm.connections.theOtherPerson'),
                        type: types.find(ct => ct.value === reverseConnectionType(draft.type))?.label || reverseConnectionType(draft.type),
                      })
                    : t('personForm.connections.oneWayHint')}
                </span>
              </span>
            </label>
          )}
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
                {incomingById.has(conn.person_id) || conn.mutual ? (
                  <span
                    title={incomingById.has(conn.person_id) ? t('personForm.connections.twoWayTitle') : t('personForm.connections.twoWayOnSaveTitle')}
                    className="ms-2 inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded-full bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-400"
                  >
                    <ArrowLeftRight className="w-3 h-3" />{t('personForm.connections.twoWayBadge')}
                  </span>
                ) : (
                  <span
                    title={t('personForm.connections.oneWayTitle', { name: person ? personName(person) : '' })}
                    className="ms-2 inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded-full bg-gray-200 dark:bg-slate-700 text-gray-700 dark:text-gray-300"
                  >
                    <ArrowRight className="w-3 h-3" />{t('personForm.connections.oneWayBadge')}
                  </span>
                )}
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

      {incomingOnly.length > 0 && (
        <div className="mt-4">
          <p className="text-sm font-medium text-gray-700 dark:text-gray-300">{t('personForm.connections.incomingTitle')}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">{t('personForm.connections.incomingHint')}</p>
          <div className="space-y-2">
            {incomingOnly.map(([id, incoming]) => {
              const other = resolvePerson(id);
              return (
                <div key={id} className="flex items-center justify-between gap-x-3 p-3 rounded-lg border border-dashed border-gray-300 dark:border-gray-600">
                  <div className="min-w-0">
                    <span className="inline-flex items-center gap-1.5 font-medium">
                      <ArrowLeft className="w-4 h-4 text-gray-500 dark:text-gray-400 shrink-0" />
                      {personName(other)}
                    </span>
                    <span className="text-sm text-gray-600 dark:text-gray-400 ms-2">
                      ({connectionTypes.find(ct => ct.value === incoming.type)?.label || incoming.type})
                    </span>
                    {incoming.note && <p className="text-sm text-gray-600 dark:text-gray-400">{incoming.note}</p>}
                  </div>
                  <button
                    type="button"
                    onClick={() => connectBack(id, incoming)}
                    className="shrink-0 inline-flex items-center gap-1 px-3 py-1.5 text-sm rounded-md border border-blue-300 text-blue-700 hover:bg-blue-50 dark:border-blue-700 dark:text-blue-300 dark:hover:bg-blue-900/30"
                  >
                    <Plus className="w-4 h-4" />{t('personForm.connections.connectBack')}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default ConnectionsSection;
