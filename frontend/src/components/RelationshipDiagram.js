// File: frontend/src/components/RelationshipDiagram.js
import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
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
import { Link, UserPlus, Bug, Building2, Landmark, Network } from 'lucide-react';
import { transactionsAPI } from '../utils/api';

// Debug component to show data structure
const DebugPanel = ({ people, nodes, edges, show }) => {
  const { t } = useTranslation();
  if (!show) return null;

  return (
    <div className="absolute bottom-4 left-4 z-20 bg-white dark:bg-slate-800 rounded-lg shadow-lg p-4 max-w-md max-h-96 overflow-auto">
      <h3 className="font-bold mb-2">{t('relationshipDiagram.debugInformation')}</h3>
      <div className="space-y-2 text-xs">
        <div>
          <strong>{t('relationshipDiagram.peopleCountLabel')}</strong> {people.length}
        </div>
        <div>
          <strong>{t('relationshipDiagram.nodesCountLabel')}</strong> {nodes.length}
        </div>
        <div>
          <strong>{t('relationshipDiagram.edgesCountLabel')}</strong> {edges.length}
        </div>
        <details>
          <summary className="cursor-pointer font-medium">{t('relationshipDiagram.peopleWithConnections')}</summary>
          <pre className="mt-2 bg-gray-100 dark:bg-slate-700 p-2 rounded overflow-auto">
            {JSON.stringify(
              people.filter(p => p.connections && p.connections.length > 0).map(p => ({
                id: p.id,
                name: `${p.first_name} ${p.last_name}`,
                connections: p.connections
              })),
              null,
              2
            )}
          </pre>
        </details>
        <details>
          <summary className="cursor-pointer font-medium">{t('relationshipDiagram.allEdges')}</summary>
          <pre className="mt-2 bg-gray-100 dark:bg-slate-700 p-2 rounded overflow-auto">
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
  );
};

// Custom node component with handles
const PersonNode = ({ data, selected }) => {
  const { t } = useTranslation();
  const initials = data.label.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || '??';

  return (
    <>
      <Handle type="target" position={Position.Top} style={{ background: '#555' }} />
      <div className={`px-4 py-3 shadow-lg rounded-lg border-2 ${selected ? 'border-blue-500 ring-2 ring-blue-200' : 'border-gray-300 dark:border-slate-600'} bg-white dark:bg-slate-800 cursor-pointer min-w-[200px]`}>
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
            <div className="text-sm font-medium text-gray-900 dark:text-slate-100 truncate">{data.label}</div>
            <div className="text-xs text-gray-500 dark:text-gray-400">{data.category || t('relationshipDiagram.unknown')}</div>
            {data.caseName && <div className="text-xs text-blue-600 truncate">{data.caseName}</div>}
          </div>
        </div>
        {data.status && (
          <div className={`mt-2 text-xs px-2 py-1 rounded-full inline-block ${
            data.status === 'Open' ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-400' :
            data.status === 'Being Investigated' ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-400' :
            data.status === 'Closed' ? 'bg-gray-100 dark:bg-slate-700 text-gray-800 dark:text-slate-200' :
            'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-400'
          }`}>
            {data.status}
          </div>
        )}
      </div>
      <Handle type="source" position={Position.Bottom} style={{ background: '#555' }} />
    </>
  );
};

