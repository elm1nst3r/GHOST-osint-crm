// File: frontend/src/components/GlobalMap.js
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import MarkerClusterGroup from 'react-leaflet-cluster';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Search, MapPin, Users, Filter, RefreshCw, Plus, AlertCircle, CheckCircle, Clock, Wifi } from 'lucide-react';
import { peopleAPI, wirelessNetworksAPI } from '../utils/api';
import { OSM_TILE_URL, OSM_ATTRIBUTION } from '../utils/mapConstants';

// Custom hook to handle map bounds with better performance (only run once on mount)
const MapBounds = ({ markers }) => {
  const map = useMap();
  const [hasInitialized, setHasInitialized] = useState(false);

  useEffect(() => {
    // Only fit bounds on initial load, not on every marker change
    if (markers.length > 0 && !hasInitialized) {
      const validMarkers = markers.filter(m => m.lat && m.lng && !isNaN(m.lat) && !isNaN(m.lng));
      if (validMarkers.length > 0) {
        const bounds = L.latLngBounds(validMarkers.map(m => [m.lat, m.lng]));
        map.fitBounds(bounds, { padding: [50, 50], maxZoom: 15 });
        setHasInitialized(true);
      }
    }
  }, [markers.length, map, hasInitialized]); // Only depend on length, not entire markers array

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
  const [wirelessNetworks, setWirelessNetworks] = useState([]);
  const [showNetworks, setShowNetworks] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [includeRelated, setIncludeRelated] = useState(false);
  const [selectedLocationTypes, setSelectedLocationTypes] = useState(Object.keys(locationColors));
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [geocoding, setGeocoding] = useState(false);
  const [showAddLocation, setShowAddLocation] = useState(false);
  const [newLocationData, setNewLocationData] = useState({ address: '', personId: null });
  const [addressSuggestions, setAddressSuggestions] = useState([]);
  const [geocodingStats, setGeocodingStats] = useState(null);
  const [currentPage, setCurrentPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [allPeople, setAllPeople] = useState([]);

  // Fetch people data, wireless networks, and geocoding stats
  useEffect(() => {
    fetchPeople();
    fetchAllPeople();
    fetchWirelessNetworks();
    fetchGeocodingStats();
  }, []);

  const fetchPeople = async (page = 0, limit = 100) => {
    try {
      setLoading(true);
      const API_BASE_URL = process.env.REACT_APP_API_URL || '/api';
      
      // Use new optimized locations endpoint with pagination
      const response = await fetch(
        `${API_BASE_URL}/locations?limit=${limit}&offset=${page * limit}&confidence=0&includeUngeocoded=true`,
        { credentials: 'include' }
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
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  };
  
  const fetchAllPeople = async () => {
    try {
      const API_BASE_URL = process.env.REACT_APP_API_URL || '/api';
      const response = await fetch(`${API_BASE_URL}/people?limit=1000`, { credentials: 'include' });
      if (!response.ok) return;
      const data = await response.json();
      const list = Array.isArray(data) ? data : (data.people || data.data || []);
      setAllPeople(list.sort((a, b) => `${a.first_name} ${a.last_name}`.localeCompare(`${b.first_name} ${b.last_name}`)));
    } catch (err) {
      console.error('Error fetching all people:', err);
    }
  };

  const fetchGeocodingStats = async () => {
    try {
      const API_BASE_URL = process.env.REACT_APP_API_URL || '/api';
      const response = await fetch(`${API_BASE_URL}/geocode/stats`, { credentials: 'include' });
      if (response.ok) {
        const stats = await response.json();
        setGeocodingStats(stats);
      }
    } catch (error) {
      console.error('Error fetching geocoding stats:', error);
    }
  };

  const fetchWirelessNetworks = async () => {
    try {
      const networks = await wirelessNetworksAPI.getAll();
      // Filter networks that have location data
      const networksWithLocation = networks.filter(n => n.latitude && n.longitude);
      setWirelessNetworks(networksWithLocation);
    } catch (error) {
      console.error('Error fetching wireless networks:', error);
    }
  };

  // Enhanced batch geocoding with improved service
  const triggerBatchGeocode = async () => {
    if (geocoding) return;
    
    try {
      setGeocoding(true);
      const API_BASE_URL = process.env.REACT_APP_API_URL || '/api';
      
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
        credentials: 'include',
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
        const fallbackApiUrl = process.env.REACT_APP_API_URL || '/api';
        const response = await fetch(`${fallbackApiUrl}/geocode/batch`, {
          method: 'POST',
          credentials: 'include',
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
      const API_BASE_URL = process.env.REACT_APP_API_URL || '/api';
      const response = await fetch(`${API_BASE_URL}/geocode/suggestions?q=${encodeURIComponent(query)}&limit=5`, { credentials: 'include' });
      
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
    if (!newLocationData.address.trim() || !newLocationData.personId) {
      alert('Please enter an address and select a person');
      return;
    }

    try {
      const API_BASE_URL = process.env.REACT_APP_API_URL || '/api';

      // First geocode the address
      const geocodeResponse = await fetch(`${API_BASE_URL}/geocode/address`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({
          address: newLocationData.address,
          minConfidence: 30
        })
      });

      if (geocodeResponse.ok) {
        const geocodeResult = await geocodeResponse.json();
        if (geocodeResult.success) {
          // Append location to the person's locations array (what the map reads from)
          const locationData = {
            address: newLocationData.address,
            city: geocodeResult.result.city || '',
            state: geocodeResult.result.state || '',
            country: geocodeResult.result.country || '',
            postal_code: geocodeResult.result.postal_code || '',
            latitude: geocodeResult.result.lat,
            longitude: geocodeResult.result.lng,
            type: 'other',
            current: true,
            date_added: new Date().toISOString().split('T')[0],
            geocode_confidence: geocodeResult.result.confidence,
            geocode_provider: geocodeResult.result.provider || 'nominatim',
            geocoded_at: new Date().toISOString()
          };

          const addResponse = await fetch(`${API_BASE_URL}/people/${newLocationData.personId}/locations`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify(locationData)
          });

          if (addResponse.ok) {
            alert(`Location added successfully!\nAddress: ${newLocationData.address}\nCoordinates: ${geocodeResult.result.lat}, ${geocodeResult.result.lng}\nConfidence: ${geocodeResult.result.confidence}%`);
            setNewLocationData({ address: '', personId: null });
            setShowAddLocation(false);
            fetchPeople();
          } else {
            alert('Location geocoded but failed to save. Please try adding it manually from the person\'s profile.');
          }
        } else {
          // Show the specific failure reason to the user
          let msg = geocodeResult.message || 'Could not geocode this address.';
          if (geocodeResult.best_match) {
            msg += `\n\nDid you mean: "${geocodeResult.best_match.displayName}"?\nIf so, try a more complete address.`;
          } else if (geocodeResult.reason === 'not_found') {
            msg += '\n\nTips:\n• Add a city and country (e.g. "10 Downing St, London, UK")\n• Check for spelling mistakes\n• Try a postcode or zip code instead';
          } else if (geocodeResult.reason === 'timeout') {
            msg += '\n\nThe geocoding service did not respond. Check your internet connection and try again.';
          }
          alert(msg);
        }
      }
    } catch (error) {
      console.error('Error adding location:', error);
      alert('Failed to add location');
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

  // Optimized marker icons cache to prevent recreation
  const iconCache = useMemo(() => {
    const cache = {};
    Object.entries(locationColors).forEach(([type, color]) => {
      // Full confidence icon
      cache[`${type}-full`] = L.divIcon({
        className: 'custom-div-icon',
        html: `<div style="
          background-color: ${color};
          width: 24px;
          height: 24px;
          border-radius: 50%;
          border: 2px solid white;
          box-shadow: 0 2px 4px rgba(0,0,0,0.3);
        "></div>`,
        iconSize: [24, 24],
        iconAnchor: [12, 12]
      });

      // Partial confidence icon
      cache[`${type}-partial`] = L.divIcon({
        className: 'custom-div-icon',
        html: `<div style="
          background-color: ${color};
          width: 20px;
          height: 20px;
          border-radius: 50%;
          border: 2px dashed white;
          box-shadow: 0 2px 4px rgba(0,0,0,0.3);
          opacity: 0.7;
        "></div>`,
        iconSize: [20, 20],
        iconAnchor: [10, 10]
      });
    });

    // Wireless network icon
    cache['wifi'] = L.divIcon({
      className: 'custom-div-icon',
      html: `<div style="
        background-color: #3b82f6;
        width: 28px;
        height: 28px;
        border-radius: 50%;
        border: 2px solid white;
        box-shadow: 0 2px 4px rgba(0,0,0,0.3);
        display: flex;
        align-items: center;
        justify-content: center;
      ">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M5 13a10 10 0 0 1 14 0"></path>
          <path d="M8.5 16.5a5 5 0 0 1 7 0"></path>
          <path d="M2 8.82a15 15 0 0 1 20 0"></path>
          <line x1="12" y1="20" x2="12.01" y2="20"></line>
        </svg>
      </div>`,
      iconSize: [28, 28],
      iconAnchor: [14, 14]
    });

    return cache;
  }, []); // Only create once

  // Create markers from filtered people - with performance optimizations
  const markers = useMemo(() => {
    const markerList = [];

    filteredPeople.forEach((person, personIndex) => {
      if (person.locations && person.locations.length > 0) {
        person.locations.forEach((location, locIndex) => {
          // Show locations with coordinates and matching type
          const hasCoordinates = location.latitude && location.longitude;
          const isSelectedType = selectedLocationTypes.includes(location.type);

          if (hasCoordinates && isSelectedType) {
            const locationType = location.type || 'other';
            const confidence = location.geocode_confidence || 0;
            const isPartialData = confidence < 50;

            // Use cached icon instead of creating new one
            const iconKey = `${locationType}-${isPartialData ? 'partial' : 'full'}`;
            const icon = iconCache[iconKey] || iconCache['other-full'];

            markerList.push({
              // Use unique stable key combining person ID and location index
              id: `${person.id}-${locIndex}`,
              lat: parseFloat(location.latitude),
              lng: parseFloat(location.longitude),
              personId: person.id,
              personName: `${person.first_name || ''} ${person.last_name || ''}`.trim(),
              personCategory: person.category,
              personCaseName: person.case_name,
              locationType: locationType,
              locationAddress: location.address,
              locationCity: location.city,
              locationCountry: location.country,
              locationConfidence: confidence,
              icon,
              isPartialData
            });
          }
        });
      }
    });

    // Add wireless network markers
    if (showNetworks) {
      wirelessNetworks.forEach((network) => {
        markerList.push({
          id: `network-${network.id}`,
          lat: parseFloat(network.latitude),
          lng: parseFloat(network.longitude),
          type: 'wireless_network',
          ssid: network.ssid,
          bssid: network.bssid,
          encryption: network.encryption,
          networkType: network.network_type,
          signalStrength: network.signal_strength,
          areaName: network.area_name,
          password: network.password,
          notes: network.notes,
          associatedPersonIds: network.associated_person_ids || [],
          associatedBusinessIds: network.associated_business_ids || [],
          icon: iconCache['wifi']
        });
      });
    }

    return markerList;
  }, [filteredPeople, selectedLocationTypes, iconCache, wirelessNetworks, showNetworks]);

  const toggleLocationType = (type) => {
    setSelectedLocationTypes(prev => {
      if (prev.includes(type)) {
        return prev.filter(t => t !== type);
      } else {
        return [...prev, type];
      }
    });
  };

  // Removed getFullName - now using pre-computed personName in markers

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
      <div className="h-full flex flex-col bg-white dark:bg-slate-900 rounded-lg m-4 overflow-hidden border border-slate-200 dark:border-slate-700">
        <div className="h-12 bg-slate-100 dark:bg-slate-800 animate-pulse" />
        <div className="flex-1 bg-slate-200 dark:bg-slate-700 animate-pulse" />
        <div className="p-4 space-y-2 border-t border-slate-200 dark:border-slate-700">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-10 bg-slate-100 dark:bg-slate-800 rounded animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="h-full flex items-center justify-center bg-white dark:bg-slate-900 rounded-lg m-4 border border-slate-200 dark:border-slate-700">
        <div className="text-center p-8">
          <p className="text-slate-700 dark:text-slate-300 font-medium mb-3">Failed to load map data</p>
          <button
            onClick={() => { setLoadError(false); setLoading(true); fetchPeople(); }}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 transition-colors duration-150 active:scale-[0.97]"
          >
            Retry
          </button>
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
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 dark:text-gray-500 w-5 h-5" />
              <input
                type="text"
                placeholder="Search people..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 pr-3 py-2 bg-white dark:bg-slate-800 dark:text-gray-100 dark:placeholder-gray-600 border border-gray-300 dark:border-gray-600 rounded focus:outline-none focus:border-blue-500 transition-all duration-300 w-64"
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
              <span className="text-sm text-gray-700 dark:text-gray-300">Include related people</span>
            </label>

            {/* Show Wireless Networks */}
            <label className="flex items-center space-x-2 cursor-pointer">
              <input
                type="checkbox"
                checked={showNetworks}
                onChange={(e) => setShowNetworks(e.target.checked)}
                className="h-4 w-4 text-blue-600 rounded"
              />
              <span className="text-sm text-gray-700 dark:text-gray-300 flex items-center">
                <Wifi className="w-4 h-4 mr-1" />
                Wireless Networks ({wirelessNetworks.length})
              </span>
            </label>
          </div>
        </div>

        {/* Location Type Filters */}
        <div className="mt-4 flex items-center space-x-4">
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Filter by type:</span>
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
            {showNetworks && wirelessNetworks.length > 0 && (
              <button
                className="px-3 py-1 rounded-full text-xs font-medium ring-2 ring-offset-2"
                style={{
                  backgroundColor: '#3b82f6',
                  color: 'white',
                  ringColor: '#3b82f6'
                }}
              >
                <Wifi className="w-3 h-3 inline mr-1" />
                Wireless Networks
              </button>
            )}
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
            url={OSM_TILE_URL}
            attribution={OSM_ATTRIBUTION}
          />
          
          <MarkerClusterGroup
            chunkedLoading={true}
            maxClusterRadius={60}
            spiderfyOnMaxZoom={true}
            showCoverageOnHover={false}
            zoomToBoundsOnClick={true}
          >
            {markers.map((marker) => (
              <Marker
                key={marker.id}
                position={[marker.lat, marker.lng]}
                icon={marker.icon}
              >
                <Popup>
                  {marker.type === 'wireless_network' ? (
                    <div className="p-2 min-w-[200px]">
                      <h3 className="font-semibold text-blue-600 dark:text-blue-400 flex items-center">
                        <Wifi className="w-4 h-4 mr-2" />
                        {marker.ssid}
                      </h3>
                      <p className="text-xs text-gray-600 dark:text-gray-400 font-mono">{marker.bssid}</p>

                      <div className="mt-2 border-t dark:border-gray-600 pt-2 space-y-1">
                        {marker.encryption && (
                          <p className="text-sm"><span className="font-medium">Security:</span> {marker.encryption}</p>
                        )}
                        {marker.networkType && (
                          <p className="text-sm"><span className="font-medium">Type:</span> {marker.networkType}</p>
                        )}
                        {marker.signalStrength && (
                          <p className="text-sm"><span className="font-medium">Signal:</span> {marker.signalStrength} dBm</p>
                        )}
                        {marker.password && (
                          <p className="text-sm"><span className="font-medium">Password:</span> ••••••••</p>
                        )}
                        {marker.areaName && (
                          <p className="text-sm text-gray-600 dark:text-gray-400">{marker.areaName}</p>
                        )}
                        {marker.notes && (
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{marker.notes}</p>
                        )}
                        {marker.associatedPersonIds.length > 0 && (
                          <p className="text-xs text-green-600 dark:text-green-400 mt-1">
                            {marker.associatedPersonIds.length} associated person(s)
                          </p>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="p-2 min-w-[200px]">
                      <h3 className="font-semibold text-gray-900 dark:text-gray-100">{marker.personName}</h3>
                      {marker.personCategory && (
                        <p className="text-sm text-gray-600 dark:text-gray-400">{marker.personCategory}</p>
                      )}
                      {marker.personCaseName && (
                        <p className="text-xs text-blue-600 dark:text-blue-400">Case: {marker.personCaseName}</p>
                      )}

                      <div className="mt-2 border-t dark:border-gray-600 pt-2">
                        <div className="flex items-center justify-between mb-1">
                          <p className="text-xs font-medium text-gray-700 dark:text-gray-300">
                            {marker.locationType.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                          </p>
                          {/* Location accuracy indicator */}
                          {marker.locationConfidence > 0 && (
                            <span className={`text-xs px-2 py-0.5 rounded ${
                              marker.locationConfidence >= 70 ? 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300' :
                              marker.locationConfidence >= 50 ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300' :
                              'bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300'
                            }`}>
                              {marker.locationConfidence >= 70 ? 'High' :
                               marker.locationConfidence >= 50 ? 'Medium' :
                               'Low'} {marker.locationConfidence}%
                            </span>
                          )}
                        </div>

                        {marker.locationAddress && (
                          <p className="text-sm text-gray-800 dark:text-gray-200">{marker.locationAddress}</p>
                        )}

                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          {[marker.locationCity, marker.locationCountry]
                            .filter(Boolean)
                            .join(', ')}
                        </p>

                        {/* Show confidence warning for partial data */}
                        {marker.isPartialData && (
                          <p className="text-xs text-orange-600 dark:text-orange-400 mt-1 flex items-center">
                            <AlertCircle className="w-3 h-3 mr-1" />
                            Approximate location
                          </p>
                        )}
                      </div>
                    </div>
                  )}
                </Popup>
              </Marker>
            ))}
          </MarkerClusterGroup>
          
          {markers.length > 0 && <MapBounds markers={markers} />}
          </MapContainer>
          
          {/* Legend */}
          <div className="absolute bottom-4 right-4 bg-white dark:bg-slate-800 border border-gray-300 dark:border-gray-600 shadow-lg rounded p-4 z-10 max-w-xs">
            <h4 className="text-sm font-semibold mb-2 text-gray-900 dark:text-gray-100">Location Types</h4>
            <div className="space-y-1 mb-3">
              {Object.entries(locationColors).map(([type, color]) => (
                <div key={type} className="flex items-center space-x-2">
                  <div
                    className="w-4 h-4 rounded-full border-2 border-white shadow-sm"
                    style={{ backgroundColor: color }}
                  />
                  <span className="text-xs text-gray-700 dark:text-gray-300 font-medium">
                    {type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                  </span>
                </div>
              ))}
            </div>

            <h4 className="text-sm font-semibold mb-2 text-gray-900 dark:text-gray-100 border-t dark:border-gray-600 pt-2">Accuracy</h4>
            <div className="space-y-1">
              <div className="flex items-center space-x-2">
                <div className="w-4 h-4 rounded-full border-2 border-white shadow-sm bg-blue-500" />
                <span className="text-xs text-gray-700 dark:text-gray-300">High accuracy (solid)</span>
              </div>
              <div className="flex items-center space-x-2">
                <div className="w-3 h-3 rounded-full border-2 border-white shadow-sm bg-blue-500 opacity-70" style={{ borderStyle: 'dashed' }} />
                <span className="text-xs text-gray-700 dark:text-gray-300">Approximate (dashed)</span>
              </div>
            </div>
          </div>
          
          {/* Enhanced Stats */}
          <div className="absolute top-4 left-4 bg-white dark:bg-slate-800 border border-gray-300 dark:border-gray-600 shadow-lg rounded px-4 py-3 z-10">
            <div className="space-y-2">
              <div className="flex items-center space-x-2 text-sm text-gray-700 dark:text-gray-300">
                <Users className="w-4 h-4 text-blue-600" />
                <span className="font-medium">{filteredPeople.length} people</span>
                <span className="text-gray-400 dark:text-gray-500 dark:text-gray-400">|</span>
                <MapPin className="w-4 h-4 text-blue-600" />
                <span className="font-medium">{markers.length} locations</span>
              </div>
              
              {geocodingStats && (
                <div className="flex items-center space-x-2 text-xs text-gray-600 dark:text-gray-400">
                  <CheckCircle className="w-3 h-3 text-green-500" />
                  <span>{geocodingStats.total_cached} cached</span>
                  <span className="text-gray-400 dark:text-gray-500 dark:text-gray-400">|</span>
                  <Clock className="w-3 h-3 text-blue-500" />
                  <span>{geocodingStats.cached_today} today</span>
                  {geocodingStats.avg_confidence && (
                    <>
                      <span className="text-gray-400 dark:text-gray-500 dark:text-gray-400">|</span>
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
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-slate-800 border border-gray-300 dark:border-gray-600 shadow-lg rounded-lg p-6 w-96 max-w-90vw">
            <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-gray-100">
              Add New Location
            </h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Select Person
                </label>
                <select
                  value={newLocationData.personId || ''}
                  onChange={(e) => setNewLocationData(prev => ({ ...prev, personId: parseInt(e.target.value) || null }))}
                  className="w-full px-3 py-2 bg-white dark:bg-slate-800 dark:text-gray-100 border border-gray-300 dark:border-gray-600 rounded focus:outline-none focus:border-blue-500"
                >
                  <option value="">-- Select a person --</option>
                  {allPeople.map(person => (
                    <option key={person.id} value={person.id}>
                      {person.first_name} {person.last_name} {person.case_name ? `(${person.case_name})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div className="relative">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
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
                  className="w-full px-3 py-2 bg-white dark:bg-slate-800 dark:text-gray-100 dark:placeholder-gray-600 border border-gray-300 dark:border-gray-600 rounded focus:outline-none focus:border-blue-500 transition-all duration-300"
                />
                
                {/* Address Suggestions */}
                {addressSuggestions.length > 0 && (
                  <div className="absolute z-10 w-full mt-1 bg-white dark:bg-slate-800 border border-gray-300 dark:border-gray-600 shadow-lg rounded overflow-hidden">
                    {addressSuggestions.map((suggestion, index) => (
                      <button
                        key={index}
                        onClick={() => {
                          setNewLocationData(prev => ({ ...prev, address: suggestion.display_name }));
                          setAddressSuggestions([]);
                        }}
                        className="w-full text-left px-3 py-2 hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors border-b border-gray-200 dark:border-gray-600 last:border-b-0"
                      >
                        <div className="text-sm font-medium text-gray-900 dark:text-gray-100">{suggestion.display_name}</div>
                        <div className="text-xs text-gray-600 dark:text-gray-400 flex items-center justify-between">
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
                  className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-slate-700 rounded hover:bg-gray-200 dark:hover:bg-slate-600 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={addLocationWithGeocoding}
                  disabled={!newLocationData.address.trim() || !newLocationData.personId}
                  className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Add Location
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