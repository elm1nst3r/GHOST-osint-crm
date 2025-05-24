// File: frontend/src/components/SettingsPage.js
import React, { useState, useRef, useEffect } from 'react';
import { Save, Upload, Download, Shield, Plus, Edit2, Trash2, X, Clock, User } from 'lucide-react';
import CustomFieldManager from './CustomFieldManager';
import { uploadLogo, modelOptionsAPI, auditAPI, exportAPI, importAPI } from '../utils/api';

const SettingsPage = ({ appSettings, customFields, fetchCustomFields, handleAppNameChange, setAppSettings }) => {
  const [activeTab, setActiveTab] = useState('general');
  const [tempAppName, setTempAppName] = useState(appSettings.appName);
  const [modelOptions, setModelOptions] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [showAddOptionForm, setShowAddOptionForm] = useState(false);
  const [editingOption, setEditingOption] = useState(null);
  const [selectedModelType, setSelectedModelType] = useState('person_category');
  const [optionForm, setOptionForm] = useState({ option_value: '', option_label: '', display_order: 999 });
  const fileInputRef = useRef(null);
  const importInputRef = useRef(null);

  useEffect(() => {
    if (activeTab === 'data-model') {
      fetchModelOptions();
    } else if (activeTab === 'audit') {
      fetchAuditLogs();
    }
  }, [activeTab]);

  const fetchModelOptions = async () => {
    try {
      const data = await modelOptionsAPI.getAll();
      setModelOptions(data);
    } catch (error) {
      console.error('Error fetching model options:', error);
    }
  };

  const fetchAuditLogs = async () => {
    try {
      const data = await auditAPI.getAll({ limit: 100 });
      setAuditLogs(data);
    } catch (error) {
      console.error('Error fetching audit logs:', error);
    }
  };

  const handleLogoUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    try {
      const logoUrl = await uploadLogo(file);
      const updatedSettings = { ...appSettings, appLogo: logoUrl };
      setAppSettings(updatedSettings);
      localStorage.setItem('appSettings', JSON.stringify(updatedSettings));
    } catch (error) {
      console.error('Error uploading logo:', error);
      alert('Failed to upload logo');
    }
  };

  const saveAppName = () => {
    handleAppNameChange(tempAppName);
  };

  const handleExport = async () => {
    try {
      const data = await exportAPI.export();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `osint-crm-export-${Date.now()}.json`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Error exporting data:', error);
      alert('Failed to export data');
    }
  };

  const handleImport = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    try {
      const text = await file.text();
      const data = JSON.parse(text);
      
      if (!data.version || !data.data) {
        throw new Error('Invalid import file format');
      }

      if (window.confirm('This will import all data from the file. Existing data with the same IDs will be updated. Continue?')) {
        await importAPI.import(data);
        alert('Data imported successfully! Please refresh the page to see the changes.');
        window.location.reload();
      }
    } catch (error) {
      console.error('Error importing data:', error);
      alert('Failed to import data: ' + error.message);
    }
  };

  const handleAddOption = async () => {
    try {
      await modelOptionsAPI.create({
        model_type: selectedModelType,
        ...optionForm
      });
      fetchModelOptions();
      setShowAddOptionForm(false);
      setOptionForm({ option_value: '', option_label: '', display_order: 999 });
    } catch (error) {
      console.error('Error adding option:', error);
      alert('Failed to add option');
    }
  };

  const handleUpdateOption = async () => {
    if (!editingOption) return;
    
    try {
      await modelOptionsAPI.update(editingOption.id, {
        option_label: optionForm.option_label,
        display_order: optionForm.display_order,
        is_active: editingOption.is_active
      });
      fetchModelOptions();
      setEditingOption(null);
      setOptionForm({ option_value: '', option_label: '', display_order: 999 });
    } catch (error) {
      console.error('Error updating option:', error);
      alert('Failed to update option');
    }
  };

  const handleDeleteOption = async (id) => {
    if (window.confirm('Are you sure you want to delete this option?')) {
      try {
        await modelOptionsAPI.delete(id);
        fetchModelOptions();
      } catch (error) {
        console.error('Error deleting option:', error);
        alert('Failed to delete option');
      }
    }
  };

  const modelTypeLabels = {
    person_category: 'Person Categories',
    person_status: 'Person Statuses',
    crm_status: 'CRM Statuses',
    task_status: 'Task Statuses',
    connection_type: 'Connection Types',
    location_type: 'Location Types'
  };

  const formatAuditValue = (value) => {
    if (!value || value === 'null') return 'N/A';
    try {
      const parsed = JSON.parse(value);
      if (typeof parsed === 'object') {
        return 'Complex data';
      }
      return value;
    } catch {
      return value;
    }
  };

  const tabs = [
    { id: 'general', label: 'General' },
    { id: 'data-model', label: 'Data Model' },
    { id: 'import-export', label: 'Import/Export' },
    { id: 'audit', label: 'Audit Log' },
  ];

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Settings</h1>
      
      <div className="bg-white rounded-lg shadow-sm border">
        {/* Tabs */}
        <div className="border-b">
          <nav className="flex space-x-8 px-6" aria-label="Tabs">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`py-4 px-1 border-b-2 font-medium text-sm ${
                  activeTab === tab.id
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        </div>
        
        {/* Tab Content */}
        <div className="p-6">
          {activeTab === 'general' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold mb-4">Application Configuration</h3>
                
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Application Name</label>
                    <div className="flex space-x-2">
                      <input
                        type="text"
                        value={tempAppName}
                        onChange={(e) => setTempAppName(e.target.value)}
                        className="flex-1 px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                      <button
                        onClick={saveAppName}
                        className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 flex items-center"
                      >
                        <Save className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Application Logo</label>
                    <div className="flex items-center space-x-4">
                      {appSettings.appLogo ? (
                        <img src={appSettings.appLogo} alt="App Logo" className="h-16 w-16 object-contain rounded" />
                      ) : (
                        <div className="h-16 w-16 bg-gray-200 rounded flex items-center justify-center">
                          <Shield className="w-8 h-8 text-gray-400" />
                        </div>
                      )}
                      <div>
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept="image/png,image/jpeg,image/gif,image/svg+xml"
                          onChange={handleLogoUpload}
                          className="hidden"
                        />
                        <button
                          onClick={() => fileInputRef.current?.click()}
                          className="px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 flex items-center"
                        >
                          <Upload className="w-4 h-4 mr-2" />
                          Upload Logo
                        </button>
                        <p className="text-xs text-gray-500 mt-1">PNG, JPG, GIF, or SVG. Max 5MB.</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              
              <div>
                <h3 className="text-lg font-semibold mb-4">System Information</h3>
                <div className="space-y-2 text-sm">
                  <div><span className="font-medium">Version:</span> 0.9.0</div>
                  <div><span className="font-medium">Database:</span> PostgreSQL</div>
                  <div><span className="font-medium">API URL:</span> {process.env.REACT_APP_API_URL || 'http://localhost:3001/api'}</div>
                </div>
              </div>
            </div>
          )}
          
          {activeTab === 'data-model' && (
            <div className="space-y-6">
              <CustomFieldManager 
                customFields={customFields}
                fetchCustomFields={fetchCustomFields}
              />
              
              <div className="pt-6 border-t">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-semibold">Predefined Options</h3>
                  <button
                    onClick={() => setShowAddOptionForm(!showAddOptionForm)}
                    className="px-3 py-1 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 flex items-center"
                  >
                    <Plus className="w-4 h-4 mr-1" />
                    Add Option
                  </button>
                </div>

                {showAddOptionForm && (
                  <div className="mb-6 p-4 bg-gray-50 rounded-lg">
                    <h4 className="font-medium mb-3">Add New Option</h4>
                    <div className="grid grid-cols-2 gap-3 mb-3">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                        <select
                          value={selectedModelType}
                          onChange={(e) => setSelectedModelType(e.target.value)}
                          className="w-full px-3 py-2 border rounded-md text-sm"
                        >
                          {Object.entries(modelTypeLabels).map(([value, label]) => (
                            <option key={value} value={value}>{label}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Display Order</label>
                        <input
                          type="number"
                          value={optionForm.display_order}
                          onChange={(e) => setOptionForm({ ...optionForm, display_order: parseInt(e.target.value) })}
                          className="w-full px-3 py-2 border rounded-md text-sm"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3 mb-3">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Internal Value</label>
                        <input
                          type="text"
                          value={optionForm.option_value}
                          onChange={(e) => setOptionForm({ ...optionForm, option_value: e.target.value })}
                          className="w-full px-3 py-2 border rounded-md text-sm"
                          placeholder="e.g., in_progress"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Display Label</label>
                        <input
                          type="text"
                          value={optionForm.option_label}
                          onChange={(e) => setOptionForm({ ...optionForm, option_label: e.target.value })}
                          className="w-full px-3 py-2 border rounded-md text-sm"
                          placeholder="e.g., In Progress"
                        />
                      </div>
                    </div>
                    <div className="flex justify-end space-x-2">
                      <button
                        onClick={() => {
                          setShowAddOptionForm(false);
                          setOptionForm({ option_value: '', option_label: '', display_order: 999 });
                        }}
                        className="px-3 py-1 text-gray-700 bg-gray-200 text-sm rounded-md hover:bg-gray-300"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleAddOption}
                        className="px-3 py-1 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700"
                      >
                        Add Option
                      </button>
                    </div>
                  </div>
                )}

                {Object.entries(modelTypeLabels).map(([modelType, label]) => {
                  const typeOptions = modelOptions.filter(opt => opt.model_type === modelType);
                  if (typeOptions.length === 0) return null;
                  
                  return (
                    <div key={modelType} className="mb-6">
                      <h4 className="font-medium text-gray-700 mb-3">{label}</h4>
                      <div className="space-y-2">
                        {typeOptions
                          .sort((a, b) => a.display_order - b.display_order)
                          .map(option => (
                            <div key={option.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                              <div className="flex items-center space-x-3">
                                <span className="text-sm text-gray-500">#{option.display_order}</span>
                                <div>
                                  <div className="font-medium">{option.option_label}</div>
                                  <div className="text-sm text-gray-600">Value: {option.option_value}</div>
                                </div>
                              </div>
                              <div className="flex items-center space-x-2">
                                <span className={`px-2 py-1 text-xs rounded ${
                                  option.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'
                                }`}>
                                  {option.is_active ? 'Active' : 'Inactive'}
                                </span>
                                <button
                                  onClick={() => {
                                    setEditingOption(option);
                                    setOptionForm({
                                      option_value: option.option_value,
                                      option_label: option.option_label,
                                      display_order: option.display_order
                                    });
                                  }}
                                  className="text-gray-600 hover:text-gray-700"
                                  title="Edit"
                                >
                                  <Edit2 className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => handleDeleteOption(option.id)}
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
                })}
              </div>
            </div>
          )}
          
          {activeTab === 'import-export' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold mb-4">Data Export</h3>
                <p className="text-sm text-gray-600 mb-4">
                  Export all your data (people, tools, todos, custom fields, and settings) to a JSON file for backup or migration.
                </p>
                <button 
                  onClick={handleExport}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 flex items-center"
                >
                  <Download className="w-4 h-4 mr-2" />
                  Export All Data
                </button>
              </div>
              
              <div className="pt-6 border-t">
                <h3 className="text-lg font-semibold mb-4">Data Import</h3>
                <p className="text-sm text-gray-600 mb-4">
                  Import data from a previously exported JSON file. This will merge the data with existing records.
                </p>
                <input
                  ref={importInputRef}
                  type="file"
                  accept="application/json"
                  onChange={handleImport}
                  className="hidden"
                />
                <button
                  onClick={() => importInputRef.current?.click()}
                  className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 flex items-center"
                >
                  <Upload className="w-4 h-4 mr-2" />
                  Import Data
                </button>
                
                <div className="mt-4 p-4 bg-blue-50 rounded-lg">
                  <p className="text-sm text-blue-800">
                    <strong>Note:</strong> Encryption for export/import is planned for a future release to enhance data security.
                  </p>
                </div>
              </div>
            </div>
          )}
          
          {activeTab === 'audit' && (
            <div>
              <h3 className="text-lg font-semibold mb-4">Audit Log</h3>
              <p className="text-sm text-gray-600 mb-4">
                View a log of all changes made to the system.
              </p>
              
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Timestamp</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Entity</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Action</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Field</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Old Value</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">New Value</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {auditLogs.map((log) => (
                      <tr key={log.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm text-gray-900">
                          <div className="flex items-center">
                            <Clock className="w-4 h-4 mr-1 text-gray-400" />
                            {new Date(log.created_at).toLocaleString()}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900">
                          {log.entity_type} #{log.entity_id}
                        </td>
                        <td className="px-4 py-3 text-sm">
                          <span className={`inline-block px-2 py-1 text-xs rounded ${
                            log.action === 'create' ? 'bg-green-100 text-green-800' :
                            log.action === 'update' ? 'bg-blue-100 text-blue-800' :
                            log.action === 'delete' ? 'bg-red-100 text-red-800' :
                            'bg-gray-100 text-gray-800'
                          }`}>
                            {log.action}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900">
                          {log.field_name || 'N/A'}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-500">
                          {formatAuditValue(log.old_value)}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900">
                          {formatAuditValue(log.new_value)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                
                {auditLogs.length === 0 && (
                  <div className="text-center py-8 text-gray-500">
                    No audit logs found.
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
      
      {/* Edit Option Modal */}
      {editingOption && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 w-96">
            <h3 className="text-lg font-semibold mb-4">Edit Option</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Display Label</label>
                <input
                  type="text"
                  value={optionForm.option_label}
                  onChange={(e) => setOptionForm({ ...optionForm, option_label: e.target.value })}
                  className="w-full px-3 py-2 border rounded-md text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Display Order</label>
                <input
                  type="number"
                  value={optionForm.display_order}
                  onChange={(e) => setOptionForm({ ...optionForm, display_order: parseInt(e.target.value) })}
                  className="w-full px-3 py-2 border rounded-md text-sm"
                />
              </div>
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="is_active"
                  checked={editingOption.is_active}
                  onChange={(e) => setEditingOption({ ...editingOption, is_active: e.target.checked })}
                  className="h-4 w-4 text-blue-600 rounded"
                />
                <label htmlFor="is_active" className="ml-2 text-sm text-gray-700">
                  Active
                </label>
              </div>
            </div>
            <div className="flex justify-end space-x-2 mt-6">
              <button
                onClick={() => {
                  setEditingOption(null);
                  setOptionForm({ option_value: '', option_label: '', display_order: 999 });
                }}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
              >
                Cancel
              </button>
              <button
                onClick={handleUpdateOption}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
              >
                Update
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SettingsPage;