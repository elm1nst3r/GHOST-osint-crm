import React, { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, ChevronDown, ChevronRight } from 'lucide-react';
import { modelOptionsAPI } from '../../utils/api';
import CustomFieldManager from '../CustomFieldManager';
import { useData } from '../../contexts/DataContext';

const MODEL_TYPE_LABELS = {
  person_category: 'Person Categories',
  person_status: 'Person Statuses',
  crm_status: 'CRM Statuses',
  task_status: 'Task Statuses',
  connection_type: 'Connection Types',
  location_type: 'Location Types',
  osint_data_type: 'OSINT Data Types',
};

const EMPTY_FORM = { option_value: '', option_label: '', display_order: 999, is_active: true };

const DataModelTab = () => {
  const { customFields, fetchCustomFields } = useData();
  const [modelOptions, setModelOptions] = useState([]);
  const [showAddOptionForm, setShowAddOptionForm] = useState(false);
  const [editingOption, setEditingOption] = useState(null);
  const [selectedModelType, setSelectedModelType] = useState('person_category');
  const [optionForm, setOptionForm] = useState(EMPTY_FORM);
  const [expandedGroups, setExpandedGroups] = useState({});

  useEffect(() => {
    fetchModelOptions();
  }, []);

  const fetchModelOptions = async () => {
    try {
      const data = await modelOptionsAPI.getAll();
      setModelOptions(data);
      const groups = {};
      [...new Set(data.map(opt => opt.model_type))].forEach(t => { groups[t] = false; });
      setExpandedGroups(groups);
    } catch (err) {
      console.error('Error fetching model options:', err);
    }
  };

  const toggleGroup = (modelType) => setExpandedGroups(prev => ({ ...prev, [modelType]: !prev[modelType] }));

  const handleAddOption = async () => {
    if (!optionForm.option_value || !optionForm.option_label) {
      alert('Please fill in both value and label fields');
      return;
    }
    try {
      await modelOptionsAPI.create({ model_type: selectedModelType, ...optionForm });
      fetchModelOptions();
      setShowAddOptionForm(false);
      setOptionForm(EMPTY_FORM);
    } catch (err) {
      alert('Failed to add option: ' + err.message);
    }
  };

  const handleUpdateOption = async () => {
    if (!editingOption) return;
    try {
      await modelOptionsAPI.update(editingOption.id, {
        option_label: optionForm.option_label,
        display_order: optionForm.display_order,
        is_active: optionForm.is_active,
      });
      fetchModelOptions();
      setEditingOption(null);
      setOptionForm(EMPTY_FORM);
    } catch (err) {
      alert('Failed to update option');
    }
  };

  const handleDeleteOption = async (id) => {
    if (!window.confirm('Delete this option? This cannot be undone.')) return;
    try {
      await modelOptionsAPI.delete(id);
      fetchModelOptions();
    } catch (err) {
      alert('Failed to delete option');
    }
  };

  return (
    <div className="space-y-6">
      <CustomFieldManager customFields={customFields} fetchCustomFields={fetchCustomFields} />

      <div className="pt-6 border-t">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold">Predefined Options</h3>
          <button onClick={() => setShowAddOptionForm(!showAddOptionForm)} className="px-3 py-1 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 flex items-center">
            <Plus className="w-4 h-4 mr-1" />Add Option
          </button>
        </div>

        {showAddOptionForm && (
          <div className="mb-6 p-4 bg-gray-50 dark:bg-slate-900 rounded-lg">
            <h4 className="font-medium mb-3">Add New Option</h4>
            <div className="grid grid-cols-2 gap-3 mb-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Category</label>
                <select value={selectedModelType} onChange={(e) => setSelectedModelType(e.target.value)} className="w-full px-3 py-2 border rounded-md text-sm">
                  {Object.entries(MODEL_TYPE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Display Order</label>
                <input type="number" value={optionForm.display_order} onChange={(e) => setOptionForm({ ...optionForm, display_order: parseInt(e.target.value) || 999 })} className="w-full px-3 py-2 border rounded-md text-sm" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 mb-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Internal Value *</label>
                <input type="text" value={optionForm.option_value} onChange={(e) => setOptionForm({ ...optionForm, option_value: e.target.value })} className="w-full px-3 py-2 border rounded-md text-sm" placeholder="e.g., in_progress" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Display Label *</label>
                <input type="text" value={optionForm.option_label} onChange={(e) => setOptionForm({ ...optionForm, option_label: e.target.value })} className="w-full px-3 py-2 border rounded-md text-sm" placeholder="e.g., In Progress" />
              </div>
            </div>
            <div className="flex items-center mb-3">
              <input type="checkbox" id="new_is_active" checked={optionForm.is_active} onChange={(e) => setOptionForm({ ...optionForm, is_active: e.target.checked })} className="h-4 w-4 text-blue-600 rounded" />
              <label htmlFor="new_is_active" className="ml-2 text-sm text-gray-700 dark:text-gray-300">Active (show this option in forms)</label>
            </div>
            <div className="flex justify-end space-x-2">
              <button onClick={() => { setShowAddOptionForm(false); setOptionForm(EMPTY_FORM); }} className="px-3 py-1 text-gray-700 dark:text-slate-300 bg-gray-200 dark:bg-slate-600 text-sm rounded-md hover:bg-gray-300">Cancel</button>
              <button onClick={handleAddOption} className="px-3 py-1 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700">Add Option</button>
            </div>
          </div>
        )}

        {Object.entries(MODEL_TYPE_LABELS).map(([modelType, label]) => {
          const typeOptions = modelOptions.filter(opt => opt.model_type === modelType);
          return (
            <div key={modelType} className="mb-4 border rounded-lg">
              <button onClick={() => toggleGroup(modelType)} className="w-full px-4 py-3 bg-gray-50 dark:bg-slate-900 hover:bg-gray-100 rounded-t-lg flex items-center justify-between transition-colors">
                <div className="flex items-center space-x-2">
                  {expandedGroups[modelType] ? <ChevronDown className="w-4 h-4 text-gray-500 dark:text-slate-400" /> : <ChevronRight className="w-4 h-4 text-gray-500 dark:text-slate-400" />}
                  <h4 className="font-medium text-gray-700 dark:text-gray-300">{label}</h4>
                  <span className="text-sm text-gray-500 dark:text-gray-400">({typeOptions.length} options)</span>
                </div>
              </button>
              {expandedGroups[modelType] && (
                <div className="p-4 space-y-2 bg-white dark:bg-slate-800 rounded-b-lg">
                  {typeOptions.length === 0 ? (
                    <p className="text-sm text-gray-500 dark:text-slate-400 text-center py-4">No options defined yet</p>
                  ) : (
                    typeOptions.sort((a, b) => a.display_order - b.display_order).map(option => (
                      <div key={option.id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-slate-900 rounded-lg">
                        <div className="flex items-center space-x-3">
                          <span className="text-sm text-gray-500 dark:text-gray-400">#{option.display_order}</span>
                          <div>
                            <div className="font-medium">{option.option_label}</div>
                            <div className="text-sm text-gray-600 dark:text-gray-400">Value: {option.option_value}</div>
                          </div>
                        </div>
                        <div className="flex items-center space-x-2">
                          <span className={`px-2 py-1 text-xs rounded ${option.is_active ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-400' : 'bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-slate-400'}`}>
                            {option.is_active ? 'Active' : 'Inactive'}
                          </span>
                          <button onClick={() => { setEditingOption(option); setOptionForm({ option_value: option.option_value, option_label: option.option_label, display_order: option.display_order, is_active: option.is_active }); }} className="text-gray-600 dark:text-slate-400 hover:text-gray-700" title="Edit"><Edit2 className="w-4 h-4" /></button>
                          <button onClick={() => handleDeleteOption(option.id)} className="text-red-600 hover:text-red-700" title="Delete"><Trash2 className="w-4 h-4" /></button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Edit Option Modal */}
      {editingOption && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl p-6 w-96">
            <h3 className="text-lg font-semibold mb-4">Edit Option</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Internal Value</label>
                <input type="text" value={optionForm.option_value} disabled className="w-full px-3 py-2 border rounded-md text-sm bg-gray-100 dark:bg-slate-700" />
                <p className="text-xs text-gray-500 dark:text-slate-400 mt-1">Internal value cannot be changed</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Display Label</label>
                <input type="text" value={optionForm.option_label} onChange={(e) => setOptionForm({ ...optionForm, option_label: e.target.value })} className="w-full px-3 py-2 border rounded-md text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Display Order</label>
                <input type="number" value={optionForm.display_order} onChange={(e) => setOptionForm({ ...optionForm, display_order: parseInt(e.target.value) || 999 })} className="w-full px-3 py-2 border rounded-md text-sm" />
              </div>
              <div className="flex items-center">
                <input type="checkbox" id="edit_is_active" checked={optionForm.is_active} onChange={(e) => setOptionForm({ ...optionForm, is_active: e.target.checked })} className="h-4 w-4 text-blue-600 rounded" />
                <label htmlFor="edit_is_active" className="ml-2 text-sm text-gray-700 dark:text-gray-300">Active</label>
              </div>
            </div>
            <div className="flex justify-end space-x-2 mt-6">
              <button onClick={() => { setEditingOption(null); setOptionForm(EMPTY_FORM); }} className="px-4 py-2 text-gray-700 dark:text-slate-300 bg-gray-100 dark:bg-slate-700 rounded-md hover:bg-gray-200">Cancel</button>
              <button onClick={handleUpdateOption} className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700">Update</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DataModelTab;
