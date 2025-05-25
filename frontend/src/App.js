// File: frontend/src/App.js
import React, { useState, useEffect } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'reactflow/dist/style.css';
import { Home, Users, Wrench, Network, Settings, Shield, Map, Folder, Search } from 'lucide-react';

// Import API utilities
import { peopleAPI, toolsAPI, todosAPI, customFieldsAPI } from './utils/api';
import { DEFAULT_APP_SETTINGS } from './utils/constants';
import TravelPatternAnalysis from './components/TravelPatternAnalysis';

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
import RelationshipDiagram from './components/RelationshipDiagram';
import GlobalMap from './components/GlobalMap';
import AdvancedSearch from './components/AdvancedSearch';

// Fix for default markers in React-Leaflet
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

const App = () => {
  // State management
  const [people, setPeople] = useState([]);
  const [tools, setTools] = useState([]);
  const [todos, setTodos] = useState([]);
  const [customFields, setCustomFields] = useState([]);
  const [appSettings, setAppSettings] = useState(DEFAULT_APP_SETTINGS);
  
  // UI state
  const [activeSection, setActiveSection] = useState('dashboard');
  const [showAddPersonForm, setShowAddPersonForm] = useState(false);
  const [showAddToolForm, setShowAddToolForm] = useState(false);
  const [editingPerson, setEditingPerson] = useState(null);
  const [editingTool, setEditingTool] = useState(null);
  const [selectedPersonForDetail, setSelectedPersonForDetail] = useState(null);
  const [showAdvancedSearch, setShowAdvancedSearch] = useState(false);

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

  // Load data on component mount
  useEffect(() => {
    fetchPeople();
    fetchTools();
    fetchTodos();
    fetchCustomFields();
    
    // Load app settings from localStorage
    const savedSettings = localStorage.getItem('appSettings');
    if (savedSettings) {
      setAppSettings(JSON.parse(savedSettings));
    }
  }, []);

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
    { id: 'tools', label: 'OSINT Tools', icon: Wrench },
    { id: 'relationships', label: 'Relationships', icon: Network },
    { id: 'map', label: 'Locations', icon: Map },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  return (
    <div className="flex h-screen bg-gray-100">
      {/* Sidebar */}
      <div className="w-64 bg-gray-900 text-white">
        <div className="p-6">
          <div className="flex items-center space-x-3">
            {appSettings.appLogo ? (
              <img src={appSettings.appLogo} alt="Logo" className="h-10 w-10 object-contain" />
            ) : (
              <Shield className="w-10 h-10 text-blue-400" />
            )}
            <h2 className="text-xl font-bold">{appSettings.appName}</h2>
          </div>
        </div>
        
        <nav className="mt-6">
          {navigationItems.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                onClick={() => setActiveSection(item.id)}
                className={`w-full text-left px-6 py-3 transition-colors duration-200 flex items-center space-x-3 ${
                  activeSection === item.id ? 'bg-blue-700 text-white' : 'text-gray-100 hover:bg-blue-700'
                }`}
              >
                <Icon className="w-5 h-5" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>
        
        {/* Advanced Search Button */}
        <div className="px-6 mt-6">
          <button
            onClick={() => setShowAdvancedSearch(true)}
            className="w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 flex items-center justify-center"
          >
            <Search className="w-4 h-4 mr-2" />
            Advanced Search
          </button>
        </div>
      </div>
      
      {/* Main Content */}
      <div className="flex-1 overflow-auto">
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
        
        {activeSection === 'relationships' && (
          <div className="h-full flex flex-col">
            <div className="bg-white shadow-sm border-b px-6 py-4">
              <h1 className="text-2xl font-bold text-gray-900">Relationship Network</h1>
              <p className="text-gray-600 mt-1">Visualize and manage connections between people</p>
            </div>
            <div className="flex-1 p-6">
              <div className="bg-white rounded-lg shadow-sm border h-full">
                <RelationshipManager />
              </div>
            </div>
          </div>
        )}
        
        {activeSection === 'map' && (
          <GlobalMap />
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
    </div>
  );
};

export default App;