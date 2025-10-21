// File: frontend/src/App.js
import React, { useState, useEffect } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'reactflow/dist/style.css';
import { Home, Users, Wrench, Network, Settings, Shield, Map, Folder, Search, Building2, Wifi, FileText, LogOut } from 'lucide-react';

// Import API utilities
import { peopleAPI, toolsAPI, todosAPI, customFieldsAPI, businessAPI } from './utils/api';
import { authAPI } from './utils/authAPI';
import { DEFAULT_APP_SETTINGS } from './utils/constants';
// Import components
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
import UserManagement from './components/UserManagement';
import AuditLogs from './components/AuditLogs';

// Fix for default markers in React-Leaflet
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

const App = () => {
  // Authentication state
  const [authenticated, setAuthenticated] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);

  // State management
  const [people, setPeople] = useState([]);
  const [tools, setTools] = useState([]);
  const [todos, setTodos] = useState([]);
  const [customFields, setCustomFields] = useState([]);
  const [appSettings, setAppSettings] = useState(DEFAULT_APP_SETTINGS);
  const [businesses, setBusinesses] = useState([]);
  const [showAddBusinessForm, setShowAddBusinessForm] = useState(false);
  const [editingBusiness, setEditingBusiness] = useState(null);

  // UI state
  const [activeSection, setActiveSection] = useState('dashboard');
  const [showAddPersonForm, setShowAddPersonForm] = useState(false);
  const [showAddToolForm, setShowAddToolForm] = useState(false);
  const [editingPerson, setEditingPerson] = useState(null);
  const [editingTool, setEditingTool] = useState(null);
  const [selectedPersonForDetail, setSelectedPersonForDetail] = useState(null);
  const [showAdvancedSearch, setShowAdvancedSearch] = useState(false);
  const [darkMode, setDarkMode] = useState(() => {
    // Check localStorage for saved preference, default to false
    const saved = localStorage.getItem('darkMode');
    return saved ? JSON.parse(saved) : false;
  });

  // Data fetching functions
  const fetchPeople = async () => {
    try {
      const data = await peopleAPI.getAll();
      setPeople(data);
    } catch (error) {
      console.error('Error fetching people:', error);
    }
  };

  const fetchTools = async () => {
    try {
      const data = await toolsAPI.getAll();
      setTools(data);
    } catch (error) {
      console.error('Error fetching tools:', error);
    }
  };

  const fetchTodos = async () => {
    try {
      const data = await todosAPI.getAll();
      setTodos(data);
    } catch (error) {
      console.error('Error fetching todos:', error);
    }
  };

  const fetchCustomFields = async () => {
    try {
      const data = await customFieldsAPI.getAll();
      setCustomFields(data);
    } catch (error) {
      console.error('Error fetching custom fields:', error);
    }
  };

  const fetchBusinesses = async () => {
    try {
      const data = await businessAPI.getAll();
      setBusinesses(data);
    } catch (error) {
      console.error('Error fetching businesses:', error);
    }
  };

  // Authentication functions
  const checkAuth = async () => {
    try {
      const session = await authAPI.getSession();
      if (session.authenticated) {
        setAuthenticated(true);
        setCurrentUser(session.user);
      } else {
        setAuthenticated(false);
        setCurrentUser(null);
      }
    } catch (error) {
      console.error('Error checking authentication:', error);
      setAuthenticated(false);
      setCurrentUser(null);
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogin = async (username, password) => {
    const result = await authAPI.login(username, password);
    setAuthenticated(true);
    setCurrentUser(result.user);
  };

  const handleLogout = async () => {
    try {
      await authAPI.logout();
      setAuthenticated(false);
      setCurrentUser(null);
      setActiveSection('dashboard');
    } catch (error) {
      console.error('Error logging out:', error);
    }
  };

  // Check authentication on mount
  useEffect(() => {
    checkAuth();
  }, []);

  // Load data when authenticated
  useEffect(() => {
    if (authenticated) {
      fetchPeople();
      fetchTools();
      fetchTodos();
      fetchCustomFields();
      fetchBusinesses();

      // Load app settings from localStorage
      const savedSettings = localStorage.getItem('appSettings');
      if (savedSettings) {
        setAppSettings(JSON.parse(savedSettings));
      }
    }
  }, [authenticated]);

  // Handle dark mode changes
  useEffect(() => {
    // Save preference to localStorage
    localStorage.setItem('darkMode', JSON.stringify(darkMode));
    
    // Apply dark class to document element
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [darkMode]);

  // Handle app name change
  const handleAppNameChange = (newName) => {
    const updatedSettings = { ...appSettings, appName: newName };
    setAppSettings(updatedSettings);
    localStorage.setItem('appSettings', JSON.stringify(updatedSettings));
  };

  // Navigation items
  const navigationItems = [
    { id: 'dashboard', label: 'Dashboard', icon: Home },
    { id: 'cases', label: 'Cases', icon: Folder },
    { id: 'people', label: 'People', icon: Users },
    { id: 'businesses', label: 'Businesses', icon: Building2 },
    { id: 'tools', label: 'OSINT Tools', icon: Wrench },
    { id: 'relationships', label: 'Entity Network', icon: Network },
    { id: 'map', label: 'Locations', icon: Map },
    { id: 'wireless', label: 'Wireless Networks', icon: Wifi },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  // Admin-only navigation items
  const adminNavigationItems = currentUser?.role === 'admin' ? [
    { id: 'users', label: 'User Management', icon: Users },
    { id: 'audit-logs', label: 'Audit Logs', icon: FileText },
  ] : [];

  const allNavigationItems = [...navigationItems, ...adminNavigationItems];

  // Show loading state while checking authentication
  if (authLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50 dark:bg-gray-900">
        <div className="text-gray-600 dark:text-gray-400">Loading...</div>
      </div>
    );
  }

  // Show login if not authenticated
  if (!authenticated) {
    return <Login onLogin={handleLogin} />;
  }

  return (
    <div className="flex h-screen bg-gradient-to-br from-indigo-50 via-white to-cyan-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 relative overflow-hidden transition-colors duration-500">
      {/* Mobile overlay for small screens */}
      <div className="lg:hidden fixed inset-0 bg-black/50 z-40" style={{ display: 'none' }} id="mobile-overlay"></div>
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-1/2 -right-1/2 w-full h-full bg-gradient-cosmic opacity-20 dark:opacity-10 rounded-full blur-3xl"></div>
        <div className="absolute -bottom-1/2 -left-1/2 w-full h-full bg-gradient-ocean opacity-15 dark:opacity-8 rounded-full blur-3xl"></div>
      </div>
      
      {/* Sidebar */}
      <div className="relative w-72 lg:w-72 md:w-64 sm:w-56 glass-card m-4 rounded-glass-lg backdrop-blur-xl border border-white/30 shadow-glass-lg flex-shrink-0">
        {/* Header */}
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
                <h2 className="text-xl font-bold bg-gradient-to-r from-gray-900 to-gray-600 bg-clip-text text-transparent dark:from-gray-100 dark:to-gray-300">{appSettings.appName}</h2>
                <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">OSINT Investigation Suite</p>
              </div>
            </div>
            {/* Dark Mode Toggle */}
            <DarkModeToggle darkMode={darkMode} setDarkMode={setDarkMode} />
          </div>
        </div>
        
        {/* Navigation */}
        <nav className="p-4 space-y-2">
          {allNavigationItems.map((item, index) => {
            const Icon = item.icon;
            const isActive = activeSection === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveSection(item.id)}
                className={`w-full text-left p-4 rounded-glass transition-all duration-300 flex items-center space-x-3 group relative overflow-hidden ${
                  isActive
                    ? 'bg-gradient-primary text-white shadow-glow-md'
                    : 'glass-button text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100'
                }`}
                style={{ animationDelay: `${index * 50}ms` }}
              >
                {isActive && (
                  <div className="absolute inset-0 bg-gradient-to-r from-white/20 to-transparent opacity-50"></div>
                )}
                <Icon className={`w-5 h-5 transition-all duration-300 ${isActive ? 'text-white' : 'text-gray-600 dark:text-gray-400 group-hover:text-accent-primary'}`} />
                <span className="font-medium relative z-10">{item.label}</span>
                {isActive && (
                  <div className="absolute right-2 w-2 h-2 bg-white rounded-full animate-pulse-soft"></div>
                )}
              </button>
            );
          })}

          {/* Logout button */}
          <button
            onClick={handleLogout}
            className="w-full text-left p-4 rounded-glass transition-all duration-300 flex items-center space-x-3 group relative overflow-hidden glass-button text-gray-700 dark:text-gray-300 hover:text-red-600 dark:hover:text-red-400 mt-4 border-t border-white/20 pt-4"
          >
            <LogOut className="w-5 h-5 transition-all duration-300" />
            <span className="font-medium relative z-10">Logout</span>
            <span className="text-xs text-gray-500 dark:text-gray-400 ml-auto">{currentUser?.username}</span>
          </button>
        </nav>
        
        {/* Advanced Search Button */}
        <div className="p-4 border-t border-white/20">
          <button
            onClick={() => setShowAdvancedSearch(true)}
            className="w-full p-4 glass-heavy text-gray-700 rounded-glass hover:shadow-glow-sm transition-all duration-300 flex items-center justify-center space-x-2 group"
          >
            <Search className="w-5 h-5 text-accent-primary group-hover:animate-pulse" />
            <span className="font-medium">Advanced Search</span>
          </button>
        </div>
        
      </div>
      
      {/* Main Content */}
      <div className="flex-1 relative flex flex-col m-4">
        {/* Content Container */}
        <div className="flex-1 glass-card backdrop-blur-xl border border-white/20 shadow-glass-lg rounded-glass-lg overflow-hidden">
          <div className="h-full p-6 overflow-auto">
            <div className="max-w-full mx-auto h-full">
        {activeSection === 'dashboard' && (
          <Dashboard 
            people={people}
            tools={tools}
            todos={todos}
            setTodos={setTodos}
            setSelectedPersonForDetail={setSelectedPersonForDetail}
            setActiveSection={setActiveSection}
          />
        )}
        
        {activeSection === 'cases' && (
          <CaseManagement
            people={people}
            fetchPeople={fetchPeople}
            setEditingPerson={setEditingPerson}
            setShowAddPersonForm={setShowAddPersonForm}
            setSelectedPersonForDetail={setSelectedPersonForDetail}
          />
        )}
        
        {activeSection === 'people' && (
          <PeopleList 
            people={people}
            fetchPeople={fetchPeople}
            setShowAddPersonForm={setShowAddPersonForm}
            setEditingPerson={setEditingPerson}
            setSelectedPersonForDetail={setSelectedPersonForDetail}
          />
        )}
        
        {activeSection === 'tools' && (
          <ToolsList 
            tools={tools}
            fetchTools={fetchTools}
            setShowAddToolForm={setShowAddToolForm}
            setEditingTool={setEditingTool}
          />
        )}

        {activeSection === 'businesses' && (
          <BusinessList 
            businesses={businesses}
            fetchBusinesses={fetchBusinesses}
            setShowAddBusinessForm={setShowAddBusinessForm}
            setEditingBusiness={setEditingBusiness}
          />
        )}        

        {activeSection === 'relationships' && (
          <div className="h-full flex flex-col overflow-hidden">
            <div className="glass border-b border-white/20 px-6 py-4 flex-shrink-0">
              <h1 className="text-2xl font-bold bg-gradient-to-r from-gray-900 to-gray-600 dark:from-gray-100 dark:to-gray-300 bg-clip-text text-transparent">Entity Relationship Network</h1>
              <p className="text-gray-600 dark:text-gray-400 mt-1">Visualize connections between people and businesses</p>
            </div>
            <div className="flex-1 min-h-0 relative">
              <div className="absolute inset-0 overflow-hidden">
                <RelationshipManager 
                  showInModal={false}
                  onClose={() => {}}
                />
              </div>
            </div>
          </div>
        )}
        
        {activeSection === 'map' && (
          <div className="h-full">
            <GlobalMap />
          </div>
        )}

        {activeSection === 'wireless' && (
          <div className="h-full">
            <WirelessNetworks />
          </div>
        )}

        {activeSection === 'settings' && (
          <SettingsPage
            appSettings={appSettings}
            customFields={customFields}
            fetchCustomFields={fetchCustomFields}
            handleAppNameChange={handleAppNameChange}
            setAppSettings={setAppSettings}
          />
        )}

        {activeSection === 'users' && currentUser?.role === 'admin' && (
          <UserManagement />
        )}

        {activeSection === 'audit-logs' && currentUser?.role === 'admin' && (
          <AuditLogs />
        )}
            </div>
          </div>
        </div>
      </div>
      
      {/* Modals */}
      {showAddPersonForm && (
        <AddEditPersonForm
          person={null}
          people={people}
          customFields={customFields}
          onSave={() => {
            setShowAddPersonForm(false);
            fetchPeople();
          }}
          onCancel={() => setShowAddPersonForm(false)}
        />
      )}
      
      {editingPerson && (
        <AddEditPersonForm
          person={editingPerson}
          people={people}
          customFields={customFields}
          onSave={() => {
            setEditingPerson(null);
            fetchPeople();
          }}
          onCancel={() => setEditingPerson(null)}
        />
      )}
      
      {selectedPersonForDetail && (
        <PersonDetailModal
          person={selectedPersonForDetail}
          people={people}
          customFields={customFields}
          onClose={() => setSelectedPersonForDetail(null)}
          onEdit={(person) => {
            setSelectedPersonForDetail(null);
            setEditingPerson(person);
          }}
        />
      )}
      
      {showAddToolForm && (
        <AddEditToolForm
          tool={null}
          onSave={() => {
            setShowAddToolForm(false);
            fetchTools();
          }}
          onCancel={() => setShowAddToolForm(false)}
        />
      )}
      
      {editingTool && (
        <AddEditToolForm
          tool={editingTool}
          onSave={() => {
            setEditingTool(null);
            fetchTools();
          }}
          onCancel={() => setEditingTool(null)}
        />
      )}
      
      {/* Advanced Search Modal */}
      {showAdvancedSearch && (
        <AdvancedSearch
          onSelectPerson={(person) => {
            setSelectedPersonForDetail(person);
            setShowAdvancedSearch(false);
          }}
          onClose={() => setShowAdvancedSearch(false)}
        />
      )}

      {/* Business Modals */}
      {showAddBusinessForm && (
        <AddEditBusinessForm
          business={null}
          onSave={() => {
            setShowAddBusinessForm(false);
            fetchBusinesses();
          }}
          onCancel={() => setShowAddBusinessForm(false)}
        />
      )}

      {editingBusiness && (
        <AddEditBusinessForm
          business={editingBusiness}
          onSave={() => {
            setEditingBusiness(null);
            fetchBusinesses();
          }}
          onCancel={() => setEditingBusiness(null)}
        />
      )}

      {/* System Health Status - Fixed Bottom Right */}
      <SystemHealth />
    </div>
  );
};

export default App;