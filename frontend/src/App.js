// File: frontend/src/App.js
import React, { useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import ReactFlow, { MiniMap, Controls, Background, useNodesState, useEdgesState } from 'reactflow';
import 'reactflow/dist/style.css';
import { User, Database, Mail, Phone, Globe, MapPin, Hash, Link, Search, Plus, Edit2, Trash2, X, Calendar, Tag, Briefcase, Home, Settings, ChevronDown, Check, Upload, Save, RefreshCw, FileText, Download, Activity, Users, Wrench, Shield, Network, Eye, EyeOff, Maximize2 } from 'lucide-react';

// Import the relationship components
import RelationshipDiagram from './components/RelationshipDiagram';
import RelationshipManager from './components/RelationshipManager';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';

// Fix for default markers in React-Leaflet
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

const App = () => {
  const [people, setPeople] = useState([]);
  const [tools, setTools] = useState([]);
  const [todos, setTodos] = useState([]);
  const [selectedPerson, setSelectedPerson] = useState(null);
  const [selectedTool, setSelectedTool] = useState(null);
  const [showAddPersonForm, setShowAddPersonForm] = useState(false);
  const [showAddToolForm, setShowAddToolForm] = useState(false);
  const [editingPerson, setEditingPerson] = useState(null);
  const [editingTool, setEditingTool] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [toolSearchTerm, setToolSearchTerm] = useState('');
  const [activeSection, setActiveSection] = useState('dashboard');
  const [filterCategory, setFilterCategory] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [selectedPersonForDetail, setSelectedPersonForDetail] = useState(null);
  const [appSettings, setAppSettings] = useState({
    appName: 'OSINT Investigation CRM',
    appLogo: null
  });
  const [customFields, setCustomFields] = useState([]);
  const fileInputRef = useRef(null);

  useEffect(() => {
    fetchPeople();
    fetchTools();
    fetchTodos();
    fetchCustomFields();
    
    const savedSettings = localStorage.getItem('appSettings');
    if (savedSettings) {
      setAppSettings(JSON.parse(savedSettings));
    }
  }, []);

  const fetchPeople = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/people`);
      const data = await response.json();
      setPeople(data);
    } catch (error) {
      console.error('Error fetching people:', error);
    }
  };

  const fetchTools = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/tools`);
      const data = await response.json();
      setTools(data);
    } catch (error) {
      console.error('Error fetching tools:', error);
    }
  };

  const fetchTodos = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/todos`);
      const data = await response.json();
      setTodos(data);
    } catch (error) {
      console.error('Error fetching todos:', error);
    }
  };

  const fetchCustomFields = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/settings/custom-fields`);
      const data = await response.json();
      setCustomFields(data);
    } catch (error) {
      console.error('Error fetching custom fields:', error);
    }
  };

  const handleAppNameChange = (newName) => {
    const updatedSettings = { ...appSettings, appName: newName };
    setAppSettings(updatedSettings);
    localStorage.setItem('appSettings', JSON.stringify(updatedSettings));
  };

  const handleLogoUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('appLogo', file);

    try {
      const response = await fetch(`${API_BASE_URL}/upload/logo`, {
        method: 'POST',
        body: formData
      });

      if (response.ok) {
        const data = await response.json();
        const updatedSettings = { ...appSettings, appLogo: `${API_BASE_URL.replace('/api', '')}${data.logoUrl}` };
        setAppSettings(updatedSettings);
        localStorage.setItem('appSettings', JSON.stringify(updatedSettings));
      } else {
        console.error('Logo upload failed');
      }
    } catch (error) {
      console.error('Error uploading logo:', error);
    }
  };

  const getRelationshipCount = (personId) => {
    const person = people.find(p => p.id === personId);
    if (!person) return 0;
    
    const directConnections = person.connections?.length || 0;
    const reverseConnections = people.filter(p => 
      p.connections?.some(c => c.person_id === personId)
    ).length;
    
    return Math.max(directConnections, reverseConnections);
  };

  const Dashboard = () => {
    const activePeople = people.filter(p => p.status === 'Open' || p.status === 'Being Investigated').slice(0, 5);
    const [newTodo, setNewTodo] = useState('');

    const handleAddTodo = async () => {
      if (!newTodo.trim()) return;

      try {
        const response = await fetch(`${API_BASE_URL}/todos`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: newTodo, status: 'open' })
        });

        if (response.ok) {
          const todo = await response.json();
          setTodos([todo, ...todos]);
          setNewTodo('');
        }
      } catch (error) {
        console.error('Error adding todo:', error);
      }
    };

    const handleUpdateTodo = async (id, updates) => {
      try {
        const response = await fetch(`${API_BASE_URL}/todos/${id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updates)
        });

        if (response.ok) {
          const updatedTodo = await response.json();
          setTodos(todos.map(todo => todo.id === id ? updatedTodo : todo));
        }
      } catch (error) {
        console.error('Error updating todo:', error);
      }
    };

    const handleDeleteTodo = async (id) => {
      try {
        const response = await fetch(`${API_BASE_URL}/todos/${id}`, {
          method: 'DELETE'
        });

        if (response.ok) {
          setTodos(todos.filter(todo => todo.id !== id));
        }
      } catch (error) {
        console.error('Error deleting todo:', error);
      }
    };

    return (
      <div className="p-6 space-y-6">
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white rounded-lg shadow-sm p-6 border">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">OSINT Tools</p>
                <p className="text-3xl font-bold text-gray-900">{tools.length}</p>
              </div>
              <Wrench className="w-8 h-8 text-blue-500" />
            </div>
          </div>
          
          <div className="bg-white rounded-lg shadow-sm p-6 border">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Active Investigations</p>
                <p className="text-3xl font-bold text-gray-900">{people.filter(p => p.status === 'Open' || p.status === 'Being Investigated').length}</p>
              </div>
              <Users className="w-8 h-8 text-green-500" />
            </div>
          </div>
          
          <div className="bg-white rounded-lg shadow-sm p-6 border">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Open To-Dos</p>
                <p className="text-3xl font-bold text-gray-900">{todos.filter(t => t.status === 'open').length}</p>
              </div>
              <Activity className="w-8 h-8 text-yellow-500" />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-lg shadow-sm p-6 border">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Active People/Cases</h3>
            <div className="space-y-3">
              {activePeople.map(person => (
                <div key={person.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div>
                    <p className="font-medium text-gray-900">{person.name}</p>
                    <p className="text-sm text-gray-600">{person.case_name || 'No case assigned'}</p>
                    <div className="flex items-center mt-1 text-xs text-gray-500">
                      <Network className="w-3 h-3 mr-1" />
                      {getRelationshipCount(person.id)} connections
                    </div>
                  </div>
                  <button onClick={() => setSelectedPersonForDetail(person)} className="text-blue-600 hover:text-blue-700 text-sm">
                    View Details
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm p-6 border">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">To-Do List</h3>
            <div className="mb-4 flex space-x-2">
              <input
                type="text"
                value={newTodo}
                onChange={(e) => setNewTodo(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleAddTodo()}
                placeholder="Add a new task..."
                className="flex-1 px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button onClick={handleAddTodo} className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700">
                Add
              </button>
            </div>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {todos.map(todo => (
                <div key={todo.id} className="flex items-center space-x-2 p-2 hover:bg-gray-50 rounded">
                  <input
                    type="checkbox"
                    checked={todo.status === 'done'}
                    onChange={(e) => handleUpdateTodo(todo.id, { status: e.target.checked ? 'done' : 'open' })}
                    className="h-4 w-4 text-blue-600 rounded"
                  />
                  <span className={`flex-1 ${todo.status === 'done' ? 'line-through text-gray-500' : 'text-gray-900'}`}>
                    {todo.text}
                  </span>
                  <button onClick={() => handleDeleteTodo(todo.id)} className="text-red-600 hover:text-red-700">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm p-6 border">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Global Relationship Overview</h3>
            <button
              onClick={() => setActiveSection('relationships')}
              className="text-sm text-blue-600 hover:text-blue-700"
            >
              View Full Network →
            </button>
          </div>
          <div className="h-64 bg-gray-50 rounded-lg overflow-hidden">
            <RelationshipManager 
              showInModal={true}
              onClose={() => {}}
            />
          </div>
        </div>
      </div>
    );
  };

  const PersonNode = ({ data }) => {
    return (
      <div className="px-4 py-2 shadow-md rounded-md border-2 border-stone-400">
        <div className="flex items-center">
          <User className="w-4 h-4 mr-2" />
          <div className="text-sm font-bold">{data.label}</div>
        </div>
      </div>
    );
  };

  const OsintDataNode = ({ data }) => {
    const iconMap = {
      'Social Media': <Database className="w-4 h-4" />,
      'Email': <Mail className="w-4 h-4" />,
      'Phone': <Phone className="w-4 h-4" />,
      'Website': <Globe className="w-4 h-4" />,
      'Location': <MapPin className="w-4 h-4" />,
      'Username': <Hash className="w-4 h-4" />,
      'Other': <Link className="w-4 h-4" />
    };
    
    const icon = iconMap[data.type] || iconMap['Other'];
    
    return (
      <div className="px-3 py-2 shadow-sm rounded-md bg-gray-50 border border-gray-200">
        <div className="flex items-center">
          {icon}
          <div className="ml-2">
            <div className="text-xs font-medium">{data.type}</div>
            <div className="text-xs text-gray-600">{data.value}</div>
          </div>
        </div>
      </div>
    );
  };

  const nodeTypes = {
    person: PersonNode,
    osintData: OsintDataNode,
  };

  const PersonDetailModal = ({ person, onClose, onEdit }) => {
    const [activeTab, setActiveTab] = useState('details');
    const [nodes, setNodes, onNodesChange] = useNodesState([]);
    const [edges, setEdges, onEdgesChange] = useEdgesState([]);
    
    useEffect(() => {
      if (!person) return;
      
      const newNodes = [];
      const newEdges = [];
      
      const personNode = {
        id: 'person-1',
        type: 'person',
        position: { x: 250, y: 25 },
        data: { label: person.name }
      };
      newNodes.push(personNode);
      
      if (person.osint_data && Array.isArray(person.osint_data)) {
        person.osint_data.forEach((osint, index) => {
          const angle = (2 * Math.PI * index) / person.osint_data.length;
          const radius = 150;
          const x = 250 + radius * Math.cos(angle);
          const y = 150 + radius * Math.sin(angle);
          
          newNodes.push({
            id: `osint-${index}`,
            type: 'osintData',
            position: { x, y },
            data: { type: osint.type, value: osint.value }
          });
          
          newEdges.push({
            id: `edge-person-osint-${index}`,
            source: 'person-1',
            target: `osint-${index}`,
            animated: true,
            style: { stroke: '#888' }
          });
        });
      }
      
      if (person.connections && Array.isArray(person.connections)) {
        person.connections.forEach((conn, index) => {
          const connectedPerson = people.find(p => p.id === conn.person_id);
          if (connectedPerson) {
            const angle = (2 * Math.PI * (index + (person.osint_data?.length || 0))) / 
                          ((person.connections?.length || 0) + (person.osint_data?.length || 0));
            const radius = 200;
            const x = 250 + radius * Math.cos(angle);
            const y = 150 + radius * Math.sin(angle);
            
            newNodes.push({
              id: `connected-person-${conn.person_id}`,
              type: 'person',
              position: { x, y },
              data: { label: connectedPerson.name }
            });
            
            newEdges.push({
              id: `edge-connection-${conn.person_id}`,
              source: 'person-1',
              target: `connected-person-${conn.person_id}`,
              label: conn.type || 'Connected',
              style: { stroke: '#3b82f6', strokeWidth: 2 }
            });
          }
        });
      }
      
      setNodes(newNodes);
      setEdges(newEdges);
    }, [person, people, setNodes, setEdges]);

    if (!person) return null;

    const validLocations = person.osint_data?.filter(
      osint => osint.type === 'Location' && osint.lat && osint.lng
    ) || [];

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden">
          <div className="p-6 border-b flex justify-between items-center">
            <h2 className="text-2xl font-bold text-gray-900">{person.name}</h2>
            <div className="flex space-x-2">
              <button onClick={() => onEdit(person)} className="text-blue-600 hover:text-blue-700">
                <Edit2 className="w-5 h-5" />
              </button>
              <button onClick={onClose} className="text-gray-600 hover:text-gray-700">
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>
          
          <div className="border-b">
            <div className="flex">
              <button
                onClick={() => setActiveTab('details')}
                className={`px-4 py-2 font-medium text-sm border-b-2 ${
                  activeTab === 'details' 
                    ? 'border-blue-500 text-blue-600' 
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                Details
              </button>
              <button
                onClick={() => setActiveTab('relationships')}
                className={`px-4 py-2 font-medium text-sm border-b-2 ${
                  activeTab === 'relationships' 
                    ? 'border-blue-500 text-blue-600' 
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                Relationships
              </button>
              <button
                onClick={() => setActiveTab('locations')}
                className={`px-4 py-2 font-medium text-sm border-b-2 ${
                  activeTab === 'locations' 
                    ? 'border-blue-500 text-blue-600' 
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                Locations
              </button>
            </div>
          </div>
          
          <div className="overflow-y-auto" style={{ maxHeight: 'calc(90vh - 200px)' }}>
            {activeTab === 'details' && (
              <div className="p-6">
                <div className="grid grid-cols-2 gap-6 mb-6">
                  <div>
                    <h3 className="text-lg font-semibold mb-3">Basic Information</h3>
                    <div className="space-y-2">
                      {person.aliases && person.aliases.length > 0 && (
                        <div><span className="font-medium">Aliases:</span> {person.aliases.join(', ')}</div>
                      )}
                      {person.date_of_birth && (
                        <div><span className="font-medium">Date of Birth:</span> {new Date(person.date_of_birth).toLocaleDateString()}</div>
                      )}
                      <div><span className="font-medium">Category:</span> {person.category || 'N/A'}</div>
                      <div><span className="font-medium">Status:</span> {person.status || 'N/A'}</div>
                      <div><span className="font-medium">CRM Status:</span> {person.crm_status || 'N/A'}</div>
                      {person.case_name && (
                        <div><span className="font-medium">Case:</span> {person.case_name}</div>
                      )}
                    </div>
                  </div>
                  
                  <div>
                    <h3 className="text-lg font-semibold mb-3">Additional Details</h3>
                    {person.notes && (
                      <div className="mb-3">
                        <span className="font-medium">Notes:</span>
                        <p className="mt-1 text-gray-700">{person.notes}</p>
                      </div>
                    )}
                    {person.profile_picture_url && (
                      <div>
                        <span className="font-medium">Profile Picture:</span>
                        <img src={person.profile_picture_url} alt={person.name} className="mt-2 w-32 h-32 object-cover rounded-lg" />
                      </div>
                    )}
                  </div>
                </div>
                
                {person.osint_data && person.osint_data.length > 0 && (
                  <div className="mb-6">
                    <h3 className="text-lg font-semibold mb-3">OSINT Data</h3>
                    <div className="space-y-2">
                      {person.osint_data.map((osint, index) => (
                        <div key={index} className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
                          <div className="text-gray-600">
                            {osint.type === 'Social Media' && <Database className="w-5 h-5" />}
                            {osint.type === 'Email' && <Mail className="w-5 h-5" />}
                            {osint.type === 'Phone' && <Phone className="w-5 h-5" />}
                            {osint.type === 'Website' && <Globe className="w-5 h-5" />}
                            {osint.type === 'Location' && <MapPin className="w-5 h-5" />}
                            {osint.type === 'Username' && <Hash className="w-5 h-5" />}
                            {!['Social Media', 'Email', 'Phone', 'Website', 'Location', 'Username'].includes(osint.type) && <Link className="w-5 h-5" />}
                          </div>
                          <div className="flex-1">
                            <span className="font-medium">{osint.type}:</span> {osint.value}
                            {osint.notes && <p className="text-sm text-gray-600 mt-1">{osint.notes}</p>}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                
                {person.custom_fields && Object.keys(person.custom_fields).length > 0 && (
                  <div>
                    <h3 className="text-lg font-semibold mb-3">Custom Fields</h3>
                    <div className="space-y-2">
                      {Object.entries(person.custom_fields).map(([key, value]) => {
                        const fieldDef = customFields.find(f => f.field_name === key);
                        return (
                          <div key={key} className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
                            <span className="font-medium">{fieldDef?.field_label || key}:</span>
                            <span>{value}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}
            
            {activeTab === 'relationships' && (
              <div className="h-[500px]">
                <RelationshipManager 
                  personId={person.id} 
                  showInModal={true}
                  onClose={() => setActiveTab('details')}
                />
              </div>
            )}
            
            {activeTab === 'locations' && (
              <div className="p-6">
                {validLocations.length > 0 ? (
                  <div>
                    <h3 className="text-lg font-semibold mb-3">Location Map</h3>
                    <div className="h-96 rounded-lg overflow-hidden">
                      <MapContainer center={[validLocations[0].lat, validLocations[0].lng]} zoom={10} style={{ height: '100%', width: '100%' }}>
                        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                        {validLocations.map((loc, index) => (
                          <Marker key={index} position={[loc.lat, loc.lng]}>
                            <Popup>
                              <div>
                                <p className="font-medium">{loc.value}</p>
                                {loc.notes && <p className="text-sm">{loc.notes}</p>}
                              </div>
                            </Popup>
                          </Marker>
                        ))}
                      </MapContainer>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-12 text-gray-500">
                    No location data with coordinates available
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  const AddEditPersonForm = ({ person, onSave, onCancel }) => {
    const [formData, setFormData] = useState({
      name: '',
      aliases: [],
      dateOfBirth: '',
      category: '',
      status: '',
      crmStatus: '',
      caseName: '',
      profilePictureUrl: '',
      notes: '',
      osintData: [],
      attachments: [],
      connections: [],
      custom_fields: {}
    });
    const [newAlias, setNewAlias] = useState('');
    const [newOsintData, setNewOsintData] = useState({ type: 'Email', value: '', notes: '', lat: '', lng: '' });

    useEffect(() => {
      if (person) {
        setFormData({
          name: person.name || '',
          aliases: person.aliases || [],
          dateOfBirth: person.date_of_birth ? person.date_of_birth.split('T')[0] : '',
          category: person.category || '',
          status: person.status || '',
          crmStatus: person.crm_status || '',
          caseName: person.case_name || '',
          profilePictureUrl: person.profile_picture_url || '',
          notes: person.notes || '',
          osintData: person.osint_data || [],
          attachments: person.attachments || [],
          connections: person.connections || [],
          custom_fields: person.custom_fields || {}
        });
      }
    }, [person]);

    const handleSubmit = async (e) => {
      e.preventDefault();
      
      const dataToSend = {
        ...formData,
        dateOfBirth: formData.dateOfBirth || null
      };

      try {
        let response;
        if (person) {
          response = await fetch(`${API_BASE_URL}/people/${person.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(dataToSend)
          });
        } else {
          response = await fetch(`${API_BASE_URL}/people`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(dataToSend)
          });
        }

        if (response.ok) {
          const savedPerson = await response.json();
          onSave(savedPerson);
          fetchPeople(); // Refresh the list
        }
      } catch (error) {
        console.error('Error saving person:', error);
      }
    };

    const addAlias = () => {
      if (newAlias.trim()) {
        setFormData({ ...formData, aliases: [...formData.aliases, newAlias.trim()] });
        setNewAlias('');
      }
    };

    const removeAlias = (index) => {
      setFormData({
        ...formData,
        aliases: formData.aliases.filter((_, i) => i !== index)
      });
    };

    const addOsintData = () => {
      if (newOsintData.value.trim()) {
        const osintToAdd = { ...newOsintData };
        if (newOsintData.type === 'Location' && newOsintData.lat && newOsintData.lng) {
          osintToAdd.lat = parseFloat(newOsintData.lat);
          osintToAdd.lng = parseFloat(newOsintData.lng);
        }
        setFormData({ ...formData, osintData: [...formData.osintData, osintToAdd] });
        setNewOsintData({ type: 'Email', value: '', notes: '', lat: '', lng: '' });
      }
    };

    const removeOsintData = (index) => {
      setFormData({
        ...formData,
        osintData: formData.osintData.filter((_, i) => i !== index)
      });
    };

    const addConnection = () => {
      const selectedPersonId = parseInt(document.getElementById('connectionSelect').value);
      const connectionType = document.getElementById('connectionType').value;
      const connectionNote = document.getElementById('connectionNote').value;
      
      if (selectedPersonId) {
        const newConnection = {
          person_id: selectedPersonId,
          type: connectionType,
          note: connectionNote
        };
        setFormData({ ...formData, connections: [...formData.connections, newConnection] });
        document.getElementById('connectionSelect').value = '';
        document.getElementById('connectionType').value = 'associate';
        document.getElementById('connectionNote').value = '';
      }
    };

    const removeConnection = (index) => {
      setFormData({
        ...formData,
        connections: formData.connections.filter((_, i) => i !== index)
      });
    };

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
          <div className="p-6 border-b">
            <h2 className="text-2xl font-bold text-gray-900">
              {person ? 'Edit Person' : 'Add New Person'}
            </h2>
          </div>
          
          <form onSubmit={handleSubmit} className="p-6 space-y-6">
            <div className="grid grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Name *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Date of Birth</label>
                <input
                  type="date"
                  value={formData.dateOfBirth}
                  onChange={(e) => setFormData({ ...formData, dateOfBirth: e.target.value })}
                  className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Category</label>
                <select
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select Category</option>
                  <option value="Person of Interest">Person of Interest</option>
                  <option value="Client">Client</option>
                  <option value="Witness">Witness</option>
                  <option value="Victim">Victim</option>
                  <option value="Suspect">Suspect</option>
                  <option value="Other">Other</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
                <select
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                  className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select Status</option>
                  <option value="Open">Open</option>
                  <option value="Being Investigated">Being Investigated</option>
                  <option value="Closed">Closed</option>
                  <option value="On Hold">On Hold</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">CRM Status</label>
                <input
                  type="text"
                  value={formData.crmStatus}
                  onChange={(e) => setFormData({ ...formData, crmStatus: e.target.value })}
                  className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Case Name</label>
                <input
                  type="text"
                  value={formData.caseName}
                  onChange={(e) => setFormData({ ...formData, caseName: e.target.value })}
                  className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Profile Picture URL</label>
              <input
                type="url"
                value={formData.profilePictureUrl}
                onChange={(e) => setFormData({ ...formData, profilePictureUrl: e.target.value })}
                className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Notes</label>
              <textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                rows="3"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Aliases</label>
              <div className="flex space-x-2 mb-2">
                <input
                  type="text"
                  value={newAlias}
                  onChange={(e) => setNewAlias(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addAlias())}
                  placeholder="Add an alias"
                  className="flex-1 px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button type="button" onClick={addAlias} className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700">
                  Add
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                {formData.aliases.map((alias, index) => (
                  <span key={index} className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-gray-100">
                    {alias}
                    <button
                      type="button"
                      onClick={() => removeAlias(index)}
                      className="ml-2 text-gray-500 hover:text-red-500"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">OSINT Data</label>
              <div className="space-y-2 mb-2">
                <div className="flex space-x-2">
                  <select
                    value={newOsintData.type}
                    onChange={(e) => setNewOsintData({ ...newOsintData, type: e.target.value })}
                    className="px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="Email">Email</option>
                    <option value="Phone">Phone</option>
                    <option value="Social Media">Social Media</option>
                    <option value="Website">Website</option>
                    <option value="Location">Location</option>
                    <option value="Username">Username</option>
                    <option value="Other">Other</option>
                  </select>
                  <input
                    type="text"
                    value={newOsintData.value}
                    onChange={(e) => setNewOsintData({ ...newOsintData, value: e.target.value })}
                    placeholder="Value"
                    className="flex-1 px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <input
                    type="text"
                    value={newOsintData.notes}
                    onChange={(e) => setNewOsintData({ ...newOsintData, notes: e.target.value })}
                    placeholder="Notes (optional)"
                    className="flex-1 px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                {newOsintData.type === 'Location' && (
                  <div className="flex space-x-2">
                    <input
                      type="number"
                      step="any"
                      value={newOsintData.lat}
                      onChange={(e) => setNewOsintData({ ...newOsintData, lat: e.target.value })}
                      placeholder="Latitude"
                      className="flex-1 px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <input
                      type="number"
                      step="any"
                      value={newOsintData.lng}
                      onChange={(e) => setNewOsintData({ ...newOsintData, lng: e.target.value })}
                      placeholder="Longitude"
                      className="flex-1 px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                )}
                <button type="button" onClick={addOsintData} className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700">
                  Add OSINT Data
                </button>
              </div>
              <div className="space-y-2">
                {formData.osintData.map((osint, index) => (
                  <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div>
                      <span className="font-medium">{osint.type}:</span> {osint.value}
                      {osint.notes && <span className="text-sm text-gray-600 ml-2">({osint.notes})</span>}
                      {osint.lat && osint.lng && <span className="text-sm text-gray-600 ml-2">[{osint.lat}, {osint.lng}]</span>}
                    </div>
                    <button
                      type="button"
                      onClick={() => removeOsintData(index)}
                      className="text-red-600 hover:text-red-700"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Connections</label>
              <div className="space-y-2 mb-2">
                <div className="flex space-x-2">
                  <select
                    id="connectionSelect"
                    className="flex-1 px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Select a person</option>
                    {people.filter(p => !person || p.id !== person.id).map(p => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                  <select
                    id="connectionType"
                    className="px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="associate">Associate</option>
                    <option value="family">Family</option>
                    <option value="employer">Employer/Employee</option>
                    <option value="suspect">Suspect Connection</option>
                    <option value="witness">Witness</option>
                    <option value="victim">Victim</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <input
                  type="text"
                  id="connectionNote"
                  placeholder="Connection notes (optional)"
                  className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button type="button" onClick={addConnection} className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700">
                  Add Connection
                </button>
              </div>
              <div className="space-y-2">
                {formData.connections.map((conn, index) => {
                  const connectedPerson = people.find(p => p.id === conn.person_id);
                  return (
                    <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div>
                        <span className="font-medium">{connectedPerson?.name || 'Unknown'}</span>
                        <span className="text-sm text-gray-600 ml-2">({conn.type})</span>
                        {conn.note && <p className="text-sm text-gray-600">{conn.note}</p>}
                      </div>
                      <button
                        type="button"
                        onClick={() => removeConnection(index)}
                        className="text-red-600 hover:text-red-700"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>

            {customFields.filter(f => f.is_active).length > 0 && (
              <div>
                <h3 className="text-lg font-semibold mb-3">Custom Fields</h3>
                <div className="space-y-4">
                  {customFields.filter(f => f.is_active).map(field => (
                    <div key={field.id}>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        {field.field_label}
                      </label>
                      {field.field_type === 'text' && (
                        <input
                          type="text"
                          value={formData.custom_fields[field.field_name] || ''}
                          onChange={(e) => setFormData({
                            ...formData,
                            custom_fields: {
                              ...formData.custom_fields,
                              [field.field_name]: e.target.value
                            }
                          })}
                          className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      )}
                      {field.field_type === 'select' && (
                        <select
                          value={formData.custom_fields[field.field_name] || ''}
                          onChange={(e) => setFormData({
                            ...formData,
                            custom_fields: {
                              ...formData.custom_fields,
                              [field.field_name]: e.target.value
                            }
                          })}
                          className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          <option value="">Select {field.field_label}</option>
                          {field.options && field.options.map(option => (
                            <option key={option} value={option}>{option}</option>
                          ))}
                        </select>
                      )}
                      {field.field_type === 'textarea' && (
                        <textarea
                          value={formData.custom_fields[field.field_name] || ''}
                          onChange={(e) => setFormData({
                            ...formData,
                            custom_fields: {
                              ...formData.custom_fields,
                              [field.field_name]: e.target.value
                            }
                          })}
                          className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                          rows="3"
                        />
                      )}
                      {field.field_type === 'date' && (
                        <input
                          type="date"
                          value={formData.custom_fields[field.field_name] || ''}
                          onChange={(e) => setFormData({
                            ...formData,
                            custom_fields: {
                              ...formData.custom_fields,
                              [field.field_name]: e.target.value
                            }
                          })}
                          className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex justify-end space-x-3 pt-6 border-t">
              <button
                type="button"
                onClick={onCancel}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
              >
                {person ? 'Update' : 'Create'} Person
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  };

  const PeopleList = () => {
    const filteredPeople = people.filter(person => {
      const matchesSearch = searchTerm === '' || 
        person.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (person.aliases && person.aliases.some(alias => alias.toLowerCase().includes(searchTerm.toLowerCase()))) ||
        (person.case_name && person.case_name.toLowerCase().includes(searchTerm.toLowerCase()));
      
      const matchesCategory = filterCategory === '' || person.category === filterCategory;
      const matchesStatus = filterStatus === '' || person.status === filterStatus;
      
      return matchesSearch && matchesCategory && matchesStatus;
    });

    const handleDelete = async (id) => {
      if (window.confirm('Are you sure you want to delete this person?')) {
        try {
          const response = await fetch(`${API_BASE_URL}/people/${id}`, {
            method: 'DELETE'
          });
          
          if (response.ok) {
            fetchPeople();
          }
        } catch (error) {
          console.error('Error deleting person:', error);
        }
      }
    };

    return (
      <div className="p-6">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold text-gray-900">People Management</h1>
          <button
            onClick={() => setShowAddPersonForm(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 flex items-center"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Person
          </button>
        </div>

        <div className="mb-6 space-y-4">
          <div className="flex space-x-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  type="text"
                  placeholder="Search by name, alias, or case..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              className="px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Categories</option>
              <option value="Person of Interest">Person of Interest</option>
              <option value="Client">Client</option>
              <option value="Witness">Witness</option>
              <option value="Victim">Victim</option>
              <option value="Suspect">Suspect</option>
              <option value="Other">Other</option>
            </select>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Statuses</option>
              <option value="Open">Open</option>
              <option value="Being Investigated">Being Investigated</option>
              <option value="Closed">Closed</option>
              <option value="On Hold">On Hold</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredPeople.map(person => (
            <div key={person.id} className="bg-white rounded-lg shadow-sm p-6 border hover:shadow-md transition-shadow">
              <div className="flex justify-between items-start mb-4">
                <div className="flex items-center space-x-3">
                  {person.profile_picture_url ? (
                    <img src={person.profile_picture_url} alt={person.name} className="w-12 h-12 rounded-full object-cover" />
                  ) : (
                    <div className="w-12 h-12 rounded-full bg-gray-200 flex items-center justify-center">
                      <User className="w-6 h-6 text-gray-500" />
                    </div>
                  )}
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">{person.name}</h3>
                    {person.aliases && person.aliases.length > 0 && (
                      <p className="text-sm text-gray-500">AKA: {person.aliases.join(', ')}</p>
                    )}
                  </div>
                </div>
                <div className="flex space-x-1">
                  <button
                    onClick={() => setSelectedPersonForDetail(person)}
                    className="text-blue-600 hover:text-blue-700"
                  >
                    <Eye className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setEditingPerson(person)}
                    className="text-gray-600 hover:text-gray-700"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(person.id)}
                    className="text-red-600 hover:text-red-700"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
              
              <div className="space-y-2">
                {person.category && (
                  <div className="flex items-center text-sm">
                    <Tag className="w-4 h-4 mr-2 text-gray-400" />
                    <span className="text-gray-600">{person.category}</span>
                  </div>
                )}
                {person.case_name && (
                  <div className="flex items-center text-sm">
                    <Briefcase className="w-4 h-4 mr-2 text-gray-400" />
                    <span className="text-gray-600">{person.case_name}</span>
                  </div>
                )}
                <div className="flex items-center text-sm">
                  <Network className="w-4 h-4 mr-2 text-gray-400" />
                  <span className="text-gray-600">{getRelationshipCount(person.id)} connections</span>
                </div>
              </div>
              
              {person.status && (
                <div className="mt-4">
                  <span className={`inline-block px-2 py-1 text-xs rounded-full ${
                    person.status === 'Open' ? 'bg-green-100 text-green-800' :
                    person.status === 'Being Investigated' ? 'bg-yellow-100 text-yellow-800' :
                    person.status === 'Closed' ? 'bg-gray-100 text-gray-800' :
                    'bg-blue-100 text-blue-800'
                  }`}>
                    {person.status}
                  </span>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    );
  };

  const AddEditToolForm = ({ tool, onSave, onCancel }) => {
    const [formData, setFormData] = useState({
      name: '',
      link: '',
      description: '',
      category: '',
      status: '',
      tags: [],
      notes: ''
    });
    const [newTag, setNewTag] = useState('');

    useEffect(() => {
      if (tool) {
        setFormData({
          name: tool.name || '',
          link: tool.link || '',
          description: tool.description || '',
          category: tool.category || '',
          status: tool.status || '',
          tags: tool.tags || [],
          notes: tool.notes || ''
        });
      }
    }, [tool]);

    const handleSubmit = async (e) => {
      e.preventDefault();
      
      try {
        let response;
        if (tool) {
          response = await fetch(`${API_BASE_URL}/tools/${tool.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(formData)
          });
        } else {
          response = await fetch(`${API_BASE_URL}/tools`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(formData)
          });
        }

        if (response.ok) {
          const savedTool = await response.json();
          onSave(savedTool);
          fetchTools();
        }
      } catch (error) {
        console.error('Error saving tool:', error);
      }
    };

    const addTag = () => {
      if (newTag.trim() && !formData.tags.includes(newTag.trim())) {
        setFormData({ ...formData, tags: [...formData.tags, newTag.trim()] });
        setNewTag('');
      }
    };

    const removeTag = (tagToRemove) => {
      setFormData({
        ...formData,
        tags: formData.tags.filter(tag => tag !== tagToRemove)
      });
    };

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl">
          <div className="p-6 border-b">
            <h2 className="text-2xl font-bold text-gray-900">
              {tool ? 'Edit Tool' : 'Add New Tool'}
            </h2>
          </div>
          
          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Tool Name *</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Link</label>
              <input
                type="url"
                value={formData.link}
                onChange={(e) => setFormData({ ...formData, link: e.target.value })}
                className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="https://example.com"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                rows="3"
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Category</label>
                <select
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select Category</option>
                  <option value="Search Engines">Search Engines</option>
                  <option value="Social Media">Social Media</option>
                  <option value="People Search">People Search</option>
                  <option value="Data Analysis">Data Analysis</option>
                  <option value="Geolocation">Geolocation</option>
                  <option value="Documentation">Documentation</option>
                  <option value="Other">Other</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
                <select
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                  className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select Status</option>
                  <option value="Active">Active</option>
                  <option value="Testing">Testing</option>
                  <option value="Deprecated">Deprecated</option>
                  <option value="Offline">Offline</option>
                </select>
              </div>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Tags</label>
              <div className="flex space-x-2 mb-2">
                <input
                  type="text"
                  value={newTag}
                  onChange={(e) => setNewTag(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addTag())}
                  placeholder="Add a tag"
                  className="flex-1 px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button
                  type="button"
                  onClick={addTag}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                >
                  Add
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                {formData.tags.map((tag, index) => (
                  <span key={index} className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-blue-100 text-blue-800">
                    {tag}
                    <button
                      type="button"
                      onClick={() => removeTag(tag)}
                      className="ml-2 text-blue-600 hover:text-blue-800"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Notes</label>
              <textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                rows="3"
              />
            </div>
            
            <div className="flex justify-end space-x-3 pt-4 border-t">
              <button
                type="button"
                onClick={onCancel}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
              >
                {tool ? 'Update' : 'Create'} Tool
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  };

  const ToolsList = () => {
    const filteredTools = tools.filter(tool => {
      const matchesSearch = toolSearchTerm === '' || 
        tool.name.toLowerCase().includes(toolSearchTerm.toLowerCase()) ||
        (tool.category && tool.category.toLowerCase().includes(toolSearchTerm.toLowerCase())) ||
        (tool.tags && tool.tags.some(tag => tag.toLowerCase().includes(toolSearchTerm.toLowerCase())));
      
      return matchesSearch;
    });

    const handleDelete = async (id) => {
      if (window.confirm('Are you sure you want to delete this tool?')) {
        try {
          const response = await fetch(`${API_BASE_URL}/tools/${id}`, {
            method: 'DELETE'
          });
          
          if (response.ok) {
            fetchTools();
          }
        } catch (error) {
          console.error('Error deleting tool:', error);
        }
      }
    };

    return (
      <div className="p-6">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold text-gray-900">OSINT Tools Directory</h1>
          <button
            onClick={() => setShowAddToolForm(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 flex items-center"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Tool
          </button>
        </div>

        <div className="mb-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Search tools by name, category, or tag..."
              value={toolSearchTerm}
              onChange={(e) => setToolSearchTerm(e.target.value)}
              className="w-full pl-10 pr-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredTools.map(tool => (
            <div key={tool.id} className="bg-white rounded-lg shadow-sm p-6 border hover:shadow-md transition-shadow">
              <div className="flex justify-between items-start mb-4">
                <h3 className="text-lg font-semibold text-gray-900">{tool.name}</h3>
                <div className="flex space-x-1">
                  <button
                    onClick={() => setEditingTool(tool)}
                    className="text-gray-600 hover:text-gray-700"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(tool.id)}
                    className="text-red-600 hover:text-red-700"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
              
              {tool.description && (
                <p className="text-gray-600 text-sm mb-3">{tool.description}</p>
              )}
              
              {tool.category && (
                <div className="mb-2">
                  <span className="inline-block px-2 py-1 text-xs bg-gray-100 text-gray-700 rounded">
                    {tool.category}
                  </span>
                </div>
              )}
              
              {tool.tags && tool.tags.length > 0 && (
                <div className="mb-3 flex flex-wrap gap-1">
                  {tool.tags.map((tag, index) => (
                    <span key={index} className="inline-block px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded">
                      {tag}
                    </span>
                  ))}
                </div>
              )}
              
              {tool.link && (
                <a
                  href={tool.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center text-blue-600 hover:text-blue-700 text-sm"
                >
                  Visit Tool
                  <Globe className="w-3 h-3 ml-1" />
                </a>
              )}
              
              {tool.status && (
                <div className="mt-3">
                  <span className={`inline-block px-2 py-1 text-xs rounded ${
                    tool.status === 'Active' ? 'bg-green-100 text-green-800' :
                    tool.status === 'Testing' ? 'bg-yellow-100 text-yellow-800' :
                    tool.status === 'Deprecated' ? 'bg-red-100 text-red-800' :
                    'bg-gray-100 text-gray-800'
                  }`}>
                    {tool.status}
                  </span>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    );
  };

  const CustomFieldManager = () => {
    const [showAddForm, setShowAddForm] = useState(false);
    const [editingField, setEditingField] = useState(null);
    const [formData, setFormData] = useState({
      field_name: '',
      field_label: '',
      field_type: 'text',
      options: [],
      is_active: true
    });
    const [newOption, setNewOption] = useState('');

    const resetForm = () => {
      setFormData({
        field_name: '',
        field_label: '',
        field_type: 'text',
        options: [],
        is_active: true
      });
      setNewOption('');
      setEditingField(null);
      setShowAddForm(false);
    };

    const handleSubmit = async (e) => {
      e.preventDefault();
      
      try {
        let response;
        if (editingField) {
          response = await fetch(`${API_BASE_URL}/settings/custom-fields/${editingField.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(formData)
          });
        } else {
          response = await fetch(`${API_BASE_URL}/settings/custom-fields`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(formData)
          });
        }

        if (response.ok) {
          fetchCustomFields();
          resetForm();
        } else {
          const error = await response.json();
          alert(error.error || 'Failed to save custom field');
        }
      } catch (error) {
        console.error('Error saving custom field:', error);
        alert('Failed to save custom field');
      }
    };

    const handleEdit = (field) => {
      setEditingField(field);
      setFormData({
        field_name: field.field_name,
        field_label: field.field_label,
        field_type: field.field_type,
        options: field.options || [],
        is_active: field.is_active
      });
      setShowAddForm(true);
    };

    const handleDelete = async (id) => {
      if (window.confirm('Are you sure you want to delete this custom field? This will not delete existing data.')) {
        try {
          const response = await fetch(`${API_BASE_URL}/settings/custom-fields/${id}`, {
            method: 'DELETE'
          });
          
          if (response.ok) {
            fetchCustomFields();
          }
        } catch (error) {
          console.error('Error deleting custom field:', error);
        }
      }
    };

    const addOption = () => {
      if (newOption.trim() && !formData.options.includes(newOption.trim())) {
        setFormData({ ...formData, options: [...formData.options, newOption.trim()] });
        setNewOption('');
      }
    };

    const removeOption = (optionToRemove) => {
      setFormData({
        ...formData,
        options: formData.options.filter(option => option !== optionToRemove)
      });
    };

    return (
      <div>
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold">Custom Person Fields</h3>
          <button
            onClick={() => setShowAddForm(true)}
            className="px-3 py-1 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 flex items-center"
          >
            <Plus className="w-4 h-4 mr-1" />
            Add Field
          </button>
        </div>

        {showAddForm && (
          <div className="mb-6 p-4 bg-gray-50 rounded-lg">
            <h4 className="font-medium mb-3">{editingField ? 'Edit' : 'Add'} Custom Field</h4>
            <form onSubmit={handleSubmit} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Field Name (Internal)</label>
                  <input
                    type="text"
                    value={formData.field_name}
                    onChange={(e) => setFormData({ ...formData, field_name: e.target.value.replace(/\s+/g, '_').toLowerCase() })}
                    className="w-full px-3 py-2 border rounded-md text-sm"
                    placeholder="e.g., security_clearance"
                    required
                    disabled={editingField}
                  />
                  <p className="text-xs text-gray-500 mt-1">Letters, numbers, underscores only</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Field Label (Display)</label>
                  <input
                    type="text"
                    value={formData.field_label}
                    onChange={(e) => setFormData({ ...formData, field_label: e.target.value })}
                    className="w-full px-3 py-2 border rounded-md text-sm"
                    placeholder="e.g., Security Clearance Level"
                    required
                  />
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Field Type</label>
                <select
                  value={formData.field_type}
                  onChange={(e) => setFormData({ ...formData, field_type: e.target.value })}
                  className="w-full px-3 py-2 border rounded-md text-sm"
                >
                  <option value="text">Text</option>
                  <option value="textarea">Textarea</option>
                  <option value="select">Dropdown</option>
                  <option value="date">Date</option>
                </select>
              </div>
              
              {formData.field_type === 'select' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Options</label>
                  <div className="flex space-x-2 mb-2">
                    <input
                      type="text"
                      value={newOption}
                      onChange={(e) => setNewOption(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addOption())}
                      placeholder="Add an option"
                      className="flex-1 px-3 py-2 border rounded-md text-sm"
                    />
                    <button
                      type="button"
                      onClick={addOption}
                      className="px-3 py-2 bg-gray-600 text-white text-sm rounded-md hover:bg-gray-700"
                    >
                      Add
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {formData.options.map((option, index) => (
                      <span key={index} className="inline-flex items-center px-2 py-1 rounded text-xs bg-gray-100">
                        {option}
                        <button
                          type="button"
                          onClick={() => removeOption(option)}
                          className="ml-1 text-gray-500 hover:text-red-500"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                </div>
              )}
              
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="is_active"
                  checked={formData.is_active}
                  onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                  className="h-4 w-4 text-blue-600 rounded"
                />
                <label htmlFor="is_active" className="ml-2 text-sm text-gray-700">
                  Active (show this field in forms)
                </label>
              </div>
              
              <div className="flex justify-end space-x-2 pt-3">
                <button
                  type="button"
                  onClick={resetForm}
                  className="px-3 py-1 text-gray-700 bg-gray-200 text-sm rounded-md hover:bg-gray-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-3 py-1 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700"
                >
                  {editingField ? 'Update' : 'Create'} Field
                </button>
              </div>
            </form>
          </div>
        )}

        <div className="space-y-2">
          {customFields.map(field => (
            <div key={field.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <div>
                <div className="font-medium">{field.field_label}</div>
                <div className="text-sm text-gray-600">
                  Type: {field.field_type} | Name: {field.field_name}
                  {field.options && field.options.length > 0 && (
                    <span> | Options: {field.options.join(', ')}</span>
                  )}
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <span className={`px-2 py-1 text-xs rounded ${
                  field.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'
                }`}>
                  {field.is_active ? 'Active' : 'Inactive'}
                </span>
                <button
                  onClick={() => handleEdit(field)}
                  className="text-gray-600 hover:text-gray-700"
                >
                  <Edit2 className="w-4 h-4" />
                </button>
                <button
                  onClick={() => handleDelete(field.id)}
                  className="text-red-600 hover:text-red-700"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const SettingsPage = () => {
    const [activeTab, setActiveTab] = useState('general');

    return (
      <div className="p-6 max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Settings</h1>
        
        <div className="bg-white rounded-lg shadow-sm border">
          <div className="border-b">
            <nav className="flex space-x-8 px-6" aria-label="Tabs">
              <button
                onClick={() => setActiveTab('general')}
                className={`py-4 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'general'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                General
              </button>
              <button
                onClick={() => setActiveTab('data-model')}
                className={`py-4 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'data-model'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Data Model
              </button>
              <button
                onClick={() => setActiveTab('import-export')}
                className={`py-4 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'import-export'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Import/Export
              </button>
              <button
                onClick={() => setActiveTab('audit')}
                className={`py-4 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'audit'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Audit Log
              </button>
            </nav>
          </div>
          
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
                          value={appSettings.appName}
                          onChange={(e) => handleAppNameChange(e.target.value)}
                          className="flex-1 px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                        <button
                          onClick={() => handleAppNameChange(appSettings.appName)}
                          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
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
                    <div><span className="font-medium">API URL:</span> {API_BASE_URL}</div>
                  </div>
                </div>
              </div>
            )}
            
            {activeTab === 'data-model' && (
              <div className="space-y-6">
                <CustomFieldManager />
                
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
          <button
            onClick={() => setActiveSection('dashboard')}
            className={`w-full text-left px-6 py-3 transition-colors duration-200 flex items-center space-x-3 ${
              activeSection === 'dashboard' ? 'bg-blue-700 text-white' : 'text-gray-100 hover:bg-blue-700'
            }`}
          >
            <Home className="w-5 h-5" />
            <span>Dashboard</span>
          </button>
          
          <button
            onClick={() => setActiveSection('people')}
            className={`w-full text-left px-6 py-3 transition-colors duration-200 flex items-center space-x-3 ${
              activeSection === 'people' ? 'bg-blue-700 text-white' : 'text-gray-100 hover:bg-blue-700'
            }`}
          >
            <Users className="w-5 h-5" />
            <span>People</span>
          </button>
          
          <button
            onClick={() => setActiveSection('tools')}
            className={`w-full text-left px-6 py-3 transition-colors duration-200 flex items-center space-x-3 ${
              activeSection === 'tools' ? 'bg-blue-700 text-white' : 'text-gray-100 hover:bg-blue-700'
            }`}
          >
            <Wrench className="w-5 h-5" />
            <span>OSINT Tools</span>
          </button>
          
          <button
            onClick={() => setActiveSection('relationships')}
            className={`w-full text-left px-6 py-3 transition-colors duration-200 flex items-center space-x-3 ${
              activeSection === 'relationships' ? 'bg-blue-700 text-white' : 'text-gray-100 hover:bg-blue-700'
            }`}
          >
            <Network className="w-5 h-5" />
            <span>Relationships</span>
          </button>
          
          <button
            onClick={() => setActiveSection('settings')}
            className={`w-full text-left px-6 py-3 transition-colors duration-200 flex items-center space-x-3 ${
              activeSection === 'settings' ? 'bg-blue-700 text-white' : 'text-gray-100 hover:bg-blue-700'
            }`}
          >
            <Settings className="w-5 h-5" />
            <span>Settings</span>
          </button>
        </nav>
      </div>
      
      {/* Main Content */}
      <div className="flex-1 overflow-auto">
        {activeSection === 'dashboard' && <Dashboard />}
        {activeSection === 'people' && <PeopleList />}
        {activeSection === 'tools' && <ToolsList />}
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
        {activeSection === 'settings' && <SettingsPage />}
      </div>
      
      {/* Modals */}
      {showAddPersonForm && (
        <AddEditPersonForm
          person={null}
          onSave={(person) => {
            setShowAddPersonForm(false);
            fetchPeople();
          }}
          onCancel={() => setShowAddPersonForm(false)}
        />
      )}
      
      {editingPerson && (
        <AddEditPersonForm
          person={editingPerson}
          onSave={(person) => {
            setEditingPerson(null);
            fetchPeople();
          }}
          onCancel={() => setEditingPerson(null)}
        />
      )}
      
      {selectedPersonForDetail && (
        <PersonDetailModal
          person={selectedPersonForDetail}
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
          onSave={(tool) => {
            setShowAddToolForm(false);
            fetchTools();
          }}
          onCancel={() => setShowAddToolForm(false)}
        />
      )}
      
      {editingTool && (
        <AddEditToolForm
          tool={editingTool}
          onSave={(tool) => {
            setEditingTool(null);
            fetchTools();
          }}
          onCancel={() => setEditingTool(null)}
        />
      )}
    </div>
  );
};

export default App;