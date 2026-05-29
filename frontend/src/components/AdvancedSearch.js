// File: frontend/src/components/AdvancedSearch.js
import React, { useState, useEffect } from 'react';
import { peopleAPI, casesAPI, modelOptionsAPI, customFieldsAPI } from '../utils/api';
import ReportGenerator from './ReportGenerator';
import SearchFilters from './search/SearchFilters';
import SearchResults from './search/SearchResults';

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
      const [casesData, { data: peopleData }, customFieldsData, modelOptionsData] = await Promise.all([
        casesAPI.getAll(),
        peopleAPI.getAll({ limit: 1000 }),
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
      <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl w-full max-w-7xl max-h-[95vh] overflow-hidden flex">
        <SearchFilters
          searchParams={searchParams}
          setSearchParams={setSearchParams}
          expandedSections={expandedSections}
          toggleSection={toggleSection}
          performSearch={performSearch}
          resetFilters={resetFilters}
          loading={loading}
          cases={cases}
          people={people}
          customFields={customFields}
          modelOptions={modelOptions}
          onClose={onClose}
        />
        <SearchResults
          results={results}
          totalResults={totalResults}
          loading={loading}
          searchParams={searchParams}
          setSearchParams={setSearchParams}
          selectedResultIds={selectedResultIds}
          setSelectedResultIds={setSelectedResultIds}
          onSelectPerson={onSelectPerson}
          exportResults={exportResults}
          showReportGenerator={showReportGenerator}
          setShowReportGenerator={setShowReportGenerator}
        />
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
