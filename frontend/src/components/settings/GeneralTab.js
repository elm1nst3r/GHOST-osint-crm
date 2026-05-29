import React, { useState, useRef } from 'react';
import { Save, Upload, Shield } from 'lucide-react';
import { uploadLogo } from '../../utils/api';
import { useData } from '../../contexts/DataContext';

const GeneralTab = () => {
  const { appSettings, setAppSettings, handleAppNameChange } = useData();
  const [tempAppName, setTempAppName] = useState(appSettings.appName);
  const fileInputRef = useRef(null);

  const saveAppName = () => handleAppNameChange(tempAppName);

  const handleLogoUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;
    try {
      const logoUrl = await uploadLogo(file);
      setAppSettings({ ...appSettings, appLogo: logoUrl });
    } catch (error) {
      console.error('Error uploading logo:', error);
      alert('Failed to upload logo');
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-4">Application Configuration</h3>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">Application Name</label>
            <div className="flex space-x-2">
              <input
                type="text"
                value={tempAppName}
                onChange={(e) => setTempAppName(e.target.value)}
                className="flex-1 px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button onClick={saveAppName} className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 flex items-center">
                <Save className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">Application Logo</label>
            <div className="flex items-center space-x-4">
              {appSettings.appLogo ? (
                <img src={appSettings.appLogo} alt="App Logo" className="h-16 w-16 object-contain rounded" />
              ) : (
                <div className="h-16 w-16 bg-gray-200 dark:bg-slate-600 rounded flex items-center justify-center">
                  <Shield className="w-8 h-8 text-gray-400 dark:text-slate-500" />
                </div>
              )}
              <div>
                <input ref={fileInputRef} type="file" accept="image/png,image/jpeg,image/gif" onChange={handleLogoUpload} className="hidden" />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="px-4 py-2 bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-slate-300 rounded-md hover:bg-gray-200 flex items-center"
                >
                  <Upload className="w-4 h-4 mr-2" />
                  Upload Logo
                </button>
                <p className="text-xs text-gray-500 dark:text-slate-400 mt-1">PNG, JPG, GIF, or SVG. Max 5MB.</p>
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
  );
};

export default GeneralTab;
