// File: frontend/src/components/visualization/ObsidianGraph.js
// Obsidian-style force-directed graph visualization using D3.js

import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as d3 from 'd3';
import {
  ZoomIn, ZoomOut, Maximize2, Minimize2, Users, Building2,
  Target, Circle, Square, Triangle, X, Info, Edit, Trash2, Link as LinkIcon
} from 'lucide-react';

const ObsidianGraph = ({
  people = [],
  selectedPersonId = null,
  onNodeClick = null,
  onUpdateConnection = null,
  onDeleteConnection = null,
  layoutType = 'force'
}) => {
  const svgRef = useRef(null);
  const containerRef = useRef(null);
  const simulationRef = useRef(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
  const [selectedNode, setSelectedNode] = useState(null);
  const [showNodeDetails, setShowNodeDetails] = useState(false);
  const [contextMenu, setContextMenu] = useState(null);
  const [connectionMode, setConnectionMode] = useState(false);
  const [sourceNode, setSourceNode] = useState(null);
  const [stats, setStats] = useState({ nodes: 0, edges: 0, clusters: 0 });

  // Theme colors (Obsidian-inspired dark theme)
  const theme = {
    background: '#1e1e1e',
    node: {
      default: '#4c51bf',
      person: '#667eea',
      business: '#48bb78',
      selected: '#f6ad55',
      hover: '#fc8181',
      text: '#ffffff'
    },
    edge: {
      family: '#10b981',
      friend: '#3b82f6',
      enemy: '#ef4444',
      associate: '#6b7280',
      employer: '#8b5cf6',
      suspect: '#ef4444',
      witness: '#f59e0b',
      victim: '#ec4899',
      other: '#6b7280'
    },
    grid: '#2d3748',
    text: '#e2e8f0'
  };

  // Prepare graph data
  const prepareGraphData = useCallback(() => {
    const nodes = [];
    const links = [];
    const nodeMap = new Map();

    // Create nodes
    people.forEach(person => {
      const nodeId = person.type === 'business' ? person.id : person.id.toString();
      const node = {
        id: nodeId,
        name: `${person.first_name || ''} ${person.last_name || ''}`.trim() || 'Unknown',
        category: person.category || 'Unknown',
        status: person.status,
        caseName: person.case_name,
        type: person.type || 'person',
        connections: person.connections || [],
        data: person
      };

      nodes.push(node);
      nodeMap.set(nodeId, node);
    });

    // Create edges from connections
    people.forEach(person => {
      const sourceId = person.type === 'business' ? person.id : person.id.toString();

      if (person.connections && Array.isArray(person.connections)) {
        person.connections.forEach(conn => {
          const targetId = conn.person_id.toString();

          // Only add edge if target exists
          if (nodeMap.has(targetId)) {
            links.push({
              source: sourceId,
              target: targetId,
              type: conn.type || 'other',
              note: conn.note || '',
              strength: getConnectionStrength(conn.type)
            });
          }
        });
      }
    });

    return { nodes, links };
  }, [people]);

  // Get connection strength for force simulation
  const getConnectionStrength = (type) => {
    const strengths = {
      family: 1.5,
      friend: 1.2,
      enemy: 0.5,
      associate: 1.0,
      employer: 1.3,
      suspect: 1.4,
      witness: 1.1,
      victim: 1.0,
      other: 0.8
    };
    return strengths[type] || 1.0;
  };

  // Get node size based on connections
  const getNodeSize = (node) => {
    const baseSize = 8;
    const connectionCount = node.connections?.length || 0;
    return baseSize + Math.min(connectionCount * 2, 20);
  };

  // Get node color (without hover - handled by D3 directly)
  const getNodeColor = (node, isSelected) => {
    if (isSelected) return theme.node.selected;
    if (node.type === 'business') return theme.node.business;

    // Color by category
    const categoryColors = {
      'Person of Interest': '#ef4444',
      'Client': '#10b981',
      'Witness': '#f59e0b',
      'Victim': '#ec4899',
      'Suspect': '#dc2626',
      'Business': theme.node.business
    };

    return categoryColors[node.category] || theme.node.person;
  };

  // Handle resize
  useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current) {
        const { width, height } = containerRef.current.getBoundingClientRect();
        setDimensions({ width, height });
      }
    };

    updateDimensions();
    window.addEventListener('resize', updateDimensions);
    return () => window.removeEventListener('resize', updateDimensions);
  }, []);

  // Initialize and update graph
  useEffect(() => {
    if (!svgRef.current || dimensions.width === 0) return;

    const { nodes, links } = prepareGraphData();

    // Update stats
    setStats({
      nodes: nodes.length,
      edges: links.length,
      clusters: new Set(nodes.map(n => n.category)).size
    });

    // Clear previous graph
    d3.select(svgRef.current).selectAll('*').remove();

    const svg = d3.select(svgRef.current);
    const width = dimensions.width;
    const height = dimensions.height;

    // Create zoom behavior
    const zoom = d3.zoom()
      .scaleExtent([0.1, 4])
      .on('zoom', (event) => {
        g.attr('transform', event.transform);
      });

    svg.call(zoom);

    // Main group for zoom/pan
    const g = svg.append('g');

    // Create force simulation
    const simulation = d3.forceSimulation(nodes)
      .force('link', d3.forceLink(links)
        .id(d => d.id)
        .distance(d => 100 / d.strength)
        .strength(d => d.strength * 0.3)
      )
      .force('charge', d3.forceManyBody()
        .strength(-300)
        .distanceMax(400)
      )
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collision', d3.forceCollide().radius(d => getNodeSize(d) + 10))
      .force('x', d3.forceX(width / 2).strength(0.05))
      .force('y', d3.forceY(height / 2).strength(0.05));

    // Create arrow markers for directed edges
    const defs = svg.append('defs');

    Object.keys(theme.edge).forEach(type => {
      defs.append('marker')
        .attr('id', `arrow-${type}`)
        .attr('viewBox', '0 -5 10 10')
        .attr('refX', 20)
        .attr('refY', 0)
        .attr('markerWidth', 6)
        .attr('markerHeight', 6)
        .attr('orient', 'auto')
        .append('path')
        .attr('d', 'M0,-5L10,0L0,5')
        .attr('fill', theme.edge[type]);
    });

    // Create edges
    const link = g.append('g')
      .selectAll('line')
      .data(links)
      .join('line')
      .attr('stroke', d => theme.edge[d.type] || theme.edge.other)
      .attr('stroke-width', 2)
      .attr('stroke-opacity', 0.6)
      .attr('marker-end', d => `url(#arrow-${d.type})`)
      .style('cursor', 'pointer')
      .on('mouseover', function(event, d) {
        d3.select(this)
          .attr('stroke-width', 4)
          .attr('stroke-opacity', 1);

        // Show edge tooltip
        const tooltip = g.append('text')
          .attr('class', 'edge-tooltip')
          .attr('x', (d.source.x + d.target.x) / 2)
          .attr('y', (d.source.y + d.target.y) / 2)
          .attr('text-anchor', 'middle')
          .attr('fill', theme.text)
          .attr('font-size', '12px')
          .attr('font-weight', 'bold')
          .style('pointer-events', 'none')
          .text(d.type);
      })
      .on('mouseout', function() {
        d3.select(this)
          .attr('stroke-width', 2)
          .attr('stroke-opacity', 0.6);
        g.selectAll('.edge-tooltip').remove();
      });

    // Create node groups
    const node = g.append('g')
      .selectAll('g')
      .data(nodes)
      .join('g')
      .call(d3.drag()
        .on('start', dragStarted)
        .on('drag', dragged)
        .on('end', dragEnded))
      .on('click', handleNodeClick)
      .on('contextmenu', handleContextMenu);

    // Add circles for nodes
    const circles = node.append('circle')
      .attr('r', d => getNodeSize(d))
      .attr('fill', d => getNodeColor(d, selectedNode?.id === d.id))
      .attr('stroke', '#fff')
      .attr('stroke-width', 2)
      .style('cursor', 'pointer')
      .on('mouseover', function(event, d) {
        // Handle hover with D3 directly - no React state
        d3.select(this)
          .transition()
          .duration(200)
          .attr('stroke-width', 4)
          .attr('r', getNodeSize(d) + 3);
      })
      .on('mouseout', function(event, d) {
        d3.select(this)
          .transition()
          .duration(200)
          .attr('stroke-width', 2)
          .attr('r', getNodeSize(d));
      });

    // Add icons for node types
    node.each(function(d) {
      const nodeGroup = d3.select(this);
      const size = getNodeSize(d);

      // Add text label
      nodeGroup.append('text')
        .attr('dy', size + 15)
        .attr('text-anchor', 'middle')
        .attr('fill', theme.text)
        .attr('font-size', '11px')
        .attr('font-weight', '500')
        .style('pointer-events', 'none')
        .text(d.name.length > 20 ? d.name.substring(0, 18) + '...' : d.name);

      // Add connection count badge
      const connectionCount = d.connections?.length || 0;
      if (connectionCount > 0) {
        nodeGroup.append('circle')
          .attr('cx', size - 2)
          .attr('cy', -size + 2)
          .attr('r', 8)
          .attr('fill', '#3b82f6')
          .attr('stroke', '#fff')
          .attr('stroke-width', 1);

        nodeGroup.append('text')
          .attr('x', size - 2)
          .attr('y', -size + 2)
          .attr('dy', '0.35em')
          .attr('text-anchor', 'middle')
          .attr('fill', '#fff')
          .attr('font-size', '9px')
          .attr('font-weight', 'bold')
          .style('pointer-events', 'none')
          .text(connectionCount);
      }
    });

    // Update positions on simulation tick
    simulation.on('tick', () => {
      link
        .attr('x1', d => d.source.x)
        .attr('y1', d => d.source.y)
        .attr('x2', d => d.target.x)
        .attr('y2', d => d.target.y);

      node.attr('transform', d => `translate(${d.x},${d.y})`);
    });

    // Drag functions
    function dragStarted(event, d) {
      if (!event.active) simulation.alphaTarget(0.3).restart();
      d.fx = d.x;
      d.fy = d.y;
    }

    function dragged(event, d) {
      d.fx = event.x;
      d.fy = event.y;
    }

    function dragEnded(event, d) {
      if (!event.active) simulation.alphaTarget(0);
      d.fx = null;
      d.fy = null;
    }

    function handleNodeClick(event, d) {
      event.stopPropagation();
      setSelectedNode(d);
      setShowNodeDetails(true);
      if (onNodeClick) onNodeClick(d.data);

      if (connectionMode) {
        if (!sourceNode) {
          setSourceNode(d);
        } else if (sourceNode.id !== d.id) {
          // Create connection
          handleCreateConnection(sourceNode, d);
          setConnectionMode(false);
          setSourceNode(null);
        }
      }
    }

    function handleContextMenu(event, d) {
      event.preventDefault();
      event.stopPropagation();

      setContextMenu({
        x: event.pageX,
        y: event.pageY,
        node: d
      });
    }

    // Center on selected person
    if (selectedPersonId) {
      const selectedNodeData = nodes.find(n => n.id === selectedPersonId.toString());
      if (selectedNodeData) {
        const transform = d3.zoomIdentity
          .translate(width / 2, height / 2)
          .scale(1.5)
          .translate(-selectedNodeData.x, -selectedNodeData.y);

        svg.transition()
          .duration(750)
          .call(zoom.transform, transform);
      }
    }

    // Store simulation reference
    simulationRef.current = simulation;

    // Cleanup
    return () => {
      simulation.stop();
    };
  }, [dimensions, people, selectedPersonId, selectedNode, connectionMode, sourceNode, onNodeClick, prepareGraphData]);

  // Handle zoom controls
  const handleZoom = (direction) => {
    const svg = d3.select(svgRef.current);
    const zoom = d3.zoom();

    svg.transition()
      .duration(350)
      .call(zoom.scaleBy, direction === 'in' ? 1.3 : 0.7);
  };

  // Handle fit to view
  const handleFitView = () => {
    const svg = d3.select(svgRef.current);
    const zoom = d3.zoom();

    svg.transition()
      .duration(750)
      .call(zoom.transform, d3.zoomIdentity);
  };

  // Handle create connection
  const handleCreateConnection = (source, target) => {
    // This would open a modal to select connection type
    const type = prompt('Connection type (family, friend, associate, etc.):');
    if (type && onUpdateConnection) {
      onUpdateConnection(
        parseInt(source.id),
        parseInt(target.id),
        type,
        ''
      );
    }
  };

  return (
    <div ref={containerRef} className="relative w-full h-full bg-gray-900">
      {/* SVG Canvas */}
      <svg
        ref={svgRef}
        width={dimensions.width}
        height={dimensions.height}
        style={{ background: theme.background }}
        onClick={() => {
          setSelectedNode(null);
          setShowNodeDetails(false);
          setContextMenu(null);
        }}
      />

      {/* Controls */}
      <div className="absolute top-4 right-4 flex flex-col space-y-2 z-10">
        <button
          onClick={() => handleZoom('in')}
          className="p-2 bg-gray-800 hover:bg-gray-700 text-white rounded-lg shadow-lg transition"
          title="Zoom In"
        >
          <ZoomIn className="w-5 h-5" />
        </button>
        <button
          onClick={() => handleZoom('out')}
          className="p-2 bg-gray-800 hover:bg-gray-700 text-white rounded-lg shadow-lg transition"
          title="Zoom Out"
        >
          <ZoomOut className="w-5 h-5" />
        </button>
        <button
          onClick={handleFitView}
          className="p-2 bg-gray-800 hover:bg-gray-700 text-white rounded-lg shadow-lg transition"
          title="Fit to View"
        >
          <Maximize2 className="w-5 h-5" />
        </button>
        <button
          onClick={() => setConnectionMode(!connectionMode)}
          className={`p-2 ${connectionMode ? 'bg-blue-600' : 'bg-gray-800'} hover:bg-blue-700 text-white rounded-lg shadow-lg transition`}
          title="Add Connection"
        >
          <LinkIcon className="w-5 h-5" />
        </button>
      </div>

      {/* Stats Panel */}
      <div className="absolute top-4 left-4 bg-gray-800 bg-opacity-90 text-white rounded-lg shadow-lg p-3 z-10">
        <div className="flex items-center space-x-4 text-sm">
          <div className="flex items-center space-x-1">
            <Users className="w-4 h-4 text-blue-400" />
            <span>{stats.nodes} nodes</span>
          </div>
          <div className="flex items-center space-x-1">
            <LinkIcon className="w-4 h-4 text-green-400" />
            <span>{stats.edges} edges</span>
          </div>
          <div className="flex items-center space-x-1">
            <Circle className="w-4 h-4 text-purple-400" />
            <span>{stats.clusters} types</span>
          </div>
        </div>
      </div>

      {/* Connection Mode Banner */}
      {connectionMode && (
        <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 bg-blue-600 text-white px-6 py-3 rounded-lg shadow-lg z-10">
          <div className="flex items-center space-x-2">
            <LinkIcon className="w-5 h-5" />
            <span className="font-medium">
              {sourceNode ? `Click target node to connect to "${sourceNode.name}"` : 'Click source node to start connection'}
            </span>
            <button
              onClick={() => {
                setConnectionMode(false);
                setSourceNode(null);
              }}
              className="ml-4 p-1 hover:bg-blue-700 rounded"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Node Details Panel */}
      {showNodeDetails && selectedNode && (
        <div className="absolute top-20 right-4 bg-gray-800 bg-opacity-95 text-white rounded-lg shadow-xl p-4 w-64 z-20">
          <div className="flex items-start justify-between mb-3">
            <h3 className="font-bold text-lg">{selectedNode.name}</h3>
            <button
              onClick={() => setShowNodeDetails(false)}
              className="text-gray-400 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="space-y-2 text-sm">
            <div>
              <span className="text-gray-400">Type:</span>
              <span className="ml-2 font-medium">{selectedNode.type === 'business' ? 'Business' : 'Person'}</span>
            </div>

            <div>
              <span className="text-gray-400">Category:</span>
              <span className="ml-2 font-medium">{selectedNode.category}</span>
            </div>

            {selectedNode.status && (
              <div>
                <span className="text-gray-400">Status:</span>
                <span className="ml-2 font-medium">{selectedNode.status}</span>
              </div>
            )}

            {selectedNode.caseName && (
              <div>
                <span className="text-gray-400">Case:</span>
                <span className="ml-2 font-medium">{selectedNode.caseName}</span>
              </div>
            )}

            <div>
              <span className="text-gray-400">Connections:</span>
              <span className="ml-2 font-medium">{selectedNode.connections?.length || 0}</span>
            </div>
          </div>
        </div>
      )}

      {/* Context Menu */}
      {contextMenu && (
        <div
          className="absolute bg-gray-800 text-white rounded-lg shadow-xl py-1 z-30 min-w-[160px]"
          style={{ top: contextMenu.y, left: contextMenu.x }}
        >
          <button
            onClick={() => {
              if (onNodeClick) onNodeClick(contextMenu.node.data);
              setContextMenu(null);
            }}
            className="w-full px-4 py-2 hover:bg-gray-700 flex items-center space-x-2 text-left"
          >
            <Info className="w-4 h-4" />
            <span>View Details</span>
          </button>

          <button
            onClick={() => {
              setSourceNode(contextMenu.node);
              setConnectionMode(true);
              setContextMenu(null);
            }}
            className="w-full px-4 py-2 hover:bg-gray-700 flex items-center space-x-2 text-left"
          >
            <LinkIcon className="w-4 h-4" />
            <span>Add Connection</span>
          </button>

          <div className="border-t border-gray-700 my-1"></div>

          <button
            onClick={() => setContextMenu(null)}
            className="w-full px-4 py-2 hover:bg-gray-700 flex items-center space-x-2 text-left text-gray-400"
          >
            <X className="w-4 h-4" />
            <span>Close</span>
          </button>
        </div>
      )}

      {/* Legend */}
      <div className="absolute bottom-4 left-4 bg-gray-800 bg-opacity-90 text-white rounded-lg shadow-lg p-3 z-10 max-w-xs">
        <h4 className="font-bold text-sm mb-2">Connection Types</h4>
        <div className="grid grid-cols-2 gap-2 text-xs">
          {Object.entries(theme.edge).map(([type, color]) => (
            <div key={type} className="flex items-center space-x-2">
              <div className="w-6 h-0.5" style={{ backgroundColor: color }}></div>
              <span className="capitalize">{type}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default ObsidianGraph;
