// File: frontend/src/components/SettingsPage.js
import React, { useState, useRef } from 'react';
import { Save, Upload, Download, Shield } from 'lucide-react';
import CustomFieldManager from './CustomFieldManager';
import { uploadLogo } from '../utils/api';

const SettingsPage = ({ appSettings, customFields, fetchCustomFields, handleAppNameChange, setAppSettings }) => {
  const [activeTab, setActiveTab] = useState('general');
  const [tempAppName, setTempAppName] = useState(appSettings.appName);
  const fileInputRef = useRef(null);

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

  const tabs = [
    { id: 'general', label: 'General' },
    { id: 'data-model', label: 'Data Model' },
    { id: 'import-export', label: 'Import/Export' },
    { id: 'audit', label: 'Audit Log' },
  ];

  return (
    <div className="p-6 max-w-4xl mx-auto">
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
                <h3 className="text-lg font-semibold mb-4">Predefined Options</h3>
                <p className="text-sm text-gray-600 mb-4">
                  Configure the available options for dropdown fields in the application.
                </p>
                <div className="space-y-4">
                  <div className="p-4 bg-yellow-50 rounded-lg">
                    <p className="text-sm text-yellow-800">
                      <strong>Note:</strong> Customization of predefined categories and statuses is coming soon. 
                      Currently, these are defined in the application code.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
          
          {activeTab === 'import-export' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold mb-4">Data Export</h3>
                <p className="text-sm text-gray-600 mb-4">
                  Export all your data (people, tools, todos) to a JSON file for backup or migration.
                </p>
                <button className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 flex items-center">
                  <Download className="w-4 h-4 mr-2" />
                  Export All Data
                </button>
              </div>
              
              <div className="pt-6 border-t">
                <h3 className="text-lg font-semibold mb-4">Data Import</h3>
                <p className="text-sm text-gray-600 mb-4">
                  Import data from a previously exported JSON file.
                </p>
                <div className="p-4 bg-yellow-50 rounded-lg">
                  <p className="text-sm text-yellow-800">
                    <strong>Coming Soon:</strong> Data import functionality is under development.
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
              <div className="p-4 bg-yellow-50 rounded-lg">
                <p className="text-sm text-yellow-800">
                  <strong>Coming Soon:</strong> Audit logging functionality is under development.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SettingsPage;