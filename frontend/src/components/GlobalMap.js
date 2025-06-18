// File: frontend/src/components/GlobalMap.js
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import MarkerClusterGroup from 'react-leaflet-cluster';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Search, MapPin, Users, Filter, RefreshCw, Plus, AlertCircle, CheckCircle, Clock } from 'lucide-react';
import { peopleAPI } from '../utils/api';

// Custom hook to handle map bounds with better performance
const MapBounds = ({ markers }) => {
  const map = useMap();
  
  useEffect(() => {
    if (markers.length > 0) {
      const validMarkers = markers.filter(m => m.lat && m.lng && !isNaN(m.lat) && !isNaN(m.lng));
      if (validMarkers.length > 0) {
        const bounds = L.latLngBounds(validMarkers.map(m => [m.lat, m.lng]));
        map.fitBounds(bounds, { padding: [50, 50], maxZoom: 15 });
      }
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
  const [showAddLocation, setShowAddLocation] = useState(false);
  const [newLocationData, setNewLocationData] = useState({ address: '', personId: null });
  const [addressSuggestions, setAddressSuggestions] = useState([]);
  const [geocodingStats, setGeocodingStats] = useState(null);
  const [currentPage, setCurrentPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [hasMore, setHasMore] = useState(true);

  // Fetch people data and geocoding stats
  useEffect(() => {
    fetchPeople();
    fetchGeocodingStats();
  }, []);

  const fetchPeople = async (page = 0, limit = 100) => {
    try {
      setLoading(true);
      const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';
      
      // Use new optimized locations endpoint with pagination
      const response = await fetch(
        `${API_BASE_URL}/locations?limit=${limit}&offset=${page * limit}&confidence=0&includeUngeocoded=true`
      );
      
      if (!response.ok) {
        throw new Error('Failed to fetch locations');
      }
      
      const result = await response.json();
      
      if (page === 0) {
        setPeople(result.data || []);
        setFilteredPeople(result.data || []);
      } else {
        setPeople(prev => [...prev, ...(result.data || [])]);
        setFilteredPeople(prev => [...prev, ...(result.data || [])]);
      }
      
      setCurrentPage(page);
      setHasMore(result.pagination?.hasMore || false);
      setTotalPages(Math.ceil((result.pagination?.total || 0) / limit));
      
    } catch (error) {
      console.error('Error fetching people:', error);
    } finally {
      setLoading(false);
    }
  };
  
  const fetchGeocodingStats = async () => {
    try {
      const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';
      const response = await fetch(`${API_BASE_URL}/geocode/stats`);
      if (response.ok) {
        const stats = await response.json();
        setGeocodingStats(stats);
      }
    } catch (error) {
      console.error('Error fetching geocoding stats:', error);
    }
  };

  // Enhanced batch geocoding with improved service
  const triggerBatchGeocode = async () => {
    if (geocoding) return;
    
    try {
      setGeocoding(true);
      const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';
      
      // First try the enhanced batch geocoding endpoint
      const locations = people.flatMap(person => 
        (person.locations || []).filter(loc => 
          (!loc.latitude || !loc.longitude) && (loc.address || loc.city || loc.country)
        ).map(loc => ({ ...loc, person_id: person.id }))
      );
      
      if (locations.length === 0) {
        alert('All locations already have coordinates.');
        return;
      }
      
      const response = await fetch(`${API_BASE_URL}/geocode/batch-enhanced`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          locations: locations,
          minConfidence: 30,
          maxConcurrent: 3
        })
      });
      
      if (!response.ok) {
        throw new Error('Enhanced geocoding failed, trying fallback...');
      }
      
      const result = await response.json();
      
      alert(`Geocoding completed! 
Processed: ${result.summary.total} locations
Successfully geocoded: ${result.summary.geocoded}
Used cache: ${result.summary.cached}`);
      
      fetchPeople(); // Refresh data
      fetchGeocodingStats(); // Refresh stats
      
    } catch (error) {
      console.error('Enhanced geocoding failed, trying fallback:', error);
      
      // Fallback to original batch geocoding
      try {
        const fallbackApiUrl = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';
        const response = await fetch(`${fallbackApiUrl}/geocode/batch`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          }
        });
        
        if (response.ok) {
          const result = await response.json();
          alert(`Fallback geocoding completed: ${result.totalGeocoded} locations geocoded`);
          fetchPeople();
        } else {
          throw new Error('Both geocoding methods failed');
        }
      } catch (fallbackError) {
        console.error('All geocoding failed:', fallbackError);
        alert(`Failed to geocode locations: ${fallbackError.message}`);
      }
    } finally {
      setGeocoding(false);
    }
  };
  
  // Get address suggestions for autocomplete
  const getAddressSuggestions = useCallback(async (query) => {
    if (!query || query.length < 3) {
      setAddressSuggestions([]);
      return;
    }
    
    try {
      const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';
      const response = await fetch(`${API_BASE_URL}/geocode/suggestions?q=${encodeURIComponent(query)}&limit=5`);
      
      if (response.ok) {
        const suggestions = await response.json();
        setAddressSuggestions(suggestions);
      }
    } catch (error) {
      console.error('Error fetching address suggestions:', error);
    }
  }, []);
  
  // Add new location with enhanced geocoding
  const addLocationWithGeocoding = async () => {
    if (!newLocationData.address.trim()) return;
    
    try {
      const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';
      const response = await fetch(`${API_BASE_URL}/geocode/address`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          address: newLocationData.address,
          minConfidence: 30
        })
      });
      
      if (response.ok) {
        const result = await response.json();
        if (result.success) {
          alert(`Location geocoded successfully!
Address: ${newLocationData.address}
Coordinates: ${result.result.lat}, ${result.result.lng}
Confidence: ${result.result.confidence}%`);
          setNewLocationData({ address: '', personId: null });
          setShowAddLocation(false);
          fetchPeople();
        } else {
          alert('Could not geocode the address. Please try a more specific address.');
        }
      }
    } catch (error) {
      console.error('Error geocoding new location:', error);
      alert('Failed to geocode location');
    }
  };
  
  // Load more locations (pagination)
  const loadMoreLocations = () => {
    if (!loading && hasMore) {
      fetchPeople(currentPage + 1);
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
      <div className="h-full flex items-center justify-center bg-white border border-gray-200 shadow-lg rounded-lg m-4">
        <div className="text-center p-8">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-700 font-medium">Loading map data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4 mb-4 transition-colors duration-300">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Global Location Map</h1>
          <div className="flex items-center space-x-4">
            {/* Geocode button */}
            {missingCoordinates > 0 && (
              <button
                onClick={triggerBatchGeocode}
                disabled={geocoding}
                className="px-4 py-2 bg-yellow-600 text-white rounded hover:bg-yellow-700 transition-all duration-300 flex items-center disabled:opacity-50"
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
                className="pl-10 pr-3 py-2 bg-white border border-gray-300 rounded focus:outline-none focus:border-blue-500 transition-all duration-300 w-64"
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
        <div className="bg-white border border-gray-200 shadow-lg rounded-lg h-full overflow-hidden" style={{ isolation: 'isolate' }}>
          <MapContainer
            center={[20, 0]}
            zoom={2}
            style={{ height: '100%', width: '100%', zIndex: 1 }}
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
          <div className="absolute bottom-4 right-4 bg-white border border-gray-300 shadow-lg rounded p-4 z-10">
            <h4 className="text-sm font-semibold mb-2 text-gray-900">Location Types</h4>
            <div className="space-y-1">
              {Object.entries(locationColors).map(([type, color]) => (
                <div key={type} className="flex items-center space-x-2">
                  <div
                    className="w-4 h-4 rounded-full border-2 border-white shadow-sm"
                    style={{ backgroundColor: color }}
                  />
                  <span className="text-xs text-gray-700 font-medium">
                    {type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                  </span>
                </div>
              ))}
            </div>
          </div>
          
          {/* Enhanced Stats */}
          <div className="absolute top-4 left-4 bg-white border border-gray-300 shadow-lg rounded px-4 py-3 z-10">
            <div className="space-y-2">
              <div className="flex items-center space-x-2 text-sm text-gray-700">
                <Users className="w-4 h-4 text-blue-600" />
                <span className="font-medium">{filteredPeople.length} people</span>
                <span className="text-gray-400">|</span>
                <MapPin className="w-4 h-4 text-blue-600" />
                <span className="font-medium">{markers.length} locations</span>
              </div>
              
              {geocodingStats && (
                <div className="flex items-center space-x-2 text-xs text-gray-600">
                  <CheckCircle className="w-3 h-3 text-green-500" />
                  <span>{geocodingStats.total_cached} cached</span>
                  <span className="text-gray-400">|</span>
                  <Clock className="w-3 h-3 text-blue-500" />
                  <span>{geocodingStats.cached_today} today</span>
                  {geocodingStats.avg_confidence && (
                    <>
                      <span className="text-gray-400">|</span>
                      <span>Avg: {Math.round(geocodingStats.avg_confidence)}%</span>
                    </>
                  )}
                </div>
              )}
              
              {missingCoordinates > 0 && (
                <div className="flex items-center space-x-2 text-xs">
                  <AlertCircle className="w-3 h-3 text-amber-500" />
                  <span className="text-yellow-600 font-medium">{missingCoordinates} need geocoding</span>
                </div>
              )}
              
              {hasMore && (
                <button
                  onClick={loadMoreLocations}
                  disabled={loading}
                  className="w-full px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 transition-all"
                >
                  {loading ? 'Loading...' : `Load More (${totalPages - currentPage - 1} pages left)`}
                </button>
              )}
            </div>
          </div>
          
          {/* Add Location Button */}
          <div className="absolute top-4 right-4 bg-white border border-gray-300 shadow-lg rounded p-2 z-10">
            <button
              onClick={() => setShowAddLocation(!showAddLocation)}
              className="p-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-all duration-300 flex items-center"
              title="Add New Location"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
      
      {/* Add Location Modal */}
      {showAddLocation && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white border border-gray-300 shadow-lg rounded-lg p-6 w-96 max-w-90vw">
            <h3 className="text-lg font-semibold mb-4 text-gray-900">
              Add New Location
            </h3>
            
            <div className="space-y-4">
              <div className="relative">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Address
                </label>
                <input
                  type="text"
                  value={newLocationData.address}
                  onChange={(e) => {
                    setNewLocationData(prev => ({ ...prev, address: e.target.value }));
                    getAddressSuggestions(e.target.value);
                  }}
                  placeholder="Enter address to geocode..."
                  className="w-full px-3 py-2 bg-white border border-gray-300 rounded focus:outline-none focus:border-blue-500 transition-all duration-300"
                />
                
                {/* Address Suggestions */}
                {addressSuggestions.length > 0 && (
                  <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 shadow-lg rounded overflow-hidden">
                    {addressSuggestions.map((suggestion, index) => (
                      <button
                        key={index}
                        onClick={() => {
                          setNewLocationData(prev => ({ ...prev, address: suggestion.display_name }));
                          setAddressSuggestions([]);
                        }}
                        className="w-full text-left px-3 py-2 hover:bg-gray-100 transition-colors border-b border-gray-200 last:border-b-0"
                      >
                        <div className="text-sm font-medium text-gray-900">{suggestion.display_name}</div>
                        <div className="text-xs text-gray-600 flex items-center justify-between">
                          <span>Confidence: {suggestion.confidence}%</span>
                          <span>{suggestion.lat.toFixed(4)}, {suggestion.lng.toFixed(4)}</span>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              
              <div className="flex justify-end space-x-3">
                <button
                  onClick={() => {
                    setShowAddLocation(false);
                    setNewLocationData({ address: '', personId: null });
                    setAddressSuggestions([]);
                  }}
                  className="px-4 py-2 text-gray-700 bg-gray-100 rounded hover:bg-gray-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={addLocationWithGeocoding}
                  disabled={!newLocationData.address.trim()}
                  className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Test Geocoding
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default GlobalMap;