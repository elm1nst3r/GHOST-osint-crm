// File: frontend/src/components/EnhancedRelationshipDiagram.js
import React, { useState, useCallback, useEffect, useMemo } from 'react';
import ReactFlow, {
  MiniMap,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  Handle,
  Position,
  MarkerType,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { 
  User, Building2, MapPin, Phone, Mail, Globe, CreditCard, Car,
  Smartphone, FileText, Calendar, DollarSign, Home, Briefcase,
  Hash, Link, UserPlus, X, Edit2, Save, AlertCircle, Trash2,
  Bug, Filter, Plus, Network
} from 'lucide-react';

// Enhanced node components for different entity types
const PersonNode = ({ data, selected }) => {
  const initials = data.label.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || '??';
  
  return (
    <>
      <Handle type="target" position={Position.Top} style={{ background: '#555' }} />
      <div className={`px-4 py-3 shadow-lg rounded-lg border-2 ${selected ? 'border-blue-500 ring-2 ring-blue-200' : 'border-gray-300'} bg-white cursor-pointer min-w-[200px]`}>
        <div className="flex items-center space-x-3">
          <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-semibold flex-shrink-0 ${
            data.category === 'Person of Interest' ? 'bg-red-500' : 
            data.category === 'Client' ? 'bg-green-500' : 
            data.category === 'Witness' ? 'bg-yellow-500' : 
            data.category === 'Victim' ? 'bg-purple-500' :
            data.category === 'Suspect' ? 'bg-orange-500' :
            'bg-blue-500'
          }`}>
            {data.profilePicture ? (
              <img src={data.profilePicture} alt={data.label} className="w-full h-full rounded-full object-cover" />
            ) : (
              initials
            )}
          </div>
          <div className="min-w-0">
            <div className="text-sm font-medium text-gray-900 truncate">{data.label}</div>
            <div className="text-xs text-gray-500">{data.category || 'Person'}</div>
            {data.caseName && <div className="text-xs text-blue-600 truncate">{data.caseName}</div>}
          </div>
        </div>
      </div>
      <Handle type="source" position={Position.Bottom} style={{ background: '#555' }} />
    </>
  );
};

const BusinessNode = ({ data, selected }) => {
  return (
    <>
      <Handle type="target" position={Position.Top} style={{ background: '#555' }} />
      <div className={`px-4 py-3 shadow-lg rounded-lg border-2 ${selected ? 'border-green-500 ring-2 ring-green-200' : 'border-gray-300'} bg-white cursor-pointer min-w-[200px]`}>
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center flex-shrink-0">
            <Building2 className="w-6 h-6 text-green-600" />
          </div>
          <div className="min-w-0">
            <div className="text-sm font-medium text-gray-900 truncate">{data.label}</div>
            <div className="text-xs text-gray-500">{data.type || 'Business'}</div>
            {data.industry && <div className="text-xs text-green-600">{data.industry}</div>}
          </div>
        </div>
      </div>
      <Handle type="source" position={Position.Bottom} style={{ background: '#555' }} />
    </>
  );
};

const LocationNode = ({ data, selected }) => {
  return (
    <>
      <Handle type="target" position={Position.Top} style={{ background: '#555' }} />
      <div className={`px-4 py-3 shadow-lg rounded-lg border-2 ${selected ? 'border-purple-500 ring-2 ring-purple-200' : 'border-gray-300'} bg-white cursor-pointer min-w-[200px]`}>
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center flex-shrink-0">
            <MapPin className="w-6 h-6 text-purple-600" />
          </div>
          <div className="min-w-0">
            <div className="text-sm font-medium text-gray-900 truncate">{data.label}</div>
            <div className="text-xs text-gray-500">{data.locationType || 'Location'}</div>
            {data.city && <div className="text-xs text-purple-600">{data.city}</div>}
          </div>
        </div>
      </div>
      <Handle type="source" position={Position.Bottom} style={{ background: '#555' }} />
    </>
  );
};

const PhoneNode = ({ data, selected }) => {
  return (
    <>
      <Handle type="target" position={Position.Top} style={{ background: '#555' }} />
      <div className={`px-3 py-2 shadow-lg rounded-lg border-2 ${selected ? 'border-blue-500 ring-2 ring-blue-200' : 'border-gray-300'} bg-white cursor-pointer`}>
        <div className="flex items-center space-x-2">
          <Phone className="w-4 h-4 text-blue-600" />
          <div className="text-sm font-medium text-gray-900">{data.label}</div>
        </div>
      </div>
      <Handle type="source" position={Position.Bottom} style={{ background: '#555' }} />
    </>
  );
};

const EmailNode = ({ data, selected }) => {
  return (
    <>
      <Handle type="target" position={Position.Top} style={{ background: '#555' }} />
      <div className={`px-3 py-2 shadow-lg rounded-lg border-2 ${selected ? 'border-indigo-500 ring-2 ring-indigo-200' : 'border-gray-300'} bg-white cursor-pointer`}>
        <div className="flex items-center space-x-2">
          <Mail className="w-4 h-4 text-indigo-600" />
          <div className="text-sm font-medium text-gray-900">{data.label}</div>
        </div>
      </div>
      <Handle type="source" position={Position.Bottom} style={{ background: '#555' }} />
    </>
  );
};

// Node type mapping
const nodeTypes = {
  person: PersonNode,
  business: BusinessNode,
  location: LocationNode,
  phone: PhoneNode,
  email: EmailNode,
};

// Enhanced edge styles
const edgeStyles = {
  // Person relationships
  family: { stroke: '#10b981', strokeWidth: 3, label: 'Family' },
  friend: { stroke: '#3b82f6', strokeWidth: 2, label: 'Friend' },
  associate: { stroke: '#6b7280', strokeWidth: 2, label: 'Associate' },
  
  // Business relationships
  owns: { stroke: '#10b981', strokeWidth: 3, label: 'Owns' },
  works_at: { stroke: '#f59e0b', strokeWidth: 2, label: 'Works At' },
  employs: { stroke: '#f59e0b', strokeWidth: 2, strokeDasharray: '5 5', label: 'Employs' },
  director_of: { stroke: '#8b5cf6', strokeWidth: 2, label: 'Director' },
  
  // Location relationships
  lives_at: { stroke: '#8b5cf6', strokeWidth: 2, label: 'Lives At' },
  located_at: { stroke: '#6366f1', strokeWidth: 2, label: 'Located At' },
  owns_property: { stroke: '#10b981', strokeWidth: 3, strokeDasharray: '5 5', label: 'Owns Property' },
  
  // Communication relationships
  uses_phone: { stroke: '#3b82f6', strokeWidth: 2, label: 'Uses Phone' },
  uses_email: { stroke: '#6366f1', strokeWidth: 2, label: 'Uses Email' },
  
  // Default
  other: { stroke: '#6b7280', strokeWidth: 2, label: 'Connected' }
};

const EnhancedRelationshipDiagram = ({ 
  entityNetworkData,
  onUpdateRelationship,
  onDeleteRelationship,
  onAddEntity,
  layoutType = 'hierarchical'
}) => {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [showDebug, setShowDebug] = useState(false);
  const [selectedNodes, setSelectedNodes] = useState([]);
  const [isAddingConnection, setIsAddingConnection] = useState(false);
  const [connectionModal, setConnectionModal] = useState(null);
  const [relationshipType, setRelationshipType] = useState('associate');
  const [relationshipNote, setRelationshipNote] = useState('');
  const [confidenceScore, setConfidenceScore] = useState(75);
  const [showAddEntityMenu, setShowAddEntityMenu] = useState(false);
  const [addEntityPosition, setAddEntityPosition] = useState({ x: 0, y: 0 });

  // Layout algorithms
  const applyLayout = useCallback((nodes, edges, type) => {
    const nodesCopy = [...nodes];
    
    switch (type) {
      case 'hierarchical': {
        // Group nodes by type
        const nodesByType = {
          person: [],
          business: [],
          location: [],
          phone: [],
          email: [],
          other: []
        };
        
        nodesCopy.forEach(node => {
          const type = node.type || 'other';
          if (nodesByType[type]) {
            nodesByType[type].push(node);
          } else {
            nodesByType.other.push(node);
          }
        });
        
        // Position nodes by type in layers
        let yOffset = 0;
        const layerHeight = 200;
        const nodeWidth = 250;
        
        Object.entries(nodesByType).forEach(([type, typeNodes]) => {
          if (typeNodes.length === 0) return;
          
          typeNodes.forEach((node, index) => {
            node.position = {
              x: (index - (typeNodes.length - 1) / 2) * nodeWidth,
              y: yOffset
            };
          });
          
          yOffset += layerHeight;
        });
        break;
      }
      
      case 'circular': {
        const radius = Math.min(600, Math.max(300, nodesCopy.length * 50));
        const center = { x: 0, y: 0 };
        
        // Group by entity type
        const groups = {};
        nodesCopy.forEach(node => {
          const type = node.type || 'other';
          if (!groups[type]) groups[type] = [];
          groups[type].push(node);
        });
        
        // Arrange groups in sectors
        const groupTypes = Object.keys(groups);
        const sectorAngle = (2 * Math.PI) / groupTypes.length;
        
        groupTypes.forEach((type, groupIndex) => {
          const startAngle = groupIndex * sectorAngle;
          const groupNodes = groups[type];
          const angleStep = sectorAngle / (groupNodes.length + 1);
          
          groupNodes.forEach((node, nodeIndex) => {
            const angle = startAngle + (nodeIndex + 1) * angleStep;
            node.position = {
              x: center.x + radius * Math.cos(angle),
              y: center.y + radius * Math.sin(angle)
            };
          });
        });
        break;
      }
      
      case 'force': {
        // Simple force-directed layout
        const iterations = 50;
        const k = Math.sqrt((1000 * 1000) / nodesCopy.length);
        
        // Initialize random positions
        nodesCopy.forEach(node => {
          if (!node.position) {
            node.position = {
              x: Math.random() * 1000 - 500,
              y: Math.random() * 1000 - 500
            };
          }
        });
        
        // Apply forces
        for (let iter = 0; iter < iterations; iter++) {
          // Repulsive forces between all nodes
          for (let i = 0; i < nodesCopy.length; i++) {
            for (let j = i + 1; j < nodesCopy.length; j++) {
              const dx = nodesCopy[j].position.x - nodesCopy[i].position.x;
              const dy = nodesCopy[j].position.y - nodesCopy[i].position.y;
              const dist = Math.sqrt(dx * dx + dy * dy) || 1;
              const force = (k * k) / dist;
              
              nodesCopy[i].position.x -= (dx / dist) * force * 0.1;
              nodesCopy[i].position.y -= (dy / dist) * force * 0.1;
              nodesCopy[j].position.x += (dx / dist) * force * 0.1;
              nodesCopy[j].position.y += (dy / dist) * force * 0.1;
            }
          }
          
          // Attractive forces for connected nodes
          edges.forEach(edge => {
            const source = nodesCopy.find(n => n.id === edge.source);
            const target = nodesCopy.find(n => n.id === edge.target);
            if (source && target) {
              const dx = target.position.x - source.position.x;
              const dy = target.position.y - source.position.y;
              const dist = Math.sqrt(dx * dx + dy * dy);
              const force = (dist * dist) / k;
              
              source.position.x += (dx / dist) * force * 0.01;
              source.position.y += (dy / dist) * force * 0.01;
              target.position.x -= (dx / dist) * force * 0.01;
              target.position.y -= (dy / dist) * force * 0.01;
            }
          });
        }
        break;
      }
    }
    
    return nodesCopy;
  }, []);

  // Build nodes and edges from entity network data
  useEffect(() => {
    if (!entityNetworkData || !entityNetworkData.nodes) return;
    
    console.log('Building enhanced diagram with:', entityNetworkData);
    
    // Create nodes
    const newNodes = entityNetworkData.nodes.map(entity => {
      let nodeData = {
        label: '',
        raw: entity.data
      };
      
      // Extract data based on entity type
      switch (entity.type) {
        case 'person':
          nodeData = {
            ...nodeData,
            label: `${entity.data.first_name || ''} ${entity.data.last_name || ''}`.trim(),
            category: entity.data.category,
            status: entity.data.status,
            caseName: entity.data.case_name,
            profilePicture: entity.data.profile_picture_url
          };
          break;
          
        case 'business':
          nodeData = {
            ...nodeData,
            label: entity.data.name,
            type: entity.data.type,
            industry: entity.data.industry,
            status: entity.data.status
          };
          break;
          
        case 'location':
          nodeData = {
            ...nodeData,
            label: entity.data.name || entity.data.address || 'Unknown Location',
            locationType: entity.data.type,
            city: entity.data.city,
            country: entity.data.country
          };
          break;
          
        case 'phone':
          nodeData = {
            ...nodeData,
            label: entity.data.value || entity.data.phone || 'Unknown Phone'
          };
          break;
          
        case 'email':
          nodeData = {
            ...nodeData,
            label: entity.data.value || entity.data.email || 'Unknown Email'
          };
          break;
          
        default:
          nodeData = {
            ...nodeData,
            label: entity.data.name || entity.data.value || 'Unknown'
          };
      }
      
      return {
        id: entity.id,
        type: entity.type,
        position: { x: 0, y: 0 },
        data: nodeData
      };
    });
    
    // Create edges
    const newEdges = entityNetworkData.edges.map(edge => {
      const style = edgeStyles[edge.type] || edgeStyles.other;
      const edgeData = edge.data || {};
      
      return {
        id: edge.id,
        source: edge.source,
        target: edge.target,
        type: 'smoothstep',
        animated: edge.type === 'suspect' || edge.type === 'transfers_money',
        label: edgeData.display_name || edgeData.notes || style.label,
        labelStyle: { 
          fontSize: 12, 
          fontWeight: 500,
          fill: '#1f2937'
        },
        labelBgStyle: { 
          fill: '#ffffff',
          fillOpacity: 0.8
        },
        style: {
          stroke: edgeData.color || style.stroke,
          strokeWidth: style.strokeWidth,
          strokeDasharray: edgeData.style === 'dashed' ? '5 5' : 
                          edgeData.style === 'dotted' ? '2 2' : 
                          style.strokeDasharray || '0',
          cursor: 'pointer'
        },
        markerEnd: {
          type: MarkerType.ArrowClosed,
          color: edgeData.color || style.stroke,
          width: 15,
          height: 15
        },
        data: {
          ...edgeData,
          type: edge.type
        }
      };
    });
    
    // Apply layout
    const layoutedNodes = applyLayout(newNodes, newEdges, layoutType);
    
    setNodes(layoutedNodes);
    setEdges(newEdges);
    
  }, [entityNetworkData, layoutType, setNodes, setEdges, applyLayout]);

  // Handle node click
  const onNodeClick = useCallback((event, node) => {
    console.log('Node clicked:', node);
    
    if (isAddingConnection) {
      setSelectedNodes(prev => {
        if (prev.includes(node.id)) {
          return prev.filter(id => id !== node.id);
        } else if (prev.length < 2) {
          return [...prev, node.id];
        }
        return prev;
      });
    }
  }, [isAddingConnection]);

  // Create connection between selected nodes
  const createConnection = useCallback(() => {
    if (selectedNodes.length === 2) {
      const sourceNode = nodes.find(n => n.id === selectedNodes[0]);
      const targetNode = nodes.find(n => n.id === selectedNodes[1]);
      
      if (sourceNode && targetNode) {
        // Determine available relationship types based on entity types
        const sourceType = sourceNode.type;
        const targetType = targetNode.type;
        let availableTypes = [];
        
        if (sourceType === 'person' && targetType === 'person') {
          availableTypes = ['family', 'friend', 'associate', 'enemy'];
        } else if (sourceType === 'person' && targetType === 'business') {
          availableTypes = ['owns', 'works_at', 'director_of', 'customer_of'];
        } else if (sourceType === 'business' && targetType === 'person') {
          availableTypes = ['employs', 'owned_by', 'has_director', 'has_customer'];
        } else if (sourceType === 'person' && targetType === 'location') {
          availableTypes = ['lives_at', 'owns_property', 'frequents'];
        } else if (sourceType === 'business' && targetType === 'location') {
          availableTypes = ['located_at', 'has_branch'];
        } else if ((sourceType === 'person' || sourceType === 'business') && targetType === 'phone') {
          availableTypes = ['uses_phone'];
        } else if ((sourceType === 'person' || sourceType === 'business') && targetType === 'email') {
          availableTypes = ['uses_email'];
        } else {
          availableTypes = ['other'];
        }
        
        setConnectionModal({
          source: sourceNode,
          target: targetNode,
          availableTypes: availableTypes
        });
      }
    }
  }, [selectedNodes, nodes]);

  // Save connection
  const saveConnection = useCallback(async () => {
    if (connectionModal && onUpdateRelationship) {
      const sourceId = connectionModal.source.id.split('-')[1];
      const targetId = connectionModal.target.id.split('-')[1];
      const sourceType = connectionModal.source.type;
      const targetType = connectionModal.target.type;
      
      await onUpdateRelationship({
        source_type: sourceType,
        source_id: parseInt(sourceId),
        target_type: targetType,
        target_id: parseInt(targetId),
        relationship_type: relationshipType,
        notes: relationshipNote,
        confidence_score: confidenceScore
      });
      
      setConnectionModal(null);
      setRelationshipType('associate');
      setRelationshipNote('');
      setConfidenceScore(75);
      setIsAddingConnection(false);
      setSelectedNodes([]);
    }
  }, [connectionModal, relationshipType, relationshipNote, confidenceScore, onUpdateRelationship]);

  // Handle edge click
  const onEdgeClick = useCallback((event, edge) => {
    console.log('Edge clicked:', edge);
    event.stopPropagation();
    
    if (!edge.data || !onDeleteRelationship) return;
    
    const confirmed = window.confirm(
      `Delete connection?\n` +
      `Type: ${edge.data.display_name || edge.data.type || 'Unknown'}\n` +
      `Note: ${edge.data.notes || 'None'}`
    );
    
    if (confirmed) {
      // Extract entity info from edge
      const [sourceType, sourceId] = edge.source.split('-');
      const [targetType, targetId] = edge.target.split('-');
      
      onDeleteRelationship({
        source_type: sourceType,
        source_id: parseInt(sourceId),
        target_type: targetType,
        target_id: parseInt(targetId),
        relationship_type: edge.data.type
      });
    }
  }, [onDeleteRelationship]);

  // Handle background click for adding entities
  const onPaneClick = useCallback((event) => {
    // Get click position relative to the flow
    const reactFlowBounds = event.currentTarget.getBoundingClientRect();
    const position = {
      x: event.clientX - reactFlowBounds.left,
      y: event.clientY - reactFlowBounds.top
    };
    
    setAddEntityPosition(position);
    setShowAddEntityMenu(true);
  }, []);

  // Add new entity
  const addNewEntity = (entityType) => {
    if (onAddEntity) {
      onAddEntity(entityType, addEntityPosition);
    }
    setShowAddEntityMenu(false);
  };

  // Get counts for debug
  const getEntityCounts = () => {
    const counts = {};
    nodes.forEach(node => {
      counts[node.type] = (counts[node.type] || 0) + 1;
    });
    return counts;
  };

  return (
    <div className="h-full w-full relative">
      {/* Toolbar */}
      <div className="absolute top-4 left-4 z-10 glass-card backdrop-blur-xl border border-white/30 shadow-glass-lg rounded-glass p-3 space-y-2">
        <div className="flex items-center space-x-2">
          <button
            onClick={() => setShowDebug(!showDebug)}
            className={`px-3 py-2 rounded-md text-sm font-medium flex items-center space-x-2 ${
              showDebug ? 'bg-orange-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
            title="Toggle Debug Panel"
          >
            <Bug className="w-4 h-4" />
          </button>
          
          <button
            onClick={() => {
              setIsAddingConnection(!isAddingConnection);
              setSelectedNodes([]);
            }}
            className={`px-3 py-2 rounded-md text-sm font-medium flex items-center space-x-2 ${
              isAddingConnection 
                ? 'bg-blue-600 text-white' 
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            <UserPlus className="w-4 h-4" />
            <span>{isAddingConnection ? 'Cancel' : 'Add Connection'}</span>
          </button>
          
          {isAddingConnection && selectedNodes.length === 2 && (
            <button
              onClick={createConnection}
              className="px-3 py-2 bg-green-600 text-white rounded-md text-sm font-medium flex items-center space-x-2 hover:bg-green-700"
            >
              <Link className="w-4 h-4" />
              <span>Connect</span>
            </button>
          )}
        </div>
        
        {isAddingConnection && (
          <div className="text-sm text-gray-600">
            {selectedNodes.length === 0 && 'Click on two entities to connect them'}
            {selectedNodes.length === 1 && 'Select one more entity'}
            {selectedNodes.length === 2 && 'Click "Connect" to create relationship'}
          </div>
        )}
        
        {/* Layout selector */}
        <select
          value={layoutType}
          onChange={(e) => {
            const newLayout = e.target.value;
            const layoutedNodes = applyLayout(nodes, edges, newLayout);
            setNodes(layoutedNodes);
          }}
          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md"
        >
          <option value="hierarchical">Hierarchical Layout</option>
          <option value="circular">Circular Layout</option>
          <option value="force">Force-Directed Layout</option>
        </select>
        
        <div className="text-xs text-gray-500 space-y-1">
          <div>Total Entities: {nodes.length}</div>
          <div>Connections: {edges.length}</div>
          {Object.entries(getEntityCounts()).map(([type, count]) => (
            <div key={type} className="pl-2">
              {type}: {count}
            </div>
          ))}
        </div>
      </div>

      {/* Legend */}
      <div className="absolute top-4 right-4 z-10 glass-card backdrop-blur-xl border border-white/30 shadow-glass-lg rounded-glass p-3">
        <h4 className="text-sm font-semibold mb-2">Entity Types</h4>
        <div className="space-y-2 mb-3">
          <div className="flex items-center space-x-2">
            <User className="w-4 h-4 text-blue-600" />
            <span className="text-xs">Person</span>
          </div>
          <div className="flex items-center space-x-2">
            <Building2 className="w-4 h-4 text-green-600" />
            <span className="text-xs">Business</span>
          </div>
          <div className="flex items-center space-x-2">
            <MapPin className="w-4 h-4 text-purple-600" />
            <span className="text-xs">Location</span>
          </div>
          <div className="flex items-center space-x-2">
            <Phone className="w-4 h-4 text-blue-600" />
            <span className="text-xs">Phone</span>
          </div>
          <div className="flex items-center space-x-2">
            <Mail className="w-4 h-4 text-indigo-600" />
            <span className="text-xs">Email</span>
          </div>
        </div>
        
        <h4 className="text-sm font-semibold mb-2">Connection Types</h4>
        <div className="space-y-1">
          {Object.entries(edgeStyles).slice(0, 5).map(([type, style]) => (
            <div key={type} className="flex items-center space-x-2">
              <svg width="30" height="10">
                <line 
                  x1="0" 
                  y1="5" 
                  x2="30" 
                  y2="5" 
                  stroke={style.stroke}
                  strokeWidth={style.strokeWidth}
                  strokeDasharray={style.strokeDasharray || '0'}
                />
              </svg>
              <span className="text-xs text-gray-600">{style.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* React Flow */}
      <ReactFlow
        nodes={nodes.map(node => ({
          ...node,
          selected: selectedNodes.includes(node.id)
        }))}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={onNodeClick}
        onEdgeClick={onEdgeClick}
        onPaneClick={onPaneClick}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{
          padding: 0.2,
          includeHiddenNodes: false
        }}
        defaultEdgeOptions={{
          type: 'smoothstep',
          animated: false
        }}
        connectionMode="loose"
        className="bg-gray-50"
        minZoom={0.1}
        maxZoom={2}
      >
        <Background variant="dots" gap={12} size={1} />
        <Controls />
        <MiniMap 
          nodeStrokeWidth={3}
          zoomable
          pannable
        />
      </ReactFlow>

      {/* Debug Panel */}
      {showDebug && (
        <div className="absolute bottom-4 left-4 z-20 glass-card backdrop-blur-xl border border-white/30 shadow-glass-lg rounded-glass p-4 max-w-md max-h-96 overflow-auto">
          <h3 className="font-bold mb-2">Debug Information</h3>
          <div className="space-y-2 text-xs">
            <details>
              <summary className="cursor-pointer font-medium">Nodes ({nodes.length})</summary>
              <pre className="mt-2 bg-gray-100 p-2 rounded overflow-auto">
                {JSON.stringify(nodes.map(n => ({ id: n.id, type: n.type, label: n.data.label })), null, 2)}
              </pre>
            </details>
            <details>
              <summary className="cursor-pointer font-medium">Edges ({edges.length})</summary>
              <pre className="mt-2 bg-gray-100 p-2 rounded overflow-auto">
                {JSON.stringify(edges.map(e => ({ 
                  id: e.id, 
                  source: e.source, 
                  target: e.target, 
                  type: e.data?.type 
                })), null, 2)}
              </pre>
            </details>
          </div>
        </div>
      )}

      {/* Add Entity Menu */}
      {showAddEntityMenu && (
        <div 
          className="absolute z-20 bg-white rounded-lg shadow-lg p-2"
          style={{ left: addEntityPosition.x, top: addEntityPosition.y }}
        >
          <div className="text-xs font-medium text-gray-700 mb-2">Add Entity</div>
          <div className="space-y-1">
            <button
              onClick={() => addNewEntity('person')}
              className="w-full text-left px-3 py-2 hover:bg-gray-100 rounded flex items-center space-x-2"
            >
              <User className="w-4 h-4" />
              <span>Person</span>
            </button>
            <button
              onClick={() => addNewEntity('business')}
              className="w-full text-left px-3 py-2 hover:bg-gray-100 rounded flex items-center space-x-2"
            >
              <Building2 className="w-4 h-4" />
              <span>Business</span>
            </button>
            <button
              onClick={() => addNewEntity('location')}
              className="w-full text-left px-3 py-2 hover:bg-gray-100 rounded flex items-center space-x-2"
            >
              <MapPin className="w-4 h-4" />
              <span>Location</span>
            </button>
          </div>
          <button
            onClick={() => setShowAddEntityMenu(false)}
            className="absolute top-1 right-1 text-gray-400 hover:text-gray-600"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Connection Modal */}
      {connectionModal && (
        <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center z-20">
          <div className="bg-white rounded-lg shadow-xl p-6 w-96">
            <h3 className="text-lg font-semibold mb-4">Create Connection</h3>
            
            <div className="mb-4">
              <p className="text-sm text-gray-600 mb-2">
                Connecting: <span className="font-medium">{connectionModal.source.data.label}</span> → <span className="font-medium">{connectionModal.target.data.label}</span>
              </p>
            </div>
            
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Relationship Type
              </label>
              <select
                value={relationshipType}
                onChange={(e) => setRelationshipType(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
              >
                {connectionModal.availableTypes.map(type => {
                  const style = edgeStyles[type] || { label: type };
                  return (
                    <option key={type} value={type}>{style.label}</option>
                  );
                })}
              </select>
            </div>
            
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Confidence Score: {confidenceScore}%
              </label>
              <input
                type="range"
                min="0"
                max="100"
                value={confidenceScore}
                onChange={(e) => setConfidenceScore(parseInt(e.target.value))}
                className="w-full"
              />
            </div>
            
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Notes (optional)
              </label>
              <textarea
                value={relationshipNote}
                onChange={(e) => setRelationshipNote(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
                rows="3"
                placeholder="Add any relevant notes about this relationship..."
              />
            </div>
            
            <div className="flex justify-end space-x-2">
              <button
                onClick={() => {
                  setConnectionModal(null);
                  setRelationshipType('associate');
                  setRelationshipNote('');
                  setConfidenceScore(75);
                }}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
              >
                Cancel
              </button>
              <button
                onClick={saveConnection}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
              >
                Save Connection
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default EnhancedRelationshipDiagram;