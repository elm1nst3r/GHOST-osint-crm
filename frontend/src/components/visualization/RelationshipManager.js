// File: frontend/src/components/visualization/RelationshipManager.js
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import RelationshipDiagram from '../RelationshipDiagram';
import ObsidianGraph from './ObsidianGraph';
import {
  AlertCircle, Loader2, Network,
  Maximize2, RefreshCw, Bug, Filter, X, Search,
  Briefcase, Tag, GitBranch, Sparkles
} from 'lucide-react';
import { casesAPI, businessesAPI, transactionsAPI } from '../../utils/api';

const API_BASE_URL = process.env.REACT_APP_API_URL || '/api';

const RelationshipManager = ({ 
  personId = null,
  showInModal = false,
  onClose = null
}) => {
  const { t } = useTranslation();
  const [people, setPeople] = useState([]);
  const [businesses, setBusinesses] = useState([]);
  const [cases, setCases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showOsintData] = useState(false);
  const [layoutType, setLayoutType] = useState('hierarchical');
  const [fullScreen, setFullScreen] = useState(false);
  const [debugMode, setDebugMode] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [viewMode, setViewMode] = useState('obsidian'); // 'reactflow' or 'obsidian'
  // Edge classes shown in the Obsidian view (issue #50)
  const [edgeClasses, setEdgeClasses] = useState({ connections: true, ownership: true, transactions: false });
  const [txEdges, setTxEdges] = useState([]);
  
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
      const response = await fetch(`${API_BASE_URL}/people`, {
        credentials: 'include'
      });

      if (!response.ok) {
        throw new Error(t('relationshipManager.errorFetchPeoplePrefix', { status: response.status, statusText: response.statusText }));
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
        
        // Validate each connection — person_id: null (legacy bad writes)
        // must be dropped too, or the graph crashes rendering it (issue #56)
        connections = connections.filter(conn => {
          if (!conn || conn.person_id == null) {
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
  }, [t]);

  // Fetch businesses
  const fetchBusinesses = useCallback(async () => {
    try {
      console.log('=== RelationshipManager: Fetching businesses ===');
      const data = await businessesAPI.getAll();
      console.log('Fetched businesses count:', data.length);
      
      // Transform businesses to have a similar structure to people for the diagram
      const transformedBusinesses = data.map(business => ({
        id: `business-${business.id}`, // Prefix to avoid ID conflicts
        first_name: business.name,
        last_name: '',
        category: 'Business',
        type: 'business',
        businessData: business, // Keep original business data
        // Ownership is the one person link the schema has today — draw it
        // so businesses aren't isolated islands in the graph (issue #50)
        connections: business.owner_person_id != null
          ? [{ person_id: business.owner_person_id, type: 'owner', note: 'Owner' }]
          : [],
        status: business.status || 'Active',
        case_name: business.case_name
      }));
      
      setBusinesses(transformedBusinesses);
    } catch (err) {
      console.error('Error fetching businesses:', err);
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

  // Derive graph edges from the transaction log (issue #50): one aggregated
  // edge per giver→receiver pair. External (free-text) parties have no node,
  // so only person/business references become edges.
  const fetchTransactionEdges = useCallback(async () => {
    try {
      const res = await transactionsAPI.getAll({ limit: 1000 });
      const list = res.data || [];
      const agg = new Map();
      list.forEach(t => {
        const src = t.from_person_id != null ? String(t.from_person_id)
          : t.from_business_id != null ? `business-${t.from_business_id}` : null;
        const dst = t.to_person_id != null ? String(t.to_person_id)
          : t.to_business_id != null ? `business-${t.to_business_id}` : null;
        if (!src || !dst || src === dst) return;
        const key = `${src}|${dst}`;
        const e = agg.get(key) || { source: src, target: dst, count: 0, types: new Set() };
        e.count += 1;
        e.types.add(t.transaction_type);
        agg.set(key, e);
      });
      setTxEdges([...agg.values()].map(e => ({
        source: e.source,
        target: e.target,
        type: 'transaction',
        note: `${[...e.types].join(', ')}${e.count > 1 ? ` ×${e.count}` : ''}`,
        count: e.count,
      })));
    } catch (err) {
      console.error('Error fetching transaction edges:', err);
    }
  }, []);

  useEffect(() => {
    fetchPeople();
    fetchBusinesses();
    fetchCases();
    fetchTransactionEdges();
  }, [fetchPeople, fetchBusinesses, fetchCases, fetchTransactionEdges]);

  // Update connection between two people
  const updateConnection = useCallback(async (sourceId, targetId, type, note) => {
    try {
      console.log('=== Updating connection ===');
      console.log('Source:', sourceId, 'Target:', targetId, 'Type:', type);

      // Guard against non-numeric ids (e.g. business nodes) — persisting a
      // NaN target becomes person_id: null in the DB and used to make the
      // Entity Network view permanently crash (issue #56)
      if (!Number.isInteger(sourceId) || !Number.isInteger(targetId)) {
        throw new Error(t('relationshipManager.errorConnectionsOnlyPeople'));
      }

      // Get the source person's current data
      const sourcePerson = people.find(p => p.id === sourceId);
      if (!sourcePerson) {
        throw new Error(t('relationshipManager.errorSourcePersonNotFound'));
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
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updateData)
      });

      if (!response.ok) {
        const errorData = await response.text();
        throw new Error(t('relationshipManager.errorUpdateConnectionPrefix', { status: response.status, errorData }));
      }

      // Refresh data
      await fetchPeople();

      alert(t('relationshipManager.connectionCreatedSuccess'));
    } catch (err) {
      console.error('Error updating connection:', err);
      alert(t('relationshipManager.errorCreateConnection', { message: err.message }));
    }
  }, [people, fetchPeople, t]);

  // Delete connection
  const deleteConnection = useCallback(async (sourceId, targetId) => {
    try {
      const sourcePerson = people.find(p => p.id === sourceId);
      if (!sourcePerson) {
        throw new Error(t('relationshipManager.errorSourcePersonNotFound'));
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
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updateData)
      });

      await fetchPeople();
      alert(t('relationshipManager.connectionDeletedSuccess'));
    } catch (err) {
      console.error('Error deleting connection:', err);
      alert(t('relationshipManager.errorDeleteConnection', { message: err.message }));
    }
  }, [people, fetchPeople, t]);

  // Derive employer→employee edges by name-matching business.employees against
  // people. There is no person_id on the employee schema (and no case column on
  // businesses to scope by), so an exact, case-insensitive full-name match is
  // the best link we have. Two distinct people who share a name would collide —
  // acceptable until the employee schema carries a real person_id reference.
  //
  // The edge is drawn business → person and typed 'employee' (the target IS the
  // employee), matching the 'owner' convention where the type names the target's
  // role. This keeps the employer (business) as the edge source, so the
  // hierarchical layout ranks it above its employees (employer at the top).
  const enrichedBusinesses = useMemo(() => {
    return businesses.map(business => {
      const employees = business.businessData?.employees;
      if (!Array.isArray(employees) || employees.length === 0) return business;

      const seenPersonIds = new Set((business.connections || []).map(c => c.person_id));
      const newConnections = [];

      employees.forEach(employee => {
        if (!employee.name) return;
        const search = employee.name.trim().toLowerCase();
        const match = people.find(p => {
          const fullName = `${p.first_name || ''} ${p.last_name || ''}`.trim().toLowerCase();
          return fullName === search;
        });
        if (!match || seenPersonIds.has(match.id)) return;

        seenPersonIds.add(match.id);
        newConnections.push({
          person_id: match.id,
          type: 'employee',
          note: employee.role
            ? t('obsidianGraph.employeeConnectionNote', { role: employee.role })
            : t('obsidianGraph.employeeConnectionNoteNoRole')
        });
      });

      if (newConnections.length === 0) return business;
      return {
        ...business,
        connections: [...(business.connections || []), ...newConnections]
      };
    });
  }, [businesses, people, t]);

  // Apply filters to people and businesses
  const applyFilters = useCallback(() => {
    // Combine people and businesses
    let allEntities = [...people, ...enrichedBusinesses];
    let filtered = allEntities;
    
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
        default:
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
      allEntities.forEach(entity => {
        if (entity.connections) {
          entity.connections.forEach(conn => {
            if (connectedIds.has(conn.person_id)) {
              connectedIds.add(entity.id);
            }
          });
        }
      });
      
      filtered = allEntities.filter(e => connectedIds.has(e.id));
    }
    
    return filtered;
  }, [people, enrichedBusinesses, filters]);

  // Get filtered people — memoised so ObsidianGraph only redraws when data/filters
  // actually change, not on every parent re-render (which would reset the D3
  // simulation before any ticks, making edges invisible).
  const filteredPeople = useMemo(() => {
    if (personId) {
      const mainPerson = people.find(p => p.id === personId);
      if (!mainPerson) return [];

      const connectedIds = new Set([personId]);

      if (mainPerson.connections) {
        mainPerson.connections.forEach(conn => {
          connectedIds.add(conn.person_id);
        });
      }

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
    }
    return applyFilters();
  }, [personId, people, applyFilters]);

  // Get unique values for filters
  const allEntities = [...people, ...enrichedBusinesses];
  const uniqueCategories = [...new Set(allEntities.map(e => e.category).filter(Boolean))];
  const uniqueStatuses = [...new Set(allEntities.map(e => e.status).filter(Boolean))];
  const uniqueConnectionTypes = [...new Set(
    allEntities.flatMap(e => (e.connections || []).map(c => c.type)).filter(Boolean)
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
        <span className="ml-2 text-gray-600 dark:text-gray-400">{t('relationshipManager.loadingRelationships')}</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <AlertCircle className="w-8 h-8 text-red-500" />
        <span className="ml-2 text-red-600">{t('relationshipManager.errorLabel', { message: error })}</span>
      </div>
    );
  }

  const containerClass = fullScreen
  ? "fixed inset-0 z-50 bg-white dark:bg-slate-900 flex flex-col"
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

  return (
    <div className={containerClass}>
      {/* Header */}
      <div className="bg-white dark:bg-slate-800 border-b px-4 py-3 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center space-x-3">
          <Network className="w-5 h-5 text-blue-600" />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-slate-100">
            {personId ? t('relationshipManager.personRelationships') : t('relationshipManager.globalRelationshipNetwork')}
          </h3>
          <span className="text-sm text-gray-600 dark:text-slate-400">
            {t('relationshipManager.entitiesSummary', {
              total: filteredPeople.length,
              people: filteredPeople.filter(e => !e.type || e.type !== 'business').length,
              businesses: filteredPeople.filter(e => e.type === 'business').length,
            })}
          </span>
        </div>
        
        <div className="flex items-center space-x-2">
          {/* View Mode Toggle */}
          <div className="flex items-center space-x-1 bg-gray-100 dark:bg-slate-700 rounded-md p-1">
            <button
              onClick={() => setViewMode('obsidian')}
              className={`px-2 py-1 text-xs rounded flex items-center space-x-1 transition ${
                viewMode === 'obsidian' ? 'bg-white dark:bg-slate-600 shadow-sm text-blue-600 dark:text-blue-400' : 'text-gray-700 dark:text-slate-300 hover:text-gray-900 dark:hover:text-slate-100'
              }`}
              title={t('relationshipManager.obsidianViewTitle')}
            >
              <Sparkles className="w-3 h-3" />
              <span className="hidden md:inline">{t('relationshipManager.obsidian')}</span>
            </button>
            <button
              onClick={() => setViewMode('reactflow')}
              className={`px-2 py-1 text-xs rounded flex items-center space-x-1 transition ${
                viewMode === 'reactflow' ? 'bg-white dark:bg-slate-600 shadow-sm text-blue-600 dark:text-blue-400' : 'text-gray-700 dark:text-slate-300 hover:text-gray-900 dark:hover:text-slate-100'
              }`}
              title={t('relationshipManager.classicViewTitle')}
            >
              <GitBranch className="w-3 h-3" />
              <span className="hidden md:inline">{t('relationshipManager.classic')}</span>
            </button>
          </div>

          {/* Edge class toggles (issue #50) — Obsidian view only */}
          {viewMode === 'obsidian' && (
            <div className="flex items-center space-x-3 px-2 py-1.5 bg-gray-100 dark:bg-slate-700 rounded-md text-xs">
              {[
                ['connections', t('relationshipManager.edgeClassPeople')],
                ['ownership', t('relationshipManager.edgeClassOwnership')],
                ['transactions', t('relationshipManager.edgeClassTransactions')],
              ].map(([key, label]) => (
                <label key={key} className="flex items-center space-x-1 cursor-pointer text-gray-700 dark:text-slate-300">
                  <input
                    type="checkbox"
                    checked={edgeClasses[key]}
                    onChange={(e) => setEdgeClasses({ ...edgeClasses, [key]: e.target.checked })}
                    className="h-3 w-3 text-blue-600 rounded"
                  />
                  <span>{label}</span>
                </label>
              ))}
            </div>
          )}

          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`px-3 py-1.5 text-sm rounded-md flex items-center space-x-2 ${
              showFilters ? 'bg-blue-600 text-white' : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
            }`}
            title={t('relationshipManager.toggleFilters')}
          >
            <Filter className="w-4 h-4" />
            <span className="hidden sm:inline">{t('relationshipManager.filters')}</span>
            {activeFilterCount > 0 && (
              <span className="ml-1 px-1.5 py-0.5 bg-white dark:bg-slate-800 text-blue-600 rounded-full text-xs font-medium">
                {activeFilterCount}
              </span>
            )}
          </button>

          <button
            onClick={() => setDebugMode(!debugMode)}
            className={`px-3 py-1.5 text-sm rounded-md flex items-center space-x-2 ${
              debugMode ? 'bg-orange-100 text-orange-700' : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
            }`}
            title={t('relationshipManager.toggleDebugInfo')}
          >
            <Bug className="w-4 h-4" />
            <span className="hidden sm:inline">{t('relationshipManager.debug')}</span>
          </button>

          <button
            onClick={fetchPeople}
            className="px-3 py-1.5 text-sm rounded-md flex items-center space-x-2 bg-gray-100 dark:bg-slate-700 hover:bg-gray-200 text-gray-700 dark:text-slate-300"
            title={t('relationshipManager.refreshData')}
          >
            <RefreshCw className="w-4 h-4" />
          </button>

          {viewMode === 'reactflow' && (
            <select
              value={layoutType}
              onChange={(e) => setLayoutType(e.target.value)}
              className="px-3 py-1.5 text-sm border border-gray-300 dark:border-slate-600 rounded-md text-gray-700 dark:text-slate-300"
            >
              <option value="hierarchical">{t('relationshipManager.hierarchical')}</option>
              <option value="circular">{t('relationshipManager.circular')}</option>
              <option value="grid">{t('relationshipManager.grid')}</option>
            </select>
          )}

          {!showInModal && (
            <button
              onClick={() => setFullScreen(!fullScreen)}
              className="px-3 py-1.5 text-sm rounded-md bg-gray-100 dark:bg-slate-700 hover:bg-gray-200 text-gray-700 dark:text-slate-300"
              title={fullScreen ? t('relationshipManager.exitFullscreen') : t('relationshipManager.enterFullscreen')}
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
              className="px-3 py-1.5 text-sm rounded-md bg-gray-100 dark:bg-slate-700 hover:bg-gray-200 text-gray-700 dark:text-slate-300"
            >
              {t('common.close')}
            </button>
          )}
        </div>
      </div>
      
      {/* Filters Panel */}
      {showFilters && (
        <div className="bg-gray-50 dark:bg-slate-900 border-b px-4 py-3 flex-shrink-0 max-h-[40%] overflow-y-auto">
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3">
            {/* Search */}
            <div className="md:col-span-2 lg:col-span-1">
              <label className="block text-xs font-medium text-gray-700 dark:text-slate-300 mb-1">{t('relationshipManager.searchLabel')}</label>
              <div className="relative">
                <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 text-gray-400 dark:text-slate-500 w-3 h-3" />
                <input
                  type="text"
                  value={filters.searchTerm}
                  onChange={(e) => setFilters({ ...filters, searchTerm: e.target.value })}
                  className="w-full pl-8 pr-2 py-1.5 border rounded text-sm"
                  placeholder={t('relationshipManager.searchPlaceholder')}
                />
              </div>
            </div>
            
            {/* Cases */}
            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-slate-300 mb-1">{t('relationshipManager.casesLabel')}</label>
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
              <label className="block text-xs font-medium text-gray-700 dark:text-slate-300 mb-1">{t('relationshipManager.categoriesLabel')}</label>
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
              <label className="block text-xs font-medium text-gray-700 dark:text-slate-300 mb-1">{t('relationshipManager.statusLabel')}</label>
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
              <label className="block text-xs font-medium text-gray-700 dark:text-slate-300 mb-1">{t('relationshipDiagram.connectionTypesTitle')}</label>
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
              <label className="block text-xs font-medium text-gray-700 dark:text-slate-300 mb-1">{t('relationshipManager.minConnectionsLabel')}</label>
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
              <label className="block text-xs font-medium text-gray-700 dark:text-slate-300 mb-1">{t('relationshipManager.updatedLabel')}</label>
              <select
                value={filters.dateRange}
                onChange={(e) => setFilters({ ...filters, dateRange: e.target.value })}
                className="w-full px-2 py-1.5 border rounded text-sm"
              >
                <option value="all">{t('relationshipManager.allTime')}</option>
                <option value="week">{t('relationshipManager.lastWeek')}</option>
                <option value="month">{t('relationshipManager.lastMonth')}</option>
                <option value="year">{t('relationshipManager.lastYear')}</option>
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
                <span className="text-xs text-gray-700 dark:text-gray-300">{t('relationshipManager.showIsolated')}</span>
              </label>

              <button
                onClick={resetFilters}
                className="px-2 py-1 text-xs text-blue-600 hover:text-blue-700"
              >
                {t('relationshipManager.reset')}
              </button>
            </div>
          </div>
          
          {/* Active filters display */}
          {activeFilterCount > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {filters.searchTerm && (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-blue-100 text-blue-800">
                  {t('relationshipManager.searchFilterTag', { term: filters.searchTerm })}
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
                  {t('relationshipManager.updatedFilterTag', {
                    range: {
                      week: t('relationshipManager.lastWeek'),
                      month: t('relationshipManager.lastMonth'),
                      year: t('relationshipManager.lastYear'),
                    }[filters.dateRange] || filters.dateRange,
                  })}
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
            <summary className="cursor-pointer font-medium">{t('relationshipDiagram.debugInformation')}</summary>
            <div className="mt-2 space-y-1">
              <div>{t('relationshipManager.totalPeople', { count: people.length })}</div>
              <div>{t('relationshipManager.totalBusinesses', { count: businesses.length })}</div>
              <div>{t('relationshipManager.filteredEntities', { count: filteredPeople.length })}</div>
              <div>
                {t('relationshipManager.entitiesWithConnections', { count: [...people, ...enrichedBusinesses].filter(e => e.connections && e.connections.length > 0).length })}
              </div>
              <div>
                {t('relationshipManager.totalConnectionsDebug', { count: [...people, ...enrichedBusinesses].reduce((sum, e) => sum + (e.connections?.length || 0), 0) })}
              </div>
              <div>{t('relationshipManager.activeFilters', { count: activeFilterCount })}</div>
            </div>
          </details>
        </div>
      )}
      
      {/* Diagram Container */}
      <div className="flex-1 overflow-hidden">
        {viewMode === 'obsidian' ? (
          <ObsidianGraph
            people={filteredPeople}
            selectedPersonId={personId}
            edgeClasses={edgeClasses}
            transactionEdges={txEdges}
            onUpdateConnection={updateConnection}
            onDeleteConnection={deleteConnection}
            onNodeClick={(person) => {
              // You can handle node click to show person details
              console.log('Node clicked:', person);
            }}
          />
        ) : (
          <RelationshipDiagram
            people={filteredPeople}
            selectedPersonId={personId}
            onUpdateConnection={updateConnection}
            onDeleteConnection={deleteConnection}
            showOsintData={showOsintData}
            layoutType={layoutType}
          />
        )}
      </div>
    </div>
  );
};

export default RelationshipManager;