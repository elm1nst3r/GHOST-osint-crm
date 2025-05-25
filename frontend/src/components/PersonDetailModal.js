// File: frontend/src/components/PersonDetailModal.js
import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import { User, Edit2, X, Database, Mail, Phone, Globe, MapPin, Hash, Link, Calendar, Briefcase, Tag, Network, FileText } from 'lucide-react';
import RelationshipManager from './visualization/RelationshipManager';
import ReportGenerator from './ReportGenerator';
import TravelPatternAnalysis from './TravelPatternAnalysis';

const PersonDetailModal = ({ person, people, customFields, onClose, onEdit }) => {
  const [activeTab, setActiveTab] = useState('details');
  const [showReportGenerator, setShowReportGenerator] = useState(false);
  
  const getFullName = (person) => {
    return `${person.first_name || ''} ${person.last_name || ''}`.trim();
  };

  const getAge = (dateOfBirth) => {
    if (!dateOfBirth) return null;
    const today = new Date();
    const birthDate = new Date(dateOfBirth);
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age;
  };

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

  const getConnectedPeople = () => {
    const connected = [];
    
    // Direct connections
    if (person.connections && Array.isArray(person.connections)) {
      person.connections.forEach(conn => {
        const connectedPerson = people.find(p => p.id === conn.person_id);
        if (connectedPerson) {
          connected.push({
            person: connectedPerson,
            type: conn.type,
            note: conn.note,
            direction: 'outgoing'
          });
        }
      });
    }
    
    // Reverse connections
    people.forEach(p => {
      if (p.connections && Array.isArray(p.connections)) {
        p.connections.forEach(conn => {
          if (conn.person_id === person.id) {
            connected.push({
              person: p,
              type: conn.type,
              note: conn.note,
              direction: 'incoming'
            });
          }
        });
      }
    });
    
    return connected;
  };

  if (!person) return null;

  const connectedPeople = getConnectedPeople();

  return (
    <>
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden">
          {/* Header */}
          <div className="p-6 border-b flex justify-between items-center">
            <div className="flex items-center space-x-4">
              {person.profile_picture_url ? (
                <img 
                  src={person.profile_picture_url} 
                  alt={getFullName(person)} 
                  className="w-16 h-16 rounded-full object-cover" 
                />
              ) : (
                <div className="w-16 h-16 rounded-full bg-gray-200 flex items-center justify-center">
                  <User className="w-8 h-8 text-gray-500" />
                </div>
              )}
              <div>
                <h2 className="text-2xl font-bold text-gray-900">
                  {getFullName(person)}
                  {person.date_of_birth && (
                    <span className="text-gray-500 font-normal text-lg ml-2">
                      ({getAge(person.date_of_birth)} years old)
                    </span>
                  )}
                </h2>
                {person.aliases && person.aliases.length > 0 && (
                  <p className="text-sm text-gray-600">AKA: {person.aliases.join(', ')}</p>
                )}
              </div>
            </div>
            <div className="flex space-x-2">
              <button 
                onClick={() => setShowReportGenerator(true)} 
                className="text-green-600 hover:text-green-700"
                title="Generate Report"
              >
                <FileText className="w-5 h-5" />
              </button>
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
            {['details', 'relationships', 'locations', 'travel'].map((tab) => (
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
                  {tab === 'relationships' && connectedPeople.length > 0 && (
                    <span className="ml-2 text-xs bg-gray-200 px-2 py-1 rounded-full">
                      {connectedPeople.length}
                    </span>
                  )}
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
                  <div className="space-y-4">
                    <div>
                      <h3 className="text-lg font-semibold mb-3 flex items-center">
                        <User className="w-5 h-5 mr-2 text-gray-400" />
                        Basic Information
                      </h3>
                      <div className="space-y-2 bg-gray-50 rounded-lg p-4">
                        <div className="flex justify-between">
                          <span className="font-medium text-gray-600">First Name:</span>
                          <span>{person.first_name || 'N/A'}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="font-medium text-gray-600">Last Name:</span>
                          <span>{person.last_name || 'N/A'}</span>
                        </div>
                        {person.date_of_birth && (
                          <div className="flex justify-between">
                            <span className="font-medium text-gray-600">Date of Birth:</span>
                            <span>{new Date(person.date_of_birth).toLocaleDateString()}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    <div>
                      <h3 className="text-lg font-semibold mb-3 flex items-center">
                        <Tag className="w-5 h-5 mr-2 text-gray-400" />
                        Classification
                      </h3>
                      <div className="space-y-2 bg-gray-50 rounded-lg p-4">
                        <div className="flex justify-between">
                          <span className="font-medium text-gray-600">Category:</span>
                          <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-sm">
                            {person.category || 'N/A'}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="font-medium text-gray-600">Status:</span>
                          <span className={`px-2 py-1 rounded text-sm ${
                            person.status === 'Open' ? 'bg-green-100 text-green-800' :
                            person.status === 'Being Investigated' ? 'bg-yellow-100 text-yellow-800' :
                            person.status === 'Closed' ? 'bg-gray-100 text-gray-800' :
                            'bg-blue-100 text-blue-800'
                          }`}>
                            {person.status || 'N/A'}
                          </span>
                        </div>
                        {person.crm_status && (
                          <div className="flex justify-between">
                            <span className="font-medium text-gray-600">CRM Status:</span>
                            <span>{person.crm_status}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  {/* Case and Additional Info */}
                  <div className="space-y-4">
                    {person.case_name && (
                      <div>
                        <h3 className="text-lg font-semibold mb-3 flex items-center">
                          <Briefcase className="w-5 h-5 mr-2 text-gray-400" />
                          Case Information
                        </h3>
                        <div className="bg-gray-50 rounded-lg p-4">
                          <div className="flex justify-between">
                            <span className="font-medium text-gray-600">Case Name:</span>
                            <span className="text-blue-600">{person.case_name}</span>
                          </div>
                        </div>
                      </div>
                    )}

                    <div>
                      <h3 className="text-lg font-semibold mb-3 flex items-center">
                        <Network className="w-5 h-5 mr-2 text-gray-400" />
                        Connection Summary
                      </h3>
                      <div className="bg-gray-50 rounded-lg p-4">
                        <div className="text-center">
                          <div className="text-3xl font-bold text-blue-600">{connectedPeople.length}</div>
                          <div className="text-sm text-gray-600">Total Connections</div>
                        </div>
                        {connectedPeople.length > 0 && (
                          <div className="mt-3 pt-3 border-t border-gray-200">
                            <div className="grid grid-cols-2 gap-2 text-sm">
                              <div>Outgoing: {connectedPeople.filter(c => c.direction === 'outgoing').length}</div>
                              <div>Incoming: {connectedPeople.filter(c => c.direction === 'incoming').length}</div>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Notes */}
                {person.notes && (
                  <div className="mb-6">
                    <h3 className="text-lg font-semibold mb-3">Notes</h3>
                    <div className="bg-gray-50 rounded-lg p-4">
                      <p className="text-gray-700 whitespace-pre-wrap">{person.notes}</p>
                    </div>
                  </div>
                )}
                
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
                {person.locations && person.locations.length > 0 ? (
                  <div>
                    <h3 className="text-lg font-semibold mb-3">Locations</h3>
                    <div className="space-y-3">
                      {person.locations.map((location, index) => (
                        <div key={index} className="p-4 bg-gray-50 rounded-lg">
                          <div className="flex items-start justify-between">
                            <div>
                              <div className="flex items-center space-x-2 mb-2">
                                <MapPin className="w-4 h-4 text-gray-400" />
                                <span className="font-medium text-sm px-2 py-1 bg-blue-100 text-blue-800 rounded">
                                  {location.type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                                </span>
                              </div>
                              <p className="font-medium">{location.address}</p>
                              <p className="text-sm text-gray-600">
                                {[location.city, location.state, location.country, location.postal_code]
                                  .filter(Boolean)
                                  .join(', ')}
                              </p>
                              {location.notes && <p className="text-sm text-gray-500 mt-2">{location.notes}</p>}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-12 text-gray-500">
                    No location data available
                  </div>
                )}
              </div>
            )}
{activeTab === 'travel' && (
  <div className="p-6">
    <TravelPatternAnalysis 
      personId={person.id} 
      personName={getFullName(person)}
    />
  </div>
)}
            
          </div>
        </div>
      </div>

      {/* Report Generator Modal */}
      {showReportGenerator && (
        <ReportGenerator 
          personId={person.id}
          onClose={() => setShowReportGenerator(false)}
        />
      )}
    </>
  );
};

export default PersonDetailModal;