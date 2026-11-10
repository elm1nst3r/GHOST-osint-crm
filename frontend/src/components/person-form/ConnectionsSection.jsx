import { useImperativeHandle, useRef, useState, useEffect, useEffectEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Trash2, Globe2, Pencil, CornerUpLeft } from 'lucide-react';
import { peopleAPI } from '../../utils/api';
import { reverseConnectionType } from '../../utils/connectionTypes';

const nameOf = (p) => [p.first_name, p.patronymic, p.last_name].filter(Boolean).join(' ');

// `incoming`: connections other people made to this person (the API's
// incoming_connections, #112). They belong to those people, so they're shown
// here read-only, with "Link back" to add this person's own connection.
// `ref.withPending(list)`: the list with whatever is still in the add/edit
// row applied, so Save doesn't silently drop a picked person (#112).
const ConnectionsSection = ({
  ref, connections, incoming = [], connectionTypes, people, currentPersonId, currentPersonProjectId,
  allowCrossLinking = false, otherProjects = [], onChange,
}) => {
  const { t } = useTranslation();
  const defaultType = connectionTypes[0]?.value || 'associate';
  const emptyDraft = () => ({ person_id: '', type: defaultType, note: '', two_way: false });
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
      .filter(id => id != null && !people.some(p => p.id === id) && !peopleCache[id] && !incoming.some(c => c.person_id === id));
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

  // People who link to this person come with their names (incoming).
  const fromIncoming = (id) => {
    const c = incoming.find(x => x.person_id === id);
    return c ? { id: c.person_id, first_name: c.first_name, patronymic: c.patronymic, last_name: c.last_name, project_id: c.project_id } : null;
  };
  const resolvePerson = (id) => people.find(p => p.id === id) || peopleCache[id] || fromIncoming(id);
  const linksBack = (id) => incoming.some(c => c.person_id === Number(id));
  const pickPool = crossMode ? otherPeople : people;

  const reset = () => { setDraft(emptyDraft()); setEditing(null); };

  // The draft as a connection, or null when no person is picked.
  const entryFromDraft = () => {
    const personId = parseInt(draft.person_id, 10);
    if (!personId) return null;
    const entry = { person_id: personId, type: draft.type, note: draft.note };
    // Two-way: the server also adds the connection back on the other person.
    if (draft.two_way && !linksBack(personId)) entry.two_way = true;
    return entry;
  };
  const applyDraft = (list, entry) => (editing === null
    ? [...list, entry]
    : list.map((c, i) => (i === editing ? { ...c, ...entry, ...(entry.two_way ? {} : { two_way: undefined }) } : c)));

  useImperativeHandle(ref, () => ({
    withPending: (list) => {
      const entry = entryFromDraft();
      return entry ? applyDraft(list, entry) : list;
    },
  }));

  const submit = () => {
    const entry = entryFromDraft();
    if (!entry) return;
    onChange(applyDraft(connections, entry));
    // Picked person isn't necessarily in `people` (active project's list) --
    // cache it immediately so it renders correctly below without waiting on
    // the resolve effect's round trip.
    const picked = pickPool.find(p => p.id === entry.person_id);
    if (picked) setPeopleCache(prev => ({ ...prev, [entry.person_id]: picked }));
    reset();
  };

  const focusForm = () => {
    firstField.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    firstField.current?.focus({ preventScroll: true });
  };

  const startEdit = (i) => {
    const conn = connections[i];
    setEditing(i);
    setDraft({ person_id: String(conn.person_id ?? ''), type: conn.type || defaultType, note: conn.note || '', two_way: Boolean(conn.two_way) });
    focusForm();
  };

  // "Link back": this person's own connection to someone who links to them,
  // with the type read from this side (employer ↔ employee).
  const linkBack = (c) => {
    setEditing(null);
    setDraft({ person_id: String(c.person_id), type: reverseConnectionType(c.type), note: '', two_way: false });
    focusForm();
  };

  const remove = (i) => {
    onChange(connections.filter((_, idx) => idx !== i));
    if (editing === i) reset();
    else if (editing !== null && i < editing) setEditing(editing - 1);
  };

  // The picked person stays a choice even when they are not in the list being
  // picked from (another project, or someone linking back), and so does a
  // connection type no longer in the Data Model.
  const draftPerson = draft.person_id ? resolvePerson(parseInt(draft.person_id, 10)) : null;
  const choices = pickPool.filter(p => !currentPersonId || p.id !== currentPersonId);
  if (draftPerson && !choices.some(p => p.id === draftPerson.id)) choices.unshift(draftPerson);
  const types = connectionTypes.some(ct => ct.value === draft.type)
    ? connectionTypes : [...connectionTypes, { value: draft.type, label: draft.type }];
  const typeLabel = (type) => connectionTypes.find(ct => ct.value === type)?.label || type;
  const inputClass = 'px-3 py-2 border rounded-md focus:outline-hidden focus:ring-2 focus:ring-blue-500 dark:bg-slate-700 dark:text-gray-100 dark:border-gray-600';
  const incomingOnly = incoming.filter(c => !connections.some(x => x.person_id === c.person_id));
  const draftLinksBack = draft.person_id && linksBack(draft.person_id);
  const badge = (tone, text) => (
    <span className={`ms-2 text-xs px-1.5 py-0.5 rounded-sm ${tone === 'green'
      ? 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300'
      : tone === 'blue' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300'
        : 'bg-gray-100 text-gray-600 dark:bg-slate-700 dark:text-slate-300'}`}>{text}</span>
  );

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
              disabled={crossMode && !otherProjectId && editing === null && !draftPerson}
              aria-label={t('personForm.connections.selectPerson')}
              className={`flex-1 ${inputClass} disabled:opacity-50`}
            >
              <option value="">{t('personForm.connections.selectPerson')}</option>
              {choices.map(p => (
                <option key={p.id} value={p.id}>{nameOf(p)}</option>
              ))}
            </select>
            <select value={draft.type} onChange={e => setDraft({ ...draft, type: e.target.value })} aria-label={t('personForm.connections.typeLabel')} className={inputClass}>
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
          {draftPerson && (
            <label className="flex items-start gap-2 text-sm text-gray-700 dark:text-gray-300">
              <input
                type="checkbox"
                checked={Boolean(draftLinksBack || draft.two_way)}
                disabled={Boolean(draftLinksBack)}
                onChange={e => setDraft({ ...draft, two_way: e.target.checked })}
                className="mt-0.5 h-4 w-4 rounded-sm border-gray-300 text-blue-600 disabled:opacity-60"
              />
              <span>
                {draftLinksBack
                  ? t('personForm.connections.alreadyTwoWay', { name: nameOf(draftPerson) })
                  : t('personForm.connections.twoWay', { name: nameOf(draftPerson), type: typeLabel(reverseConnectionType(draft.type)) })}
              </span>
            </label>
          )}
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={submit} className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700">
              {editing === null ? t('personForm.connections.addConnection') : t('personForm.connections.updateConnection')}
            </button>
            {(editing !== null || draft.person_id) && (
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
                <span className="font-medium"><bdi>{person ? nameOf(person) : t('personForm.connections.unknownPerson')}</bdi></span>
                <span className="text-sm text-gray-600 dark:text-gray-400 ms-2">({typeLabel(conn.type)})</span>
                {linksBack(conn.person_id)
                  ? badge('green', t('personForm.connections.badgeTwoWay'))
                  : conn.two_way ? badge('blue', t('personForm.connections.badgeTwoWayOnSave')) : badge('gray', t('personForm.connections.badgeOneWay'))}
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
            {incomingOnly.map((c, i) => {
              const otherProject = currentPersonProjectId != null && c.project_id != null && c.project_id !== currentPersonProjectId;
              const blocked = otherProject && !allowCrossLinking;
              return (
                <div key={`${c.person_id}-${i}`} className="flex items-center justify-between gap-x-3 p-3 border border-dashed border-gray-300 dark:border-gray-600 rounded-lg">
                  <div className="min-w-0">
                    <span className="font-medium"><bdi>{nameOf(c) || t('personForm.connections.unknownPerson')}</bdi></span>
                    <span className="text-sm text-gray-600 dark:text-gray-400 ms-2">({typeLabel(c.type)})</span>
                    {badge('gray', t('personForm.connections.badgeIncoming'))}
                    {c.note && <p className="text-sm text-gray-600 dark:text-gray-400">{c.note}</p>}
                  </div>
                  <button
                    type="button"
                    onClick={() => linkBack(c)}
                    disabled={blocked}
                    title={blocked ? t('personForm.connections.linkBackBlocked') : undefined}
                    className="shrink-0 text-sm text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 disabled:opacity-50 disabled:no-underline"
                  >
                    <CornerUpLeft className="w-4 h-4" />{t('personForm.connections.linkBack')}
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
