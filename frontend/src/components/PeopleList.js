// File: frontend/src/components/PeopleList.js
import React, { useState, useEffect } from 'react';
import { User, Search, Plus, Edit2, Trash2, Eye, Tag, Briefcase, Network, Clock, Calendar, Users, Grid3x3, Table } from 'lucide-react';
import { peopleAPI, casesAPI } from '../utils/api';
import { PERSON_CATEGORIES, PERSON_STATUSES } from '../utils/constants';
import PeopleTableView from './PeopleTableView';

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
  const [viewMode, setViewMode] = useState('cards'); // 'cards' or 'table'

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
      green: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
      yellow: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
      gray: 'bg-gray-100 text-gray-800 dark:bg-slate-700 dark:text-gray-300',
      blue: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400'
    };
    return colorMap[statusConfig?.color] || 'bg-gray-100 text-gray-800 dark:bg-slate-700 dark:text-gray-300';
  };

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-gray-900 to-gray-600 bg-clip-text text-transparent dark:from-gray-100 dark:to-gray-300">People Management</h1>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-2 flex items-center">
            <Users className="w-5 h-5 mr-2 text-accent-primary" />
            {filteredPeople.length === people.length ? (
              <span className="font-medium">{people.length} people</span>
            ) : (
              <span className="font-medium">{filteredPeople.length} of {people.length} people</span>
            )}
          </p>
        </div>
        <div className="flex items-center space-x-3">
          {/* View Mode Toggle */}
          <div className="flex items-center space-x-1 bg-gray-100 dark:bg-slate-800 rounded-lg p-1">
            <button
              onClick={() => setViewMode('cards')}
              className={`px-3 py-2 rounded flex items-center space-x-2 transition ${
                viewMode === 'cards' ? 'bg-white dark:bg-blue-600 shadow-sm text-blue-600 dark:text-white' : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100'
              }`}
              title="Card View"
            >
              <Grid3x3 className="w-4 h-4" />
              <span className="text-sm font-medium hidden md:inline">Cards</span>
            </button>
            <button
              onClick={() => setViewMode('table')}
              className={`px-3 py-2 rounded flex items-center space-x-2 transition ${
                viewMode === 'table' ? 'bg-white dark:bg-blue-600 shadow-sm text-blue-600 dark:text-white' : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100'
              }`}
              title="Table View"
            >
              <Table className="w-4 h-4" />
              <span className="text-sm font-medium hidden md:inline">Table</span>
            </button>
          </div>

          <button
            onClick={() => setShowAddPersonForm(true)}
            className="px-6 py-3 bg-gradient-primary text-white rounded-glass hover:shadow-glow-md transition-all duration-300 flex items-center group"
          >
            <Plus className="w-5 h-5 mr-2 group-hover:animate-pulse" />
            Add Person
          </button>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="mb-6 space-y-4">
        <div className="flex space-x-4">
          <div className="flex-1 max-w-md">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-accent-primary w-5 h-5" />
              <input
                type="text"
                placeholder="Search by name, alias, or case..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-3 glass border border-white/30 rounded-glass focus:outline-none focus:border-accent-primary focus:shadow-glow-sm transition-all duration-300 dark:bg-slate-800 dark:text-white dark:placeholder-gray-500"
              />
            </div>
          </div>
          <select
            value={filterCase}
            onChange={(e) => setFilterCase(e.target.value)}
            className="px-4 py-3 glass border border-white/30 rounded-glass focus:outline-none focus:border-accent-primary focus:shadow-glow-sm transition-all duration-300 dark:bg-slate-800 dark:text-white"
          >
            <option value="">All Cases</option>
            {cases.map(caseItem => (
              <option key={caseItem.id} value={caseItem.case_name}>{caseItem.case_name}</option>
            ))}
          </select>
          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            className="px-4 py-3 glass border border-white/30 rounded-glass focus:outline-none focus:border-accent-primary focus:shadow-glow-sm transition-all duration-300 dark:bg-slate-800 dark:text-white"
          >
            <option value="">All Categories</option>
            {PERSON_CATEGORIES.map(cat => (
              <option key={cat.value} value={cat.value}>{cat.label}</option>
            ))}
          </select>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-4 py-3 glass border border-white/30 rounded-glass focus:outline-none focus:border-accent-primary focus:shadow-glow-sm transition-all duration-300 dark:bg-slate-800 dark:text-white"
          >
            <option value="">All Statuses</option>
            {PERSON_STATUSES.map(status => (
              <option key={status.value} value={status.value}>{status.label}</option>
            ))}
          </select>
          <select
            value={filterLastModified}
            onChange={(e) => setFilterLastModified(e.target.value)}
            className="px-4 py-3 glass border border-white/30 rounded-glass focus:outline-none focus:border-accent-primary focus:shadow-glow-sm transition-all duration-300 dark:bg-slate-800 dark:text-white"
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

      {/* View Content */}
      {viewMode === 'table' ? (
        <PeopleTableView
          people={filteredPeople}
          fetchPeople={fetchPeople}
          setEditingPerson={setEditingPerson}
          setSelectedPersonForDetail={setSelectedPersonForDetail}
        />
      ) : (
        /* People Cards Grid */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredPeople.map(person => (
          <div key={person.id} className="glass-card backdrop-blur-xl border border-white/30 shadow-glass-lg rounded-glass-lg p-6 hover:shadow-glass-xl transition-all duration-300 group">
            <div className="flex justify-between items-start mb-4">
              <div className="flex items-center space-x-3">
                {person.profile_picture_url ? (
                  <img 
                    src={person.profile_picture_url} 
                    alt={getFullName(person)} 
                    className="w-12 h-12 rounded-full object-cover" 
                  />
                ) : (
                  <div className="w-12 h-12 rounded-full glass-heavy border border-white/30 flex items-center justify-center">
                    <User className="w-6 h-6 text-accent-primary" />
                  </div>
                )}
                <div>
                  <h3 className="text-lg font-semibold bg-gradient-to-r from-gray-900 to-gray-600 bg-clip-text text-transparent dark:from-gray-100 dark:to-gray-300">
                    {getFullName(person)}
                    {person.date_of_birth && (
                      <span className="text-gray-500 dark:text-gray-400 font-normal ml-2">
                        ({getAge(person.date_of_birth)})
                      </span>
                    )}
                  </h3>
                  {person.aliases && person.aliases.length > 0 && (
                    <p className="text-sm text-gray-500 dark:text-gray-400">AKA: {person.aliases.join(', ')}</p>
                  )}
                </div>
              </div>
              <div className="flex space-x-2 opacity-0 group-hover:opacity-100 transition-all duration-300">
                <button
                  onClick={() => setSelectedPersonForDetail(person)}
                  className="p-2 glass-button rounded-glass text-accent-primary hover:bg-gradient-primary hover:text-white transition-all duration-300"
                  title="View Details"
                >
                  <Eye className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setEditingPerson(person)}
                  className="p-2 glass-button rounded-glass text-gray-600 dark:text-gray-300 hover:bg-gradient-secondary hover:text-white dark:hover:text-white transition-all duration-300"
                  title="Edit"
                >
                  <Edit2 className="w-4 h-4" />
                </button>
                <button
                  onClick={() => handleDelete(person.id)}
                  className="p-2 glass-button rounded-glass text-accent-danger hover:bg-gradient-danger hover:text-white transition-all duration-300"
                  title="Delete"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
            
            <div className="space-y-3 mt-4">
              {person.category && (
                <div className="flex items-center text-sm">
                  <Tag className="w-4 h-4 mr-2 text-accent-secondary" />
                  <span className="text-gray-700 dark:text-gray-300 font-medium">{person.category}</span>
                </div>
              )}
              {person.case_name && (
                <div className="flex items-center text-sm">
                  <Briefcase className="w-4 h-4 mr-2 text-accent-tertiary" />
                  <span className="text-gray-700 dark:text-gray-300 font-medium">{person.case_name}</span>
                </div>
              )}
              <div className="flex items-center text-sm">
                <Network className="w-4 h-4 mr-2 text-accent-primary" />
                <span className="text-gray-700 dark:text-gray-300 font-medium">{getRelationshipCount(person.id)} connections</span>
              </div>
              <div className="flex items-center text-sm">
                <Clock className="w-4 h-4 mr-2 text-gray-500 dark:text-gray-500" />
                <span className="text-gray-600 dark:text-gray-400">
                  Modified {getTimeAgo(new Date(person.updated_at || person.created_at))}
                </span>
              </div>
            </div>
            
            {person.status && (
              <div className="mt-4">
                <span className={`inline-block px-3 py-1 text-xs font-medium rounded-glass ${getStatusColor(person.status)}`}>
                  {person.status}
                </span>
              </div>
            )}
          </div>
        ))}

          {filteredPeople.length === 0 && (
            <div className="col-span-full text-center py-12">
              <div className="glass-card backdrop-blur-xl border border-white/30 shadow-glass-lg rounded-glass-lg p-8 max-w-md mx-auto">
                <Users className="w-12 h-12 text-gray-400 dark:text-gray-600 mx-auto mb-4" />
                <p className="text-gray-600 dark:text-gray-400 font-medium">No people found matching your search criteria.</p>
                <p className="text-gray-500 dark:text-gray-500 text-sm mt-2">Try adjusting your filters or search terms.</p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default PeopleList;