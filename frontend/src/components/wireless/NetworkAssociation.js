import React, { useState } from 'react';
import { User, Save, X } from 'lucide-react';

const inputClass = 'w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-gray-100';

const NetworkAssociation = ({ network, people, saving, onSave, onRemove }) => {
  const [associating, setAssociating] = useState(false);
  const [associationData, setAssociationData] = useState({
    person_id: network.person_id || '',
    association_note: network.association_note || '',
    association_confidence: network.association_confidence || 'possible',
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setAssociationData(prev => ({ ...prev, [name]: value }));
  };

  const handleSave = async () => {
    if (!associationData.person_id) return;
    await onSave(associationData);
    setAssociating(false);
  };

  const personName = (id) => {
    const p = people.find(p => p.id === id);
    return p ? `${p.first_name} ${p.last_name}` : 'Unknown';
  };

  return (
    <div className="pt-6 border-t border-gray-200 dark:border-gray-700">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Person Association</h3>
        {!associating && !network.person_id && (
          <button
            onClick={() => setAssociating(true)}
            className="flex items-center space-x-2 px-3 py-1.5 text-sm font-medium text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
          >
            <User className="w-4 h-4" /><span>Associate Person</span>
          </button>
        )}
      </div>

      {network.person_id && !associating ? (
        <div className="p-4 bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <p className="text-sm font-medium text-purple-900 dark:text-purple-200">{personName(network.person_id)}</p>
              {network.association_confidence && (
                <p className="text-xs text-purple-700 dark:text-purple-300 mt-1 capitalize">{network.association_confidence} confidence</p>
              )}
              {network.association_note && (
                <p className="text-sm text-purple-800 dark:text-purple-200 mt-2 italic">"{network.association_note}"</p>
              )}
            </div>
            <button
              onClick={onRemove}
              disabled={saving}
              className="ml-3 p-1.5 text-purple-600 dark:text-purple-400 hover:bg-purple-100 dark:hover:bg-purple-900/30 rounded transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      ) : associating ? (
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Select Person</label>
            <select name="person_id" value={associationData.person_id} onChange={handleChange} className={inputClass}>
              <option value="">-- Select Person --</option>
              {people.map(p => <option key={p.id} value={p.id}>{p.first_name} {p.last_name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Confidence Level</label>
            <select name="association_confidence" value={associationData.association_confidence} onChange={handleChange} className={inputClass}>
              <option value="investigating">Investigating</option>
              <option value="possible">Possible</option>
              <option value="probable">Probable</option>
              <option value="confirmed">Confirmed</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Association Note</label>
            <textarea name="association_note" value={associationData.association_note} onChange={handleChange} rows={3} placeholder="Why this network is associated with this person..." className={inputClass} />
          </div>
          <div className="flex items-center justify-end space-x-3 pt-4">
            <button onClick={() => setAssociating(false)} disabled={saving} className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg transition-colors">
              Cancel
            </button>
            <button onClick={handleSave} disabled={saving || !associationData.person_id} className="flex items-center space-x-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-all disabled:opacity-50">
              <Save className="w-4 h-4" /><span>{saving ? 'Saving...' : 'Save Association'}</span>
            </button>
          </div>
        </div>
      ) : (
        <p className="text-sm text-gray-600 dark:text-gray-400">No person associated with this network</p>
      )}
    </div>
  );
};

export default NetworkAssociation;
