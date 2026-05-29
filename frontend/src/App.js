// File: frontend/src/App.js
import React, { useEffect } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'reactflow/dist/style.css';
import { Home, Users, Wrench, Network, Settings, Shield, Map, Folder, Search, Building2, Wifi, LogOut } from 'lucide-react';

import { AuthProvider, useAuth } from './contexts/AuthContext';
import { DataProvider, useData } from './contexts/DataContext';
import { UIProvider, useUI } from './contexts/UIContext';

import Dashboard from './components/Dashboard';
import CaseManagement from './components/CaseManagement';
import PeopleList from './components/PeopleList';
import PersonDetailModal from './components/PersonDetailModal';
import AddEditPersonForm from './components/AddEditPersonForm';
import ToolsList from './components/ToolsList';
import AddEditToolForm from './components/AddEditToolForm';
import SettingsPage from './components/SettingsPage';
import RelationshipManager from './components/visualization/RelationshipManager';
import GlobalMap from './components/GlobalMap';
import AdvancedSearch from './components/AdvancedSearch';
import BusinessList from './components/BusinessList';
import AddEditBusinessForm from './components/AddEditBusinessForm';
import DarkModeToggle from './components/DarkModeToggle';
import SystemHealth from './components/SystemHealth';
import WirelessNetworks from './components/WirelessNetworks';
import Login from './components/Login';

// Fix default Leaflet marker icons
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

const navigationItems = [
  { id: 'dashboard',     label: 'Dashboard',         icon: Home },
  { id: 'cases',         label: 'Cases',              icon: Folder },
  { id: 'people',        label: 'People',             icon: Users },
  { id: 'businesses',    label: 'Businesses',         icon: Building2 },
  { id: 'tools',         label: 'OSINT Tools',        icon: Wrench },
  { id: 'relationships', label: 'Entity Network',     icon: Network },
  { id: 'map',           label: 'Locations',          icon: Map },
  { id: 'wireless',      label: 'Wireless Networks',  icon: Wifi },
  { id: 'settings',      label: 'Settings',           icon: Settings },
];

// ── Inner component (has access to all context hooks) ───────────────────────

