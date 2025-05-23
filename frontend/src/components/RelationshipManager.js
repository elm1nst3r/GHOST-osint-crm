// File: frontend/src/components/RelationshipManager.js
import React, { useState, useEffect, useCallback } from 'react';
import RelationshipDiagram from './RelationshipDiagram'; // Import the diagram component
import { AlertCircle, Loader2, Network, Users, Eye, EyeOff, Maximize2 } from 'lucide-react';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';

const RelationshipManager = ({ 
  personId = null, // If provided, shows person-specific view
  showInModal = false, // If true, renders in a more compact way
  onClose = null // Callback for closing if in modal
}) => {
  const [people, setPeople] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showOsintData, setShowOsintData] = useState(false);
  const [layoutType, setLayoutType] = useState('hierarchical');
  const [fullScreen, setFullScreen] = useState(false);

  // Fetch people data
  const fetchPeople = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_BASE_URL}/people`);
      if (!response.ok) throw new Error('Failed to fetch people');
      const data = await response.json();
      setPeople(data);
      setError(null);
    } catch (err) {
      setError(err.message);
      console.error('Error fetching people:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPeople();
  }, [fetchPeople]);

  // Update connection between two people
  const updateConnection = useCallback(async (sourceId, targetId, type, note) => {
    try {
      // First, get the source person's current connections
      const sourcePerson = people.find(p => p.id === sourceId);
      if (!sourcePerson) throw new Error('Source person not found');

      const updatedConnections = [...(sourcePerson.connections || [])];
      
      // Check if connection already exists
      const existingIndex = updatedConnections.findIndex(
        conn => conn.person_id === targetId
      );

      if (existingIndex >= 0) {
        // Update existing connection
        updatedConnections[existingIndex] = {
          person_id: targetId,
          type,
          note,
          created_at: updatedConnections[existingIndex].created_at,
          updated_at: new Date().toISOString()
        };
      } else {
        // Add new connection
        updatedConnections.push({
          person_id: targetId,
          type,
          note,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });
      }

      // Update the source person
      const response = await fetch(`${API_BASE_URL}/people/${sourceId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...sourcePerson,
          connections: updatedConnections
        })
      });

      if (!response.ok) throw new Error('Failed to update connection');

      // Also update the target person's connections (bidirectional)
      const targetPerson = people.find(p => p.id === targetId);
      if (targetPerson) {
        const targetConnections = [...(targetPerson.connections || [])];
        const targetExistingIndex = targetConnections.findIndex(
          conn => conn.person_id === sourceId
        );

        if (targetExistingIndex >= 0) {
          targetConnections[targetExistingIndex] = {
            person_id: sourceId,
            type,
            note,
            created_at: targetConnections[targetExistingIndex].created_at,
            updated_at: new Date().toISOString()
          };
        } else {
          targetConnections.push({
            person_id: sourceId,
            type,
            note,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          });
        }

        await fetch(`${API_BASE_URL}/people/${targetId}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            ...targetPerson,
            connections: targetConnections
          })
        });
      }

      // Refresh data
      await fetchPeople();
      
      // Show success message (you might want to use a toast library)
      alert('Connection created successfully!');
    } catch (err) {
      console.error('Error updating connection:', err);
      alert('Failed to create connection: ' + err.message);
    }
  }, [people, fetchPeople]);

  // Delete connection
  const deleteConnection = useCallback(async (sourceId, targetId) => {
    try {
      // Update source person
      const sourcePerson = people.find(p => p.id === sourceId);
      if (!sourcePerson) throw new Error('Source person not found');

      const updatedConnections = (sourcePerson.connections || []).filter(
        conn => conn.person_id !== targetId
      );

      await fetch(`${API_BASE_URL}/people/${sourceId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...sourcePerson,
          connections: updatedConnections
        })
      });

      // Update target person
      const targetPerson = people.find(p => p.id === targetId);
      if (targetPerson) {
        const targetConnections = (targetPerson.connections || []).filter(
          conn => conn.person_id !== sourceId
        );

        await fetch(`${API_BASE_URL}/people/${targetId}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            ...targetPerson,
            connections: targetConnections
          })
        });
      }

      // Refresh data
      await fetchPeople();
      alert('Connection deleted successfully!');
    } catch (err) {
      console.error('Error deleting connection:', err);
      alert('Failed to delete connection: ' + err.message);
    }
  }, [people, fetchPeople]);

  // Filter people for person-specific view
  const filteredPeople = personId ? (() => {
    const mainPerson = people.find(p => p.id === personId);
    if (!mainPerson) return [];

    const connectedIds = new Set([personId]);
    
    // Add directly connected people
    if (mainPerson.connections) {
      mainPerson.connections.forEach(conn => {
        connectedIds.add(conn.person_id);
      });
    }

    // Find people connected to the main person
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
  })() : people;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        <span className="ml-2 text-gray-600">Loading relationships...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <AlertCircle className="w-8 h-8 text-red-500" />
        <span className="ml-2 text-red-600">Error: {error}</span>
      </div>
    );
  }

  const containerClass = fullScreen 
    ? "fixed inset-0 z-50 bg-white" 
    : showInModal 
      ? "h-[500px] w-full" 
      : "h-[600px] w-full";

  return (
    <div className={containerClass}>
      {/* Header */}
      <div className="bg-white border-b px-4 py-3 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <Network className="w-5 h-5 text-blue-600" />
          <h3 className="text-lg font-semibold">
            {personId ? 'Person Relationships' : 'Global Relationship Network'}
          </h3>
          {personId && (
            <span className="text-sm text-gray-500">
              ({filteredPeople.length} people in network)
            </span>
          )}
        </div>
        
        <div className="flex items-center space-x-2">
          {/* Toggle OSINT data */}
          <button
            onClick={() => setShowOsintData(!showOsintData)}
            className="px-3 py-1.5 text-sm rounded-md flex items-center space-x-2 bg-gray-100 hover:bg-gray-200"
            title={showOsintData ? "Hide OSINT Data" : "Show OSINT Data"}
          >
            {showOsintData ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            <span>OSINT Data</span>
          </button>
          
          {/* Layout selector */}
          <select
            value={layoutType}
            onChange={(e) => setLayoutType(e.target.value)}
            className="px-3 py-1.5 text-sm border border-gray-300 rounded-md"
          >
            <option value="hierarchical">Hierarchical</option>
            <option value="circular">Circular</option>
            <option value="force">Force-Directed</option>
          </select>
          
          {/* Fullscreen toggle */}
          <button
            onClick={() => setFullScreen(!fullScreen)}
            className="px-3 py-1.5 text-sm rounded-md bg-gray-100 hover:bg-gray-200"
            title={fullScreen ? "Exit fullscreen" : "Enter fullscreen"}
          >
            <Maximize2 className="w-4 h-4" />
          </button>
          
          {/* Close button if in modal or fullscreen */}
          {(showInModal || fullScreen) && onClose && (
            <button
              onClick={() => {
                setFullScreen(false);
                if (showInModal) onClose();
              }}
              className="px-3 py-1.5 text-sm rounded-md bg-gray-100 hover:bg-gray-200"
            >
              Close
            </button>
          )}
        </div>
      </div>
      
      {/* Diagram Container */}
      <div className="flex-1 h-full">
        <RelationshipDiagram
          people={filteredPeople}
          selectedPersonId={personId}
          onUpdateConnection={updateConnection}
          onDeleteConnection={deleteConnection}
          showOsintData={showOsintData}
          layoutType={layoutType}
        />
      </div>
      
      {/* Statistics Footer */}
      {!showInModal && (
        <div className="bg-gray-50 border-t px-4 py-2">
          <div className="flex items-center justify-between text-sm text-gray-600">
            <div className="flex items-center space-x-4">
              <span>
                <Users className="w-4 h-4 inline mr-1" />
                {filteredPeople.length} People
              </span>
              <span>
                <Network className="w-4 h-4 inline mr-1" />
                {filteredPeople.reduce((acc, p) => acc + (p.connections?.length || 0), 0)} Connections
              </span>
            </div>
            <div>
              {personId && (
                <button
                  onClick={() => {
                    // Switch to global view
                    window.location.hash = '#relationships';
                  }}
                  className="text-blue-600 hover:text-blue-700"
                >
                  View All Relationships →
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RelationshipManager;