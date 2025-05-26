// File: frontend/src/components/PeopleList.js
import React, { useState, useEffect } from 'react';
import { User, Search, Plus, Edit2, Trash2, Eye, Tag, Briefcase, Network, Clock, Calendar, Users } from 'lucide-react';
import { peopleAPI, casesAPI } from '../utils/api';
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
  const [filterLastModified, setFilterLastModified] = useState('');
  const [filterCase, setFilterCase] = useState('');
  const [cases, setCases] = useState([]);

  useEffect(() => {
    fetchCases();
  }, []);

  const fetchCases = async () => {
    try {
      const casesData = await casesAPI.getAll();
      setCases(casesData);
    } catch (error) {
      console.error('Error fetching cases:', error);
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

  const isWithinTimeFilter = (person, filter) => {
    if (!filter) return true;
    
    const lastModified = new Date(person.updated_at || person.created_at);
    const now = new Date();
    const daysDiff = Math.floor((now - lastModified) / (1000 * 60 * 60 * 24));
    
    switch (filter) {
      case 'week': return daysDiff <= 7;
      case '2weeks': return daysDiff <= 14;
      case 'month': return daysDiff <= 30;
      case 'quarter': return daysDiff <= 90;
      case 'halfyear': return daysDiff <= 180;
      case 'year': return daysDiff <= 365;
      case 'prevyear': return daysDiff > 365 && daysDiff <= 730;
      case 'older': return daysDiff > 730;
      default: return true;
    }
  };

  const filteredPeople = people.filter(person => {
    const fullName = getFullName(person);
    const matchesSearch = searchTerm === '' || 
      fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (person.aliases && person.aliases.some(alias => alias.toLowerCase().includes(searchTerm.toLowerCase()))) ||
      (person.case_name && person.case_name.toLowerCase().includes(searchTerm.toLowerCase()));
    
    const matchesCategory = filterCategory === '' || person.category === filterCategory;
    const matchesStatus = filterStatus === '' || person.status === filterStatus;
    const matchesCase = filterCase === '' || person.case_name === filterCase;
    const matchesTimeFilter = isWithinTimeFilter(person, filterLastModified);
    
    return matchesSearch && matchesCategory && matchesStatus && matchesCase && matchesTimeFilter;
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
        <div>
          <h1 className="text-2xl font-bold text-gray-900">People Management</h1>
          <p className="text-sm text-gray-600 mt-1 flex items-center">
            <Users className="w-4 h-4 mr-1" />
            {filteredPeople.length === people.length ? (
              <span>{people.length} people</span>
            ) : (
              <span>{filteredPeople.length} of {people.length} people</span>
            )}
          </p>
        </div>
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
          <div className="flex-1 max-w-md">
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
            value={filterCase}
            onChange={(e) => setFilterCase(e.target.value)}
            className="px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All Cases</option>
            {cases.map(caseItem => (
              <option key={caseItem.id} value={caseItem.case_name}>{caseItem.case_name}</option>
            ))}
          </select>
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
          <select
            value={filterLastModified}
            onChange={(e) => setFilterLastModified(e.target.value)}
            className="px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All Time</option>
            <option value="week">Last Week</option>
            <option value="2weeks">Last 2 Weeks</option>
            <option value="month">Last Month</option>
            <option value="quarter">Last Quarter</option>
            <option value="halfyear">Last 6 Months</option>
            <option value="year">Last Year</option>
            <option value="prevyear">Previous Year</option>
            <option value="older">Older</option>
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
                    alt={getFullName(person)} 
                    className="w-12 h-12 rounded-full object-cover" 
                  />
                ) : (
                  <div className="w-12 h-12 rounded-full bg-gray-200 flex items-center justify-center">
                    <User className="w-6 h-6 text-gray-500" />
                  </div>
                )}
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">
                    {getFullName(person)}
                    {person.date_of_birth && (
                      <span className="text-gray-500 font-normal ml-2">
                        ({getAge(person.date_of_birth)})
                      </span>
                    )}
                  </h3>
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
              <div className="flex items-center text-sm">
                <Clock className="w-4 h-4 mr-2 text-gray-400" />
                <span className="text-gray-600">
                  Modified {getTimeAgo(new Date(person.updated_at || person.created_at))}
                </span>
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