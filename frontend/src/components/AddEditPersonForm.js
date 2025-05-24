// File: frontend/src/components/AddEditPersonForm.js
import React, { useState, useEffect } from 'react';
import { X, Trash2 } from 'lucide-react';
import { peopleAPI } from '../utils/api';
import { PERSON_CATEGORIES, PERSON_STATUSES, OSINT_DATA_TYPES, CONNECTION_TYPES } from '../utils/constants';

const AddEditPersonForm = ({ person, people, customFields, onSave, onCancel }) => {
  const [formData, setFormData] = useState({
    name: '',
    aliases: [],
    dateOfBirth: '',
    category: '',
    status: '',
    crmStatus: '',
    caseName: '',
    profilePictureUrl: '',
    notes: '',
    osintData: [],
    attachments: [],
    connections: [],
    custom_fields: {}
  });
  const [newAlias, setNewAlias] = useState('');
  const [newOsintData, setNewOsintData] = useState({ type: 'Email', value: '', notes: '', lat: '', lng: '' });

  useEffect(() => {
    if (person) {
      setFormData({
        name: person.name || '',
        aliases: person.aliases || [],
        dateOfBirth: person.date_of_birth ? person.date_of_birth.split('T')[0] : '',
        category: person.category || '',
        status: person.status || '',
        crmStatus: person.crm_status || '',
        caseName: person.case_name || '',
        profilePictureUrl: person.profile_picture_url || '',
        notes: person.notes || '',
        osintData: person.osint_data || [],
        attachments: person.attachments || [],
        connections: person.connections || [],
        custom_fields: person.custom_fields || {}
      });
    }
  }, [person]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    const dataToSend = {
      ...formData,
      dateOfBirth: formData.dateOfBirth || null
    };

    try {
      let savedPerson;
      if (person) {
        savedPerson = await peopleAPI.update(person.id, dataToSend);
      } else {
        savedPerson = await peopleAPI.create(dataToSend);
      }
      onSave(savedPerson);
    } catch (error) {
      console.error('Error saving person:', error);
      alert('Failed to save person: ' + error.message);
    }
  };

  const addAlias = () => {
    if (newAlias.trim()) {
      setFormData({ ...formData, aliases: [...formData.aliases, newAlias.trim()] });
      setNewAlias('');
    }
  };

  const removeAlias = (index) => {
    setFormData({
      ...formData,
      aliases: formData.aliases.filter((_, i) => i !== index)
    });
  };

  const addOsintData = () => {
    if (newOsintData.value.trim()) {
      const osintToAdd = { ...newOsintData };
      if (newOsintData.type === 'Location' && newOsintData.lat && newOsintData.lng) {
        osintToAdd.lat = parseFloat(newOsintData.lat);
        osintToAdd.lng = parseFloat(newOsintData.lng);
      }
      setFormData({ ...formData, osintData: [...formData.osintData, osintToAdd] });
      setNewOsintData({ type: 'Email', value: '', notes: '', lat: '', lng: '' });
    }
  };

  const removeOsintData = (index) => {
    setFormData({
      ...formData,
      osintData: formData.osintData.filter((_, i) => i !== index)
    });
  };

  const addConnection = () => {
    const selectedPersonId = parseInt(document.getElementById('connectionSelect').value);
    const connectionType = document.getElementById('connectionType').value;
    const connectionNote = document.getElementById('connectionNote').value;
    
    if (selectedPersonId) {
      const newConnection = {
        person_id: selectedPersonId,
        type: connectionType,
        note: connectionNote
      };
      setFormData({ ...formData, connections: [...formData.connections, newConnection] });
      document.getElementById('connectionSelect').value = '';
      document.getElementById('connectionType').value = 'associate';
      document.getElementById('connectionNote').value = '';
    }
  };

  const removeConnection = (index) => {
    setFormData({
      ...formData,
      connections: formData.connections.filter((_, i) => i !== index)
    });
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b">
          <h2 className="text-2xl font-bold text-gray-900">
            {person ? 'Edit Person' : 'Add New Person'}
          </h2>
        </div>
        
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Basic Information */}
          <div className="grid grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Name *</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Date of Birth</label>
              <input
                type="date"
                value={formData.dateOfBirth}
                onChange={(e) => setFormData({ ...formData, dateOfBirth: e.target.value })}
                className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Category</label>
              <select
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select Category</option>
                {PERSON_CATEGORIES.map(cat => (
                  <option key={cat.value} value={cat.value}>{cat.label}</option>
                ))}
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
              <select
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select Status</option>
                {PERSON_STATUSES.map(status => (
                  <option key={status.value} value={status.value}>{status.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">CRM Status</label>
              <input
                type="text"
                value={formData.crmStatus}
                onChange={(e) => setFormData({ ...formData, crmStatus: e.target.value })}
                className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Case Name</label>
              <input
                type="text"
                value={formData.caseName}
                onChange={(e) => setFormData({ ...formData, caseName: e.target.value })}
                className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Profile Picture URL</label>
            <input
              type="url"
              value={formData.profilePictureUrl}
              onChange={(e) => setFormData({ ...formData, profilePictureUrl: e.target.value })}
              className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Notes</label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              rows="3"
            />
          </div>

          {/* Aliases */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Aliases</label>
            <div className="flex space-x-2 mb-2">
              <input
                type="text"
                value={newAlias}
                onChange={(e) => setNewAlias(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addAlias())}
                placeholder="Add an alias"
                className="flex-1 px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button type="button" onClick={addAlias} className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700">
                Add
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {formData.aliases.map((alias, index) => (
                <span key={index} className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-gray-100">
                  {alias}
                  <button
                    type="button"
                    onClick={() => removeAlias(index)}
                    className="ml-2 text-gray-500 hover:text-red-500"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>
          </div>

          {/* OSINT Data */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">OSINT Data</label>
            <div className="space-y-2 mb-2">
              <div className="flex space-x-2">
                <select
                  value={newOsintData.type}
                  onChange={(e) => setNewOsintData({ ...newOsintData, type: e.target.value })}
                  className="px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {OSINT_DATA_TYPES.map(type => (
                    <option key={type.value} value={type.value}>{type.label}</option>
                  ))}
                </select>
                <input
                  type="text"
                  value={newOsintData.value}
                  onChange={(e) => setNewOsintData({ ...newOsintData, value: e.target.value })}
                  placeholder="Value"
                  className="flex-1 px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <input
                  type="text"
                  value={newOsintData.notes}
                  onChange={(e) => setNewOsintData({ ...newOsintData, notes: e.target.value })}
                  placeholder="Notes (optional)"
                  className="flex-1 px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              {newOsintData.type === 'Location' && (
                <div className="flex space-x-2">
                  <input
                    type="number"
                    step="any"
                    value={newOsintData.lat}
                    onChange={(e) => setNewOsintData({ ...newOsintData, lat: e.target.value })}
                    placeholder="Latitude"
                    className="flex-1 px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <input
                    type="number"
                    step="any"
                    value={newOsintData.lng}
                    onChange={(e) => setNewOsintData({ ...newOsintData, lng: e.target.value })}
                    placeholder="Longitude"
                    className="flex-1 px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              )}
              <button type="button" onClick={addOsintData} className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700">
                Add OSINT Data
              </button>
            </div>
            <div className="space-y-2">
              {formData.osintData.map((osint, index) => (
                <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div>
                    <span className="font-medium">{osint.type}:</span> {osint.value}
                    {osint.notes && <span className="text-sm text-gray-600 ml-2">({osint.notes})</span>}
                    {osint.lat && osint.lng && <span className="text-sm text-gray-600 ml-2">[{osint.lat}, {osint.lng}]</span>}
                  </div>
                  <button
                    type="button"
                    onClick={() => removeOsintData(index)}
                    className="text-red-600 hover:text-red-700"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Connections */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Connections</label>
            <div className="space-y-2 mb-2">
              <div className="flex space-x-2">
                <select
                  id="connectionSelect"
                  className="flex-1 px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select a person</option>
                  {people.filter(p => !person || p.id !== person.id).map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
                <select
                  id="connectionType"
                  className="px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {CONNECTION_TYPES.map(type => (
                    <option key={type.value} value={type.value}>{type.label}</option>
                  ))}
                </select>
              </div>
              <input
                type="text"
                id="connectionNote"
                placeholder="Connection notes (optional)"
                className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button type="button" onClick={addConnection} className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700">
                Add Connection
              </button>
            </div>
            <div className="space-y-2">
              {formData.connections.map((conn, index) => {
                const connectedPerson = people.find(p => p.id === conn.person_id);
                return (
                  <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div>
                      <span className="font-medium">{connectedPerson?.name || 'Unknown'}</span>
                      <span className="text-sm text-gray-600 ml-2">({conn.type})</span>
                      {conn.note && <p className="text-sm text-gray-600">{conn.note}</p>}
                    </div>
                    <button
                      type="button"
                      onClick={() => removeConnection(index)}
                      className="text-red-600 hover:text-red-700"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Custom Fields */}
          {customFields.filter(f => f.is_active).length > 0 && (
            <div>
              <h3 className="text-lg font-semibold mb-3">Custom Fields</h3>
              <div className="space-y-4">
                {customFields.filter(f => f.is_active).map(field => (
                  <div key={field.id}>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      {field.field_label}
                    </label>
                    {field.field_type === 'text' && (
                      <input
                        type="text"
                        value={formData.custom_fields[field.field_name] || ''}
                        onChange={(e) => setFormData({
                          ...formData,
                          custom_fields: {
                            ...formData.custom_fields,
                            [field.field_name]: e.target.value
                          }
                        })}
                        className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    )}
                    {field.field_type === 'select' && (
                      <select
                        value={formData.custom_fields[field.field_name] || ''}
                        onChange={(e) => setFormData({
                          ...formData,
                          custom_fields: {
                            ...formData.custom_fields,
                            [field.field_name]: e.target.value
                          }
                        })}
                        className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="">Select {field.field_label}</option>
                        {field.options && field.options.map(option => (
                          <option key={option} value={option}>{option}</option>
                        ))}
                      </select>
                    )}
                    {field.field_type === 'textarea' && (
                      <textarea
                        value={formData.custom_fields[field.field_name] || ''}
                        onChange={(e) => setFormData({
                          ...formData,
                          custom_fields: {
                            ...formData.custom_fields,
                            [field.field_name]: e.target.value
                          }
                        })}
                        className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        rows="3"
                      />
                    )}
                    {field.field_type === 'date' && (
                      <input
                        type="date"
                        value={formData.custom_fields[field.field_name] || ''}
                        onChange={(e) => setFormData({
                          ...formData,
                          custom_fields: {
                            ...formData.custom_fields,
                            [field.field_name]: e.target.value
                          }
                        })}
                        className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Form Actions */}
          <div className="flex justify-end space-x-3 pt-6 border-t">
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
            >
              {person ? 'Update' : 'Create'} Person
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddEditPersonForm;