// File: backend/routes/entityNetwork.js
const express = require('express');
const router = express.Router();
const { pool } = require('../config/database');

// Entity relationships endpoints
router.get('/entity-relationships', async (req, res) => {
  try {
    // Extract relationships from people connections
    const peopleResult = await pool.query(`
      SELECT id, first_name, last_name, connections 
      FROM people 
      WHERE connections IS NOT NULL AND connections != '[]'::jsonb
    `);
    
    const relationships = [];
    
    peopleResult.rows.forEach(person => {
      const connections = person.connections || [];
      connections.forEach(connection => {
        relationships.push({
          id: `${person.id}-${connection.person_id}-${connection.type}`,
          source_type: 'person',
          source_id: person.id,
          target_type: 'person',
          target_id: connection.person_id,
          relationship_type: connection.type,
          note: connection.note,
          confidence_score: 90 // Default confidence
        });
      });
    });
    
    res.json(relationships);
  } catch (err) {
    console.error('Error fetching entity relationships:', err);
    res.status(500).json({ error: 'Failed to fetch entity relationships' });
  }
});

router.post('/entity-relationships', async (req, res) => {
  try {
    const { source_type, source_id, target_type, target_id, relationship_type, note } = req.body;
    
    if (source_type === 'person' && target_type === 'person') {
      // Get the source person
      const sourceResult = await pool.query('SELECT * FROM people WHERE id = $1', [source_id]);
      if (sourceResult.rows.length === 0) {
        return res.status(404).json({ error: 'Source person not found' });
      }
      
      const sourcePerson = sourceResult.rows[0];
      const connections = sourcePerson.connections || [];
      
      // Check if connection already exists
      const existingIndex = connections.findIndex(c => c.person_id === target_id);
      
      if (existingIndex >= 0) {
        // Update existing connection
        connections[existingIndex] = { person_id: target_id, type: relationship_type, note };
      } else {
        // Add new connection
        connections.push({ person_id: target_id, type: relationship_type, note });
      }
      
      // Update the person's connections
      await pool.query(
        'UPDATE people SET connections = $1 WHERE id = $2',
        [JSON.stringify(connections), source_id]
      );
      
      res.status(201).json({ message: 'Relationship created successfully' });
    } else {
      res.status(501).json({ error: 'Only person-to-person relationships are currently supported' });
    }
  } catch (err) {
    console.error('Error creating entity relationship:', err);
    res.status(500).json({ error: 'Failed to create entity relationship' });
  }
});

router.delete('/entity-relationships/:id', async (req, res) => {
  try {
    // Parse the relationship ID to extract source_id, target_id, and type
    const parts = req.params.id.split('-');
    if (parts.length < 3) {
      return res.status(400).json({ error: 'Invalid relationship ID format' });
    }
    
    const source_id = parseInt(parts[0]);
    const target_id = parseInt(parts[1]);
    const relationship_type = parts.slice(2).join('-');
    
    // Get the source person
    const sourceResult = await pool.query('SELECT * FROM people WHERE id = $1', [source_id]);
    if (sourceResult.rows.length === 0) {
      return res.status(404).json({ error: 'Source person not found' });
    }
    
    const sourcePerson = sourceResult.rows[0];
    const connections = sourcePerson.connections || [];
    
    // Remove the connection
    const updatedConnections = connections.filter(c => 
      !(c.person_id === target_id && c.type === relationship_type)
    );
    
    // Update the person's connections
    await pool.query(
      'UPDATE people SET connections = $1 WHERE id = $2',
      [JSON.stringify(updatedConnections), source_id]
    );
    
    res.json({ message: 'Relationship deleted successfully' });
  } catch (err) {
    console.error('Error deleting entity relationship:', err);
    res.status(500).json({ error: 'Failed to delete entity relationship' });
  }
});

// Relationship types endpoint
router.get('/relationship-types', async (req, res) => {
  try {
    // Get relationship types from model_options
    const result = await pool.query(`
      SELECT option_value as value, option_label as label
      FROM model_options 
      WHERE model_type = 'connection_type' AND is_active = true
      ORDER BY display_order
    `);
    
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching relationship types:', err);
    res.status(500).json({ error: 'Failed to fetch relationship types' });
  }
});

