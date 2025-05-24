// File: frontend/src/components/CustomFieldManager.js
import React, { useState } from 'react';
import { Plus, Edit2, Trash2, X } from 'lucide-react';
import { customFieldsAPI } from '../utils/api';
import { CUSTOM_FIELD_TYPES } from '../utils/constants';

const CustomFieldManager = ({ customFields, fetchCustomFields }) => {
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingField, setEditingField] = useState(null);
  const [formData, setFormData] = useState({
    field_name: '',
    field_label: '',
    field_type: 'text',
    options: [],
    is_active: true
  });
  const [newOption, setNewOption] = useState('');

  const resetForm = () => {
    setFormData({
      field_name: '',
      field_label: '',
      field_type: 'text',
      options: [],
      is_active: true
    });
    setNewOption('');
    setEditingField(null);
    setShowAddForm(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    try {
      if (editingField) {
        await customFieldsAPI.update(editingField.id, formData);
      } else {
        await customFieldsAPI.create(formData);
      }
      fetchCustomFields();
      resetForm();
    } catch (error) {
      console.error('Error saving custom field:', error);
      alert(error.message || 'Failed to save custom field');
    }
  };

  const handleEdit = (field) => {
    setEditingField(field);
    setFormData({
      field_name: field.field_name,
      field_label: field.field_label,
      field_type: field.field_type,
      options: field.options || [],
      is_active: field.is_active
    });
    setShowAddForm(true);
  };

  const handleDelete = async (id) => {
    if (window.confirm('Are you sure you want to delete this custom field? This will not delete existing data.')) {
      try {
        await customFieldsAPI.delete(id);
        fetchCustomFields();
      } catch (error) {
        console.error('Error deleting custom field:', error);
        alert('Failed to delete custom field');
      }
    }
  };

  const addOption = () => {
    if (newOption.trim() && !formData.options.includes(newOption.trim())) {
      setFormData({ ...formData, options: [...formData.options, newOption.trim()] });
      setNewOption('');
    }
  };

  const removeOption = (optionToRemove) => {
    setFormData({
      ...formData,
      options: formData.options.filter(option => option !== optionToRemove)
    });
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold">Custom Person Fields</h3>
        <button
          onClick={() => setShowAddForm(true)}
          className="px-3 py-1 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 flex items-center"
        >
          <Plus className="w-4 h-4 mr-1" />
          Add Field
        </button>
      </div>

      {showAddForm && (
        <div className="mb-6 p-4 bg-gray-50 rounded-lg">
          <h4 className="font-medium mb-3">{editingField ? 'Edit' : 'Add'} Custom Field</h4>
          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Field Name (Internal)</label>
                <input
                  type="text"
                  value={formData.field_name}
                  onChange={(e) => setFormData({ ...formData, field_name: e.target.value.replace(/\s+/g, '_').toLowerCase() })}
                  className="w-full px-3 py-2 border rounded-md text-sm"
                  placeholder="e.g., security_clearance"
                  required
                  disabled={editingField}
                />
                <p className="text-xs text-gray-500 mt-1">Letters, numbers, underscores only</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Field Label (Display)</label>
                <input
                  type="text"
                  value={formData.field_label}
                  onChange={(e) => setFormData({ ...formData, field_label: e.target.value })}
                  className="w-full px-3 py-2 border rounded-md text-sm"
                  placeholder="e.g., Security Clearance Level"
                  required
                />
              </div>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Field Type</label>
              <select
                value={formData.field_type}
                onChange={(e) => setFormData({ ...formData, field_type: e.target.value })}
                className="w-full px-3 py-2 border rounded-md text-sm"
              >
                {CUSTOM_FIELD_TYPES.map(type => (
                  <option key={type.value} value={type.value}>{type.label}</option>
                ))}
              </select>
            </div>
            
            {formData.field_type === 'select' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Options</label>
                <div className="flex space-x-2 mb-2">
                  <input
                    type="text"
                    value={newOption}
                    onChange={(e) => setNewOption(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addOption())}
                    placeholder="Add an option"
                    className="flex-1 px-3 py-2 border rounded-md text-sm"
                  />
                  <button
                    type="button"
                    onClick={addOption}
                    className="px-3 py-2 bg-gray-600 text-white text-sm rounded-md hover:bg-gray-700"
                  >
                    Add
                  </button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {formData.options.map((option, index) => (
                    <span key={index} className="inline-flex items-center px-2 py-1 rounded text-xs bg-gray-100">
                      {option}
                      <button
                        type="button"
                        onClick={() => removeOption(option)}
                        className="ml-1 text-gray-500 hover:text-red-500"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>
              </div>
            )}
            
            <div className="flex items-center">
              <input
                type="checkbox"
                id="is_active"
                checked={formData.is_active}
                onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                className="h-4 w-4 text-blue-600 rounded"
              />
              <label htmlFor="is_active" className="ml-2 text-sm text-gray-700">
                Active (show this field in forms)
              </label>
            </div>
            
            <div className="flex justify-end space-x-2 pt-3">
              <button
                type="button"
                onClick={resetForm}
                className="px-3 py-1 text-gray-700 bg-gray-200 text-sm rounded-md hover:bg-gray-300"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-3 py-1 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700"
              >
                {editingField ? 'Update' : 'Create'} Field
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="space-y-2">
        {customFields.map(field => (
          <div key={field.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
            <div>
              <div className="font-medium">{field.field_label}</div>
              <div className="text-sm text-gray-600">
                Type: {field.field_type} | Name: {field.field_name}
                {field.options && field.options.length > 0 && (
                  <span> | Options: {field.options.join(', ')}</span>
                )}
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <span className={`px-2 py-1 text-xs rounded ${
                field.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'
              }`}>
                {field.is_active ? 'Active' : 'Inactive'}
              </span>
              <button
                onClick={() => handleEdit(field)}
                className="text-gray-600 hover:text-gray-700"
                title="Edit"
              >
                <Edit2 className="w-4 h-4" />
              </button>
              <button
                onClick={() => handleDelete(field.id)}
                className="text-red-600 hover:text-red-700"
                title="Delete"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default CustomFieldManager;