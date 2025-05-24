// File: frontend/src/components/visualization/RelationshipManager.js
import React, { useState, useEffect, useCallback } from 'react';
import RelationshipDiagram from '../RelationshipDiagram';
import { AlertCircle, Loader2, Network, Users, Eye, EyeOff, Maximize2, RefreshCw } from 'lucide-react';
import { peopleAPI } from '../../utils/api';

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
  const [debugMode, setDebugMode] = useState(false);

  // Fetch people data
  const fetchPeople = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_BASE_URL}/people`);
      if (!response.ok) throw new Error('Failed to fetch people');
      const data = await response.json();
      
      // Debug logging
      console.log('Fetched people data:', data);
      
      // Ensure connections are properly formatted
      const processedData = data.map(person => ({
        ...person,
        connections: person.connections || []
      }));
      
      setPeople(processedData);
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

      // Debug logging
      console.log('Updating connections for person:', sourceId, 'with connections:', updatedConnections);

      // Prepare the full person data for update
      const updateData = {
        firstName: sourcePerson.first_name,
        lastName: sourcePerson.last_name,
        aliases: sourcePerson.aliases,
        dateOfBirth: sourcePerson.date_of_birth,
        category: sourcePerson.category,
        status: sourcePerson.status,
        crmStatus: sourcePerson.crm_status,
        caseName: sourcePerson.case_name,
        profilePictureUrl: sourcePerson.profile_picture_url,
        notes: sourcePerson.notes,
        osintData: sourcePerson.osint_data,
        attachments: sourcePerson.attachments,
        connections: updatedConnections,
        locations: sourcePerson.locations,
        custom_fields: sourcePerson.custom_fields
      };

      // Update the source person
      const response = await fetch(`${API_BASE_URL}/people/${sourceId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updateData)
      });

      if (!response.ok) throw new Error('Failed to update connection');

      // Refresh data
      await fetchPeople();
      
      // Show success message
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

      const updateData = {
        firstName: sourcePerson.first_name,
        lastName: sourcePerson.last_name,
        aliases: sourcePerson.aliases,
        dateOfBirth: sourcePerson.date_of_birth,
        category: sourcePerson.category,
        status: sourcePerson.status,
        crmStatus: sourcePerson.crm_status,
        caseName: sourcePerson.case_name,
        profilePictureUrl: sourcePerson.profile_picture_url,
        notes: sourcePerson.notes,
        osintData: sourcePerson.osint_data,
        attachments: sourcePerson.attachments,
        connections: updatedConnections,
        locations: sourcePerson.locations,
        custom_fields: sourcePerson.custom_fields
      };

      await fetch(`${API_BASE_URL}/people/${sourceId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updateData)
      });

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

  // Debug info
  const getConnectionsDebugInfo = () => {
    const totalConnections = people.reduce((acc, p) => acc + (p.connections?.length || 0), 0);
    const peopleWithConnections = people.filter(p => p.connections && p.connections.length > 0).length;
    return { totalConnections, peopleWithConnections };
  };

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

  const debugInfo = getConnectionsDebugInfo();

  return (
    <div className={containerClass}>
      {/* Header */}
      <div className="bg-white border-b px-4 py-3 flex items-center justify-between flex-shrink-0">
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
          {/* Debug toggle */}
          <button
            onClick={() => setDebugMode(!debugMode)}
            className="px-3 py-1.5 text-sm rounded-md flex items-center space-x-2 bg-gray-100 hover:bg-gray-200"
            title="Toggle Debug Info"
          >
            <AlertCircle className="w-4 h-4" />
          </button>
          
          {/* Refresh button */}
          <button
            onClick={fetchPeople}
            className="px-3 py-1.5 text-sm rounded-md flex items-center space-x-2 bg-gray-100 hover:bg-gray-200"
            title="Refresh Data"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          
          {/* Toggle OSINT data */}
          <button
            onClick={() => setShowOsintData(!showOsintData)}
            className="px-3 py-1.5 text-sm rounded-md flex items-center space-x-2 bg-gray-100 hover:bg-gray-200"
            title={showOsintData ? "Hide OSINT Data" : "Show OSINT Data"}
          >
            {showOsintData ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            <span className="hidden sm:inline">OSINT Data</span>
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
          {!showInModal && (
            <button
              onClick={() => setFullScreen(!fullScreen)}
              className="px-3 py-1.5 text-sm rounded-md bg-gray-100 hover:bg-gray-200"
              title={fullScreen ? "Exit fullscreen" : "Enter fullscreen"}
            >
              <Maximize2 className="w-4 h-4" />
            </button>
          )}
          
          {/* Close button if in modal or fullscreen */}
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
          <p className="font-semibold">Debug Info:</p>
          <p>Total People: {people.length}</p>
          <p>People with Connections: {debugInfo.peopleWithConnections}</p>
          <p>Total Connections: {debugInfo.totalConnections}</p>
          <p>Filtered People (shown): {filteredPeople.length}</p>
          <details className="mt-2">
            <summary className="cursor-pointer text-blue-600">View Raw Data</summary>
            <pre className="mt-2 text-xs overflow-auto max-h-40 bg-white p-2 rounded">
              {JSON.stringify(filteredPeople.map(p => ({
                id: p.id,
                name: `${p.first_name} ${p.last_name}`,
                connections: p.connections
              })), null, 2)}
            </pre>
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
      
      {/* Statistics Footer */}
      {!showInModal && (
        <div className="bg-gray-50 border-t px-4 py-2 flex-shrink-0">
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
            {personId && (
              <button
                onClick={() => {
                  // Navigate to global view
                  if (onClose) onClose();
                  window.location.hash = '#relationships';
                }}
                className="text-blue-600 hover:text-blue-700"
              >
                View All Relationships →
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default RelationshipManager;