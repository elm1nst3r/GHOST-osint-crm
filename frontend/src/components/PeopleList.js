// File: frontend/src/components/PeopleList.js
import React, { useState } from 'react';
import { User, Search, Plus, Edit2, Trash2, Eye, Tag, Briefcase, Network } from 'lucide-react';
import { peopleAPI } from '../utils/api';
import { PERSON_CATEGORIES, PERSON_STATUSES } from '../utils/constants';

const PeopleList = ({ 
  people, 
  fetchPeople, 
  setShowAddPersonForm, 
  setEditingPerson, 
  setSelectedPersonForDetail 
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [filterStatus, setFilterStatus] = useState('');

  const getRelationshipCount = (personId) => {
    const person = people.find(p => p.id === personId);
    if (!person) return 0;
    
    const directConnections = person.connections?.length || 0;
    const reverseConnections = people.filter(p => 
      p.connections?.some(c => c.person_id === personId)
    ).length;
    
    return Math.max(directConnections, reverseConnections);
  };

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
        await peopleAPI.delete(id);
        fetchPeople();
      } catch (error) {
        console.error('Error deleting person:', error);
        alert('Failed to delete person');
      }
    }
  };

  const getStatusColor = (status) => {
    const statusConfig = PERSON_STATUSES.find(s => s.value === status);
    const colorMap = {
      green: 'bg-green-100 text-green-800',
      yellow: 'bg-yellow-100 text-yellow-800',
      gray: 'bg-gray-100 text-gray-800',
      blue: 'bg-blue-100 text-blue-800'
    };
    return colorMap[statusConfig?.color] || 'bg-gray-100 text-gray-800';
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

      {/* Search and Filters */}
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
            {PERSON_CATEGORIES.map(cat => (
              <option key={cat.value} value={cat.value}>{cat.label}</option>
            ))}
          </select>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All Statuses</option>
            {PERSON_STATUSES.map(status => (
              <option key={status.value} value={status.value}>{status.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* People Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredPeople.map(person => (
          <div key={person.id} className="bg-white rounded-lg shadow-sm p-6 border hover:shadow-md transition-shadow">
            <div className="flex justify-between items-start mb-4">
              <div className="flex items-center space-x-3">
                {person.profile_picture_url ? (
                  <img 
                    src={person.profile_picture_url} 
                    alt={person.name} 
                    className="w-12 h-12 rounded-full object-cover" 
                  />
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
                  title="View Details"
                >
                  <Eye className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setEditingPerson(person)}
                  className="text-gray-600 hover:text-gray-700"
                  title="Edit"
                >
                  <Edit2 className="w-4 h-4" />
                </button>
                <button
                  onClick={() => handleDelete(person.id)}
                  className="text-red-600 hover:text-red-700"
                  title="Delete"
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
                <span className={`inline-block px-2 py-1 text-xs rounded-full ${getStatusColor(person.status)}`}>
                  {person.status}
                </span>
              </div>
            )}
          </div>
        ))}
      </div>

      {filteredPeople.length === 0 && (
        <div className="text-center py-12">
          <p className="text-gray-500">No people found matching your search criteria.</p>
        </div>
      )}
    </div>
  );
};

export default PeopleList;