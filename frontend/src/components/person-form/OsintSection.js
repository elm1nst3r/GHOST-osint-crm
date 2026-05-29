import React, { useState } from 'react';
import { Trash2 } from 'lucide-react';

const OsintSection = ({ osintData, osintDataTypes, onChange }) => {
  const [newItem, setNewItem] = useState({ type: osintDataTypes[0]?.value || 'Email', value: '', notes: '' });

  const add = () => {
    if (!newItem.value.trim()) return;
    onChange([...osintData, { ...newItem }]);
    setNewItem({ type: osintDataTypes[0]?.value || 'Email', value: '', notes: '' });
  };

  const remove = (i) => onChange(osintData.filter((_, idx) => idx !== i));

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">OSINT Data</label>

      <div className="space-y-2 mb-2">
        <div className="flex space-x-2">
          <select
            value={newItem.type}
            onChange={e => setNewItem({ ...newItem, type: e.target.value })}
            className="px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-slate-700 dark:text-gray-100 dark:border-gray-600"
          >
            {osintDataTypes.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
          <input
            type="text"
            value={newItem.value}
            onChange={e => setNewItem({ ...newItem, value: e.target.value })}
            placeholder="Value"
            className="flex-1 px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-slate-700 dark:text-gray-100 dark:border-gray-600"
          />
          <input
            type="text"
            value={newItem.notes}
            onChange={e => setNewItem({ ...newItem, notes: e.target.value })}
            placeholder="Notes (optional)"
            className="flex-1 px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-slate-700 dark:text-gray-100 dark:border-gray-600"
          />
          <button type="button" onClick={add} className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700">
            Add
          </button>
        </div>
      </div>

      <div className="space-y-2">
        {osintData.map((item, i) => (
          <div key={i} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-slate-900 rounded-lg">
            <div>
              <span className="font-medium">{item.type}:</span> {item.value}
              {item.notes && <span className="text-sm text-gray-600 dark:text-slate-400 ml-2">({item.notes})</span>}
            </div>
            <button type="button" onClick={() => remove(i)} className="text-red-600 hover:text-red-700">
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};

export default OsintSection;
