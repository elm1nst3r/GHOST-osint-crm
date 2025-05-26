// File: frontend/src/components/GlobalMap.js
import React, { useState, useEffect, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import MarkerClusterGroup from 'react-leaflet-cluster';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Search, MapPin, Users, Filter, RefreshCw } from 'lucide-react';
import { peopleAPI } from '../utils/api';

// Custom hook to handle map bounds
const MapBounds = ({ markers }) => {
  const map = useMap();
  
  useEffect(() => {
    if (markers.length > 0) {
      const bounds = L.latLngBounds(markers.map(m => [m.lat, m.lng]));
      map.fitBounds(bounds, { padding: [50, 50] });
    }
  }, [markers, map]);
  
  return null;
};

// Location type colors
const locationColors = {
  primary_residence: '#10b981', // green
  holiday_home: '#3b82f6', // blue
  work: '#f59e0b', // yellow
  family_residence: '#8b5cf6', // purple
  favorite_hotel: '#ec4899', // pink
  yacht_location: '#06b6d4', // cyan
  other: '#6b7280' // gray
};

const GlobalMap = () => {
  const [people, setPeople] = useState([]);
  const [filteredPeople, setFilteredPeople] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [includeRelated, setIncludeRelated] = useState(false);
  const [selectedLocationTypes, setSelectedLocationTypes] = useState(Object.keys(locationColors));
  const [loading, setLoading] = useState(true);
  const [geocoding, setGeocoding] = useState(false);

  // Fetch people data
  useEffect(() => {
    fetchPeople();
  }, []);

  const fetchPeople = async () => {
    try {
      setLoading(true);
      const data = await peopleAPI.getAll();
      setPeople(data);
      setFilteredPeople(data);
    } catch (error) {
      console.error('Error fetching people:', error);
    } finally {
      setLoading(false);
    }
  };

  // Trigger batch geocoding for missing coordinates
const triggerBatchGeocode = async () => {
  if (geocoding) return;
  
  try {
    setGeocoding(true);
    // Use the correct API base URL
    const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';
    const response = await fetch(`${API_BASE_URL}/geocode/batch`, { 
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.details || errorData.error || 'Geocoding failed');
    }
    
    const result = await response.json();
    
    if (result.totalGeocoded > 0) {
      alert(`Successfully geocoded ${result.totalGeocoded} locations!`);
      fetchPeople(); // Refresh data
    } else if (result.totalFailed > 0) {
      alert(`Failed to geocode ${result.totalFailed} locations. Check console for details.`);
      console.error('Geocoding errors:', result.errors);
    } else {
      alert('All locations already have coordinates.');
    }
  } catch (error) {
    console.error('Error batch geocoding:', error);
    alert(`Failed to geocode locations: ${error.message}`);
  } finally {
    setGeocoding(false);
  }
};


  // Filter people based on search
  useEffect(() => {
    if (!searchTerm) {
      setFilteredPeople(people);
      return;
    }

    const searchLower = searchTerm.toLowerCase();
    const filtered = people.filter(person => {
      const fullName = `${person.first_name || ''} ${person.last_name || ''}`.toLowerCase();
      return fullName.includes(searchLower) ||
        (person.aliases && person.aliases.some(alias => alias.toLowerCase().includes(searchLower))) ||
        (person.case_name && person.case_name.toLowerCase().includes(searchLower));
    });

    if (includeRelated) {
      const relatedPeople = new Set(filtered.map(p => p.id));
      
      // Add connected people
      filtered.forEach(person => {
        if (person.connections) {
          person.connections.forEach(conn => {
            relatedPeople.add(conn.person_id);
          });
        }
      });
      
      // Also check reverse connections
      people.forEach(person => {
        if (person.connections) {
          person.connections.forEach(conn => {
            if (relatedPeople.has(conn.person_id)) {
              relatedPeople.add(person.id);
            }
          });
        }
      });
      
      setFilteredPeople(people.filter(p => relatedPeople.has(p.id)));
    } else {
      setFilteredPeople(filtered);
    }
  }, [searchTerm, people, includeRelated]);

  // Create markers from filtered people - much simpler now!
  const markers = useMemo(() => {
    const markerList = [];
    
    filteredPeople.forEach(person => {
      if (person.locations && person.locations.length > 0) {
        person.locations.forEach(location => {
          // Only show locations with coordinates and matching type
          if (location.latitude && location.longitude && selectedLocationTypes.includes(location.type)) {
            const color = locationColors[location.type] || locationColors.other;
            
            const icon = L.divIcon({
              className: 'custom-div-icon',
              html: `<div style="background-color: ${color}; width: 24px; height: 24px; border-radius: 50%; border: 2px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3);"></div>`,
              iconSize: [24, 24],
              iconAnchor: [12, 12]
            });
            
            markerList.push({
              lat: location.latitude,
              lng: location.longitude,
              person,
              location,
              icon
            });
          }
        });
      }
    });
    
    return markerList;
  }, [filteredPeople, selectedLocationTypes]);

  const toggleLocationType = (type) => {
    setSelectedLocationTypes(prev => {
      if (prev.includes(type)) {
        return prev.filter(t => t !== type);
      } else {
        return [...prev, type];
      }
    });
  };

  const getFullName = (person) => {
    return `${person.first_name || ''} ${person.last_name || ''}`.trim();
  };

  // Count locations missing coordinates
  const missingCoordinates = useMemo(() => {
    let count = 0;
    people.forEach(person => {
      if (person.locations) {
        person.locations.forEach(location => {
          if ((!location.latitude || !location.longitude) && 
              (location.address || location.city || location.country)) {
            count++;
          }
        });
      }
    });
    return count;
  }, [people]);

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading map data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="bg-white shadow-sm border-b px-6 py-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900">Global Location Map</h1>
          <div className="flex items-center space-x-4">
            {/* Geocode button */}
            {missingCoordinates > 0 && (
              <button
                onClick={triggerBatchGeocode}
                disabled={geocoding}
                className="px-3 py-2 bg-orange-600 text-white rounded-md hover:bg-orange-700 flex items-center disabled:opacity-50"
                title={`${missingCoordinates} locations need geocoding`}
              >
                <RefreshCw className={`w-4 h-4 mr-2 ${geocoding ? 'animate-spin' : ''}`} />
                {geocoding ? 'Geocoding...' : `Geocode ${missingCoordinates} Locations`}
              </button>
            )}
            
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Search people..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 pr-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 w-64"
              />
            </div>
            
            {/* Include Related */}
            <label className="flex items-center space-x-2 cursor-pointer">
              <input
                type="checkbox"
                checked={includeRelated}
                onChange={(e) => setIncludeRelated(e.target.checked)}
                className="h-4 w-4 text-blue-600 rounded"
              />
              <span className="text-sm text-gray-700">Include related people</span>
            </label>
          </div>
        </div>
        
        {/* Location Type Filters */}
        <div className="mt-4 flex items-center space-x-4">
          <span className="text-sm font-medium text-gray-700">Filter by type:</span>
          <div className="flex flex-wrap gap-2">
            {Object.entries(locationColors).map(([type, color]) => (
              <button
                key={type}
                onClick={() => toggleLocationType(type)}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${
                  selectedLocationTypes.includes(type)
                    ? 'ring-2 ring-offset-2'
                    : 'opacity-50'
                }`}
                style={{
                  backgroundColor: color,
                  color: 'white',
                  ringColor: color
                }}
              >
                {type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
              </button>
            ))}
          </div>
        </div>
      </div>
      
      {/* Map */}
      <div className="flex-1 relative">
        <MapContainer
          center={[20, 0]}
          zoom={2}
          style={{ height: '100%', width: '100%' }}
          worldCopyJump={true}
        >
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          />
          
          <MarkerClusterGroup>
            {markers.map((marker, index) => (
              <Marker
                key={index}
                position={[marker.lat, marker.lng]}
                icon={marker.icon}
              >
                <Popup>
                  <div className="p-2">
                    <h3 className="font-semibold">{getFullName(marker.person)}</h3>
                    {marker.person.category && (
                      <p className="text-sm text-gray-600">{marker.person.category}</p>
                    )}
                    <div className="mt-2">
                      <p className="text-xs font-medium text-gray-700">
                        {marker.location.type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                      </p>
                      <p className="text-sm">{marker.location.address}</p>
                      <p className="text-sm text-gray-600">
                        {[marker.location.city, marker.location.state, marker.location.country]
                          .filter(Boolean)
                          .join(', ')}
                      </p>
                      {marker.location.notes && (
                        <p className="text-xs text-gray-500 mt-1">{marker.location.notes}</p>
                      )}
                    </div>
                  </div>
                </Popup>
              </Marker>
            ))}
          </MarkerClusterGroup>
          
          {markers.length > 0 && <MapBounds markers={markers} />}
        </MapContainer>
        
        {/* Legend */}
        <div className="absolute bottom-4 right-4 bg-white rounded-lg shadow-lg p-4 z-10">
          <h4 className="text-sm font-semibold mb-2">Location Types</h4>
          <div className="space-y-1">
            {Object.entries(locationColors).map(([type, color]) => (
              <div key={type} className="flex items-center space-x-2">
                <div
                  className="w-4 h-4 rounded-full border-2 border-white shadow-sm"
                  style={{ backgroundColor: color }}
                />
                <span className="text-xs text-gray-600">
                  {type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                </span>
              </div>
            ))}
          </div>
        </div>
        
        {/* Stats */}
        <div className="absolute top-4 left-4 bg-white rounded-lg shadow-lg px-4 py-2 z-10">
          <div className="flex items-center space-x-2 text-sm text-gray-600">
            <Users className="w-4 h-4" />
            <span>{filteredPeople.length} people</span>
            <span className="text-gray-400">|</span>
            <MapPin className="w-4 h-4" />
            <span>{markers.length} locations</span>
            {missingCoordinates > 0 && (
              <>
                <span className="text-gray-400">|</span>
                <span className="text-orange-600">{missingCoordinates} need geocoding</span>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default GlobalMap;