// Entity network endpoint - builds a network graph from people and their connections
router.get('/entity-network', async (req, res) => {
  try {
    const { entity_type, entity_id } = req.query;
    
    // Get all people with their connections
    const peopleQuery = `
      SELECT id, first_name, last_name, category, status, case_name, 
             profile_picture_url, connections, locations, created_at
      FROM people 
      ORDER BY created_at DESC
    `;
    
    const peopleResult = await pool.query(peopleQuery);
    const people = peopleResult.rows;
    
    const nodes = [];
    const edges = [];
    const nodeMap = new Map();
    
    // Create nodes for each person
    people.forEach(person => {
      const nodeId = `person-${person.id}`;
      const fullName = `${person.first_name} ${person.last_name || ''}`.trim();
      
      const node = {
        id: nodeId,
        type: 'person',
        data: {
          id: person.id,
          label: fullName,
          category: person.category,
          status: person.status,
          case_name: person.case_name,
          profile_picture_url: person.profile_picture_url,
          entity_type: 'person',
          entity_id: person.id
        },
        position: { x: 0, y: 0 }
      };
      
      nodes.push(node);
      nodeMap.set(nodeId, node);
    });
    
    // Create location nodes from person locations
    people.forEach(person => {
      const locations = person.locations || [];
      locations.forEach((location, index) => {
        if (location.city || location.country) {
          const locationId = `location-${person.id}-${index}`;
          const locationName = [location.city, location.country].filter(Boolean).join(', ');
          
          const locationNode = {
            id: locationId,
            type: 'location',
            data: {
              label: locationName,
              location_type: location.type,
              address: location.address,
              entity_type: 'location',
              latitude: location.latitude,
              longitude: location.longitude
            },
            position: { x: 0, y: 0 }
          };
          
          nodes.push(locationNode);
          
          // Create edge from person to location
          edges.push({
            id: `edge-person-${person.id}-to-${locationId}`,
            source: `person-${person.id}`,
            target: locationId,
            type: 'location',
            data: {
              relationship_type: 'located_at',
              confidence_score: 85
            }
          });
        }
      });
    });
    
    // Create edges from person connections
    people.forEach(person => {
      const connections = person.connections || [];
      connections.forEach(connection => {
        const targetNodeId = `person-${connection.person_id}`;
        
        // Only create edge if target node exists
        if (nodeMap.has(targetNodeId)) {
          const edgeId = `edge-person-${person.id}-to-person-${connection.person_id}`;
          
          edges.push({
            id: edgeId,
            source: `person-${person.id}`,
            target: targetNodeId,
            type: connection.type || 'associate',
            label: connection.note || connection.type,
            data: {
              relationship_type: connection.type,
              note: connection.note,
              confidence_score: 90
            }
          });
        }
      });
    });
    
    // If filtering by specific entity, return a subset focused on that entity
    if (entity_type && entity_id) {
      const focusNodeId = `${entity_type}-${entity_id}`;
      const focusNode = nodeMap.get(focusNodeId);
      
      if (focusNode) {
        // Get directly connected nodes
        const connectedNodeIds = new Set([focusNodeId]);
        
        edges.forEach(edge => {
          if (edge.source === focusNodeId) {
            connectedNodeIds.add(edge.target);
          } else if (edge.target === focusNodeId) {
            connectedNodeIds.add(edge.source);
          }
        });
        
        // Filter nodes and edges
        const filteredNodes = nodes.filter(node => connectedNodeIds.has(node.id));
        const filteredEdges = edges.filter(edge => 
          connectedNodeIds.has(edge.source) && connectedNodeIds.has(edge.target)
        );
        
        return res.json({ nodes: filteredNodes, edges: filteredEdges });
      }
    }
    
    res.json({ nodes, edges });
  } catch (err) {
    console.error('Error building entity network:', err);
    res.status(500).json({ error: 'Failed to build entity network' });
  }
});

module.exports = router;