// File: frontend/src/components/SettingsPage.js
import React, { useState, useRef, useEffect } from 'react';
import { Save, Upload, Download, Shield, Plus, Edit2, Trash2, X, Clock, User, ChevronDown, ChevronRight, CheckCircle, AlertTriangle, FileText, Database, Settings, Users, Building2, MapPin, Eye, Folder, Lock } from 'lucide-react';
import CustomFieldManager from './CustomFieldManager';
import { uploadLogo, modelOptionsAPI, auditAPI, exportAPI, importAPI } from '../utils/api';
import { authAPI } from '../utils/authAPI';

const SettingsPage = ({ appSettings, customFields, fetchCustomFields, handleAppNameChange, setAppSettings }) => {
  const [activeTab, setActiveTab] = useState('general');
  const [tempAppName, setTempAppName] = useState(appSettings.appName);
  const [modelOptions, setModelOptions] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [showAddOptionForm, setShowAddOptionForm] = useState(false);
  const [editingOption, setEditingOption] = useState(null);
  const [selectedModelType, setSelectedModelType] = useState('person_category');
  const [optionForm, setOptionForm] = useState({ option_value: '', option_label: '', display_order: 999, is_active: true });
  const [expandedGroups, setExpandedGroups] = useState({});
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [exportSuccess, setExportSuccess] = useState(false);
  const [importSuccess, setImportSuccess] = useState(false);
  const [exportFormat, setExportFormat] = useState('complete');
  const [exportProgress, setExportProgress] = useState(null);
  const [importPreview, setImportPreview] = useState(null);
  const [showImportPreview, setShowImportPreview] = useState(false);
  const fileInputRef = useRef(null);
  const importInputRef = useRef(null);

  // Profile state
  const [currentUser, setCurrentUser] = useState(null);
  const [profileForm, setProfileForm] = useState({
    username: '',
    email: '',
    first_name: '',
    last_name: '',
    current_password: '',
    new_password: '',
    confirm_password: ''
  });
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileSuccess, setProfileSuccess] = useState(false);
  const [profileError, setProfileError] = useState('');

  useEffect(() => {
    if (activeTab === 'data-model') {
      fetchModelOptions();
    } else if (activeTab === 'audit') {
      fetchAuditLogs();
    } else if (activeTab === 'profile') {
      fetchCurrentUser();
    }
  }, [activeTab]);

  const fetchCurrentUser = async () => {
    try {
      const user = await authAPI.getCurrentUser();
      setCurrentUser(user);
      setProfileForm({
        username: user.username || '',
        email: user.email || '',
        first_name: user.first_name || '',
        last_name: user.last_name || '',
        current_password: '',
        new_password: '',
        confirm_password: ''
      });
    } catch (error) {
      console.error('Error fetching current user:', error);
    }
  };

  const handleProfileSave = async (e) => {
    e.preventDefault();
    setProfileError('');
    setProfileSuccess(false);

    // Validate password change
    if (profileForm.new_password) {
      if (!profileForm.current_password) {
        setProfileError('Current password is required to set a new password');
        return;
      }
      if (profileForm.new_password !== profileForm.confirm_password) {
        setProfileError('New passwords do not match');
        return;
      }
      if (profileForm.new_password.length < 6) {
        setProfileError('New password must be at least 6 characters');
        return;
      }
    }

    try {
      setProfileSaving(true);

      const updateData = {
        email: profileForm.email,
        first_name: profileForm.first_name,
        last_name: profileForm.last_name
      };

      if (profileForm.new_password) {
        updateData.current_password = profileForm.current_password;
        updateData.new_password = profileForm.new_password;
      }

      await authAPI.updateProfile(updateData);

      setProfileSuccess(true);
      // Clear password fields
      setProfileForm({
        ...profileForm,
        current_password: '',
        new_password: '',
        confirm_password: ''
      });

      // Refresh user data
      await fetchCurrentUser();

      setTimeout(() => setProfileSuccess(false), 3000);
    } catch (error) {
      setProfileError(error.message || 'Failed to update profile');
    } finally {
      setProfileSaving(false);
    }
  };

  const fetchModelOptions = async () => {
    try {
      const data = await modelOptionsAPI.getAll();
      setModelOptions(data);
      
      // Initialize all groups as collapsed
      const groups = {};
      const modelTypes = [...new Set(data.map(opt => opt.model_type))];
      modelTypes.forEach(type => {
        groups[type] = false;
      });
      setExpandedGroups(groups);
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
      setIsExporting(true);
      setExportSuccess(false);
      setExportProgress('Preparing export...');
      
      // Simulate progress for better UX
      setTimeout(() => setExportProgress('Gathering data...'), 500);
      setTimeout(() => setExportProgress('Generating file...'), 1000);
      
      await exportAPI.export();
      
      setExportProgress('Download started!');
      setExportSuccess(true);
      setTimeout(() => {
        setExportSuccess(false);
        setExportProgress(null);
      }, 3000);
    } catch (error) {
      console.error('Error exporting data:', error);
      alert('Failed to export data: ' + error.message);
      setExportProgress(null);
    } finally {
      setIsExporting(false);
    }
  };

  const handleImportPreview = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    try {
      const text = await file.text();
      const data = JSON.parse(text);
      
      if (!data.version || !data.data) {
        throw new Error('Invalid import file format - missing version or data fields');
      }

      // Generate preview statistics
      const preview = {
        version: data.version,
        exportDate: data.exportDate,
        fileName: file.name,
        fileSize: (file.size / 1024).toFixed(1) + ' KB',
        counts: {
          people: data.data.people?.length || 0,
          businesses: data.data.businesses?.length || 0,
          tools: data.data.tools?.length || 0,
          todos: data.data.todos?.length || 0,
          cases: data.data.cases?.length || 0,
          customFields: data.data.customFields?.length || 0,
          modelOptions: data.data.modelOptions?.length || 0,
          travelHistory: data.data.travelHistory?.length || 0,
        },
        rawData: data
      };
      
      setImportPreview(preview);
      setShowImportPreview(true);
    } catch (error) {
      console.error('Error reading import file:', error);
      alert('Failed to read import file: ' + error.message);
    } finally {
      event.target.value = ''; // Reset file input
    }
  };

  const handleConfirmImport = async () => {
    if (!importPreview) return;

    try {
      setIsImporting(true);
      setImportSuccess(false);
      setShowImportPreview(false);
      
      await importAPI.import(importPreview.rawData);
      setImportSuccess(true);
      setImportPreview(null);
      
      setTimeout(() => {
        window.location.reload();
      }, 2000);
    } catch (error) {
      console.error('Error importing data:', error);
      alert('Failed to import data: ' + error.message);
    } finally {
      setIsImporting(false);
    }
  };

  const handleAddOption = async () => {
    if (!optionForm.option_value || !optionForm.option_label) {
      alert('Please fill in both value and label fields');
      return;
    }

    try {
      await modelOptionsAPI.create({
        model_type: selectedModelType,
        ...optionForm
      });
      fetchModelOptions();
      setShowAddOptionForm(false);
      setOptionForm({ option_value: '', option_label: '', display_order: 999, is_active: true });
    } catch (error) {
      console.error('Error adding option:', error);
      alert('Failed to add option: ' + error.message);
    }
  };

  const handleUpdateOption = async () => {
    if (!editingOption) return;
    
    try {
      await modelOptionsAPI.update(editingOption.id, {
        option_label: optionForm.option_label,
        display_order: optionForm.display_order,
        is_active: optionForm.is_active
      });
      fetchModelOptions();
      setEditingOption(null);
      setOptionForm({ option_value: '', option_label: '', display_order: 999, is_active: true });
    } catch (error) {
      console.error('Error updating option:', error);
      alert('Failed to update option');
    }
  };

  const handleDeleteOption = async (id) => {
    if (window.confirm('Are you sure you want to delete this option? This action cannot be undone.')) {
      try {
        await modelOptionsAPI.delete(id);
        fetchModelOptions();
      } catch (error) {
        console.error('Error deleting option:', error);
        alert('Failed to delete option');
      }
    }
  };

  const toggleGroup = (modelType) => {
    setExpandedGroups(prev => ({
      ...prev,
      [modelType]: !prev[modelType]
    }));
  };

  const modelTypeLabels = {
    person_category: 'Person Categories',
    person_status: 'Person Statuses',
    crm_status: 'CRM Statuses',
    task_status: 'Task Statuses',
    connection_type: 'Connection Types',
    location_type: 'Location Types',
    osint_data_type: 'OSINT Data Types'
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
      return value.length > 50 ? value.substring(0, 50) + '...' : value;
    }
  };

  const tabs = [
    { id: 'general', label: 'General' },
    { id: 'profile', label: 'My Profile' },
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
                  <div><span className="font-medium">Version:</span> 1.0.0</div>
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
                          onChange={(e) => setOptionForm({ ...optionForm, display_order: parseInt(e.target.value) || 999 })}
                          className="w-full px-3 py-2 border rounded-md text-sm"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3 mb-3">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Internal Value *</label>
                        <input
                          type="text"
                          value={optionForm.option_value}
                          onChange={(e) => setOptionForm({ ...optionForm, option_value: e.target.value })}
                          className="w-full px-3 py-2 border rounded-md text-sm"
                          placeholder="e.g., in_progress"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Display Label *</label>
                        <input
                          type="text"
                          value={optionForm.option_label}
                          onChange={(e) => setOptionForm({ ...optionForm, option_label: e.target.value })}
                          className="w-full px-3 py-2 border rounded-md text-sm"
                          placeholder="e.g., In Progress"
                          required
                        />
                      </div>
                    </div>
                    <div className="flex items-center mb-3">
                      <input
                        type="checkbox"
                        id="new_is_active"
                        checked={optionForm.is_active}
                        onChange={(e) => setOptionForm({ ...optionForm, is_active: e.target.checked })}
                        className="h-4 w-4 text-blue-600 rounded"
                      />
                      <label htmlFor="new_is_active" className="ml-2 text-sm text-gray-700">
                        Active (show this option in forms)
                      </label>
                    </div>
                    <div className="flex justify-end space-x-2">
                      <button
                        onClick={() => {
                          setShowAddOptionForm(false);
                          setOptionForm({ option_value: '', option_label: '', display_order: 999, is_active: true });
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
                  
                  return (
                    <div key={modelType} className="mb-4 border rounded-lg">
                      <button
                        onClick={() => toggleGroup(modelType)}
                        className="w-full px-4 py-3 bg-gray-50 hover:bg-gray-100 rounded-t-lg flex items-center justify-between transition-colors"
                      >
                        <div className="flex items-center space-x-2">
                          {expandedGroups[modelType] ? (
                            <ChevronDown className="w-4 h-4 text-gray-500" />
                          ) : (
                            <ChevronRight className="w-4 h-4 text-gray-500" />
                          )}
                          <h4 className="font-medium text-gray-700">{label}</h4>
                          <span className="text-sm text-gray-500">({typeOptions.length} options)</span>
                        </div>
                      </button>
                      
                      {expandedGroups[modelType] && (
                        <div className="p-4 space-y-2 bg-white rounded-b-lg">
                          {typeOptions.length === 0 ? (
                            <p className="text-sm text-gray-500 text-center py-4">No options defined yet</p>
                          ) : (
                            typeOptions
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
                                          display_order: option.display_order,
                                          is_active: option.is_active
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
                              ))
                          )}
                        </div>
                      )}
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
                  disabled={isExporting}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 flex items-center disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isExporting ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Exporting...
                    </>
                  ) : (
                    <>
                      <Download className="w-4 h-4 mr-2" />
                      Export All Data
                    </>
                  )}
                </button>
                {exportSuccess && (
                  <div className="mt-2 flex items-center text-green-600 text-sm">
                    <CheckCircle className="w-4 h-4 mr-1" />
                    Export completed successfully!
                  </div>
                )}
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
                  onChange={handleImportPreview}
                  className="hidden"
                />
                <button
                  onClick={() => importInputRef.current?.click()}
                  disabled={isImporting}
                  className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 flex items-center disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isImporting ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Importing...
                    </>
                  ) : (
                    <>
                      <Upload className="w-4 h-4 mr-2" />
                      Import Data
                    </>
                  )}
                </button>
                {importSuccess && (
                  <div className="mt-2 flex items-center text-green-600 text-sm">
                    <CheckCircle className="w-4 h-4 mr-1" />
                    Import completed successfully! Reloading page...
                  </div>
                )}
                
                <div className="mt-4 p-4 bg-amber-50 border border-amber-200 rounded-lg">
                  <div className="flex items-start">
                    <AlertTriangle className="w-5 h-5 text-amber-600 mr-2 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm text-amber-800 font-medium">Important Notes:</p>
                      <ul className="text-sm text-amber-700 mt-1 list-disc list-inside">
                        <li>Import will merge data with existing records</li>
                        <li>Records with matching IDs will be updated</li>
                        <li>Always backup your data before importing</li>
                        <li>Encryption for export/import is planned for a future release</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
          
          {activeTab === 'profile' && (
            <div>
              <h3 className="text-lg font-semibold mb-4">My Profile</h3>
              <p className="text-sm text-gray-600 mb-6">
                Update your personal information and change your password.
              </p>

              <form onSubmit={handleProfileSave} className="space-y-6 max-w-2xl">
                {/* Account Information */}
                <div className="border-b pb-6">
                  <h4 className="text-md font-medium text-gray-900 mb-4">Account Information</h4>

                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Username</label>
                      <div className="relative">
                        <input
                          type="text"
                          value={profileForm.username}
                          disabled
                          className="w-full px-3 py-2 border rounded-md bg-gray-100 text-gray-600 cursor-not-allowed"
                        />
                        <Lock className="absolute right-3 top-2.5 w-4 h-4 text-gray-400" />
                      </div>
                      <p className="text-xs text-gray-500 mt-1">Username cannot be changed</p>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
                      <input
                        type="email"
                        value={profileForm.email}
                        onChange={(e) => setProfileForm({ ...profileForm, email: e.target.value })}
                        className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">First Name</label>
                        <input
                          type="text"
                          value={profileForm.first_name}
                          onChange={(e) => setProfileForm({ ...profileForm, first_name: e.target.value })}
                          className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Last Name</label>
                        <input
                          type="text"
                          value={profileForm.last_name}
                          onChange={(e) => setProfileForm({ ...profileForm, last_name: e.target.value })}
                          className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Change Password */}
                <div className="border-b pb-6">
                  <h4 className="text-md font-medium text-gray-900 mb-4">Change Password</h4>
                  <p className="text-sm text-gray-600 mb-4">
                    Leave password fields empty if you don't want to change your password.
                  </p>

                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Current Password</label>
                      <input
                        type="password"
                        value={profileForm.current_password}
                        onChange={(e) => setProfileForm({ ...profileForm, current_password: e.target.value })}
                        className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="Enter current password"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">New Password</label>
                      <input
                        type="password"
                        value={profileForm.new_password}
                        onChange={(e) => setProfileForm({ ...profileForm, new_password: e.target.value })}
                        className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="Enter new password (min. 6 characters)"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Confirm New Password</label>
                      <input
                        type="password"
                        value={profileForm.confirm_password}
                        onChange={(e) => setProfileForm({ ...profileForm, confirm_password: e.target.value })}
                        className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="Confirm new password"
                      />
                    </div>
                  </div>
                </div>

                {/* Error/Success Messages */}
                {profileError && (
                  <div className="flex items-center p-3 bg-red-50 border border-red-200 rounded-md text-red-800 text-sm">
                    <AlertTriangle className="w-4 h-4 mr-2 flex-shrink-0" />
                    {profileError}
                  </div>
                )}

                {profileSuccess && (
                  <div className="flex items-center p-3 bg-green-50 border border-green-200 rounded-md text-green-800 text-sm">
                    <CheckCircle className="w-4 h-4 mr-2 flex-shrink-0" />
                    Profile updated successfully!
                  </div>
                )}

                {/* Save Button */}
                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={profileSaving}
                    className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 flex items-center disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {profileSaving ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                        Saving...
                      </>
                    ) : (
                      <>
                        <Save className="w-4 h-4 mr-2" />
                        Save Changes
                      </>
                    )}
                  </button>
                </div>
              </form>
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
                <label className="block text-sm font-medium text-gray-700 mb-1">Internal Value</label>
                <input
                  type="text"
                  value={optionForm.option_value}
                  disabled
                  className="w-full px-3 py-2 border rounded-md text-sm bg-gray-100"
                />
                <p className="text-xs text-gray-500 mt-1">Internal value cannot be changed</p>
              </div>
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
                  onChange={(e) => setOptionForm({ ...optionForm, display_order: parseInt(e.target.value) || 999 })}
                  className="w-full px-3 py-2 border rounded-md text-sm"
                />
              </div>
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="edit_is_active"
                  checked={optionForm.is_active}
                  onChange={(e) => setOptionForm({ ...optionForm, is_active: e.target.checked })}
                  className="h-4 w-4 text-blue-600 rounded"
                />
                <label htmlFor="edit_is_active" className="ml-2 text-sm text-gray-700">
                  Active
                </label>
              </div>
            </div>
            <div className="flex justify-end space-x-2 mt-6">
              <button
                onClick={() => {
                  setEditingOption(null);
                  setOptionForm({ option_value: '', option_label: '', display_order: 999, is_active: true });
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