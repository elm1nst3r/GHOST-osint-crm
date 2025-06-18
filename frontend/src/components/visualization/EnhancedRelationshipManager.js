// File: frontend/src/components/visualization/EnhancedRelationshipManager.js
import React, { useState, useEffect, useCallback } from 'react';
import EnhancedRelationshipDiagram from '../EnhancedRelationshipDiagram';
import AddEditPersonForm from '../AddEditPersonForm';
import AddEditBusinessForm from '../AddEditBusinessForm';
import { 
  AlertCircle, Loader2, Network, Users, Eye, EyeOff, 
  Maximize2, RefreshCw, Bug, Filter, X, Search,
  Briefcase, Tag, CheckCircle, Building2, MapPin,
  Phone, Mail
} from 'lucide-react';
import { peopleAPI, businessAPI, entityRelationshipAPI } from '../../utils/api';

const EnhancedRelationshipManager = ({ 
  personId = null,
  businessId = null,
  showInModal = false,
  onClose = null
}) => {
  const [entityNetworkData, setEntityNetworkData] = useState({ nodes: [], edges: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [layoutType, setLayoutType] = useState('hierarchical');
  const [fullScreen, setFullScreen] = useState(false);
  const [debugMode, setDebugMode] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [showAddPersonForm, setShowAddPersonForm] = useState(false);
  const [showAddBusinessForm, setShowAddBusinessForm] = useState(false);
  
  // Filter states
  const [filters, setFilters] = useState({
    entityTypes: ['person', 'business', 'location', 'phone', 'email'],
    relationshipTypes: [],
    minConfidence: 0,
    showIsolated: true
  });

  // Fetch entity network data
  const fetchEntityNetwork = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      console.log('=== Fetching enhanced entity network ===');
      
      const params = new URLSearchParams();
      if (personId) {
        params.append('entity_type', 'person');
        params.append('entity_id', personId);
      } else if (businessId) {
        params.append('entity_type', 'business');
        params.append('entity_id', businessId);
      }
      
      console.log('Fetching from URL:', `/api/entity-network?${params}`);
      const response = await fetch(`/api/entity-network?${params}`);
      
      console.log('Response status:', response.status);
      console.log('Response headers:', response.headers);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('Response error text:', errorText);
        throw new Error(`Failed to fetch entity network: ${response.status} - ${errorText}`);
      }
      
      const data = await response.json();
      console.log('Entity network data received:', data);
      
      if (!data || (!data.nodes && !data.edges)) {
        throw new Error('Invalid data format received from API');
      }
      
      setEntityNetworkData(data);
    } catch (err) {
      console.error('Error fetching entity network:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [personId, businessId]);

  useEffect(() => {
    fetchEntityNetwork();
  }, [fetchEntityNetwork]);

  // Update entity relationship
  const updateRelationship = useCallback(async (relationshipData) => {
    try {
      console.log('Creating relationship:', relationshipData);
      
      await entityRelationshipAPI.create(relationshipData);
      
      // Refresh the network
      await fetchEntityNetwork();
      
      alert('Relationship created successfully!');
    } catch (err) {
      console.error('Error updating relationship:', err);
      alert('Failed to create relationship: ' + err.message);
    }
  }, [fetchEntityNetwork]);

  // Delete entity relationship
  const deleteRelationship = useCallback(async (relationshipData) => {
    try {
      // Find the relationship ID
      const relationships = await entityRelationshipAPI.getAll({
        source_type: relationshipData.source_type,
        source_id: relationshipData.source_id,
        target_type: relationshipData.target_type,
        target_id: relationshipData.target_id
      });
      
      const relationship = relationships.find(r => 
        r.relationship_type === relationshipData.relationship_type
      );
      
      if (relationship) {
        await entityRelationshipAPI.delete(relationship.id);
        await fetchEntityNetwork();
        alert('Relationship deleted successfully!');
      }
    } catch (err) {
      console.error('Error deleting relationship:', err);
      alert('Failed to delete relationship: ' + err.message);
    }
  }, [fetchEntityNetwork]);

  // Add new entity
  const addEntity = useCallback((entityType, position) => {
    console.log('Adding entity:', entityType, 'at position:', position);
    
    switch (entityType) {
      case 'person':
        setShowAddPersonForm(true);
        break;
      case 'business':
        setShowAddBusinessForm(true);
        break;
      default:
        alert(`Adding ${entityType} entities is not yet implemented`);
    }
  }, []);

  // Apply filters to network data
  const applyFilters = useCallback(() => {
    if (!entityNetworkData.nodes) return { nodes: [], edges: [] };
    
    let filteredNodes = [...entityNetworkData.nodes];
    let filteredEdges = [...entityNetworkData.edges];
    
    // Filter by entity type
    if (filters.entityTypes.length < 5) {
      filteredNodes = filteredNodes.filter(node => 
        filters.entityTypes.includes(node.type)
      );
      
      // Keep only edges where both nodes exist
      const nodeIds = new Set(filteredNodes.map(n => n.id));
      filteredEdges = filteredEdges.filter(edge => 
        nodeIds.has(edge.source) && nodeIds.has(edge.target)
      );
    }
    
    // Filter by confidence score
    if (filters.minConfidence > 0) {
      filteredEdges = filteredEdges.filter(edge => 
        (edge.data?.confidence_score || 50) >= filters.minConfidence
      );
    }
    
    // Filter isolated nodes
    if (!filters.showIsolated) {
      const connectedNodeIds = new Set();
      filteredEdges.forEach(edge => {
        connectedNodeIds.add(edge.source);
        connectedNodeIds.add(edge.target);
      });
      
      filteredNodes = filteredNodes.filter(node => 
        connectedNodeIds.has(node.id)
      );
    }
    
    return { nodes: filteredNodes, edges: filteredEdges };
  }, [entityNetworkData, filters]);

  // Get filtered data
  const filteredData = applyFilters();

  // Get unique relationship types
  const uniqueRelationshipTypes = [...new Set(
    entityNetworkData.edges?.map(e => e.type) || []
  )];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 glass-card backdrop-blur-xl border border-white/30 shadow-glass-lg rounded-glass-lg m-4">
        <div className="text-center p-8">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-2 text-accent-primary" />
          <span className="text-gray-700 font-medium">Loading entity network...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64 glass-card backdrop-blur-xl border border-white/30 shadow-glass-lg rounded-glass-lg m-4">
        <div className="text-center p-8 max-w-md">
          <AlertCircle className="w-8 h-8 mx-auto mb-4 text-accent-danger" />
          <h3 className="text-lg font-semibold bg-gradient-to-r from-gray-900 to-gray-600 bg-clip-text text-transparent mb-2">Load Failed</h3>
          <p className="text-red-600 font-medium mb-4">{error}</p>
          <p className="text-xs text-gray-500 mb-6">Check browser console (F12) for detailed error information</p>
          <button
            onClick={fetchEntityNetwork}
            className="px-6 py-3 bg-gradient-primary text-white rounded-glass hover:shadow-glow-md transition-all duration-300 flex items-center mx-auto group"
          >
            <RefreshCw className="w-4 h-4 mr-2 group-hover:animate-spin" />
            Retry
          </button>
        </div>
      </div>
    );
  }

  const containerClass = fullScreen 
    ? "fixed inset-0 z-50 bg-white flex flex-col" 
    : showInModal 
      ? "h-full w-full flex flex-col" 
      : "h-full flex flex-col";

  const activeFilterCount = 
    (filters.entityTypes.length < 5 ? 1 : 0) +
    (filters.minConfidence > 0 ? 1 : 0) +
    (!filters.showIsolated ? 1 : 0);

  return (
    <>
      <div className={containerClass}>
        {/* Header */}
        <div className="bg-white border-b px-4 py-3 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center space-x-3">
            <Network className="w-5 h-5 text-blue-600" />
            <h3 className="text-lg font-semibold">
              Enhanced Entity Network
            </h3>
            <span className="text-sm text-gray-500">
              ({filteredData.nodes.length} entities, {filteredData.edges.length} connections)
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
              onClick={fetchEntityNetwork}
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
              <option value="force">Force-Directed</option>
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
          <div className="bg-gray-50 border-b px-4 py-3 flex-shrink-0">
            <div className="flex items-center space-x-6">
              {/* Entity Type Filters */}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Entity Types</label>
                <div className="flex space-x-2">
                  {[
                    { type: 'person', icon: Users, label: 'People' },
                    { type: 'business', icon: Building2, label: 'Businesses' },
                    { type: 'location', icon: MapPin, label: 'Locations' },
                    { type: 'phone', icon: Phone, label: 'Phones' },
                    { type: 'email', icon: Mail, label: 'Emails' }
                  ].map(({ type, icon: Icon, label }) => (
                    <label key={type} className="flex items-center space-x-1 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={filters.entityTypes.includes(type)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setFilters({
                              ...filters,
                              entityTypes: [...filters.entityTypes, type]
                            });
                          } else {
                            setFilters({
                              ...filters,
                              entityTypes: filters.entityTypes.filter(t => t !== type)
                            });
                          }
                        }}
                        className="h-3 w-3 text-blue-600 rounded"
                      />
                      <Icon className="w-3 h-3 text-gray-500" />
                      <span className="text-xs">{label}</span>
                    </label>
                  ))}
                </div>
              </div>
              
              {/* Confidence Filter */}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Min Confidence: {filters.minConfidence}%
                </label>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={filters.minConfidence}
                  onChange={(e) => setFilters({ ...filters, minConfidence: parseInt(e.target.value) })}
                  className="w-32"
                />
              </div>
              
              {/* Options */}
              <div className="flex items-center space-x-3">
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
                  onClick={() => setFilters({
                    entityTypes: ['person', 'business', 'location', 'phone', 'email'],
                    relationshipTypes: [],
                    minConfidence: 0,
                    showIsolated: true
                  })}
                  className="px-2 py-1 text-xs text-blue-600 hover:text-blue-700"
                >
                  Reset
                </button>
              </div>
            </div>
          </div>
        )}
        
        {/* Diagram Container */}
        <div className="flex-1 overflow-hidden">
          <EnhancedRelationshipDiagram
            entityNetworkData={filteredData}
            onUpdateRelationship={updateRelationship}
            onDeleteRelationship={deleteRelationship}
            onAddEntity={addEntity}
            layoutType={layoutType}
          />
        </div>
      </div>

      {/* Add Person Form */}
      {showAddPersonForm && (
        <AddEditPersonForm
          person={null}
          people={[]}
          customFields={[]}
          onSave={() => {
            setShowAddPersonForm(false);
            fetchEntityNetwork();
          }}
          onCancel={() => setShowAddPersonForm(false)}
        />
      )}

      {/* Add Business Form */}
      {showAddBusinessForm && (
        <AddEditBusinessForm
          business={null}
          onSave={() => {
            setShowAddBusinessForm(false);
            fetchEntityNetwork();
          }}
          onCancel={() => setShowAddBusinessForm(false)}
        />
      )}
    </>
  );
};

export default EnhancedRelationshipManager;