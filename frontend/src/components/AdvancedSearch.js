// File: frontend/src/components/AdvancedSearch.js
import React, { useState, useEffect } from 'react';
import { 
  Search, Filter, X, ChevronDown, ChevronUp, Calendar, MapPin, 
  Users, Tag, Briefcase, Clock, FileText, Download, RefreshCw,
  AlertCircle, CheckCircle, Network, Database, Phone, Mail,
  Globe, Hash, SortAsc, SortDesc
} from 'lucide-react';
import { peopleAPI, casesAPI, modelOptionsAPI, customFieldsAPI } from '../utils/api';
import { PERSON_CATEGORIES, PERSON_STATUSES, OSINT_DATA_TYPES } from '../utils/constants';
import ReportGenerator from './ReportGenerator';

const AdvancedSearch = ({ onSelectPerson, onClose }) => {
  const [searchParams, setSearchParams] = useState({
    // Basic search
    searchText: '',
    searchIn: ['name', 'aliases', 'notes'], // Where to search
    
    // Filters
    categories: [],
    statuses: [],
    crmStatuses: [],
    cases: [],
    
    // Date filters
    dateFilter: 'all', // all, created, updated
    dateFrom: '',
    dateTo: '',
    
    // Location filters
    locationSearch: '',
    locationRadius: '10', // miles
    locationType: '',
    
    // Connection filters
    connectedTo: '',
    connectionType: '',
    minConnections: '',
    maxConnections: '',
    
    // OSINT filters
    osintTypes: [],
    osintValue: '',
    
    // Custom fields
    customFieldFilters: {},
    
    // Sorting
    sortBy: 'updated_at',
    sortOrder: 'desc'
  });

  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [totalResults, setTotalResults] = useState(0);
  const [cases, setCases] = useState([]);
  const [people, setPeople] = useState([]);
  const [customFields, setCustomFields] = useState([]);
  const [modelOptions, setModelOptions] = useState([]);
  const [expandedSections, setExpandedSections] = useState({
    basic: true,
    categories: false,
    dates: false,
    locations: false,
    connections: false,
    osint: false,
    custom: false
  });
  const [showReportGenerator, setShowReportGenerator] = useState(false);
  const [selectedResultIds, setSelectedResultIds] = useState([]);

  useEffect(() => {
    loadInitialData();
  }, []);

  const loadInitialData = async () => {
    try {
      const [casesData, peopleData, customFieldsData, modelOptionsData] = await Promise.all([
        casesAPI.getAll(),
        peopleAPI.getAll(),
        customFieldsAPI.getAll(),
        modelOptionsAPI.getAll()
      ]);
      
      setCases(casesData);
      setPeople(peopleData);
      setCustomFields(customFieldsData.filter(f => f.is_active));
      setModelOptions(modelOptionsData);
    } catch (error) {
      console.error('Error loading data:', error);
    }
  };

  const performSearch = async () => {
    setLoading(true);
    try {
      // In a real implementation, this would call a backend endpoint
      // For now, we'll filter the data client-side
      let filtered = [...people];
      
      // Text search
      if (searchParams.searchText) {
        const searchLower = searchParams.searchText.toLowerCase();
        filtered = filtered.filter(person => {
          if (searchParams.searchIn.includes('name')) {
            const fullName = `${person.first_name || ''} ${person.last_name || ''}`.toLowerCase();
            if (fullName.includes(searchLower)) return true;
          }
          
          if (searchParams.searchIn.includes('aliases') && person.aliases) {
            if (person.aliases.some(alias => alias.toLowerCase().includes(searchLower))) return true;
          }
          
          if (searchParams.searchIn.includes('notes') && person.notes) {
            if (person.notes.toLowerCase().includes(searchLower)) return true;
          }
          
          if (searchParams.searchIn.includes('osint') && person.osint_data) {
            if (person.osint_data.some(osint => 
              osint.value.toLowerCase().includes(searchLower) ||
              (osint.notes && osint.notes.toLowerCase().includes(searchLower))
            )) return true;
          }
          
          return false;
        });
      }
      
      // Category filter
      if (searchParams.categories.length > 0) {
        filtered = filtered.filter(person => 
          searchParams.categories.includes(person.category)
        );
      }
      
      // Status filter
      if (searchParams.statuses.length > 0) {
        filtered = filtered.filter(person => 
          searchParams.statuses.includes(person.status)
        );
      }
      
      // CRM Status filter
      if (searchParams.crmStatuses.length > 0) {
        filtered = filtered.filter(person => 
          searchParams.crmStatuses.includes(person.crm_status)
        );
      }
      
      // Case filter
      if (searchParams.cases.length > 0) {
        filtered = filtered.filter(person => 
          searchParams.cases.includes(person.case_name)
        );
      }
      
      // Date filters
      if (searchParams.dateFrom || searchParams.dateTo) {
        filtered = filtered.filter(person => {
          let dateToCheck;
          if (searchParams.dateFilter === 'created') {
            dateToCheck = new Date(person.created_at);
          } else if (searchParams.dateFilter === 'updated') {
            dateToCheck = new Date(person.updated_at || person.created_at);
          } else {
            return true; // 'all' - no date filter
          }
          
          if (searchParams.dateFrom && dateToCheck < new Date(searchParams.dateFrom)) {
            return false;
          }
          if (searchParams.dateTo && dateToCheck > new Date(searchParams.dateTo)) {
            return false;
          }
          return true;
        });
      }
      
      // Location filter
      if (searchParams.locationSearch) {
        filtered = filtered.filter(person => {
          if (!person.locations || person.locations.length === 0) return false;
          
          const searchLower = searchParams.locationSearch.toLowerCase();
          return person.locations.some(loc => {
            const locationString = `${loc.address} ${loc.city} ${loc.state} ${loc.country}`.toLowerCase();
            return locationString.includes(searchLower) &&
              (!searchParams.locationType || loc.type === searchParams.locationType);
          });
        });
      }
      
      // Connection filters
      if (searchParams.connectedTo) {
        const searchLower = searchParams.connectedTo.toLowerCase();
        filtered = filtered.filter(person => {
          if (!person.connections || person.connections.length === 0) return false;
          
          return person.connections.some(conn => {
            const connectedPerson = people.find(p => p.id === conn.person_id);
            if (!connectedPerson) return false;
            
            const fullName = `${connectedPerson.first_name || ''} ${connectedPerson.last_name || ''}`.toLowerCase();
            return fullName.includes(searchLower) &&
              (!searchParams.connectionType || conn.type === searchParams.connectionType);
          });
        });
      }
      
      // Connection count filter
      if (searchParams.minConnections || searchParams.maxConnections) {
        filtered = filtered.filter(person => {
          const connectionCount = person.connections?.length || 0;
          
          if (searchParams.minConnections && connectionCount < parseInt(searchParams.minConnections)) {
            return false;
          }
          if (searchParams.maxConnections && connectionCount > parseInt(searchParams.maxConnections)) {
            return false;
          }
          return true;
        });
      }
      
      // OSINT filters
      if (searchParams.osintTypes.length > 0 || searchParams.osintValue) {
        filtered = filtered.filter(person => {
          if (!person.osint_data || person.osint_data.length === 0) return false;
          
          return person.osint_data.some(osint => {
            if (searchParams.osintTypes.length > 0 && !searchParams.osintTypes.includes(osint.type)) {
              return false;
            }
            if (searchParams.osintValue) {
              const searchLower = searchParams.osintValue.toLowerCase();
              return osint.value.toLowerCase().includes(searchLower) ||
                (osint.notes && osint.notes.toLowerCase().includes(searchLower));
            }
            return true;
          });
        });
      }
      
      // Custom field filters
      const activeCustomFilters = Object.entries(searchParams.customFieldFilters)
        .filter(([_, value]) => value && value.trim() !== '');
      
      if (activeCustomFilters.length > 0) {
        filtered = filtered.filter(person => {
          return activeCustomFilters.every(([fieldName, filterValue]) => {
            const personValue = person.custom_fields?.[fieldName];
            if (!personValue) return false;
            return personValue.toLowerCase().includes(filterValue.toLowerCase());
          });
        });
      }
      
      // Sorting
      filtered.sort((a, b) => {
        let aValue, bValue;
        
        switch (searchParams.sortBy) {
          case 'name':
            aValue = `${a.first_name || ''} ${a.last_name || ''}`.toLowerCase();
            bValue = `${b.first_name || ''} ${b.last_name || ''}`.toLowerCase();
            break;
          case 'created_at':
            aValue = new Date(a.created_at);
            bValue = new Date(b.created_at);
            break;
          case 'updated_at':
            aValue = new Date(a.updated_at || a.created_at);
            bValue = new Date(b.updated_at || b.created_at);
            break;
          case 'connections':
            aValue = a.connections?.length || 0;
            bValue = b.connections?.length || 0;
            break;
          default:
            aValue = a[searchParams.sortBy];
            bValue = b[searchParams.sortBy];
        }
        
        if (searchParams.sortOrder === 'asc') {
          return aValue > bValue ? 1 : -1;
        } else {
          return aValue < bValue ? 1 : -1;
        }
      });
      
      setResults(filtered);
      setTotalResults(filtered.length);
    } catch (error) {
      console.error('Error performing search:', error);
      alert('Search failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const toggleSection = (section) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  const resetFilters = () => {
    setSearchParams({
      searchText: '',
      searchIn: ['name', 'aliases', 'notes'],
      categories: [],
      statuses: [],
      crmStatuses: [],
      cases: [],
      dateFilter: 'all',
      dateFrom: '',
      dateTo: '',
      locationSearch: '',
      locationRadius: '10',
      locationType: '',
      connectedTo: '',
      connectionType: '',
      minConnections: '',
      maxConnections: '',
      osintTypes: [],
      osintValue: '',
      customFieldFilters: {},
      sortBy: 'updated_at',
      sortOrder: 'desc'
    });
    setResults([]);
    setTotalResults(0);
    setSelectedResultIds([]);
  };

  const exportResults = () => {
    const exportData = results.map(person => ({
      id: person.id,
      first_name: person.first_name,
      last_name: person.last_name,
      aliases: person.aliases?.join(', ') || '',
      date_of_birth: person.date_of_birth || '',
      category: person.category || '',
      status: person.status || '',
      crm_status: person.crm_status || '',
      case_name: person.case_name || '',
      connections_count: person.connections?.length || 0,
      osint_data_count: person.osint_data?.length || 0,
      locations_count: person.locations?.length || 0,
      notes: person.notes || '',
      created_at: person.created_at,
      updated_at: person.updated_at
    }));
    
    const csv = [
      Object.keys(exportData[0]).join(','),
      ...exportData.map(row => 
        Object.values(row).map(value => 
          typeof value === 'string' && value.includes(',') 
            ? `"${value.replace(/"/g, '""')}"` 
            : value
        ).join(',')
      )
    ].join('\n');
    
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `search-results-${new Date().getTime()}.csv`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  };

  const getFullName = (person) => {
    return `${person.first_name || ''} ${person.last_name || ''}`.trim() || 'Unknown';
  };

  const getCrmStatuses = () => {
    return modelOptions
      .filter(opt => opt.model_type === 'crm_status' && opt.is_active)
      .sort((a, b) => a.display_order - b.display_order);
  };

  const getConnectionTypes = () => {
    return modelOptions
      .filter(opt => opt.model_type === 'connection_type' && opt.is_active)
      .sort((a, b) => a.display_order - b.display_order);
  };

  const getLocationTypes = () => {
    return modelOptions
      .filter(opt => opt.model_type === 'location_type' && opt.is_active)
      .sort((a, b) => a.display_order - b.display_order);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-7xl max-h-[95vh] overflow-hidden flex">
        {/* Left Panel - Search Filters */}
        <div className="w-96 border-r bg-gray-50 overflow-y-auto">
          <div className="p-6 border-b bg-white">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-900 flex items-center">
                <Search className="w-5 h-5 mr-2" />
                Advanced Search
              </h2>
              <button onClick={onClose} className="text-gray-600 dark:text-gray-300 hover:text-gray-700 dark:hover:text-gray-100">
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>
          
          <div className="p-6 space-y-4">
            {/* Basic Search */}
            <div className="bg-white rounded-lg shadow-sm border">
              <button
                onClick={() => toggleSection('basic')}
                className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50"
              >
                <span className="font-medium flex items-center">
                  <Search className="w-4 h-4 mr-2" />
                  Basic Search
                </span>
                {expandedSections.basic ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>
              
              {expandedSections.basic && (
                <div className="px-4 pb-4 space-y-3">
                  <input
                    type="text"
                    placeholder="Search text..."
                    value={searchParams.searchText}
                    onChange={(e) => setSearchParams({ ...searchParams, searchText: e.target.value })}
                    className="w-full px-3 py-2 border rounded-md"
                  />
                  
                  <div>
                    <label className="text-sm font-medium text-gray-700 mb-1 block">Search in:</label>
                    <div className="space-y-2">
                      {[
                        { value: 'name', label: 'Names' },
                        { value: 'aliases', label: 'Aliases' },
                        { value: 'notes', label: 'Notes' },
                        { value: 'osint', label: 'OSINT Data' }
                      ].map(option => (
                        <label key={option.value} className="flex items-center space-x-2">
                          <input
                            type="checkbox"
                            checked={searchParams.searchIn.includes(option.value)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSearchParams({
                                  ...searchParams,
                                  searchIn: [...searchParams.searchIn, option.value]
                                });
                              } else {
                                setSearchParams({
                                  ...searchParams,
                                  searchIn: searchParams.searchIn.filter(v => v !== option.value)
                                });
                              }
                            }}
                            className="h-4 w-4 text-blue-600 rounded"
                          />
                          <span className="text-sm">{option.label}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
            
            {/* Categories & Status */}
            <div className="bg-white rounded-lg shadow-sm border">
              <button
                onClick={() => toggleSection('categories')}
                className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50"
              >
                <span className="font-medium flex items-center">
                  <Tag className="w-4 h-4 mr-2" />
                  Categories & Status
                </span>
                {expandedSections.categories ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>
              
              {expandedSections.categories && (
                <div className="px-4 pb-4 space-y-3">
                  <div>
                    <label className="text-sm font-medium text-gray-700 mb-1 block">Categories:</label>
                    <div className="space-y-1 max-h-32 overflow-y-auto">
                      {PERSON_CATEGORIES.map(cat => (
                        <label key={cat.value} className="flex items-center space-x-2">
                          <input
                            type="checkbox"
                            checked={searchParams.categories.includes(cat.value)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSearchParams({
                                  ...searchParams,
                                  categories: [...searchParams.categories, cat.value]
                                });
                              } else {
                                setSearchParams({
                                  ...searchParams,
                                  categories: searchParams.categories.filter(v => v !== cat.value)
                                });
                              }
                            }}
                            className="h-4 w-4 text-blue-600 rounded"
                          />
                          <span className="text-sm">{cat.label}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                  
                  <div>
                    <label className="text-sm font-medium text-gray-700 mb-1 block">Status:</label>
                    <div className="space-y-1">
                      {PERSON_STATUSES.map(status => (
                        <label key={status.value} className="flex items-center space-x-2">
                          <input
                            type="checkbox"
                            checked={searchParams.statuses.includes(status.value)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSearchParams({
                                  ...searchParams,
                                  statuses: [...searchParams.statuses, status.value]
                                });
                              } else {
                                setSearchParams({
                                  ...searchParams,
                                  statuses: searchParams.statuses.filter(v => v !== status.value)
                                });
                              }
                            }}
                            className="h-4 w-4 text-blue-600 rounded"
                          />
                          <span className="text-sm">{status.label}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                  
                  <div>
                    <label className="text-sm font-medium text-gray-700 mb-1 block">CRM Status:</label>
                    <div className="space-y-1 max-h-32 overflow-y-auto">
                      {getCrmStatuses().map(status => (
                        <label key={status.id} className="flex items-center space-x-2">
                          <input
                            type="checkbox"
                            checked={searchParams.crmStatuses.includes(status.option_value)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSearchParams({
                                  ...searchParams,
                                  crmStatuses: [...searchParams.crmStatuses, status.option_value]
                                });
                              } else {
                                setSearchParams({
                                  ...searchParams,
                                  crmStatuses: searchParams.crmStatuses.filter(v => v !== status.option_value)
                                });
                              }
                            }}
                            className="h-4 w-4 text-blue-600 rounded"
                          />
                          <span className="text-sm">{status.option_label}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                  
                  <div>
                    <label className="text-sm font-medium text-gray-700 mb-1 block">Cases:</label>
                    <div className="space-y-1 max-h-32 overflow-y-auto">
                      {cases.map(caseItem => (
                        <label key={caseItem.id} className="flex items-center space-x-2">
                          <input
                            type="checkbox"
                            checked={searchParams.cases.includes(caseItem.case_name)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSearchParams({
                                  ...searchParams,
                                  cases: [...searchParams.cases, caseItem.case_name]
                                });
                              } else {
                                setSearchParams({
                                  ...searchParams,
                                  cases: searchParams.cases.filter(v => v !== caseItem.case_name)
                                });
                              }
                            }}
                            className="h-4 w-4 text-blue-600 rounded"
                          />
                          <span className="text-sm">{caseItem.case_name}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
            
            {/* Date Filters */}
            <div className="bg-white rounded-lg shadow-sm border">
              <button
                onClick={() => toggleSection('dates')}
                className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50"
              >
                <span className="font-medium flex items-center">
                  <Calendar className="w-4 h-4 mr-2" />
                  Date Filters
                </span>
                {expandedSections.dates ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>
              
              {expandedSections.dates && (
                <div className="px-4 pb-4 space-y-3">
                  <div>
                    <label className="text-sm font-medium text-gray-700 mb-1 block">Filter by:</label>
                    <select
                      value={searchParams.dateFilter}
                      onChange={(e) => setSearchParams({ ...searchParams, dateFilter: e.target.value })}
                      className="w-full px-3 py-2 border rounded-md text-sm"
                    >
                      <option value="all">All Dates</option>
                      <option value="created">Created Date</option>
                      <option value="updated">Updated Date</option>
                    </select>
                  </div>
                  
                  {searchParams.dateFilter !== 'all' && (
                    <>
                      <div>
                        <label className="text-sm font-medium text-gray-700 mb-1 block">From:</label>
                        <input
                          type="date"
                          value={searchParams.dateFrom}
                          onChange={(e) => setSearchParams({ ...searchParams, dateFrom: e.target.value })}
                          className="w-full px-3 py-2 border rounded-md text-sm"
                        />
                      </div>
                      
                      <div>
                        <label className="text-sm font-medium text-gray-700 mb-1 block">To:</label>
                        <input
                          type="date"
                          value={searchParams.dateTo}
                          onChange={(e) => setSearchParams({ ...searchParams, dateTo: e.target.value })}
                          className="w-full px-3 py-2 border rounded-md text-sm"
                        />
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
            
            {/* Location Filters */}
            <div className="bg-white rounded-lg shadow-sm border">
              <button
                onClick={() => toggleSection('locations')}
                className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50"
              >
                <span className="font-medium flex items-center">
                  <MapPin className="w-4 h-4 mr-2" />
                  Location Filters
                </span>
                {expandedSections.locations ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>
              
              {expandedSections.locations && (
                <div className="px-4 pb-4 space-y-3">
                  <div>
                    <label className="text-sm font-medium text-gray-700 mb-1 block">Location contains:</label>
                    <input
                      type="text"
                      placeholder="City, state, address..."
                      value={searchParams.locationSearch}
                      onChange={(e) => setSearchParams({ ...searchParams, locationSearch: e.target.value })}
                      className="w-full px-3 py-2 border rounded-md text-sm"
                    />
                  </div>
                  
                  <div>
                    <label className="text-sm font-medium text-gray-700 mb-1 block">Location Type:</label>
                    <select
                      value={searchParams.locationType}
                      onChange={(e) => setSearchParams({ ...searchParams, locationType: e.target.value })}
                      className="w-full px-3 py-2 border rounded-md text-sm"
                    >
                      <option value="">All Types</option>
                      {getLocationTypes().map(type => (
                        <option key={type.id} value={type.option_value}>
                          {type.option_label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              )}
            </div>
            
            {/* Connection Filters */}
            <div className="bg-white rounded-lg shadow-sm border">
              <button
                onClick={() => toggleSection('connections')}
                className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50"
              >
                <span className="font-medium flex items-center">
                  <Network className="w-4 h-4 mr-2" />
                  Connection Filters
                </span>
                {expandedSections.connections ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>
              
              {expandedSections.connections && (
                <div className="px-4 pb-4 space-y-3">
                  <div>
                    <label className="text-sm font-medium text-gray-700 mb-1 block">Connected to:</label>
                    <input
                      type="text"
                      placeholder="Person name..."
                      value={searchParams.connectedTo}
                      onChange={(e) => setSearchParams({ ...searchParams, connectedTo: e.target.value })}
                      className="w-full px-3 py-2 border rounded-md text-sm"
                    />
                  </div>
                  
                  <div>
                    <label className="text-sm font-medium text-gray-700 mb-1 block">Connection Type:</label>
                    <select
                      value={searchParams.connectionType}
                      onChange={(e) => setSearchParams({ ...searchParams, connectionType: e.target.value })}
                      className="w-full px-3 py-2 border rounded-md text-sm"
                    >
                      <option value="">All Types</option>
                      {getConnectionTypes().map(type => (
                        <option key={type.id} value={type.option_value}>
                          {type.option_label}
                        </option>
                      ))}
                    </select>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-sm font-medium text-gray-700 mb-1 block">Min connections:</label>
                      <input
                        type="number"
                        value={searchParams.minConnections}
                        onChange={(e) => setSearchParams({ ...searchParams, minConnections: e.target.value })}
                        className="w-full px-3 py-2 border rounded-md text-sm"
                        min="0"
                      />
                    </div>
                    
                    <div>
                      <label className="text-sm font-medium text-gray-700 mb-1 block">Max connections:</label>
                      <input
                        type="number"
                        value={searchParams.maxConnections}
                        onChange={(e) => setSearchParams({ ...searchParams, maxConnections: e.target.value })}
                        className="w-full px-3 py-2 border rounded-md text-sm"
                        min="0"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
            
            {/* OSINT Filters */}
            <div className="bg-white rounded-lg shadow-sm border">
              <button
                onClick={() => toggleSection('osint')}
                className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50"
              >
                <span className="font-medium flex items-center">
                  <Database className="w-4 h-4 mr-2" />
                  OSINT Data
                </span>
                {expandedSections.osint ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>
              
              {expandedSections.osint && (
                <div className="px-4 pb-4 space-y-3">
                  <div>
                    <label className="text-sm font-medium text-gray-700 mb-1 block">OSINT Types:</label>
                    <div className="space-y-1">
                      {OSINT_DATA_TYPES.map(type => (
                        <label key={type.value} className="flex items-center space-x-2">
                          <input
                            type="checkbox"
                            checked={searchParams.osintTypes.includes(type.value)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSearchParams({
                                  ...searchParams,
                                  osintTypes: [...searchParams.osintTypes, type.value]
                                });
                              } else {
                                setSearchParams({
                                  ...searchParams,
                                  osintTypes: searchParams.osintTypes.filter(v => v !== type.value)
                                });
                              }
                            }}
                            className="h-4 w-4 text-blue-600 rounded"
                          />
                          <span className="text-sm">{type.label}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                  
                  <div>
                    <label className="text-sm font-medium text-gray-700 mb-1 block">OSINT Value contains:</label>
                    <input
                      type="text"
                      placeholder="Email, phone, username..."
                      value={searchParams.osintValue}
                      onChange={(e) => setSearchParams({ ...searchParams, osintValue: e.target.value })}
                      className="w-full px-3 py-2 border rounded-md text-sm"
                    />
                  </div>
                </div>
              )}
            </div>
            
            {/* Custom Fields */}
            {customFields.length > 0 && (
              <div className="bg-white rounded-lg shadow-sm border">
                <button
                  onClick={() => toggleSection('custom')}
                  className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50"
                >
                  <span className="font-medium flex items-center">
                    <Tag className="w-4 h-4 mr-2" />
                    Custom Fields
                  </span>
                  {expandedSections.custom ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </button>
                
                {expandedSections.custom && (
                  <div className="px-4 pb-4 space-y-3">
                    {customFields.map(field => (
                      <div key={field.id}>
                        <label className="text-sm font-medium text-gray-700 mb-1 block">
                          {field.field_label}:
                        </label>
                        {field.field_type === 'select' ? (
                          <select
                            value={searchParams.customFieldFilters[field.field_name] || ''}
                            onChange={(e) => setSearchParams({
                              ...searchParams,
                              customFieldFilters: {
                                ...searchParams.customFieldFilters,
                                [field.field_name]: e.target.value
                              }
                            })}
                            className="w-full px-3 py-2 border rounded-md text-sm"
                          >
                            <option value="">All</option>
                            {field.options?.map(option => (
                              <option key={option} value={option}>{option}</option>
                            ))}
                          </select>
                        ) : (
                          <input
                            type={field.field_type === 'date' ? 'date' : 'text'}
                            value={searchParams.customFieldFilters[field.field_name] || ''}
                            onChange={(e) => setSearchParams({
                              ...searchParams,
                              customFieldFilters: {
                                ...searchParams.customFieldFilters,
                                [field.field_name]: e.target.value
                              }
                            })}
                            className="w-full px-3 py-2 border rounded-md text-sm"
                          />
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
            
            {/* Action Buttons */}
            <div className="space-y-2">
              <button
                onClick={performSearch}
                disabled={loading}
                className="w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 flex items-center justify-center disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                    Searching...
                  </>
                ) : (
                  <>
                    <Search className="w-4 h-4 mr-2" />
                    Search
                  </>
                )}
              </button>
              
              <button
                onClick={resetFilters}
                className="w-full px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200"
              >
                Reset Filters
              </button>
            </div>
          </div>
        </div>
        
        {/* Right Panel - Results */}
        <div className="flex-1 flex flex-col">
          <div className="p-6 border-b bg-white">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold">Search Results</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {totalResults > 0 ? `Found ${totalResults} results` : 'No search performed yet'}
                </p>
              </div>
              
              <div className="flex items-center space-x-2">
                {/* Sorting */}
                <div className="flex items-center space-x-2">
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Sort by:</label>
                  <select
                    value={searchParams.sortBy}
                    onChange={(e) => setSearchParams({ ...searchParams, sortBy: e.target.value })}
                    className="px-3 py-1 border rounded-md text-sm"
                  >
                    <option value="name">Name</option>
                    <option value="created_at">Created Date</option>
                    <option value="updated_at">Updated Date</option>
                    <option value="connections">Connections</option>
                  </select>
                  
                  <button
                    onClick={() => setSearchParams({
                      ...searchParams,
                      sortOrder: searchParams.sortOrder === 'asc' ? 'desc' : 'asc'
                    })}
                    className="p-1 hover:bg-gray-100 rounded"
                  >
                    {searchParams.sortOrder === 'asc' ? (
                      <SortAsc className="w-4 h-4" />
                    ) : (
                      <SortDesc className="w-4 h-4" />
                    )}
                  </button>
                </div>
                
                {results.length > 0 && (
                  <>
                    <button
                      onClick={exportResults}
                      className="px-3 py-1 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 flex items-center text-sm"
                    >
                      <Download className="w-4 h-4 mr-1" />
                      Export CSV
                    </button>
                    
                    <button
                      onClick={() => setShowReportGenerator(true)}
                      disabled={selectedResultIds.length === 0}
                      className="px-3 py-1 bg-blue-600 text-white rounded-md hover:bg-blue-700 flex items-center text-sm disabled:opacity-50"
                    >
                      <FileText className="w-4 h-4 mr-1" />
                      Generate Report ({selectedResultIds.length})
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
          
          {/* Results List */}
          <div className="flex-1 overflow-y-auto p-6">
            {results.length > 0 ? (
              <div className="space-y-4">
                <div className="flex items-center space-x-2 text-sm text-gray-600 dark:text-gray-400">
                  <input
                    type="checkbox"
                    checked={selectedResultIds.length === results.length}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedResultIds(results.map(r => r.id));
                      } else {
                        setSelectedResultIds([]);
                      }
                    }}
                    className="h-4 w-4 text-blue-600 rounded"
                  />
                  <span>Select all</span>
                </div>
                
                {results.map(person => (
                  <div key={person.id} className="bg-white rounded-lg shadow-sm border p-4 hover:shadow-md transition-shadow">
                    <div className="flex items-start justify-between">
                      <div className="flex items-start space-x-3">
                        <input
                          type="checkbox"
                          checked={selectedResultIds.includes(person.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedResultIds([...selectedResultIds, person.id]);
                            } else {
                              setSelectedResultIds(selectedResultIds.filter(id => id !== person.id));
                            }
                          }}
                          className="h-4 w-4 text-blue-600 rounded mt-1"
                        />
                        
                        <div>
                          <h4 className="font-semibold text-gray-900 dark:text-gray-100">
                            {getFullName(person)}
                            {person.date_of_birth && (
                              <span className="text-gray-500 font-normal text-sm ml-2">
                                ({new Date().getFullYear() - new Date(person.date_of_birth).getFullYear()} years old)
                              </span>
                            )}
                          </h4>
                          
                          {person.aliases && person.aliases.length > 0 && (
                            <p className="text-sm text-gray-600 dark:text-gray-400">AKA: {person.aliases.join(', ')}</p>
                          )}
                          
                          <div className="mt-2 flex flex-wrap gap-2">
                            {person.category && (
                              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300">
                                <Tag className="w-3 h-3 mr-1" />
                                {person.category}
                              </span>
                            )}
                            
                            {person.status && (
                              <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs ${
                                person.status === 'Open' ? 'bg-green-100 text-green-800' :
                                person.status === 'Being Investigated' ? 'bg-yellow-100 text-yellow-800' :
                                'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
                              }`}>
                                {person.status}
                              </span>
                            )}
                            
                            {person.case_name && (
                              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-purple-100 text-purple-800">
                                <Briefcase className="w-3 h-3 mr-1" />
                                {person.case_name}
                              </span>
                            )}
                            
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300">
                              <Network className="w-3 h-3 mr-1" />
                              {person.connections?.length || 0} connections
                            </span>
                            
                            {person.locations && person.locations.length > 0 && (
                              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300">
                                <MapPin className="w-3 h-3 mr-1" />
                                {person.locations.length} locations
                              </span>
                            )}
                            
                            {person.osint_data && person.osint_data.length > 0 && (
                              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300">
                                <Database className="w-3 h-3 mr-1" />
                                {person.osint_data.length} OSINT
                              </span>
                            )}
                          </div>
                          
                          <p className="text-xs text-gray-500 mt-2">
                            Updated {new Date(person.updated_at || person.created_at).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                      
                      <button
                        onClick={() => onSelectPerson(person)}
                        className="px-3 py-1 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm"
                      >
                        View Details
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <Search className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-500 dark:text-gray-500">
                  {totalResults === 0 && searchParams.searchText ? 
                    'No results found. Try adjusting your search criteria.' : 
                    'Use the filters on the left to search for people.'}
                </p>
              </div>
            )}
          </div>
        </div>
        
        {/* Report Generator Modal */}
        {showReportGenerator && (
          <ReportGenerator 
            customPeopleIds={selectedResultIds}
            onClose={() => setShowReportGenerator(false)}
          />
        )}
      </div>
    </div>
  );
};

export default AdvancedSearch;