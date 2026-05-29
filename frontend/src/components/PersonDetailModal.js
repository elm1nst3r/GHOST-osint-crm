// File: frontend/src/components/PersonDetailModal.js
import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import { User, Edit2, X, Database, Mail, Phone, Globe, MapPin, Hash, Link, Calendar, Briefcase, Tag, Network, FileText, Trash2 } from 'lucide-react';
import RelationshipManager from './visualization/RelationshipManager';
import ReportGenerator from './ReportGenerator';
import TravelPatternAnalysis from './TravelPatternAnalysis';
import { useData } from '../contexts/DataContext';
import { useUI } from '../contexts/UIContext';

const PersonDetailModal = () => {
  const { people, customFields } = useData();
  const { selectedPersonForDetail: person, setSelectedPersonForDetail, setEditingPerson } = useUI();

  const onClose = () => setSelectedPersonForDetail(null);
  const onEdit = (p) => { setSelectedPersonForDetail(null); setEditingPerson(p); };
  const [activeTab, setActiveTab] = useState('details');
  const [showReportGenerator, setShowReportGenerator] = useState(false);
  const [locations, setLocations] = useState(person.locations || []);

  const handleDeleteLocation = async (index) => {
    if (!window.confirm('Remove this location?')) return;
    try {
      const res = await fetch(`/api/people/${person.id}/locations/${index}`, {
        method: 'DELETE',
        credentials: 'include'
      });
      if (res.ok) {
        setLocations(prev => prev.filter((_, i) => i !== index));
      } else {
        alert('Failed to delete location');
      }
    } catch {
      alert('Failed to delete location');
    }
  };
  // Removed: const [riskSummary, setRiskSummary] = useState(null);

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
      <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl border border-gray-200 dark:border-gray-700 w-full max-w-4xl max-h-[90vh] overflow-hidden">
          {/* Header */}
          <div className="p-6 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
            <div className="flex items-center space-x-4">
              {person.profile_picture_url ? (
                <img 
                  src={person.profile_picture_url} 
                  alt={getFullName(person)} 
                  className="w-16 h-16 rounded-full object-cover border-2 border-gray-300 dark:border-gray-600 shadow-md" 
                />
              ) : (
                <div className="w-16 h-16 rounded-full bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 flex items-center justify-center">
                  <User className="w-8 h-8 text-blue-600 dark:text-blue-400" />
                </div>
              )}
              <div>
                <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                  {getFullName(person)}
                  {person.date_of_birth && (
                    <span className="text-gray-500 dark:text-slate-400 font-normal text-lg ml-2">
                      ({getAge(person.date_of_birth)} years old)
                    </span>
                  )}
                </h2>
                {person.aliases && person.aliases.length > 0 && (
                  <p className="text-sm text-gray-600 dark:text-gray-400 font-medium">AKA: {person.aliases.join(', ')}</p>
                )}
              </div>
            </div>
            <div className="flex space-x-2">
              <button 
                onClick={() => setShowReportGenerator(true)} 
                className="p-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-accent-success hover:bg-green-600 dark:bg-green-500 hover:text-white transition-all duration-300"
                title="Generate Report"
              >
                <FileText className="w-5 h-5" />
              </button>
              <button 
                onClick={() => onEdit(person)} 
                className="p-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-blue-600 dark:text-blue-400 hover:bg-blue-700 dark:hover:bg-blue-600 hover:text-white transition-all duration-300"
              >
                <Edit2 className="w-5 h-5" />
              </button>
              <button 
                onClick={onClose} 
                className="p-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-600 dark:text-slate-400 hover:bg-red-600 dark:bg-red-500 hover:text-white transition-all duration-300"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>
          
          {/* Tabs */}
          <div className="border-b border-gray-200 dark:border-gray-700">
            <div className="flex">
            {['details', 'relationships', 'locations', 'travel'].map((tab) => (
               <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-6 py-3 font-medium text-sm border-b-2 capitalize transition-all duration-300 ${
                    activeTab === tab 
                      ? 'border-accent-primary text-blue-600 dark:text-blue-400 bg-gradient-to-t from-white/5 to-transparent' 
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  {tab}
                  {tab === 'relationships' && connectedPeople.length > 0 && (
                    <span className="ml-2 text-xs glass px-2 py-1 rounded-lg text-blue-600 dark:text-blue-400">
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
                      <h3 className="text-lg font-semibold mb-3 flex items-center text-gray-900 dark:text-gray-100">
                        <User className="w-5 h-5 mr-2 text-gray-400 dark:text-slate-500" />
                        Basic Information
                      </h3>
                      <div className="space-y-3 glass rounded-lg-lg p-4">
                        <div className="flex justify-between">
                          <span className="font-medium text-gray-600 dark:text-gray-400">First Name:</span>
                          <span className="font-semibold text-gray-900 dark:text-gray-100">{person.first_name || 'N/A'}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="font-medium text-gray-600 dark:text-gray-400">Last Name:</span>
                          <span className="font-semibold text-gray-900 dark:text-gray-100">{person.last_name || 'N/A'}</span>
                        </div>
                        {person.date_of_birth && (
                          <div className="flex justify-between">
                            <span className="font-medium text-gray-600 dark:text-gray-400">Date of Birth:</span>
                            <span className="font-semibold text-gray-900 dark:text-gray-100">{new Date(person.date_of_birth).toLocaleDateString()}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    <div>
                      <h3 className="text-lg font-semibold mb-3 flex items-center text-gray-900 dark:text-gray-100">
                        <Tag className="w-5 h-5 mr-2 text-gray-400 dark:text-slate-500" />
                        Classification
                      </h3>
                      <div className="space-y-3 glass rounded-lg-lg p-4">
                        <div className="flex justify-between">
                          <span className="font-medium text-gray-600 dark:text-gray-400">Category:</span>
                          <span className="px-3 py-1 bg-blue-600 text-white dark:bg-blue-500 rounded-lg text-sm font-medium">
                            {person.category || 'N/A'}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="font-medium text-gray-600 dark:text-gray-400">Status:</span>
                          <span className={`px-3 py-1 rounded-lg text-sm font-medium ${
                            person.status === 'Open' ? 'bg-green-600 dark:bg-green-500 text-white' :
                            person.status === 'Being Investigated' ? 'bg-gradient-warning text-white' :
                            person.status === 'Closed' ? 'glass text-gray-800 dark:text-slate-200' :
                            'bg-blue-600 text-white dark:bg-blue-500'
                          }`}>
                            {person.status || 'N/A'}
                          </span>
                        </div>
                        {person.crm_status && (
                          <div className="flex justify-between">
                            <span className="font-medium text-gray-600 dark:text-gray-400">CRM Status:</span>
                            <span className="font-semibold text-gray-900 dark:text-gray-100">{person.crm_status}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  {/* Case and Additional Info */}
                  <div className="space-y-4">
                    {person.case_name && (
                      <div>
                        <h3 className="text-lg font-semibold mb-3 flex items-center text-gray-900 dark:text-gray-100">
                          <Briefcase className="w-5 h-5 mr-2 text-gray-400 dark:text-slate-500" />
                          Case Information
                        </h3>
                        <div className="glass rounded-lg-lg p-4">
                          <div className="flex justify-between">
                            <span className="font-medium text-gray-600 dark:text-gray-400">Case Name:</span>
                            <span className="text-blue-600 dark:text-blue-400 font-semibold">{person.case_name}</span>
                          </div>
                        </div>
                      </div>
                    )}

                    <div>
                      <h3 className="text-lg font-semibold mb-3 flex items-center text-gray-900 dark:text-gray-100">
                        <Network className="w-5 h-5 mr-2 text-gray-400 dark:text-slate-500" />
                        Connection Summary
                      </h3>
                      <div className="glass rounded-lg-lg p-4">
                        <div className="text-center">
                          <div className="text-3xl font-bold bg-gradient-to-r from-accent-primary to-accent-secondary bg-clip-text text-transparent">{connectedPeople.length}</div>
                          <div className="text-sm text-gray-600 dark:text-gray-400 font-medium">Total Connections</div>
                        </div>
                        {connectedPeople.length > 0 && (
                          <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
                            <div className="grid grid-cols-2 gap-2 text-sm">
                              <div className="font-medium text-gray-900 dark:text-gray-100">Outgoing: <span className="text-blue-600 dark:text-blue-400">{connectedPeople.filter(c => c.direction === 'outgoing').length}</span></div>
                              <div className="font-medium text-gray-900 dark:text-gray-100">Incoming: <span className="text-accent-secondary">{connectedPeople.filter(c => c.direction === 'incoming').length}</span></div>
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
                    <h3 className="text-lg font-semibold mb-3 text-gray-900 dark:text-gray-100">Notes</h3>
                    <div className="glass rounded-lg-lg p-4">
                      <p className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap leading-relaxed">{person.notes}</p>
                    </div>
                  </div>
                )}
                
                {/* OSINT Data */}
                {person.osint_data && person.osint_data.length > 0 && (
                  <div className="mb-6">
                    <h3 className="text-lg font-semibold mb-3 text-gray-900 dark:text-gray-100">OSINT Data</h3>
                    <div className="space-y-2">
                      {person.osint_data.map((osint, index) => (
                        <div key={index} className="flex items-center space-x-3 p-3 glass rounded-lg hover:bg-gray-100 dark:bg-gray-700 transition-all duration-300">
                          <div className="text-gray-600 dark:text-gray-400">
                            {getOsintIcon(osint.type)}
                          </div>
                          <div className="flex-1 text-gray-900 dark:text-gray-100">
                            <span className="font-medium">{osint.type}:</span> {osint.value}
                            {osint.notes && <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{osint.notes}</p>}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                
                {/* Custom Fields */}
                {person.custom_fields && Object.keys(person.custom_fields).length > 0 && (
                  <div>
                    <h3 className="text-lg font-semibold mb-3 text-gray-900 dark:text-gray-100">Custom Fields</h3>
                    <div className="space-y-2">
                      {Object.entries(person.custom_fields).map(([key, value]) => {
                        const fieldDef = customFields.find(f => f.field_name === key);
                        return (
                          <div key={key} className="flex items-center space-x-3 p-3 glass rounded-lg text-gray-900 dark:text-gray-100">
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
                {locations.length > 0 ? (
                  <div>
                    <h3 className="text-lg font-semibold mb-3 text-gray-900 dark:text-gray-100">Locations</h3>
                    <div className="space-y-3">
                      {locations.map((location, index) => (
                        <div key={index} className="p-4 glass rounded-lg">
                          <div className="flex items-start justify-between">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center space-x-2 mb-2">
                                <MapPin className="w-4 h-4 text-gray-400 dark:text-slate-500 flex-shrink-0" />
                                <span className="font-medium text-sm px-3 py-1 bg-blue-600 text-white dark:bg-blue-500 rounded-lg">
                                  {(location.type || 'unknown').replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                                </span>
                              </div>
                              <p className="font-medium text-gray-900 dark:text-gray-100">{location.address}</p>
                              <p className="text-sm text-gray-600 dark:text-gray-400">
                                {[location.city, location.state, location.country, location.postal_code]
                                  .filter(Boolean)
                                  .join(', ')}
                              </p>
                              {location.notes && <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">{location.notes}</p>}
                            </div>
                            <button
                              onClick={() => handleDeleteLocation(index)}
                              className="ml-3 p-1.5 text-gray-400 dark:text-slate-500 hover:text-red-600 dark:hover:text-red-400 transition-colors duration-150 flex-shrink-0"
                              title="Remove location"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-12 text-gray-500 dark:text-gray-400">
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