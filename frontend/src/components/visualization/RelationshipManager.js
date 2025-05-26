// File: frontend/src/components/visualization/RelationshipManager.js
import React, { useState, useEffect, useCallback } from 'react';
import RelationshipDiagram from '../RelationshipDiagram';
import { 
  AlertCircle, Loader2, Network, Users, Eye, EyeOff, 
  Maximize2, RefreshCw, Bug, Filter, X, Search,
  Briefcase, Tag, CheckCircle
} from 'lucide-react';
import { peopleAPI, casesAPI } from '../../utils/api';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';

const RelationshipManager = ({ 
  personId = null,
  showInModal = false,
  onClose = null
}) => {
  const [people, setPeople] = useState([]);
  const [cases, setCases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showOsintData, setShowOsintData] = useState(false);
  const [layoutType, setLayoutType] = useState('hierarchical');
  const [fullScreen, setFullScreen] = useState(false);
  const [debugMode, setDebugMode] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  
  // Filter states
  const [filters, setFilters] = useState({
    searchTerm: '',
    selectedCases: [],
    selectedCategories: [],
    selectedStatuses: [],
    connectionTypes: [],
    minConnections: 0,
    showIsolated: true,
    dateRange: 'all' // all, week, month, year
  });

  // Fetch people data
  const fetchPeople = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      console.log('=== RelationshipManager: Fetching people ===');
      const response = await fetch(`${API_BASE_URL}/people`);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch people: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json();
      console.log('Fetched people count:', data.length);
      
      // Process and validate the data
      const processedData = data.map(person => {
        // Ensure connections is an array
        let connections = [];
        
        if (person.connections) {
          if (Array.isArray(person.connections)) {
            connections = person.connections;
          } else if (typeof person.connections === 'string') {
            try {
              connections = JSON.parse(person.connections);
            } catch (e) {
              console.error(`Failed to parse connections for person ${person.id}:`, e);
              connections = [];
            }
          }
        }
        
        // Validate each connection
        connections = connections.filter(conn => {
          if (!conn || typeof conn.person_id === 'undefined') {
            console.warn(`Invalid connection found for person ${person.id}`);
            return false;
          }
          return true;
        });
        
        return {
          ...person,
          connections
        };
      });
      
      setPeople(processedData);
    } catch (err) {
      console.error('Error fetching people:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch cases
  const fetchCases = useCallback(async () => {
    try {
      const data = await casesAPI.getAll();
      setCases(data);
    } catch (err) {
      console.error('Error fetching cases:', err);
    }
  }, []);

  useEffect(() => {
    fetchPeople();
    fetchCases();
  }, [fetchPeople, fetchCases]);

  // Update connection between two people
  const updateConnection = useCallback(async (sourceId, targetId, type, note) => {
    try {
      console.log('=== Updating connection ===');
      console.log('Source:', sourceId, 'Target:', targetId, 'Type:', type);
      
      // Get the source person's current data
      const sourcePerson = people.find(p => p.id === sourceId);
      if (!sourcePerson) {
        throw new Error('Source person not found');
      }

      // Create updated connections array
      const updatedConnections = [...(sourcePerson.connections || [])];
      
      // Check if connection already exists
      const existingIndex = updatedConnections.findIndex(
        conn => conn.person_id === targetId
      );

      if (existingIndex >= 0) {
        // Update existing
        updatedConnections[existingIndex] = {
          person_id: targetId,
          type,
          note: note || '',
          updated_at: new Date().toISOString()
        };
      } else {
        // Add new
        updatedConnections.push({
          person_id: targetId,
          type,
          note: note || '',
          created_at: new Date().toISOString()
        });
      }

      // Prepare the full update data
      const updateData = {
        firstName: sourcePerson.first_name,
        lastName: sourcePerson.last_name,
        aliases: sourcePerson.aliases || [],
        dateOfBirth: sourcePerson.date_of_birth,
        category: sourcePerson.category,
        status: sourcePerson.status,
        crmStatus: sourcePerson.crm_status,
        caseName: sourcePerson.case_name,
        profilePictureUrl: sourcePerson.profile_picture_url,
        notes: sourcePerson.notes,
        osintData: sourcePerson.osint_data || [],
        attachments: sourcePerson.attachments || [],
        connections: updatedConnections,
        locations: sourcePerson.locations || [],
        custom_fields: sourcePerson.custom_fields || {}
      };

      // Send update
      const response = await fetch(`${API_BASE_URL}/people/${sourceId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updateData)
      });

      if (!response.ok) {
        const errorData = await response.text();
        throw new Error(`Failed to update connection: ${response.status} - ${errorData}`);
      }

      // Refresh data
      await fetchPeople();
      
      alert('Connection created successfully!');
    } catch (err) {
      console.error('Error updating connection:', err);
      alert('Failed to create connection: ' + err.message);
    }
  }, [people, fetchPeople]);

  // Delete connection
  const deleteConnection = useCallback(async (sourceId, targetId) => {
    try {
      const sourcePerson = people.find(p => p.id === sourceId);
      if (!sourcePerson) {
        throw new Error('Source person not found');
      }

      // Remove the connection
      const updatedConnections = (sourcePerson.connections || []).filter(
        conn => conn.person_id !== targetId
      );

      const updateData = {
        firstName: sourcePerson.first_name,
        lastName: sourcePerson.last_name,
        aliases: sourcePerson.aliases || [],
        dateOfBirth: sourcePerson.date_of_birth,
        category: sourcePerson.category,
        status: sourcePerson.status,
        crmStatus: sourcePerson.crm_status,
        caseName: sourcePerson.case_name,
        profilePictureUrl: sourcePerson.profile_picture_url,
        notes: sourcePerson.notes,
        osintData: sourcePerson.osint_data || [],
        attachments: sourcePerson.attachments || [],
        connections: updatedConnections,
        locations: sourcePerson.locations || [],
        custom_fields: sourcePerson.custom_fields || {}
      };

      await fetch(`${API_BASE_URL}/people/${sourceId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updateData)
      });

      await fetchPeople();
      alert('Connection deleted successfully!');
    } catch (err) {
      console.error('Error deleting connection:', err);
      alert('Failed to delete connection: ' + err.message);
    }
  }, [people, fetchPeople]);

  // Apply filters to people
  const applyFilters = useCallback(() => {
    let filtered = [...people];
    
    // Text search
    if (filters.searchTerm) {
      const searchLower = filters.searchTerm.toLowerCase();
      filtered = filtered.filter(person => {
        const fullName = `${person.first_name || ''} ${person.last_name || ''}`.toLowerCase();
        return fullName.includes(searchLower) ||
          (person.aliases && person.aliases.some(alias => alias.toLowerCase().includes(searchLower))) ||
          (person.notes && person.notes.toLowerCase().includes(searchLower));
      });
    }
    
    // Case filter
    if (filters.selectedCases.length > 0) {
      filtered = filtered.filter(person => 
        filters.selectedCases.includes(person.case_name)
      );
    }
    
    // Category filter
    if (filters.selectedCategories.length > 0) {
      filtered = filtered.filter(person => 
        filters.selectedCategories.includes(person.category)
      );
    }
    
    // Status filter
    if (filters.selectedStatuses.length > 0) {
      filtered = filtered.filter(person => 
        filters.selectedStatuses.includes(person.status)
      );
    }
    
    // Connection count filter
    if (filters.minConnections > 0) {
      filtered = filtered.filter(person => {
        const connectionCount = person.connections?.length || 0;
        return connectionCount >= filters.minConnections;
      });
    }
    
    // Date range filter
    if (filters.dateRange !== 'all') {
      const now = new Date();
      const cutoffDate = new Date();
      
      switch (filters.dateRange) {
        case 'week':
          cutoffDate.setDate(now.getDate() - 7);
          break;
        case 'month':
          cutoffDate.setMonth(now.getMonth() - 1);
          break;
        case 'year':
          cutoffDate.setFullYear(now.getFullYear() - 1);
          break;
      }
      
      filtered = filtered.filter(person => {
        const updatedDate = new Date(person.updated_at || person.created_at);
        return updatedDate >= cutoffDate;
      });
    }
    
    // Connection type filter
    if (filters.connectionTypes.length > 0) {
      const peopleWithConnectionTypes = new Set();
      
      filtered.forEach(person => {
        if (person.connections) {
          person.connections.forEach(conn => {
            if (filters.connectionTypes.includes(conn.type)) {
              peopleWithConnectionTypes.add(person.id);
              peopleWithConnectionTypes.add(conn.person_id);
            }
          });
        }
      });
      
      filtered = filtered.filter(person => peopleWithConnectionTypes.has(person.id));
    }
    
    // Include connected people even if they don't match filters
    // This ensures we see complete networks
    if (!filters.showIsolated) {
      const connectedIds = new Set();
      
      filtered.forEach(person => {
        connectedIds.add(person.id);
        if (person.connections) {
          person.connections.forEach(conn => {
            connectedIds.add(conn.person_id);
          });
        }
      });
      
      // Add people who are connected to filtered people
      people.forEach(person => {
        if (person.connections) {
          person.connections.forEach(conn => {
            if (connectedIds.has(conn.person_id)) {
              connectedIds.add(person.id);
            }
          });
        }
      });
      
      filtered = people.filter(p => connectedIds.has(p.id));
    }
    
    return filtered;
  }, [people, filters]);

  // Get filtered people
  const filteredPeople = personId ? (() => {
    const mainPerson = people.find(p => p.id === personId);
    if (!mainPerson) return [];

    const connectedIds = new Set([personId]);
    
    // Add directly connected people
    if (mainPerson.connections) {
      mainPerson.connections.forEach(conn => {
        connectedIds.add(conn.person_id);
      });
    }

    // Find people connected to the main person
    people.forEach(person => {
      if (person.connections) {
        person.connections.forEach(conn => {
          if (conn.person_id === personId) {
            connectedIds.add(person.id);
          }
        });
      }
    });

    return people.filter(p => connectedIds.has(p.id));
  })() : applyFilters();

  // Get unique values for filters
  const uniqueCategories = [...new Set(people.map(p => p.category).filter(Boolean))];
  const uniqueStatuses = [...new Set(people.map(p => p.status).filter(Boolean))];
  const uniqueConnectionTypes = [...new Set(
    people.flatMap(p => (p.connections || []).map(c => c.type)).filter(Boolean)
  )];

  // Reset filters
  const resetFilters = () => {
    setFilters({
      searchTerm: '',
      selectedCases: [],
      selectedCategories: [],
      selectedStatuses: [],
      connectionTypes: [],
      minConnections: 0,
      showIsolated: true,
      dateRange: 'all'
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        <span className="ml-2 text-gray-600">Loading relationships...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <AlertCircle className="w-8 h-8 text-red-500" />
        <span className="ml-2 text-red-600">Error: {error}</span>
      </div>
    );
  }

  const containerClass = fullScreen 
  ? "fixed inset-0 z-50 bg-white flex flex-col" 
  : showInModal 
    ? "h-full w-full flex flex-col" 
    : "h-full flex flex-col"; // Changed from h-[600px] to h-full


  const activeFilterCount = 
    (filters.searchTerm ? 1 : 0) +
    filters.selectedCases.length +
    filters.selectedCategories.length +
    filters.selectedStatuses.length +
    filters.connectionTypes.length +
    (filters.minConnections > 0 ? 1 : 0) +
    (filters.dateRange !== 'all' ? 1 : 0);

  // ... (previous code remains the same until the return statement) ...

  return (
    <div className={containerClass}>
      {/* Header */}
      <div className="bg-white border-b px-4 py-3 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center space-x-3">
          <Network className="w-5 h-5 text-blue-600" />
          <h3 className="text-lg font-semibold">
            {personId ? 'Person Relationships' : 'Global Relationship Network'}
          </h3>
          <span className="text-sm text-gray-500">
            ({filteredPeople.length} of {people.length} people)
          </span>
        </div>
        
        <div className="flex items-center space-x-2">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`px-3 py-1.5 text-sm rounded-md flex items-center space-x-2 ${
              showFilters ? 'bg-blue-600 text-white' : 'bg-gray-100 hover:bg-gray-200'
            }`}
            title="Toggle Filters"
          >
            <Filter className="w-4 h-4" />
            <span className="hidden sm:inline">Filters</span>
            {activeFilterCount > 0 && (
              <span className="ml-1 px-1.5 py-0.5 bg-white text-blue-600 rounded-full text-xs font-medium">
                {activeFilterCount}
              </span>
            )}
          </button>
          
          <button
            onClick={() => setDebugMode(!debugMode)}
            className={`px-3 py-1.5 text-sm rounded-md flex items-center space-x-2 ${
              debugMode ? 'bg-orange-100 text-orange-700' : 'bg-gray-100 hover:bg-gray-200'
            }`}
            title="Toggle Debug Info"
          >
            <Bug className="w-4 h-4" />
            <span className="hidden sm:inline">Debug</span>
          </button>
          
          <button
            onClick={fetchPeople}
            className="px-3 py-1.5 text-sm rounded-md flex items-center space-x-2 bg-gray-100 hover:bg-gray-200"
            title="Refresh Data"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          
          <select
            value={layoutType}
            onChange={(e) => setLayoutType(e.target.value)}
            className="px-3 py-1.5 text-sm border border-gray-300 rounded-md"
          >
            <option value="hierarchical">Hierarchical</option>
            <option value="circular">Circular</option>
            <option value="grid">Grid</option>
          </select>
          
          {!showInModal && (
            <button
              onClick={() => setFullScreen(!fullScreen)}
              className="px-3 py-1.5 text-sm rounded-md bg-gray-100 hover:bg-gray-200"
              title={fullScreen ? "Exit fullscreen" : "Enter fullscreen"}
            >
              <Maximize2 className="w-4 h-4" />
            </button>
          )}
          
          {(showInModal || fullScreen) && onClose && (
            <button
              onClick={() => {
                setFullScreen(false);
                if (showInModal || fullScreen) onClose();
              }}
              className="px-3 py-1.5 text-sm rounded-md bg-gray-100 hover:bg-gray-200"
            >
              Close
            </button>
          )}
        </div>
      </div>
      
      {/* Filters Panel */}
      {showFilters && (
        <div className="bg-gray-50 border-b px-4 py-3 flex-shrink-0 max-h-[40%] overflow-y-auto">
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3">
            {/* Search */}
            <div className="md:col-span-2 lg:col-span-1">
              <label className="block text-xs font-medium text-gray-700 mb-1">Search</label>
              <div className="relative">
                <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 text-gray-400 w-3 h-3" />
                <input
                  type="text"
                  value={filters.searchTerm}
                  onChange={(e) => setFilters({ ...filters, searchTerm: e.target.value })}
                  className="w-full pl-8 pr-2 py-1.5 border rounded text-sm"
                  placeholder="Name or notes..."
                />
              </div>
            </div>
            
            {/* Cases */}
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Cases</label>
              <select
                multiple
                value={filters.selectedCases}
                onChange={(e) => {
                  const selected = Array.from(e.target.selectedOptions, option => option.value);
                  setFilters({ ...filters, selectedCases: selected });
                }}
                className="w-full px-2 py-1.5 border rounded text-sm"
                style={{ minHeight: '32px', maxHeight: '80px' }}
              >
                {cases.map(caseItem => (
                  <option key={caseItem.id} value={caseItem.case_name}>
                    {caseItem.case_name}
                  </option>
                ))}
              </select>
            </div>
            
            {/* Categories */}
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Categories</label>
              <select
                multiple
                value={filters.selectedCategories}
                onChange={(e) => {
                  const selected = Array.from(e.target.selectedOptions, option => option.value);
                  setFilters({ ...filters, selectedCategories: selected });
                }}
                className="w-full px-2 py-1.5 border rounded text-sm"
                style={{ minHeight: '32px', maxHeight: '80px' }}
              >
                {uniqueCategories.map(category => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>
            </div>
            
            {/* Statuses */}
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Status</label>
              <select
                multiple
                value={filters.selectedStatuses}
                onChange={(e) => {
                  const selected = Array.from(e.target.selectedOptions, option => option.value);
                  setFilters({ ...filters, selectedStatuses: selected });
                }}
                className="w-full px-2 py-1.5 border rounded text-sm"
                style={{ minHeight: '32px', maxHeight: '80px' }}
              >
                {uniqueStatuses.map(status => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
            </div>
            
            {/* Connection Types */}
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Connection Types</label>
              <select
                multiple
                value={filters.connectionTypes}
                onChange={(e) => {
                  const selected = Array.from(e.target.selectedOptions, option => option.value);
                  setFilters({ ...filters, connectionTypes: selected });
                }}
                className="w-full px-2 py-1.5 border rounded text-sm"
                style={{ minHeight: '32px', maxHeight: '80px' }}
              >
                {uniqueConnectionTypes.map(type => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </div>
            
            {/* Min Connections */}
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Min Connections</label>
              <input
                type="number"
                value={filters.minConnections}
                onChange={(e) => setFilters({ ...filters, minConnections: parseInt(e.target.value) || 0 })}
                className="w-full px-2 py-1.5 border rounded text-sm"
                min="0"
              />
            </div>
            
            {/* Date Range */}
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Updated</label>
              <select
                value={filters.dateRange}
                onChange={(e) => setFilters({ ...filters, dateRange: e.target.value })}
                className="w-full px-2 py-1.5 border rounded text-sm"
              >
                <option value="all">All Time</option>
                <option value="week">Last Week</option>
                <option value="month">Last Month</option>
                <option value="year">Last Year</option>
              </select>
            </div>
            
            {/* Options */}
            <div className="flex items-center space-x-3 md:col-span-2 lg:col-span-1">
              <label className="flex items-center space-x-1 cursor-pointer">
                <input
                  type="checkbox"
                  checked={filters.showIsolated}
                  onChange={(e) => setFilters({ ...filters, showIsolated: e.target.checked })}
                  className="h-3 w-3 text-blue-600 rounded"
                />
                <span className="text-xs text-gray-700">Show Isolated</span>
              </label>
              
              <button
                onClick={resetFilters}
                className="px-2 py-1 text-xs text-blue-600 hover:text-blue-700"
              >
                Reset
              </button>
            </div>
          </div>
          
          {/* Active filters display */}
          {activeFilterCount > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {filters.searchTerm && (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-blue-100 text-blue-800">
                  Search: {filters.searchTerm}
                  <button
                    onClick={() => setFilters({ ...filters, searchTerm: '' })}
                    className="ml-1 text-blue-600 hover:text-blue-800"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              )}
              
              {filters.selectedCases.map(caseName => (
                <span key={caseName} className="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-purple-100 text-purple-800">
                  <Briefcase className="w-3 h-3 mr-1" />
                  {caseName}
                  <button
                    onClick={() => setFilters({ 
                      ...filters, 
                      selectedCases: filters.selectedCases.filter(c => c !== caseName) 
                    })}
                    className="ml-1 text-purple-600 hover:text-purple-800"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
              
              {filters.selectedCategories.map(category => (
                <span key={category} className="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-green-100 text-green-800">
                  <Tag className="w-3 h-3 mr-1" />
                  {category}
                  <button
                    onClick={() => setFilters({ 
                      ...filters, 
                      selectedCategories: filters.selectedCategories.filter(c => c !== category) 
                    })}
                    className="ml-1 text-green-600 hover:text-green-800"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
              
              {filters.dateRange !== 'all' && (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-orange-100 text-orange-800">
                  Updated: Last {filters.dateRange}
                  <button
                    onClick={() => setFilters({ ...filters, dateRange: 'all' })}
                    className="ml-1 text-orange-600 hover:text-orange-800"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              )}
            </div>
          )}
        </div>
      )}
      
      {/* Debug Info */}
      {debugMode && (
        <div className="bg-yellow-50 border-b border-yellow-200 px-4 py-2 text-sm">
          <details>
            <summary className="cursor-pointer font-medium">Debug Information</summary>
            <div className="mt-2 space-y-1">
              <div>Total People: {people.length}</div>
              <div>Filtered People: {filteredPeople.length}</div>
              <div>
                People with connections: {people.filter(p => p.connections && p.connections.length > 0).length}
              </div>
              <div>
                Total connections: {people.reduce((sum, p) => sum + (p.connections?.length || 0), 0)}
              </div>
              <div>Active Filters: {activeFilterCount}</div>
            </div>
          </details>
        </div>
      )}
      
      {/* Diagram Container */}
      <div className="flex-1 overflow-hidden">
        <RelationshipDiagram
          people={filteredPeople}
          selectedPersonId={personId}
          onUpdateConnection={updateConnection}
          onDeleteConnection={deleteConnection}
          showOsintData={showOsintData}
          layoutType={layoutType}
        />
      </div>
    </div>
  );
}; 

export default RelationshipManager; 