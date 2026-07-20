import React, { useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Save, Upload, Shield } from 'lucide-react';
import { uploadLogo } from '../../utils/api';
import { useData } from '../../contexts/DataContext';
import { SUPPORTED_LANGUAGES, changeLanguage } from '../../i18n';

const GeneralTab = () => {
  const { appSettings, setAppSettings, handleAppNameChange } = useData();
  const { t, i18n } = useTranslation();
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
      alert(t('settings.general.logoUploadFailed'));
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-4">{t('settings.general.appConfiguration')}</h3>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">{t('settings.general.appName')}</label>
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
            <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">{t('settings.general.appLogo')}</label>
            <div className="flex items-center space-x-4">
              {appSettings.appLogo ? (
                <img src={appSettings.appLogo} alt={t('settings.general.appLogoAlt')} className="h-16 w-16 object-contain rounded" />
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
                  {t('settings.general.uploadLogo')}
                </button>
                <p className="text-xs text-gray-500 dark:text-slate-400 mt-1">{t('settings.general.logoHelp')}</p>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">{t('settings.general.language')}</label>
            <select
              value={i18n.language}
              onChange={(e) => changeLanguage(e.target.value)}
              className="w-full max-w-xs px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-slate-700 dark:border-slate-600 dark:text-slate-200"
            >
              {SUPPORTED_LANGUAGES.map((lang) => (
                <option key={lang.code} value={lang.code}>{lang.label}</option>
              ))}
            </select>
            <p className="text-xs text-gray-500 dark:text-slate-400 mt-1">{t('settings.general.languageHelp')}</p>
          </div>
        </div>
      </div>

      <div>
        <h3 className="text-lg font-semibold mb-4">{t('settings.general.systemInformation')}</h3>
        <div className="space-y-2 text-sm">
          <div><span className="font-medium">{t('settings.general.version')}</span> 1.0.0</div>
          <div><span className="font-medium">{t('settings.general.database')}</span> PostgreSQL</div>
          <div><span className="font-medium">{t('settings.general.apiUrl')}</span> {process.env.REACT_APP_API_URL || 'http://localhost:3001/api'}</div>
        </div>
      </div>
    </div>
  );
};

export default GeneralTab;