// Hub node for businesses / properties in the transaction layer (issue #43)
const EntityNode = ({ data, selected }) => {
  const { t } = useTranslation();
  const isProperty = data.kind === 'property';
  const Icon = isProperty ? Landmark : Building2;
  return (
    <>
      <Handle type="target" position={Position.Top} style={{ background: '#555' }} />
      <div className={`px-4 py-3 shadow-lg rounded-lg border-2 ${selected ? 'border-blue-500' : 'border-gray-300 dark:border-slate-600'} ${isProperty ? 'bg-emerald-50 dark:bg-emerald-900/30' : 'bg-indigo-50 dark:bg-indigo-900/30'} cursor-pointer min-w-[180px]`}>
        <div className="flex items-center space-x-3">
          <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-white flex-shrink-0 ${isProperty ? 'bg-emerald-600' : 'bg-indigo-600'}`}>
            <Icon className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <div className="text-sm font-medium text-gray-900 dark:text-slate-100 truncate">{data.label}</div>
            <div className="text-xs text-gray-500 dark:text-gray-400 capitalize">{data.kind}{data.eventCount ? ` · ${t('relationshipDiagram.eventCount', { count: data.eventCount })}` : ''}</div>
          </div>
        </div>
      </div>
      <Handle type="source" position={Position.Bottom} style={{ background: '#555' }} />
    </>
  );
};

// Node type mapping
const nodeTypes = {
  person: PersonNode,
  entity: EntityNode,
};

const RelationshipDiagram = ({
  people = [],
  selectedPersonId = null,
  onUpdateConnection,
  onDeleteConnection,
  showOsintData = false,
  layoutType = 'hierarchical'
}) => {
  const { t } = useTranslation();
  // Edge styles
  const edgeStyles = useMemo(() => ({
    family: { stroke: '#10b981', strokeWidth: 3, label: t('relationshipDiagram.edgeStyles.family') },
    friend: { stroke: '#3b82f6', strokeWidth: 2, label: t('relationshipDiagram.edgeStyles.friend') },
    enemy: { stroke: '#ef4444', strokeWidth: 2, strokeDasharray: '5 5', label: t('relationshipDiagram.edgeStyles.enemy') },
    associate: { stroke: '#6b7280', strokeWidth: 2, label: t('relationshipDiagram.edgeStyles.associate') },
    employer: { stroke: '#8b5cf6', strokeWidth: 2, strokeDasharray: '5 5', label: t('relationshipDiagram.edgeStyles.employer') },
    employee: { stroke: '#a78bfa', strokeWidth: 2, strokeDasharray: '5 5', label: t('relationshipDiagram.edgeStyles.employee') },
    suspect: { stroke: '#ef4444', strokeWidth: 3, label: t('relationshipDiagram.edgeStyles.suspect') },
    witness: { stroke: '#f59e0b', strokeWidth: 2, strokeDasharray: '3 3', label: t('relationshipDiagram.edgeStyles.witness') },
    victim: { stroke: '#ec4899', strokeWidth: 2, label: t('relationshipDiagram.edgeStyles.victim') },
    owner: { stroke: '#48bb78', strokeWidth: 2, label: t('relationshipDiagram.edgeStyles.owner') },
    other: { stroke: '#6b7280', strokeWidth: 2, label: t('relationshipDiagram.edgeStyles.other') }
  }), [t]);
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [showDebug, setShowDebug] = useState(false);
  const [selectedNodes, setSelectedNodes] = useState([]);
  const [isAddingConnection, setIsAddingConnection] = useState(false);
  const [connectionModal, setConnectionModal] = useState(null);
  const [connectionType, setConnectionType] = useState('associate');
  const [connectionNote, setConnectionNote] = useState('');
  // Transaction/venue layer (issue #43)
  const [showTransactionLayer, setShowTransactionLayer] = useState(false);
  const [txData, setTxData] = useState([]);

  useEffect(() => {
    transactionsAPI.getAll({ limit: 1000 })
      .then(r => setTxData(r.data || []))
      .catch(err => console.error('Error loading transactions for graph:', err));
  }, []);

  // Helper function to get full name
  const getFullName = useCallback((person) => {
    if (!person) return t('relationshipDiagram.unknown');
    return `${person.first_name || ''} ${person.last_name || ''}`.trim() || t('relationshipDiagram.unknown');
  }, [t]);

  // Layout algorithms
  const applyLayout = useCallback((nodes, edges, type) => {
    const nodesCopy = [...nodes];
    
    switch (type) {
      case 'hierarchical': {
        const levels = new Map();
        const visited = new Set();
        
        // Find nodes with no incoming edges (roots)
        const roots = nodesCopy.filter(node => 
          !edges.some(edge => edge.target === node.id)
        );
        
        if (roots.length === 0 && nodesCopy.length > 0) {
          roots.push(nodesCopy[0]);
        }
        
        // BFS to assign levels
        const queue = roots.map(root => ({ node: root, level: 0 }));
        
        while (queue.length > 0) {
          const { node, level } = queue.shift();
          if (visited.has(node.id)) continue;
          
          visited.add(node.id);
          if (!levels.has(level)) levels.set(level, []);
          levels.get(level).push(node);
          
          // Find children
          const children = edges
            .filter(edge => edge.source === node.id)
            .map(edge => nodesCopy.find(n => n.id === edge.target))
            .filter(child => child && !visited.has(child.id));
          
          children.forEach(child => {
            queue.push({ node: child, level: level + 1 });
          });
        }
        
        // Add unvisited nodes
        nodesCopy.forEach(node => {
          if (!visited.has(node.id)) {
            const level = levels.size;
            if (!levels.has(level)) levels.set(level, []);
            levels.get(level).push(node);
          }
        });
        
        // Position nodes
        const levelHeight = 200;
        const nodeWidth = 300;
        
        levels.forEach((levelNodes, level) => {
          levelNodes.forEach((node, index) => {
            node.position = {
              x: (index - (levelNodes.length - 1) / 2) * nodeWidth,
              y: level * levelHeight
            };
          });
        });
        break;
      }
      
      case 'circular': {
        const radius = Math.min(400, Math.max(200, nodesCopy.length * 40));
        const center = { x: 0, y: 0 };
        
        nodesCopy.forEach((node, index) => {
          const angle = (2 * Math.PI * index) / nodesCopy.length - Math.PI / 2;
          node.position = {
            x: center.x + radius * Math.cos(angle),
            y: center.y + radius * Math.sin(angle)
          };
        });
        break;
      }
      
      case 'grid': {
        const cols = Math.ceil(Math.sqrt(nodesCopy.length));
        const nodeSpacing = 300;
        
        nodesCopy.forEach((node, index) => {
          const row = Math.floor(index / cols);
          const col = index % cols;
          node.position = {
            x: col * nodeSpacing,
            y: row * nodeSpacing
          };
        });
        break;
      }
      default:
        break;
    }
    
    return nodesCopy;
  }, []);

  // Build nodes and edges from people data
  useEffect(() => {
    console.log('=== RelationshipDiagram: Building diagram ===');
    console.log('People count:', people.length);
    console.log('Layout type:', layoutType);
    
    const newNodes = [];
    const newEdges = [];
    const edgeMap = new Map(); // To track and avoid duplicate edges
    
    // Create nodes for each person
    people.forEach(person => {
      const nodeId = `person-${person.id}`;
      const node = {
        id: nodeId,
        type: 'person',
        position: { x: 0, y: 0 },
        data: {
          label: getFullName(person),
          category: person.category,
          status: person.status,
          caseName: person.case_name,
          profilePicture: person.profile_picture_url,
          personId: person.id,
          raw: person
        }
      };
      
      newNodes.push(node);
      console.log(`Created node: ${nodeId} - ${node.data.label}`);
    });
    
    // Create edges from connections
    people.forEach(person => {
      if (!person.connections || !Array.isArray(person.connections)) {
        return;
      }
      
      console.log(`Processing connections for ${person.id} - ${getFullName(person)}: ${person.connections.length} connections`);
      
      person.connections.forEach((connection, idx) => {
        // Validate connection — person_id: null must be skipped too (issue #56)
        if (!connection || connection.person_id == null) {
          console.warn(`Invalid connection at index ${idx} for person ${person.id}`);
          return;
        }
        
        const targetPersonId = connection.person_id;
        const targetPerson = people.find(p => p.id === targetPersonId);
        
        if (!targetPerson) {
          console.warn(`Target person ${targetPersonId} not found for connection from ${person.id}`);
          return;
        }
        
        const sourceNodeId = `person-${person.id}`;
        const targetNodeId = `person-${targetPersonId}`;
        
        // Create unique edge key to avoid duplicates. String sort, not
        // Math.min/max — business entity ids are strings ('business-5'),
        // which would collapse every ownership edge into one 'NaN-NaN' key.
        const edgeKey = [String(person.id), String(targetPersonId)].sort().join('~');
        
        if (!edgeMap.has(edgeKey)) {
          const style = edgeStyles[connection.type] || edgeStyles.other;
          const edge = {
            id: `edge-${person.id}-to-${targetPersonId}`,
            source: sourceNodeId,
            target: targetNodeId,
            type: 'smoothstep',
            animated: connection.type === 'suspect',
            label: connection.note || style.label,
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
              stroke: style.stroke,
              strokeWidth: style.strokeWidth,
              strokeDasharray: style.strokeDasharray || '0',
              cursor: 'pointer'
            },
            markerEnd: {
              type: MarkerType.ArrowClosed,
              color: style.stroke,
              width: 15,
              height: 15
            },
            data: {
              type: connection.type,
              note: connection.note,
              sourcePersonId: person.id,
              targetPersonId: targetPersonId
            }
          };
          
          newEdges.push(edge);
          edgeMap.set(edgeKey, edge);
          console.log(`Created edge: ${edge.id} (${connection.type})`);
        } else {
          console.log(`Skipping duplicate edge: ${edgeKey}`);
        }
      });
    });
    
    // Transaction/venue layer: businesses & properties as hubs, edges to parties.
    if (showTransactionLayer && txData.length > 0) {
      const nodeIds = new Set(newNodes.map(n => n.id));
      const ensureEntity = (kind, id, label) => {
        const nid = `${kind === 'business' ? 'biz' : 'prop'}-${id}`;
        if (!nodeIds.has(nid)) {
          newNodes.push({ id: nid, type: 'entity', position: { x: 0, y: 0 }, data: { label: label || `${kind} #${id}`, kind, eventCount: 0 } });
          nodeIds.add(nid);
        }
        return nid;
      };
      const txEdgeMap = new Map();
      txData.forEach(t => {
        const hubs = [];
        if (t.location_business_id) hubs.push(ensureEntity('business', t.location_business_id, t.resolved_location?.label));
        if (t.location_property_id) hubs.push(ensureEntity('property', t.location_property_id, t.resolved_location?.label));
        if (t.subject_business_id) hubs.push(ensureEntity('business', t.subject_business_id, t.resolved_subject?.label));
        if (t.subject_property_id) hubs.push(ensureEntity('property', t.subject_property_id, t.resolved_subject?.label));
        if (hubs.length === 0) return;
        const spokes = [];
        [t.resolved_from, t.resolved_to].forEach(party => {
          if (!party) return;
          if (party.type === 'person') { const nid = `person-${party.id}`; if (nodeIds.has(nid)) spokes.push(nid); }
          else if (party.type === 'business') spokes.push(ensureEntity('business', party.id, party.label));
        });
        hubs.forEach(hub => {
          const hubNode = newNodes.find(n => n.id === hub);
          if (hubNode) hubNode.data.eventCount = (hubNode.data.eventCount || 0) + 1;
          spokes.forEach(spoke => {
            if (spoke === hub) return;
            const key = `${hub}|${spoke}`;
            txEdgeMap.set(key, (txEdgeMap.get(key) || 0) + 1);
          });
        });
      });
      txEdgeMap.forEach((count, key) => {
        const [hub, spoke] = key.split('|');
        newEdges.push({
          id: `txedge-${hub}-${spoke}`, source: hub, target: spoke, type: 'straight',
          label: count > 1 ? String(count) : undefined,
          style: { stroke: '#0891b2', strokeWidth: Math.min(8, 1 + count), strokeDasharray: '4 3', cursor: 'default' },
          labelStyle: { fontSize: 10, fill: '#0e7490' },
          data: { txLayer: true },
        });
      });
    }

    console.log(`Total nodes created: ${newNodes.length}`);
    console.log(`Total edges created: ${newEdges.length}`);

    // Apply layout
    const layoutedNodes = applyLayout(newNodes, newEdges, layoutType);
    
    // Set the nodes and edges
    setNodes(layoutedNodes);
    setEdges(newEdges);
    
  }, [people, layoutType, setNodes, setEdges, applyLayout, showTransactionLayer, txData, edgeStyles, getFullName]);

  // Handle connection creation
  const onConnect = useCallback((params) => {
    console.log('onConnect called:', params);
    
    if (!params.source || !params.target) return;
    
    const sourcePersonId = parseInt(params.source.replace('person-', ''));
    const targetPersonId = parseInt(params.target.replace('person-', ''));
    
    if (isNaN(sourcePersonId) || isNaN(targetPersonId)) {
      console.error('Invalid person IDs:', sourcePersonId, targetPersonId);
      return;
    }
    
    const sourcePerson = people.find(p => p.id === sourcePersonId);
    const targetPerson = people.find(p => p.id === targetPersonId);
    
    if (sourcePerson && targetPerson) {
      setConnectionModal({
        sourceId: sourcePersonId,
        targetId: targetPersonId,
        sourceName: getFullName(sourcePerson),
        targetName: getFullName(targetPerson)
      });
    }
  }, [people, getFullName]);

  // Handle node click
  const onNodeClick = useCallback((event, node) => {
    console.log('Node clicked:', node);
    
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
  const createConnection = useCallback(() => {
    if (selectedNodes.length === 2) {
      const sourceId = parseInt(selectedNodes[0].replace('person-', ''));
      const targetId = parseInt(selectedNodes[1].replace('person-', ''));
      
      const sourcePerson = people.find(p => p.id === sourceId);
      const targetPerson = people.find(p => p.id === targetId);
      
      if (sourcePerson && targetPerson) {
        setConnectionModal({
          sourceId,
          targetId,
          sourceName: getFullName(sourcePerson),
          targetName: getFullName(targetPerson)
        });
      }
    }
  }, [selectedNodes, people, getFullName]);

  // Save connection
  const saveConnection = useCallback(async () => {
    if (connectionModal && onUpdateConnection) {
      console.log('Saving connection:', connectionModal);
      
      await onUpdateConnection(
        connectionModal.sourceId,
        connectionModal.targetId,
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

  // Handle edge click
  const onEdgeClick = useCallback((event, edge) => {
    console.log('Edge clicked:', edge);
    event.stopPropagation();

    if (!edge.data || edge.data.txLayer) return;

    // Ownership edges are derived from the business record, not a person
    // connection — deleting them here would silently fail
    if (edge.data.type === 'owner' || typeof edge.data.sourcePersonId !== 'number') {
      alert(t('relationshipDiagram.ownershipManagedElsewhere'));
      return;
    }

    const confirmed = window.confirm(
      t('relationshipDiagram.confirmDeleteConnection', {
        source: edge.source,
        target: edge.target,
        type: edge.data.type || t('relationshipDiagram.unknown'),
        note: edge.data.note || t('relationshipDiagram.noneNote'),
      })
    );
    
    if (confirmed && onDeleteConnection) {
      onDeleteConnection(edge.data.sourcePersonId, edge.data.targetPersonId);
    }
  }, [onDeleteConnection, t]);

  return (
    <div className="h-full w-full relative" style={{ minHeight: '400px' }}>
      {/* Toolbar */}
      <div className="absolute top-4 left-4 z-10 bg-white dark:bg-slate-800 rounded-lg shadow-lg p-3 space-y-2">
        <div className="flex items-center space-x-2">
          <button
            onClick={() => setShowDebug(!showDebug)}
            className={`px-3 py-2 rounded-md text-sm font-medium flex items-center space-x-2 ${
              showDebug ? 'bg-orange-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
            title={t('relationshipDiagram.toggleDebugPanel')}
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
            <span>{isAddingConnection ? t('common.cancel') : t('relationshipDiagram.addConnection')}</span>
          </button>

          {isAddingConnection && selectedNodes.length === 2 && (
            <button
              onClick={createConnection}
              className="px-3 py-2 bg-green-600 text-white rounded-md text-sm font-medium flex items-center space-x-2 hover:bg-green-700"
            >
              <Link className="w-4 h-4" />
              <span>{t('relationshipDiagram.connect')}</span>
            </button>
          )}

          <button
            onClick={() => setShowTransactionLayer(v => !v)}
            className={`px-3 py-2 rounded-md text-sm font-medium flex items-center space-x-2 ${showTransactionLayer ? 'bg-cyan-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
            title={t('relationshipDiagram.toggleTransactionLayer')}
          >
            <Network className="w-4 h-4" />
            <span>{showTransactionLayer ? t('relationshipDiagram.hideVenues') : t('relationshipDiagram.showVenues')}</span>
          </button>
        </div>

        {isAddingConnection && (
          <div className="text-sm text-gray-600 dark:text-gray-400">
            {selectedNodes.length === 0 && t('relationshipDiagram.clickTwoPeople')}
            {selectedNodes.length === 1 && t('relationshipDiagram.selectOneMore')}
            {selectedNodes.length === 2 && t('relationshipDiagram.clickConnectToCreate')}
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
          className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-slate-600 rounded-md"
        >
          <option value="hierarchical">{t('relationshipDiagram.hierarchicalLayout')}</option>
          <option value="circular">{t('relationshipDiagram.circularLayout')}</option>
          <option value="grid">{t('relationshipDiagram.gridLayout')}</option>
        </select>

        <div className="text-xs text-gray-500 dark:text-slate-400 space-y-1">
          <div>{t('relationshipDiagram.nodesLabel', { count: nodes.length })}</div>
          <div>{t('relationshipDiagram.connectionsLabel', { count: edges.length })}</div>
        </div>
      </div>

      {/* Legend */}
      <div className="absolute top-4 right-4 z-10 bg-white dark:bg-slate-800 rounded-lg shadow-lg p-3">
        <h4 className="text-sm font-semibold mb-2">{t('relationshipDiagram.connectionTypesTitle')}</h4>
        <div className="space-y-1">
          {Object.entries(edgeStyles).map(([type, style]) => (
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
              <span className="text-xs text-gray-600 dark:text-gray-400">{style.label}</span>
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
        onConnect={isAddingConnection ? onConnect : undefined}
        onNodeClick={onNodeClick}
        onEdgeClick={onEdgeClick}
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
        className="bg-gray-50 dark:bg-slate-900"
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
      <DebugPanel 
        people={people} 
        nodes={nodes} 
        edges={edges} 
        show={showDebug} 
      />

      {/* Connection Modal */}
      {connectionModal && (
        <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center z-20">
          <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl p-6 w-96">
            <h3 className="text-lg font-semibold mb-4">{t('relationshipDiagram.createConnectionTitle')}</h3>

            <div className="mb-4">
              <p className="text-sm text-gray-600 dark:text-slate-400 mb-2">
                {t('relationshipDiagram.connectingLabel')} <span className="font-medium">{connectionModal.sourceName}</span> → <span className="font-medium">{connectionModal.targetName}</span>
              </p>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">
                {t('relationshipDiagram.relationshipTypeLabel')}
              </label>
              <select
                value={connectionType}
                onChange={(e) => setConnectionType(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-md"
              >
                {Object.entries(edgeStyles).map(([type, style]) => (
                  <option key={type} value={type}>{style.label}</option>
                ))}
              </select>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">
                {t('personForm.notesOptionalPlaceholder')}
              </label>
              <textarea
                value={connectionNote}
                onChange={(e) => setConnectionNote(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-md"
                rows="3"
                placeholder={t('relationshipDiagram.notesPlaceholder')}
              />
            </div>

            <div className="flex justify-end space-x-2">
              <button
                onClick={() => {
                  setConnectionModal(null);
                  setConnectionType('associate');
                  setConnectionNote('');
                }}
                className="px-4 py-2 text-gray-700 dark:text-slate-300 bg-gray-100 dark:bg-slate-700 rounded-md hover:bg-gray-200"
              >
                {t('common.cancel')}
              </button>
              <button
                onClick={saveConnection}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
              >
                {t('relationshipDiagram.saveConnection')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RelationshipDiagram;