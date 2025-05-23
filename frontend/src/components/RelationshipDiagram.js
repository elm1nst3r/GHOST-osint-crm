// File: frontend/src/components/RelationshipDiagram.js
import React, { useState, useCallback, useEffect, useMemo } from 'react';
import ReactFlow, {
  MiniMap,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  addEdge,
  MarkerType,
  Position,
  getIncomers,
  getOutgoers,
  getConnectedEdges,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { User, Database, Mail, Phone, Globe, MapPin, Hash, Link, UserPlus, X, Edit2, Save, AlertCircle } from 'lucide-react';

// Custom node components
const PersonNode = ({ data, selected }) => {
  const initials = data.label.split(' ').map(n => n[0]).join('').toUpperCase();
  
  return (
    <div className={`px-4 py-3 shadow-lg rounded-lg border-2 ${selected ? 'border-blue-500' : 'border-gray-300'} bg-white`}>
      <div className="flex items-center space-x-3">
        <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-semibold ${
          data.category === 'Person of Interest' ? 'bg-red-500' : 
          data.category === 'Client' ? 'bg-green-500' : 
          data.category === 'Witness' ? 'bg-yellow-500' : 
          'bg-blue-500'
        }`}>
          {data.profilePicture ? (
            <img src={data.profilePicture} alt={data.label} className="w-full h-full rounded-full object-cover" />
          ) : (
            initials
          )}
        </div>
        <div>
          <div className="text-sm font-medium text-gray-900">{data.label}</div>
          <div className="text-xs text-gray-500">{data.category || 'Unknown'}</div>
          {data.caseName && <div className="text-xs text-blue-600">{data.caseName}</div>}
        </div>
      </div>
      {data.status && (
        <div className={`mt-2 text-xs px-2 py-1 rounded-full inline-block ${
          data.status === 'Open' ? 'bg-green-100 text-green-800' :
          data.status === 'Being Investigated' ? 'bg-yellow-100 text-yellow-800' :
          data.status === 'Closed' ? 'bg-gray-100 text-gray-800' :
          'bg-blue-100 text-blue-800'
        }`}>
          {data.status}
        </div>
      )}
    </div>
  );
};

const OsintDataNode = ({ data }) => {
  const iconMap = {
    'Social Media': <Database className="w-4 h-4" />,
    'Email': <Mail className="w-4 h-4" />,
    'Phone': <Phone className="w-4 h-4" />,
    'Website': <Globe className="w-4 h-4" />,
    'Location': <MapPin className="w-4 h-4" />,
    'Username': <Hash className="w-4 h-4" />,
    'Other': <Link className="w-4 h-4" />
  };
  
  const icon = iconMap[data.type] || iconMap['Other'];
  
  return (
    <div className="px-3 py-2 shadow-md rounded-lg border border-gray-200 bg-gray-50">
      <div className="flex items-center space-x-2">
        <div className="text-gray-600">{icon}</div>
        <div>
          <div className="text-xs font-medium text-gray-700">{data.type}</div>
          <div className="text-xs text-gray-600">{data.value}</div>
        </div>
      </div>
    </div>
  );
};

// Node type mapping
const nodeTypes = {
  person: PersonNode,
  osintData: OsintDataNode,
};

// Edge types with different styles
const relationshipStyles = {
  family: { 
    stroke: '#10b981', 
    strokeWidth: 3, 
    strokeDasharray: '0',
    label: 'Family'
  },
  associate: { 
    stroke: '#3b82f6', 
    strokeWidth: 2, 
    strokeDasharray: '0',
    label: 'Associate'
  },
  employer: { 
    stroke: '#8b5cf6', 
    strokeWidth: 2, 
    strokeDasharray: '5 5',
    label: 'Employer/Employee'
  },
  suspect: { 
    stroke: '#ef4444', 
    strokeWidth: 3, 
    strokeDasharray: '0',
    label: 'Suspect Connection'
  },
  witness: { 
    stroke: '#f59e0b', 
    strokeWidth: 2, 
    strokeDasharray: '3 3',
    label: 'Witness'
  },
  victim: { 
    stroke: '#ec4899', 
    strokeWidth: 2, 
    strokeDasharray: '0',
    label: 'Victim'
  },
  other: { 
    stroke: '#6b7280', 
    strokeWidth: 2, 
    strokeDasharray: '0',
    label: 'Other'
  }
};

// Layout algorithms
const layoutAlgorithms = {
  hierarchical: (nodes, edges) => {
    const levels = {};
    const visited = new Set();
    
    // Find root nodes (nodes with no incoming edges)
    const roots = nodes.filter(node => 
      !edges.some(edge => edge.target === node.id)
    );
    
    // BFS to assign levels
    const queue = roots.map(root => ({ node: root, level: 0 }));
    
    while (queue.length > 0) {
      const { node, level } = queue.shift();
      if (visited.has(node.id)) continue;
      
      visited.add(node.id);
      if (!levels[level]) levels[level] = [];
      levels[level].push(node);
      
      // Find children
      const children = edges
        .filter(edge => edge.source === node.id)
        .map(edge => nodes.find(n => n.id === edge.target))
        .filter(child => child && !visited.has(child.id));
      
      children.forEach(child => {
        queue.push({ node: child, level: level + 1 });
      });
    }
    
    // Position nodes
    const levelHeight = 150;
    const nodeWidth = 250;
    
    return nodes.map(node => {
      let nodeLevel = 0;
      let indexInLevel = 0;
      
      // Find node's level and index
      Object.entries(levels).forEach(([level, levelNodes]) => {
        const index = levelNodes.findIndex(n => n.id === node.id);
        if (index !== -1) {
          nodeLevel = parseInt(level);
          indexInLevel = index;
        }
      });
      
      const levelSize = levels[nodeLevel]?.length || 1;
      const x = (indexInLevel - (levelSize - 1) / 2) * nodeWidth;
      const y = nodeLevel * levelHeight;
      
      return {
        ...node,
        position: { x, y }
      };
    });
  },
  
  circular: (nodes, edges) => {
    const radius = 300;
    const center = { x: 400, y: 300 };
    
    return nodes.map((node, index) => {
      const angle = (2 * Math.PI * index) / nodes.length;
      const x = center.x + radius * Math.cos(angle);
      const y = center.y + radius * Math.sin(angle);
      
      return {
        ...node,
        position: { x, y }
      };
    });
  },
  
  force: (nodes, edges) => {
    // Simple force-directed layout
    const iterations = 50;
    const k = 100; // Ideal spring length
    const c = 0.01; // Repulsion constant
    
    // Initialize random positions
    let positions = nodes.map(node => ({
      id: node.id,
      x: Math.random() * 800,
      y: Math.random() * 600,
      vx: 0,
      vy: 0
    }));
    
    for (let iter = 0; iter < iterations; iter++) {
      // Calculate repulsive forces
      positions.forEach((pos1, i) => {
        positions.forEach((pos2, j) => {
          if (i === j) return;
          
          const dx = pos1.x - pos2.x;
          const dy = pos1.y - pos2.y;
          const distance = Math.sqrt(dx * dx + dy * dy) || 1;
          
          const force = (k * k) / distance;
          pos1.vx += (dx / distance) * force * c;
          pos1.vy += (dy / distance) * force * c;
        });
      });
      
      // Calculate attractive forces
      edges.forEach(edge => {
        const source = positions.find(p => p.id === edge.source);
        const target = positions.find(p => p.id === edge.target);
        
        if (source && target) {
          const dx = target.x - source.x;
          const dy = target.y - source.y;
          const distance = Math.sqrt(dx * dx + dy * dy) || 1;
          
          const force = (distance * distance) / k;
          const fx = (dx / distance) * force * c;
          const fy = (dy / distance) * force * c;
          
          source.vx += fx;
          source.vy += fy;
          target.vx -= fx;
          target.vy -= fy;
        }
      });
      
      // Update positions
      positions.forEach(pos => {
        pos.x += pos.vx;
        pos.y += pos.vy;
        pos.vx *= 0.85; // Damping
        pos.vy *= 0.85;
      });
    }
    
    return nodes.map(node => {
      const pos = positions.find(p => p.id === node.id);
      return {
        ...node,
        position: { x: pos.x, y: pos.y }
      };
    });
  }
};

const RelationshipDiagram = ({ 
  people = [], 
  selectedPersonId = null, 
  onUpdateConnection,
  showOsintData = false,
  layoutType = 'hierarchical' 
}) => {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [selectedNodes, setSelectedNodes] = useState([]);
  const [isAddingConnection, setIsAddingConnection] = useState(false);
  const [connectionModal, setConnectionModal] = useState(null);
  const [connectionType, setConnectionType] = useState('associate');
  const [connectionNote, setConnectionNote] = useState('');

  // Convert people data to nodes and edges
  useEffect(() => {
    const newNodes = [];
    const newEdges = [];
    const processedConnections = new Set();

    // Create person nodes
    people.forEach(person => {
      newNodes.push({
        id: `person-${person.id}`,
        type: 'person',
        position: { x: 0, y: 0 }, // Will be set by layout
        data: {
          label: person.name,
          category: person.category,
          status: person.status,
          caseName: person.case_name,
          profilePicture: person.profile_picture_url,
          ...person
        }
      });

      // Add OSINT data nodes if enabled
      if (showOsintData && person.osint_data) {
        person.osint_data.forEach((osint, index) => {
          const osintNodeId = `osint-${person.id}-${index}`;
          newNodes.push({
            id: osintNodeId,
            type: 'osintData',
            position: { x: 0, y: 0 },
            data: {
              type: osint.type,
              value: osint.value
            }
          });

          newEdges.push({
            id: `edge-person-${person.id}-to-osint-${index}`,
            source: `person-${person.id}`,
            target: osintNodeId,
            type: 'smoothstep',
            animated: false,
            style: { stroke: '#cbd5e1', strokeWidth: 1 }
          });
        });
      }

      // Process connections
      if (person.connections) {
        person.connections.forEach(conn => {
          const connectionId = [person.id, conn.person_id].sort().join('-');
          if (!processedConnections.has(connectionId)) {
            processedConnections.add(connectionId);
            
            const style = relationshipStyles[conn.type] || relationshipStyles.other;
            newEdges.push({
              id: `edge-${person.id}-to-${conn.person_id}`,
              source: `person-${person.id}`,
              target: `person-${conn.person_id}`,
              type: 'smoothstep',
              animated: conn.type === 'suspect',
              label: conn.note || style.label,
              style: {
                stroke: style.stroke,
                strokeWidth: style.strokeWidth,
                strokeDasharray: style.strokeDasharray
              },
              markerEnd: {
                type: MarkerType.ArrowClosed,
                color: style.stroke
              },
              data: {
                type: conn.type,
                note: conn.note
              }
            });
          }
        });
      }
    });

    // Apply layout
    const layoutedNodes = layoutAlgorithms[layoutType](newNodes, newEdges);
    setNodes(layoutedNodes);
    setEdges(newEdges);
  }, [people, showOsintData, layoutType, setNodes, setEdges]);

  // Handle connection creation
  const onConnect = useCallback((params) => {
    if (isAddingConnection) {
      const sourcePersonId = params.source.replace('person-', '');
      const targetPersonId = params.target.replace('person-', '');
      
      setConnectionModal({
        sourceId: sourcePersonId,
        targetId: targetPersonId,
        sourceName: people.find(p => p.id === parseInt(sourcePersonId))?.name,
        targetName: people.find(p => p.id === parseInt(targetPersonId))?.name
      });
    }
  }, [isAddingConnection, people]);

  // Handle node selection
  const onNodeClick = useCallback((event, node) => {
    if (isAddingConnection && node.type === 'person') {
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
  const createConnection = useCallback(async () => {
    if (selectedNodes.length === 2) {
      const sourceId = selectedNodes[0].replace('person-', '');
      const targetId = selectedNodes[1].replace('person-', '');
      
      setConnectionModal({
        sourceId,
        targetId,
        sourceName: people.find(p => p.id === parseInt(sourceId))?.name,
        targetName: people.find(p => p.id === parseInt(targetId))?.name
      });
    }
  }, [selectedNodes, people]);

  // Save connection
  const saveConnection = useCallback(async () => {
    if (connectionModal && onUpdateConnection) {
      await onUpdateConnection(
        parseInt(connectionModal.sourceId),
        parseInt(connectionModal.targetId),
        connectionType,
        connectionNote
      );
      
      setConnectionModal(null);
      setConnectionType('associate');
      setConnectionNote('');
      setIsAddingConnection(false);
      setSelectedNodes([]);
    }
  }, [connectionModal, connectionType, connectionNote, onUpdateConnection]);

  // Handle edge deletion
  const onEdgeClick = useCallback((event, edge) => {
    if (window.confirm('Delete this connection?')) {
      setEdges(edges => edges.filter(e => e.id !== edge.id));
      // TODO: Call API to delete connection
    }
  }, [setEdges]);

  // Highlight connected nodes
  const getHighlightedElements = useCallback(() => {
    if (!selectedPersonId) return { nodes: [], edges: [] };
    
    const nodeId = `person-${selectedPersonId}`;
    const highlightedNodes = [nodeId];
    const highlightedEdges = [];
    
    edges.forEach(edge => {
      if (edge.source === nodeId || edge.target === nodeId) {
        highlightedEdges.push(edge.id);
        highlightedNodes.push(edge.source === nodeId ? edge.target : edge.source);
      }
    });
    
    return { nodes: highlightedNodes, edges: highlightedEdges };
  }, [selectedPersonId, edges]);

  const highlighted = getHighlightedElements();

  return (
    <div className="h-full w-full relative">
      {/* Toolbar */}
      <div className="absolute top-4 left-4 z-10 bg-white rounded-lg shadow-lg p-3 space-y-2">
        <div className="flex items-center space-x-2">
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
            {selectedNodes.length === 0 && 'Select two people to connect'}
            {selectedNodes.length === 1 && 'Select one more person'}
            {selectedNodes.length === 2 && 'Click "Connect" to create relationship'}
          </div>
        )}
        
        {/* Layout selector */}
        <select
          value={layoutType}
          onChange={(e) => {
            const newLayout = e.target.value;
            const layoutedNodes = layoutAlgorithms[newLayout](nodes, edges);
            setNodes(layoutedNodes);
          }}
          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md"
        >
          <option value="hierarchical">Hierarchical Layout</option>
          <option value="circular">Circular Layout</option>
          <option value="force">Force-Directed Layout</option>
        </select>
      </div>

      {/* Legend */}
      <div className="absolute top-4 right-4 z-10 bg-white rounded-lg shadow-lg p-3">
        <h4 className="text-sm font-semibold mb-2">Relationship Types</h4>
        <div className="space-y-1">
          {Object.entries(relationshipStyles).map(([type, style]) => (
            <div key={type} className="flex items-center space-x-2">
              <div
                className="w-8 h-0.5"
                style={{
                  backgroundColor: style.stroke,
                  borderTop: `${style.strokeWidth}px ${style.strokeDasharray ? 'dashed' : 'solid'} ${style.stroke}`
                }}
              />
              <span className="text-xs text-gray-600">{style.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* React Flow Diagram */}
      <ReactFlow
        nodes={nodes.map(node => ({
          ...node,
          selected: selectedNodes.includes(node.id) || highlighted.nodes.includes(node.id),
          style: {
            opacity: highlighted.nodes.length > 0 && !highlighted.nodes.includes(node.id) ? 0.3 : 1
          }
        }))}
        edges={edges.map(edge => ({
          ...edge,
          style: {
            ...edge.style,
            opacity: highlighted.edges.length > 0 && !highlighted.edges.includes(edge.id) ? 0.3 : 1
          }
        }))}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeClick={onNodeClick}
        onEdgeClick={onEdgeClick}
        nodeTypes={nodeTypes}
        fitView
        className="bg-gray-50"
      >
        <Background />
        <Controls />
        <MiniMap />
      </ReactFlow>

      {/* Connection Modal */}
      {connectionModal && (
        <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center z-20">
          <div className="bg-white rounded-lg shadow-xl p-6 w-96">
            <h3 className="text-lg font-semibold mb-4">Create Connection</h3>
            
            <div className="mb-4">
              <p className="text-sm text-gray-600 mb-2">
                Connecting: <span className="font-medium">{connectionModal.sourceName}</span> → <span className="font-medium">{connectionModal.targetName}</span>
              </p>
            </div>
            
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Relationship Type
              </label>
              <select
                value={connectionType}
                onChange={(e) => setConnectionType(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
              >
                {Object.entries(relationshipStyles).map(([type, style]) => (
                  <option key={type} value={type}>{style.label}</option>
                ))}
              </select>
            </div>
            
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Notes (optional)
              </label>
              <textarea
                value={connectionNote}
                onChange={(e) => setConnectionNote(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
                rows="3"
                placeholder="Add any relevant notes about this relationship..."
              />
            </div>
            
            <div className="flex justify-end space-x-2">
              <button
                onClick={() => {
                  setConnectionModal(null);
                  setConnectionType('associate');
                  setConnectionNote('');
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

export default RelationshipDiagram;