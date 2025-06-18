// File: frontend/src/components/SimpleEntityNetwork.js
import React, { useState, useEffect, useCallback } from 'react';
import ReactFlow, {
  MiniMap,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  Handle,
  Position,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { User, Building2, MapPin, RefreshCw, Network } from 'lucide-react';

// Simple node components
const PersonNode = ({ data }) => (
  <div className="px-4 py-3 shadow-lg rounded-lg border-2 border-blue-300 bg-white min-w-[160px]">
    <Handle type="target" position={Position.Top} />
    <div className="flex items-center space-x-2">
      <User className="w-5 h-5 text-blue-600" />
      <div>
        <div className="text-sm font-medium text-gray-900">{data.label}</div>
        <div className="text-xs text-gray-500">{data.category || 'Person'}</div>
      </div>
    </div>
    <Handle type="source" position={Position.Bottom} />
  </div>
);

const BusinessNode = ({ data }) => (
  <div className="px-4 py-3 shadow-lg rounded-lg border-2 border-green-300 bg-white min-w-[160px]">
    <Handle type="target" position={Position.Top} />
    <div className="flex items-center space-x-2">
      <Building2 className="w-5 h-5 text-green-600" />
      <div>
        <div className="text-sm font-medium text-gray-900">{data.label}</div>
        <div className="text-xs text-gray-500">{data.type || 'Business'}</div>
      </div>
    </div>
    <Handle type="source" position={Position.Bottom} />
  </div>
);

const LocationNode = ({ data }) => (
  <div className="px-3 py-2 shadow-lg rounded-lg border-2 border-purple-300 bg-white min-w-[140px]">
    <Handle type="target" position={Position.Top} />
    <div className="flex items-center space-x-2">
      <MapPin className="w-4 h-4 text-purple-600" />
      <div>
        <div className="text-sm font-medium text-gray-900">{data.label}</div>
        <div className="text-xs text-gray-500">Location</div>
      </div>
    </div>
    <Handle type="source" position={Position.Bottom} />
  </div>
);

const nodeTypes = {
  person: PersonNode,
  business: BusinessNode,
  location: LocationNode,
};

const SimpleEntityNetwork = () => {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchEntityNetwork = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      console.log('Fetching entity network...');
      const response = await fetch('/api/entity-network');
      
      if (!response.ok) {
        throw new Error(`Failed to fetch entity network: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json();
      console.log('Entity network data:', data);
      
      if (!data.nodes || !data.edges) {
        throw new Error('Invalid data format received');
      }

      // Apply simple layout
      const layoutedNodes = data.nodes.map((node, index) => {
        const angle = (index / data.nodes.length) * 2 * Math.PI;
        const radius = Math.max(200, data.nodes.length * 30);
        
        return {
          ...node,
          position: {
            x: Math.cos(angle) * radius,
            y: Math.sin(angle) * radius,
          },
        };
      });

      setNodes(layoutedNodes);
      setEdges(data.edges.map(edge => ({
        ...edge,
        type: 'smoothstep',
        animated: false,
        style: { stroke: '#94a3b8', strokeWidth: 2 },
      })));
      
    } catch (err) {
      console.error('Error fetching entity network:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchEntityNetwork();
  }, [fetchEntityNetwork]);

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center bg-gray-50 border border-gray-200 rounded-lg">
        <div className="text-center p-8">
          <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-2 text-blue-600" />
          <span className="text-gray-700 font-medium">Loading entity network...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-full flex items-center justify-center bg-gray-50 border border-gray-200 rounded-lg">
        <div className="text-center p-8">
          <div className="text-red-600 mb-4">Error: {error}</div>
          <button
            onClick={fetchEntityNetwork}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center mx-auto"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4 rounded-t-lg">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900">Entity Network</h1>
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2 text-sm text-gray-600">
              <Network className="w-4 h-4" />
              <span>{nodes.length} entities, {edges.length} connections</span>
            </div>
            <button
              onClick={fetchEntityNetwork}
              className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Network Container */}
      <div className="flex-1 bg-white border border-gray-200 rounded-b-lg overflow-hidden">
        {nodes.length === 0 ? (
          <div className="h-full flex items-center justify-center text-gray-500">
            <div className="text-center">
              <Network className="w-12 h-12 mx-auto mb-4 text-gray-300" />
              <p>No entities found</p>
              <p className="text-sm mt-2">Add people and businesses to see the entity network</p>
            </div>
          </div>
        ) : (
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            nodeTypes={nodeTypes}
            fitView
            fitViewOptions={{ padding: 0.3 }}
            style={{ width: '100%', height: '100%' }}
            minZoom={0.1}
            maxZoom={2}
            className="bg-gray-50"
          >
            <Background variant="dots" gap={12} size={1} />
            <Controls />
            <MiniMap 
              nodeStrokeWidth={3}
              zoomable
              pannable
              style={{
                height: 120,
                backgroundColor: '#f8fafc',
              }}
            />
          </ReactFlow>
        )}
      </div>
    </div>
  );
};

export default SimpleEntityNetwork;