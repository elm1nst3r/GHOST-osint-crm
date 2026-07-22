// File: frontend/src/components/SettingsPage.js
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../contexts/AuthContext';
import GeneralTab from './settings/GeneralTab';
import AppearanceTab from './settings/AppearanceTab';
import DataModelTab from './settings/DataModelTab';
import ImportExportTab from './settings/ImportExportTab';
import ProfileTab from './settings/ProfileTab';
import UserManagement from './UserManagement';
import AuditLogs from './AuditLogs';

const SettingsPage = () => {
  const { currentUser } = useAuth();
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState('general');

  const tabs = [
    { id: 'general',        label: t('settings.tabs.general') },
    { id: 'appearance',     label: t('settings.tabs.appearance') },
    { id: 'profile',        label: t('settings.tabs.profile') },
    { id: 'data-model',     label: t('settings.tabs.dataModel') },
    { id: 'import-export',  label: t('settings.tabs.importExport') },
    ...(currentUser?.role === 'admin' ? [
      { id: 'users',       label: t('settings.tabs.users') },
      { id: 'audit-logs',  label: t('settings.tabs.auditLogs') },
    ] : []),
  ];

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-6">{t('settings.pageTitle')}</h1>

      <div className="glass-card">
        {/* Tab Navigation */}
        <div className="border-b border-slate-200 dark:border-slate-700">
          <nav className="flex space-x-8 px-6 overflow-x-auto" aria-label="Tabs">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`py-4 px-1 border-b-2 font-medium text-sm whitespace-nowrap transition-colors duration-150 ${
                  activeTab === tab.id
                    ? 'border-accent-primary text-accent-primary'
                    : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:border-slate-300 dark:hover:border-slate-600'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        {/* Tab Content */}
        <div className="p-6">
          {activeTab === 'general'       && <GeneralTab />}
          {activeTab === 'appearance'    && <AppearanceTab />}
          {activeTab === 'profile'       && <ProfileTab />}
          {activeTab === 'data-model'    && <DataModelTab />}
          {activeTab === 'import-export' && <ImportExportTab />}
          {activeTab === 'users'         && currentUser?.role === 'admin' && <UserManagement />}
          {activeTab === 'audit-logs'    && currentUser?.role === 'admin' && <AuditLogs />}
        </div>
      </div>
    </div>
  );
};

export default SettingsPage;
