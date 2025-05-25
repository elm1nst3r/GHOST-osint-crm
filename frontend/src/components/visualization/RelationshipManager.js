// File: frontend/src/components/visualization/RelationshipManager.js
import React, { useState, useEffect, useCallback } from 'react';
import RelationshipDiagram from '../RelationshipDiagram';
import { AlertCircle, Loader2, Network, Users, Eye, EyeOff, Maximize2, RefreshCw, Bug } from 'lucide-react';
import { peopleAPI } from '../../utils/api';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';

const RelationshipManager = ({ 
  personId = null,
  showInModal = false,
  onClose = null
}) => {
  const [people, setPeople] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showOsintData, setShowOsintData] = useState(false);
  const [layoutType, setLayoutType] = useState('hierarchical');
  const [fullScreen, setFullScreen] = useState(false);
  const [debugMode, setDebugMode] = useState(false);

  // Fetch people data
  const fetchPeople = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      console.log('=== RelationshipManager: Fetching people ===');
      const response = await fetch(`${API_BASE_URL}/people`);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch people: ${response.status} ${response.statusText}`);
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
        
        // Validate each connection
        connections = connections.filter(conn => {
          if (!conn || typeof conn.person_id === 'undefined') {
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
      
      // Log summary
      const connectionSummary = processedData.reduce((acc, person) => {
        if (person.connections && person.connections.length > 0) {
          acc.peopleWithConnections++;
          acc.totalConnections += person.connections.length;
        }
        return acc;
      }, { peopleWithConnections: 0, totalConnections: 0 });
      
      console.log('Connection Summary:', connectionSummary);
      
      setPeople(processedData);
    } catch (err) {
      console.error('Error fetching people:', err);
      setError(err.message);
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
      console.log('=== Updating connection ===');
      console.log('Source:', sourceId, 'Target:', targetId, 'Type:', type);
      
      // Get the source person's current data
      const sourcePerson = people.find(p => p.id === sourceId);
      if (!sourcePerson) {
        throw new Error('Source person not found');
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

      console.log('Updated connections:', updatedConnections);

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
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updateData)
      });

      if (!response.ok) {
        const errorData = await response.text();
        throw new Error(`Failed to update connection: ${response.status} - ${errorData}`);
      }

      // Refresh data
      await fetchPeople();
      
      alert('Connection created successfully!');
    } catch (err) {
      console.error('Error updating connection:', err);
      alert('Failed to create connection: ' + err.message);
    }
  }, [people, fetchPeople]);

  // Delete connection
  const deleteConnection = useCallback(async (sourceId, targetId) => {
    try {
      const sourcePerson = people.find(p => p.id === sourceId);
      if (!sourcePerson) {
        throw new Error('Source person not found');
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
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updateData)
      });

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
    ? "fixed inset-0 z-50 bg-white flex flex-col" 
    : showInModal 
      ? "h-full w-full flex flex-col" 
      : "h-[600px] w-full flex flex-col";

  return (
    <div className={containerClass}>
      {/* Header */}
      <div className="bg-white border-b px-4 py-3 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center space-x-3">
          <Network className="w-5 h-5 text-blue-600" />
          <h3 className="text-lg font-semibold">
            {personId ? 'Person Relationships' : 'Global Relationship Network'}
          </h3>
          <span className="text-sm text-gray-500">
            ({filteredPeople.length} people)
          </span>
        </div>
        
        <div className="flex items-center space-x-2">
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
            onClick={fetchPeople}
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
            <option value="grid">Grid</option>
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
      
      {/* Debug Info */}
      {debugMode && (
        <div className="bg-yellow-50 border-b border-yellow-200 px-4 py-2 text-sm">
          <details>
            <summary className="cursor-pointer font-medium">Debug Information</summary>
            <div className="mt-2 space-y-1">
              <div>Total People: {people.length}</div>
              <div>Filtered People: {filteredPeople.length}</div>
              <div>
                People with connections: {people.filter(p => p.connections && p.connections.length > 0).length}
              </div>
              <div>
                Total connections: {people.reduce((sum, p) => sum + (p.connections?.length || 0), 0)}
              </div>
            </div>
          </details>
        </div>
      )}
      
      {/* Diagram Container */}
      <div className="flex-1 overflow-hidden">
        <RelationshipDiagram
          people={filteredPeople}
          selectedPersonId={personId}
          onUpdateConnection={updateConnection}
          onDeleteConnection={deleteConnection}
          showOsintData={showOsintData}
          layoutType={layoutType}
        />
      </div>
    </div>
  );
};

export default RelationshipManager;