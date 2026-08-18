import React, { useRef, useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Trash2, Globe2 } from 'lucide-react';
import { peopleAPI } from '../../utils/api';

const ConnectionsSection = ({
  connections, connectionTypes, people, currentPersonId, currentPersonProjectId,
  allowCrossLinking = false, otherProjects = [], onChange,
}) => {
  const { t } = useTranslation();
  const selectRef = useRef();
  const typeRef = useRef();
  const noteRef = useRef();
  // Cross-project picking (issue #83): a second project + person picker,
  // only offered when the subject's own project has allow_cross_linking on.
  const [crossMode, setCrossMode] = useState(false);
  const [otherProjectId, setOtherProjectId] = useState('');
  const [otherPeople, setOtherPeople] = useState([]);
  // Names for connections whose target isn't in the (active-project-scoped)
  // `people` list -- covers both a link just picked from another project and
  // a cross-project link that was already saved before this form opened.
  const [peopleCache, setPeopleCache] = useState({});

  useEffect(() => {
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connections, people]);

  useEffect(() => {
    if (!otherProjectId) { setOtherPeople([]); return; }
    peopleAPI.getAll({ project_id: otherProjectId, limit: 1000 })
      .then(({ data }) => setOtherPeople(data || []))
      .catch(() => setOtherPeople([]));
  }, [otherProjectId]);

  const resolvePerson = (id) => people.find(p => p.id === id) || peopleCache[id];
  const pickPool = crossMode ? otherPeople : people;

  const add = () => {
    const personId = parseInt(selectRef.current.value, 10);
    if (!personId) return;
    onChange([...connections, {
      person_id: personId,
      type: typeRef.current.value,
      note: noteRef.current.value,
    }]);
    // Picked person isn't necessarily in `people` (active project's list) --
    // cache it immediately so it renders correctly below without waiting on
    // the resolve effect's round trip.
    const picked = pickPool.find(p => p.id === personId);
    if (picked) setPeopleCache(prev => ({ ...prev, [personId]: picked }));
    selectRef.current.value = '';
    typeRef.current.value = connectionTypes[0]?.value || 'associate';
    noteRef.current.value = '';
  };

  const remove = (i) => onChange(connections.filter((_, idx) => idx !== i));

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
            className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-slate-700 dark:text-gray-100 dark:border-gray-600"
          >
            <option value="">{t('personForm.connections.chooseProject')}</option>
            {otherProjects.map(p => (
              <option key={p.id} value={p.id}>{p.icon ? `${p.icon} ` : ''}{p.name}</option>
            ))}
          </select>
        )}
        <div className="flex flex-wrap gap-2">
          <select
            ref={selectRef}
            disabled={crossMode && !otherProjectId}
            className="flex-1 px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-slate-700 dark:text-gray-100 dark:border-gray-600 disabled:opacity-50"
          >
            <option value="">{t('personForm.connections.selectPerson')}</option>
            {pickPool.filter(p => !currentPersonId || p.id !== currentPersonId).map(p => (
              <option key={p.id} value={p.id}>{p.first_name} {p.last_name || ''}</option>
            ))}
          </select>
          <select ref={typeRef} defaultValue={connectionTypes[0]?.value || 'associate'} className="px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-slate-700 dark:text-gray-100 dark:border-gray-600">
            {connectionTypes.map(ct => <option key={ct.value} value={ct.value}>{ct.label}</option>)}
          </select>
        </div>
        <input
          type="text"
          ref={noteRef}
          placeholder={t('personForm.connections.notesPlaceholder')}
          className="w-full px-3 py-2 border dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-slate-700 dark:text-gray-100"
        />
        <button type="button" onClick={add} className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700">
          {t('personForm.connections.addConnection')}
        </button>
      </div>

      <div className="space-y-2">
        {connections.map((conn, i) => {
          const person = resolvePerson(conn.person_id);
          const isOtherProject = person && currentPersonProjectId != null
            && person.project_id != null && person.project_id !== currentPersonProjectId;
          const otherProjectMeta = isOtherProject && otherProjects.find(p => p.id === person.project_id);
          return (
            <div key={i} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-slate-900 rounded-lg">
              <div>
                <span className="font-medium">
                  {person ? `${person.first_name} ${person.last_name || ''}` : t('personForm.connections.unknownPerson')}
                </span>
                <span className="text-sm text-gray-600 dark:text-gray-400 ml-2">
                  ({connectionTypes.find(ct => ct.value === conn.type)?.label || conn.type})
                </span>
                {isOtherProject && (
                  <span className="ml-2 text-xs px-1.5 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-400">
                    {t('personForm.connections.fromProject', { project: otherProjectMeta?.name || t('personDetailModal.otherProjectUnknown') })}
                  </span>
                )}
                {conn.note && <p className="text-sm text-gray-600 dark:text-gray-400">{conn.note}</p>}
              </div>
              <button type="button" onClick={() => remove(i)} className="text-red-600 hover:text-red-700">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default ConnectionsSection;
