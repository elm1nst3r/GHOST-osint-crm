// File: frontend/src/components/SettingsPage.js
import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import GeneralTab from './settings/GeneralTab';
import DataModelTab from './settings/DataModelTab';
import ImportExportTab from './settings/ImportExportTab';
import ProfileTab from './settings/ProfileTab';
import UserManagement from './UserManagement';
import AuditLogs from './AuditLogs';

const SettingsPage = () => {
  const { currentUser } = useAuth();
  const [activeTab, setActiveTab] = useState('general');

  const tabs = [
    { id: 'general',        label: 'General' },
    { id: 'profile',        label: 'My Profile' },
    { id: 'data-model',     label: 'Data Model' },
    { id: 'import-export',  label: 'Import/Export' },
    ...(currentUser?.role === 'admin' ? [
      { id: 'users',       label: 'User Management' },
      { id: 'audit-logs',  label: 'Audit Logs' },
    ] : []),
  ];

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-slate-100 mb-6">Settings</h1>

      <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border">
        {/* Tab Navigation */}
        <div className="border-b">
          <nav className="flex space-x-8 px-6" aria-label="Tabs">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`py-4 px-1 border-b-2 font-medium text-sm whitespace-nowrap ${
                  activeTab === tab.id
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200 hover:border-gray-300'
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
