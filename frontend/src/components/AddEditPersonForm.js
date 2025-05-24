// File: frontend/src/components/AddEditPersonForm.js
import React, { useState, useEffect } from 'react';
import { X, Trash2, Plus, MapPin, AlertCircle } from 'lucide-react';
import { peopleAPI, modelOptionsAPI, casesAPI } from '../utils/api';
import { PERSON_CATEGORIES, PERSON_STATUSES, OSINT_DATA_TYPES, CONNECTION_TYPES, LOCATION_TYPES, CRM_STATUSES, updateDynamicConstants } from '../utils/constants';

const AddEditPersonForm = ({ person, people, customFields, onSave, onCancel }) => {
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
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
    locations: [],
    custom_fields: {}
  });
  const [newAlias, setNewAlias] = useState('');
  const [newOsintData, setNewOsintData] = useState({ type: 'Email', value: '', notes: '' });
  const [newLocation, setNewLocation] = useState({ 
    type: 'primary_residence', 
    address: '', 
    city: '', 
    state: '', 
    country: '', 
    postal_code: '', 
    notes: '' 
  });
  const [connectionTypes, setConnectionTypes] = useState(CONNECTION_TYPES);
  const [locationTypes, setLocationTypes] = useState(LOCATION_TYPES);
  const [crmStatuses, setCrmStatuses] = useState(CRM_STATUSES);
  const [existingCases, setExistingCases] = useState([]);
  const [caseExists, setCaseExists] = useState(false);

  useEffect(() => {
    // Load dynamic options from database
    const loadModelOptions = async () => {
      try {
        const options = await modelOptionsAPI.getAll();
        updateDynamicConstants(options);
        
        // Update connection types
        const connTypes = options
          .filter(opt => opt.model_type === 'connection_type' && opt.is_active)
          .sort((a, b) => a.display_order - b.display_order)
          .map(opt => ({ value: opt.option_value, label: opt.option_label }));
        if (connTypes.length > 0) setConnectionTypes(connTypes);
        
        // Update location types
        const locTypes = options
          .filter(opt => opt.model_type === 'location_type' && opt.is_active)
          .sort((a, b) => a.display_order - b.display_order)
          .map(opt => ({ value: opt.option_value, label: opt.option_label }));
        if (locTypes.length > 0) setLocationTypes(locTypes);
        
        // Update CRM statuses
        const crmStats = options
          .filter(opt => opt.model_type === 'crm_status' && opt.is_active)
          .sort((a, b) => a.display_order - b.display_order)
          .map(opt => ({ value: opt.option_value, label: opt.option_label }));
        if (crmStats.length > 0) setCrmStatuses(crmStats);
      } catch (error) {
        console.error('Error loading model options:', error);
      }
    };
    
    const loadCases = async () => {
      try {
        const cases = await casesAPI.getAll();
        setExistingCases(cases);
      } catch (error) {
        console.error('Error loading cases:', error);
      }
    };
    
    loadModelOptions();
    loadCases();
  }, []);

  useEffect(() => {
    if (person) {
      setFormData({
        firstName: person.first_name || '',
        lastName: person.last_name || '',
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
        locations: person.locations || [],
        custom_fields: person.custom_fields || {}
      });
    }
  }, [person]);

  useEffect(() => {
    // Check if case exists
    if (formData.caseName) {
      const exists = existingCases.some(c => 
        c.case_name.toLowerCase() === formData.caseName.toLowerCase()
      );
      setCaseExists(exists);
    } else {
      setCaseExists(false);
    }
  }, [formData.caseName, existingCases]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Create case if it doesn't exist
    if (formData.caseName && !caseExists) {
      try {
        await casesAPI.create({ 
          case_name: formData.caseName, 
          description: `Auto-created from person: ${formData.firstName} ${formData.lastName}`,
          status: 'active'
        });
      } catch (error) {
        console.error('Error creating case:', error);
      }
    }
    
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
      setFormData({ ...formData, osintData: [...formData.osintData, { ...newOsintData }] });
      setNewOsintData({ type: 'Email', value: '', notes: '' });
    }
  };

  const removeOsintData = (index) => {
    setFormData({
      ...formData,
      osintData: formData.osintData.filter((_, i) => i !== index)
    });
  };

  const addLocation = () => {
    if (newLocation.address.trim()) {
      const locationToAdd = {
        ...newLocation,
        id: Date.now() // temporary ID for frontend tracking
      };
      setFormData({ ...formData, locations: [...formData.locations, locationToAdd] });
      setNewLocation({ 
        type: 'primary_residence', 
        address: '', 
        city: '', 
        state: '', 
        country: '', 
        postal_code: '', 
        notes: '' 
      });
    }
  };

  const removeLocation = (index) => {
    setFormData({
      ...formData,
      locations: formData.locations.filter((_, i) => i !== index)
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
      document.getElementById('connectionType').value = connectionTypes[0]?.value || 'associate';
      document.getElementById('connectionNote').value = '';
    }
  };

  const removeConnection = (index) => {
    setFormData({
      ...formData,
      connections: formData.connections.filter((_, i) => i !== index)
    });
  };

  const getSimilarCases = () => {
    if (!formData.caseName || formData.caseName.length < 2) return [];
    return existingCases.filter(c => 
      c.case_name.toLowerCase().includes(formData.caseName.toLowerCase())
    ).slice(0, 5);
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
              <label className="block text-sm font-medium text-gray-700 mb-2">First Name *</label>
              <input
                type="text"
                value={formData.firstName}
                onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Last Name</label>
              <input
                type="text"
                value={formData.lastName}
                onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Date of Birth</label>
              <input
                type="date"
                value={formData.dateOfBirth}
                onChange={(e) => setFormData({ ...formData, dateOfBirth: e.target.value })}
                className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            
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
          </div>

          <div className="grid grid-cols-2 gap-6">
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
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">CRM Status</label>
              <select
                value={formData.crmStatus}
                onChange={(e) => setFormData({ ...formData, crmStatus: e.target.value })}
                className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select CRM Status</option>
                {crmStatuses.map(status => (
                  <option key={status.value} value={status.value}>{status.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Case Name</label>
              <div className="relative">
                <input
                  type="text"
                  value={formData.caseName}
                  onChange={(e) => setFormData({ ...formData, caseName: e.target.value })}
                  className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter or select case name"
                />
                {formData.caseName && !caseExists && (
                  <div className="absolute right-2 top-2">
                    <span className="text-xs text-orange-600 flex items-center">
                      <AlertCircle className="w-3 h-3 mr-1" />
                      New case will be created
                    </span>
                  </div>
                )}
              </div>
              {getSimilarCases().length > 0 && (
                <div className="mt-1 p-2 bg-gray-50 rounded-md">
                  <p className="text-xs text-gray-600 mb-1">Similar cases:</p>
                  <div className="space-y-1">
                    {getSimilarCases().map(c => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => setFormData({ ...formData, caseName: c.case_name })}
                        className="text-xs text-blue-600 hover:text-blue-700 block"
                      >
                        {c.case_name}
                      </button>
                    ))}
                  </div>
                </div>
              )}
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

          {/* Locations */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <MapPin className="w-4 h-4 inline mr-1" />
              Locations
            </label>
            <div className="space-y-3 mb-3 bg-gray-50 p-4 rounded-lg">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <select
                    value={newLocation.type}
                    onChange={(e) => setNewLocation({ ...newLocation, type: e.target.value })}
                    className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {locationTypes.map(type => (
                      <option key={type.value} value={type.value}>{type.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <input
                    type="text"
                    value={newLocation.address}
                    onChange={(e) => setNewLocation({ ...newLocation, address: e.target.value })}
                    placeholder="Street Address"
                    className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <input
                  type="text"
                  value={newLocation.city}
                  onChange={(e) => setNewLocation({ ...newLocation, city: e.target.value })}
                  placeholder="City"
                  className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <input
                  type="text"
                  value={newLocation.state}
                  onChange={(e) => setNewLocation({ ...newLocation, state: e.target.value })}
                  placeholder="State/Province"
                  className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <input
                  type="text"
                  value={newLocation.country}
                  onChange={(e) => setNewLocation({ ...newLocation, country: e.target.value })}
                  placeholder="Country"
                  className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <input
                  type="text"
                  value={newLocation.postal_code}
                  onChange={(e) => setNewLocation({ ...newLocation, postal_code: e.target.value })}
                  placeholder="Postal Code"
                  className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <input
                  type="text"
                  value={newLocation.notes}
                  onChange={(e) => setNewLocation({ ...newLocation, notes: e.target.value })}
                  placeholder="Notes (optional)"
                  className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <button type="button" onClick={addLocation} className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 flex items-center">
                <Plus className="w-4 h-4 mr-2" />
                Add Location
              </button>
            </div>
            <div className="space-y-2">
              {formData.locations.map((location, index) => (
                <div key={index} className="flex items-center justify-between p-3 bg-white border rounded-lg">
                  <div>
                    <div className="flex items-center space-x-2">
                      <span className="font-medium text-sm px-2 py-1 bg-blue-100 text-blue-800 rounded">
                        {locationTypes.find(t => t.value === location.type)?.label || location.type}
                      </span>
                      <span className="font-medium">{location.address}</span>
                    </div>
                    <div className="text-sm text-gray-600">
                      {[location.city, location.state, location.country, location.postal_code]
                        .filter(Boolean)
                        .join(', ')}
                    </div>
                    {location.notes && <p className="text-sm text-gray-500 mt-1">{location.notes}</p>}
                  </div>
                  <button
                    type="button"
                    onClick={() => removeLocation(index)}
                    className="text-red-600 hover:text-red-700"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
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
                <button type="button" onClick={addOsintData} className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700">
                  Add
                </button>
              </div>
            </div>
            <div className="space-y-2">
              {formData.osintData.map((osint, index) => (
                <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div>
                    <span className="font-medium">{osint.type}:</span> {osint.value}
                    {osint.notes && <span className="text-sm text-gray-600 ml-2">({osint.notes})</span>}
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
                    <option key={p.id} value={p.id}>
                      {p.first_name} {p.last_name ? p.last_name : ''}
                    </option>
                  ))}
                </select>
                <select
                  id="connectionType"
                  className="px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  defaultValue={connectionTypes[0]?.value || 'associate'}
                >
                  {connectionTypes.map(type => (
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
                      <span className="font-medium">
                        {connectedPerson ? `${connectedPerson.first_name} ${connectedPerson.last_name || ''}` : 'Unknown'}
                      </span>
                      <span className="text-sm text-gray-600 ml-2">
                        ({connectionTypes.find(t => t.value === conn.type)?.label || conn.type})
                      </span>
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