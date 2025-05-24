// File: frontend/src/components/CaseManagement.js
import React, { useState, useEffect } from 'react';
import { 
  Folder, Users, Clock, ChevronDown, ChevronRight, Plus, Search, 
  Edit2, Trash2, Calendar, AlertCircle, CheckCircle, User, 
  UserPlus, X, Save, FolderOpen 
} from 'lucide-react';
import { casesAPI, peopleAPI } from '../utils/api';

const CaseManagement = ({ 
  people, 
  fetchPeople, 
  setEditingPerson,
  setShowAddPersonForm,
  setSelectedPersonForDetail 
}) => {
  const [cases, setCases] = useState([]);
  const [expandedCases, setExpandedCases] = useState({});
  const [editingCase, setEditingCase] = useState(null);
  const [showNewCaseForm, setShowNewCaseForm] = useState(false);
  const [newCaseData, setNewCaseData] = useState({ case_name: '', description: '', status: 'active' });
  const [searchTerm, setSearchTerm] = useState('');
  const [showQuickAdd, setShowQuickAdd] = useState(null);
  const [quickAddPerson, setQuickAddPerson] = useState({ firstName: '', lastName: '' });
  const [showAddPeopleModal, setShowAddPeopleModal] = useState(null);
  const [selectedPeopleToAdd, setSelectedPeopleToAdd] = useState([]);

  useEffect(() => {
    fetchCases();
  }, [people]);

  const fetchCases = async () => {
    try {
      const casesData = await casesAPI.getAll();
      
      // Process cases to add people count and other stats
      const processedCases = casesData.map(caseItem => {
        const casePeople = people.filter(p => p.case_name === caseItem.case_name);
        const lastUpdate = Math.max(
          ...casePeople.map(p => new Date(p.updated_at || p.created_at).getTime()),
          new Date(caseItem.updated_at || caseItem.created_at).getTime()
        );
        
        return {
          ...caseItem,
          peopleCount: casePeople.length,
          people: casePeople,
          lastUpdate: new Date(lastUpdate),
          openCount: casePeople.filter(p => p.status === 'Open').length,
          investigatingCount: casePeople.filter(p => p.status === 'Being Investigated').length,
          closedCount: casePeople.filter(p => p.status === 'Closed').length
        };
      });
      
      setCases(processedCases.sort((a, b) => b.lastUpdate - a.lastUpdate));
    } catch (error) {
      console.error('Error fetching cases:', error);
    }
  };

  const handleCreateCase = async () => {
    if (!newCaseData.case_name.trim()) return;
    
    try {
      await casesAPI.create(newCaseData);
      setNewCaseData({ case_name: '', description: '', status: 'active' });
      setShowNewCaseForm(false);
      fetchCases();
    } catch (error) {
      console.error('Error creating case:', error);
      alert('Failed to create case');
    }
  };

  const handleUpdateCase = async (caseId, updates) => {
    try {
      await casesAPI.update(caseId, updates);
      fetchCases();
      setEditingCase(null);
    } catch (error) {
      console.error('Error updating case:', error);
      alert('Failed to update case');
    }
  };

  const handleDeleteCase = async (caseId) => {
    if (window.confirm('Are you sure you want to delete this case? People will not be deleted but will no longer be associated with this case.')) {
      try {
        await casesAPI.delete(caseId);
        fetchCases();
      } catch (error) {
        console.error('Error deleting case:', error);
        alert('Failed to delete case');
      }
    }
  };

  const handleQuickAddPerson = async (caseName) => {
    if (!quickAddPerson.firstName.trim()) return;
    
    try {
      const newPerson = {
        firstName: quickAddPerson.firstName,
        lastName: quickAddPerson.lastName,
        caseName: caseName,
        status: 'Open',
        category: 'Person of Interest',
        aliases: [],
        osintData: [],
        connections: [],
        locations: [],
        attachments: [],
        custom_fields: {}
      };
      
      await peopleAPI.create(newPerson);
      setQuickAddPerson({ firstName: '', lastName: '' });
      setShowQuickAdd(null);
      fetchPeople();
    } catch (error) {
      console.error('Error creating person:', error);
      alert('Failed to create person');
    }
  };

  const handleAddPeopleToCase = async (caseName) => {
    for (const personId of selectedPeopleToAdd) {
      const person = people.find(p => p.id === personId);
      if (person) {
        const updatedPerson = {
          firstName: person.first_name,
          lastName: person.last_name,
          aliases: person.aliases,
          dateOfBirth: person.date_of_birth,
          category: person.category,
          status: person.status,
          crmStatus: person.crm_status,
          caseName: caseName,
          profilePictureUrl: person.profile_picture_url,
          notes: person.notes,
          osintData: person.osint_data,
          attachments: person.attachments,
          connections: person.connections,
          locations: person.locations,
          custom_fields: person.custom_fields
        };
        
        await peopleAPI.update(personId, updatedPerson);
      }
    }
    
    setSelectedPeopleToAdd([]);
    setShowAddPeopleModal(null);
    fetchPeople();
  };

  const toggleCase = (caseId) => {
    setExpandedCases(prev => ({
      ...prev,
      [caseId]: !prev[caseId]
    }));
  };

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

  const getTimeAgo = (date) => {
    const now = new Date();
    const diff = now - date;
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    
    if (days === 0) return 'Today';
    if (days === 1) return 'Yesterday';
    if (days < 7) return `${days} days ago`;
    if (days < 30) return `${Math.floor(days / 7)} weeks ago`;
    if (days < 365) return `${Math.floor(days / 30)} months ago`;
    return `${Math.floor(days / 365)} years ago`;
  };

  const filteredCases = cases.filter(caseItem => 
    caseItem.case_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    caseItem.description?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const availablePeople = people.filter(p => 
    !p.case_name || p.case_name === ''
  );

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Case Management</h1>
        <button
          onClick={() => setShowNewCaseForm(true)}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 flex items-center"
        >
          <Plus className="w-4 h-4 mr-2" />
          New Case
        </button>
      </div>

      {/* Search */}
      <div className="mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
          <input
            type="text"
            placeholder="Search cases..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* New Case Form */}
      {showNewCaseForm && (
        <div className="mb-6 p-4 bg-white rounded-lg shadow-sm border">
          <h3 className="text-lg font-semibold mb-4">Create New Case</h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Case Name</label>
              <input
                type="text"
                value={newCaseData.case_name}
                onChange={(e) => setNewCaseData({ ...newCaseData, case_name: e.target.value })}
                className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Enter case name..."
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
              <textarea
                value={newCaseData.description}
                onChange={(e) => setNewCaseData({ ...newCaseData, description: e.target.value })}
                className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                rows="3"
                placeholder="Enter case description..."
              />
            </div>
            <div className="flex justify-end space-x-2">
              <button
                onClick={() => {
                  setShowNewCaseForm(false);
                  setNewCaseData({ case_name: '', description: '', status: 'active' });
                }}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateCase}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
              >
                Create Case
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cases List */}
      <div className="space-y-4">
        {filteredCases.map(caseItem => (
          <div key={caseItem.id} className="bg-white rounded-lg shadow-sm border">
            {/* Case Header */}
            <div className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <button
                    onClick={() => toggleCase(caseItem.id)}
                    className="text-gray-500 hover:text-gray-700"
                  >
                    {expandedCases[caseItem.id] ? (
                      <ChevronDown className="w-5 h-5" />
                    ) : (
                      <ChevronRight className="w-5 h-5" />
                    )}
                  </button>
                  <Folder className="w-5 h-5 text-blue-600" />
                  <h3 className="text-lg font-semibold">{caseItem.case_name}</h3>
                  <span className={`px-2 py-1 text-xs rounded-full ${
                    caseItem.status === 'active' ? 'bg-green-100 text-green-800' :
                    caseItem.status === 'closed' ? 'bg-gray-100 text-gray-800' :
                    'bg-yellow-100 text-yellow-800'
                  }`}>
                    {caseItem.status}
                  </span>
                </div>
                <div className="flex items-center space-x-4">
                  <div className="flex items-center space-x-2 text-sm text-gray-600">
                    <Users className="w-4 h-4" />
                    <span>{caseItem.peopleCount} people</span>
                  </div>
                  <div className="flex items-center space-x-2 text-sm text-gray-600">
                    <Clock className="w-4 h-4" />
                    <span>{getTimeAgo(caseItem.lastUpdate)}</span>
                  </div>
                </div>
              </div>
              
              {!expandedCases[caseItem.id] && (
                <div className="mt-3 flex items-center space-x-6 text-sm">
                  <div className="flex items-center space-x-1">
                    <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                    <span className="text-gray-600">Open: {caseItem.openCount}</span>
                  </div>
                  <div className="flex items-center space-x-1">
                    <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
                    <span className="text-gray-600">Investigating: {caseItem.investigatingCount}</span>
                  </div>
                  <div className="flex items-center space-x-1">
                    <div className="w-3 h-3 bg-gray-500 rounded-full"></div>
                    <span className="text-gray-600">Closed: {caseItem.closedCount}</span>
                  </div>
                </div>
              )}
            </div>

            {/* Expanded Case Content */}
            {expandedCases[caseItem.id] && (
              <div className="border-t">
                {/* Case Settings */}
                <div className="p-4 bg-gray-50">
                  {editingCase === caseItem.id ? (
                    <div className="space-y-3">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Case Name</label>
                        <input
                          type="text"
                          value={caseItem.case_name}
                          onChange={(e) => {
                            const updatedCases = cases.map(c => 
                              c.id === caseItem.id ? { ...c, case_name: e.target.value } : c
                            );
                            setCases(updatedCases);
                          }}
                          className="w-full px-3 py-2 border rounded-md"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                        <textarea
                          value={caseItem.description || ''}
                          onChange={(e) => {
                            const updatedCases = cases.map(c => 
                              c.id === caseItem.id ? { ...c, description: e.target.value } : c
                            );
                            setCases(updatedCases);
                          }}
                          className="w-full px-3 py-2 border rounded-md"
                          rows="2"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                        <select
                          value={caseItem.status}
                          onChange={(e) => {
                            const updatedCases = cases.map(c => 
                              c.id === caseItem.id ? { ...c, status: e.target.value } : c
                            );
                            setCases(updatedCases);
                          }}
                          className="px-3 py-2 border rounded-md"
                        >
                          <option value="active">Active</option>
                          <option value="on_hold">On Hold</option>
                          <option value="closed">Closed</option>
                        </select>
                      </div>
                      <div className="flex justify-end space-x-2">
                        <button
                          onClick={() => setEditingCase(null)}
                          className="px-3 py-1 text-gray-700 bg-gray-200 rounded-md hover:bg-gray-300"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={() => handleUpdateCase(caseItem.id, {
                            case_name: caseItem.case_name,
                            description: caseItem.description,
                            status: caseItem.status
                          })}
                          className="px-3 py-1 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                        >
                          Save
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-sm text-gray-600">{caseItem.description || 'No description'}</p>
                        <p className="text-xs text-gray-500 mt-1">
                          Created: {new Date(caseItem.created_at).toLocaleDateString()}
                        </p>
                      </div>
                      <div className="flex space-x-2">
                        <button
                          onClick={() => setEditingCase(caseItem.id)}
                          className="text-gray-600 hover:text-gray-700"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteCase(caseItem.id)}
                          className="text-red-600 hover:text-red-700"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* People in Case */}
                <div className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="font-medium">People in this case</h4>
                    <div className="flex space-x-2">
                      <button
                        onClick={() => setShowAddPeopleModal(caseItem.case_name)}
                        className="px-3 py-1 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 flex items-center text-sm"
                      >
                        <UserPlus className="w-4 h-4 mr-1" />
                        Add Existing
                      </button>
                      <button
                        onClick={() => setShowQuickAdd(caseItem.case_name)}
                        className="px-3 py-1 bg-blue-600 text-white rounded-md hover:bg-blue-700 flex items-center text-sm"
                      >
                        <Plus className="w-4 h-4 mr-1" />
                        Quick Add
                      </button>
                    </div>
                  </div>

                  {/* Quick Add Form */}
                  {showQuickAdd === caseItem.case_name && (
                    <div className="mb-4 p-3 bg-gray-50 rounded-lg">
                      <div className="flex space-x-2">
                        <input
                          type="text"
                          placeholder="First Name"
                          value={quickAddPerson.firstName}
                          onChange={(e) => setQuickAddPerson({ ...quickAddPerson, firstName: e.target.value })}
                          className="flex-1 px-3 py-2 border rounded-md text-sm"
                        />
                        <input
                          type="text"
                          placeholder="Last Name"
                          value={quickAddPerson.lastName}
                          onChange={(e) => setQuickAddPerson({ ...quickAddPerson, lastName: e.target.value })}
                          className="flex-1 px-3 py-2 border rounded-md text-sm"
                        />
                        <button
                          onClick={() => handleQuickAddPerson(caseItem.case_name)}
                          className="px-3 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 text-sm"
                        >
                          Add
                        </button>
                        <button
                          onClick={() => {
                            setShowQuickAdd(null);
                            setQuickAddPerson({ firstName: '', lastName: '' });
                          }}
                          className="px-3 py-2 text-gray-700 bg-gray-200 rounded-md hover:bg-gray-300 text-sm"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}

                  {/* People List */}
                  <div className="space-y-2">
                    {caseItem.people.map(person => (
                      <div key={person.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100">
                        <div className="flex items-center space-x-3">
                          <User className="w-4 h-4 text-gray-400" />
                          <div>
                            <p className="font-medium">
                              {getFullName(person)}
                              {person.date_of_birth && (
                                <span className="text-gray-500 ml-2">
                                  ({getAge(person.date_of_birth)})
                                </span>
                              )}
                            </p>
                            <p className="text-sm text-gray-600">
                              {person.category} • {person.status}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center space-x-2">
                          <span className="text-xs text-gray-500">
                            Updated {getTimeAgo(new Date(person.updated_at || person.created_at))}
                          </span>
                          <button
                            onClick={() => setSelectedPersonForDetail(person)}
                            className="text-blue-600 hover:text-blue-700 text-sm"
                          >
                            View
                          </button>
                          <button
                            onClick={() => setEditingPerson(person)}
                            className="text-gray-600 hover:text-gray-700"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Add People Modal */}
      {showAddPeopleModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
            <div className="p-6 border-b">
              <h3 className="text-lg font-semibold">Add People to {showAddPeopleModal}</h3>
            </div>
            <div className="p-6">
              <p className="text-sm text-gray-600 mb-4">Select people to add to this case:</p>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {availablePeople.map(person => (
                  <label key={person.id} className="flex items-center space-x-3 p-2 hover:bg-gray-50 rounded cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedPeopleToAdd.includes(person.id)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedPeopleToAdd([...selectedPeopleToAdd, person.id]);
                        } else {
                          setSelectedPeopleToAdd(selectedPeopleToAdd.filter(id => id !== person.id));
                        }
                      }}
                      className="h-4 w-4 text-blue-600 rounded"
                    />
                    <div className="flex-1">
                      <p className="font-medium">{getFullName(person)}</p>
                      <p className="text-sm text-gray-600">{person.category}</p>
                    </div>
                  </label>
                ))}
              </div>
              <div className="flex justify-end space-x-2 mt-6">
                <button
                  onClick={() => {
                    setShowAddPeopleModal(null);
                    setSelectedPeopleToAdd([]);
                  }}
                  className="px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleAddPeopleToCase(showAddPeopleModal)}
                  disabled={selectedPeopleToAdd.length === 0}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
                >
                  Add {selectedPeopleToAdd.length} People
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CaseManagement;