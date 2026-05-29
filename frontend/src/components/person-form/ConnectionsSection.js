import React, { useRef } from 'react';
import { Trash2 } from 'lucide-react';

const ConnectionsSection = ({ connections, connectionTypes, people, currentPersonId, onChange }) => {
  const selectRef = useRef();
  const typeRef = useRef();
  const noteRef = useRef();

  const add = () => {
    const personId = parseInt(selectRef.current.value);
    if (!personId) return;
    onChange([...connections, {
      person_id: personId,
      type: typeRef.current.value,
      note: noteRef.current.value,
    }]);
    selectRef.current.value = '';
    typeRef.current.value = connectionTypes[0]?.value || 'associate';
    noteRef.current.value = '';
  };

  const remove = (i) => onChange(connections.filter((_, idx) => idx !== i));

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Connections</label>

      <div className="space-y-2 mb-2">
        <div className="flex space-x-2">
          <select ref={selectRef} className="flex-1 px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-slate-700 dark:text-gray-100 dark:border-gray-600">
            <option value="">Select a person</option>
            {people.filter(p => !currentPersonId || p.id !== currentPersonId).map(p => (
              <option key={p.id} value={p.id}>{p.first_name} {p.last_name || ''}</option>
            ))}
          </select>
          <select ref={typeRef} defaultValue={connectionTypes[0]?.value || 'associate'} className="px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-slate-700 dark:text-gray-100 dark:border-gray-600">
            {connectionTypes.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </div>
        <input
          type="text"
          ref={noteRef}
          placeholder="Connection notes (optional)"
          className="w-full px-3 py-2 border dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-slate-700 dark:text-gray-100"
        />
        <button type="button" onClick={add} className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700">
          Add Connection
        </button>
      </div>

      <div className="space-y-2">
        {connections.map((conn, i) => {
          const person = people.find(p => p.id === conn.person_id);
          return (
            <div key={i} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-slate-900 rounded-lg">
              <div>
                <span className="font-medium">
                  {person ? `${person.first_name} ${person.last_name || ''}` : 'Unknown'}
                </span>
                <span className="text-sm text-gray-600 dark:text-gray-400 ml-2">
                  ({connectionTypes.find(t => t.value === conn.type)?.label || conn.type})
                </span>
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