const AppShell = () => {
  const { authenticated, currentUser, authLoading, handleLogin, handleLogout } = useAuth();
  const { refreshAll, appSettings } = useData();
  const {
    activeSection, setActiveSection,
    selectedPersonForDetail, setSelectedPersonForDetail,
    editingPerson, setEditingPerson,
    showAddPersonForm, setShowAddPersonForm,
    editingTool, setEditingTool,
    showAddToolForm, setShowAddToolForm,
    editingBusiness, setEditingBusiness,
    showAddBusinessForm, setShowAddBusinessForm,
    showAdvancedSearch, setShowAdvancedSearch,
  } = useUI();

  const [darkMode, setDarkMode] = React.useState(() => {
    const saved = localStorage.getItem('darkMode');
    return saved ? JSON.parse(saved) : false;
  });

  // Fetch all data once authenticated
  useEffect(() => {
    if (authenticated) refreshAll();
  }, [authenticated, refreshAll]);

  // Persist dark mode preference and apply CSS class
  useEffect(() => {
    localStorage.setItem('darkMode', JSON.stringify(darkMode));
    document.documentElement.classList.toggle('dark', darkMode);
  }, [darkMode]);

  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-[100dvh] bg-slate-50 dark:bg-slate-900">
        <div className="text-gray-600 dark:text-gray-400">Loading...</div>
      </div>
    );
  }

  if (!authenticated) {
    return <Login onLogin={handleLogin} />;
  }

  return (
    <div className="flex min-h-[100dvh] bg-gradient-to-br from-indigo-50 via-white to-cyan-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 relative overflow-hidden transition-colors duration-150">
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-1/2 -right-1/2 w-full h-full bg-gradient-cosmic opacity-20 dark:opacity-10 rounded-full blur-3xl"></div>
        <div className="absolute -bottom-1/2 -left-1/2 w-full h-full bg-gradient-ocean opacity-15 dark:opacity-8 rounded-full blur-3xl"></div>
      </div>

      {/* Sidebar */}
      <div className="relative w-72 lg:w-72 md:w-64 sm:w-56 glass-card m-4 rounded-glass-lg backdrop-blur-xl border border-white/30 shadow-glass-lg flex-shrink-0">
        <div className="p-6 border-b border-white/20">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              {appSettings.appLogo ? (
                <img src={appSettings.appLogo} alt="Logo" className="h-12 w-12 object-contain rounded-xl shadow-glow-sm" />
              ) : (
                <div className="p-2 rounded-xl bg-gradient-primary shadow-glow-sm">
                  <Shield className="w-8 h-8 text-white" />
                </div>
              )}
              <div>
                <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">{appSettings.appName}</h2>
                <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">OSINT Investigation Suite</p>
              </div>
            </div>
            <DarkModeToggle darkMode={darkMode} setDarkMode={setDarkMode} />
          </div>
        </div>

        <nav className="p-4 space-y-2">
          {navigationItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeSection === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveSection(item.id)}
                className={`w-full text-left p-4 rounded-glass transition-[background-color,box-shadow] duration-150 flex items-center space-x-3 group relative overflow-hidden active:scale-[0.97] ${
                  isActive
                    ? 'bg-gradient-primary text-white shadow-glow-md'
                    : 'glass-button text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-slate-100'
                }`}
              >
                {isActive && <div className="absolute inset-0 bg-gradient-to-r from-white/20 to-transparent opacity-50"></div>}
                <Icon className={`w-5 h-5 transition-colors duration-150 ${isActive ? 'text-white' : 'text-slate-600 dark:text-slate-400 group-hover:text-accent-primary'}`} />
                <span className="font-medium relative z-10">{item.label}</span>
                {isActive && <div className="absolute right-2 w-2 h-2 bg-white rounded-full animate-pulse-soft"></div>}
              </button>
            );
          })}

          <button
            onClick={handleLogout}
            className="w-full text-left p-4 rounded-glass transition-[background-color,box-shadow] duration-150 flex items-center space-x-3 group relative overflow-hidden glass-button text-slate-700 dark:text-slate-300 hover:text-red-600 dark:hover:text-red-400 active:scale-[0.97] mt-4 border-t border-white/20 pt-4"
          >
            <LogOut className="w-5 h-5 transition-colors duration-150" />
            <span className="font-medium relative z-10">Logout</span>
            <span className="text-xs text-gray-500 dark:text-gray-400 ml-auto">{currentUser?.username}</span>
          </button>
        </nav>

        <div className="p-4 border-t border-white/20">
          <button
            onClick={() => setShowAdvancedSearch(true)}
            className="w-full p-4 glass-heavy text-slate-700 rounded-glass hover:shadow-glow-sm transition-[box-shadow] duration-150 flex items-center justify-center space-x-2 group active:scale-[0.97]"
          >
            <Search className="w-5 h-5 text-accent-primary group-hover:animate-pulse" />
            <span className="font-medium">Advanced Search</span>
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 relative flex flex-col m-4">
        <div className="flex-1 glass-card backdrop-blur-xl border border-white/20 shadow-glass-lg rounded-glass-lg overflow-hidden">
          <div className="h-full p-6 overflow-auto">
            <div className="max-w-full mx-auto h-full">

              {activeSection === 'dashboard'     && <Dashboard />}
              {activeSection === 'cases'         && <CaseManagement />}
              {activeSection === 'people'        && <PeopleList />}
              {activeSection === 'tools'         && <ToolsList />}
              {activeSection === 'businesses'    && <BusinessList />}
              {activeSection === 'map'           && <div className="h-full"><GlobalMap /></div>}
              {activeSection === 'wireless'      && <div className="h-full"><WirelessNetworks /></div>}
              {activeSection === 'settings'      && <SettingsPage />}

              {activeSection === 'relationships' && (
                <div className="h-full flex flex-col overflow-hidden">
                  <div className="glass border-b border-white/20 px-6 py-4 flex-shrink-0">
                    <h1 className="text-2xl font-bold bg-gradient-to-r from-gray-900 to-gray-600 dark:from-gray-100 dark:to-gray-300 bg-clip-text text-transparent">Entity Relationship Network</h1>
                    <p className="text-gray-600 dark:text-gray-400 mt-1">Visualize connections between people and businesses</p>
                  </div>
                  <div className="flex-1 min-h-0 relative">
                    <div className="absolute inset-0 overflow-hidden">
                      <RelationshipManager showInModal={false} onClose={() => {}} />
                    </div>
                  </div>
                </div>
              )}

            </div>
          </div>
        </div>
      </div>

      {/* Modals */}
      {showAddPersonForm  && <AddEditPersonForm />}
      {editingPerson      && <AddEditPersonForm />}
      {selectedPersonForDetail && <PersonDetailModal />}
      {showAddToolForm    && <AddEditToolForm tool={null} onSave={() => { setShowAddToolForm(false); }} onCancel={() => setShowAddToolForm(false)} />}
      {editingTool        && <AddEditToolForm tool={editingTool} onSave={() => { setEditingTool(null); }} onCancel={() => setEditingTool(null)} />}
      {showAddBusinessForm && <AddEditBusinessForm business={null} onSave={() => { setShowAddBusinessForm(false); }} onCancel={() => setShowAddBusinessForm(false)} />}
      {editingBusiness    && <AddEditBusinessForm business={editingBusiness} onSave={() => { setEditingBusiness(null); }} onCancel={() => setEditingBusiness(null)} />}
      {showAdvancedSearch && (
        <AdvancedSearch
          onSelectPerson={(person) => { setSelectedPersonForDetail(person); setShowAdvancedSearch(false); }}
          onClose={() => setShowAdvancedSearch(false)}
        />
      )}

      <SystemHealth />
    </div>
  );
};

// ── Root: wrap providers around the shell ────────────────────────────────────

const App = () => (
  <AuthProvider>
    <DataProvider>
      <UIProvider>
        <AppShell />
      </UIProvider>
    </DataProvider>
  </AuthProvider>
);

export default App;
