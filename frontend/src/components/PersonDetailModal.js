// File: frontend/src/components/PersonDetailModal.js
import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import ReactFlow, { MiniMap, Controls, Background, useNodesState, useEdgesState } from 'reactflow';
import 'reactflow/dist/style.css';
import { User, Edit2, X, Database, Mail, Phone, Globe, MapPin, Hash, Link } from 'lucide-react';
import RelationshipManager from './visualization/RelationshipManager';

// Custom node components (these are simple enough to include here rather than import)
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

const PersonDetailModal = ({ person, people, customFields, onClose, onEdit }) => {
  const [activeTab, setActiveTab] = useState('details');
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  
  useEffect(() => {
    if (!person) return;
    
    const newNodes = [];
    const newEdges = [];
    
    // Main person node
    const personNode = {
      id: 'person-1',
      type: 'person',
      position: { x: 250, y: 25 },
      data: { label: person.name }
    };
    newNodes.push(personNode);
    
    // OSINT data nodes
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
    
    // Connected people nodes
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

  const getOsintIcon = (type) => {
    const icons = {
      'Social Media': <Database className="w-5 h-5" />,
      'Email': <Mail className="w-5 h-5" />,
      'Phone': <Phone className="w-5 h-5" />,
      'Website': <Globe className="w-5 h-5" />,
      'Location': <MapPin className="w-5 h-5" />,
      'Username': <Hash className="w-5 h-5" />,
    };
    return icons[type] || <Link className="w-5 h-5" />;
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden">
        {/* Header */}
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
        
        {/* Tabs */}
        <div className="border-b">
          <div className="flex">
            {['details', 'relationships', 'locations'].map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-2 font-medium text-sm border-b-2 capitalize ${
                  activeTab === tab 
                    ? 'border-blue-500 text-blue-600' 
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>
        
        {/* Content */}
        <div className="overflow-y-auto" style={{ maxHeight: 'calc(90vh - 200px)' }}>
          {activeTab === 'details' && (
            <div className="p-6">
              <div className="grid grid-cols-2 gap-6 mb-6">
                {/* Basic Information */}
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
                
                {/* Additional Details */}
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
                      <img 
                        src={person.profile_picture_url} 
                        alt={person.name} 
                        className="mt-2 w-32 h-32 object-cover rounded-lg" 
                      />
                    </div>
                  )}
                </div>
              </div>
              
              {/* OSINT Data */}
              {person.osint_data && person.osint_data.length > 0 && (
                <div className="mb-6">
                  <h3 className="text-lg font-semibold mb-3">OSINT Data</h3>
                  <div className="space-y-2">
                    {person.osint_data.map((osint, index) => (
                      <div key={index} className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
                        <div className="text-gray-600">
                          {getOsintIcon(osint.type)}
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
              
              {/* Custom Fields */}
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
                    <MapContainer 
                      center={[validLocations[0].lat, validLocations[0].lng]} 
                      zoom={10} 
                      style={{ height: '100%', width: '100%' }}
                    >
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

export default PersonDetailModal;