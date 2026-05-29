// File: frontend/src/components/GlobalMap.js
import React, { useState, useEffect, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import MarkerClusterGroup from 'react-leaflet-cluster';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Search, RefreshCw, Plus, AlertCircle, Wifi, Filter } from 'lucide-react';
import { wirelessNetworksAPI } from '../utils/api';
import { OSM_TILE_URL, OSM_ATTRIBUTION } from '../utils/mapConstants';
import { locationColors, buildIconCache } from './map/mapUtils';
import AddLocationModal from './map/AddLocationModal';
import MapLegend from './map/MapLegend';
import MapStats from './map/MapStats';

const API_BASE = process.env.REACT_APP_API_URL || '/api';

// Fits map bounds once on initial load
const MapBounds = ({ markers }) => {
  const map = useMap();
  const [initialized, setInitialized] = useState(false);
  useEffect(() => {
    if (markers.length > 0 && !initialized) {
      const valid = markers.filter(m => m.lat && m.lng && !isNaN(m.lat) && !isNaN(m.lng));
      if (valid.length > 0) {
        map.fitBounds(L.latLngBounds(valid.map(m => [m.lat, m.lng])), { padding: [50, 50], maxZoom: 15 });
        setInitialized(true);
      }
    }
  }, [markers.length, map, initialized]);
  return null;
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
  const [geocodingStats, setGeocodingStats] = useState(null);
  const [currentPage, setCurrentPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [allPeople, setAllPeople] = useState([]);

  useEffect(() => {
    fetchPeople();
    fetchAllPeople();
    fetchWirelessNetworks();
    fetchGeocodingStats();
  }, []);

  const fetchPeople = async (page = 0, limit = 100) => {
    try {
      setLoading(true);
      const res = await fetch(
        `${API_BASE}/locations?limit=${limit}&offset=${page * limit}&confidence=0&includeUngeocoded=true`,
        { credentials: 'include' }
      );
      if (!res.ok) throw new Error('Failed to fetch locations');
      const result = await res.json();
      const data = result.data || [];
      setPeople(prev => page === 0 ? data : [...prev, ...data]);
      setFilteredPeople(prev => page === 0 ? data : [...prev, ...data]);
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
      const res = await fetch(`${API_BASE}/people?limit=1000`, { credentials: 'include' });
      if (!res.ok) return;
      const data = await res.json();
      const list = Array.isArray(data) ? data : (data.people || data.data || []);
      setAllPeople(list.sort((a, b) =>
        `${a.first_name} ${a.last_name}`.localeCompare(`${b.first_name} ${b.last_name}`)
      ));
    } catch (err) {
      console.error('Error fetching all people:', err);
    }
  };

  const fetchGeocodingStats = async () => {
    try {
      const res = await fetch(`${API_BASE}/geocode/stats`, { credentials: 'include' });
      if (res.ok) setGeocodingStats(await res.json());
    } catch (error) {
      console.error('Error fetching geocoding stats:', error);
    }
  };

  const fetchWirelessNetworks = async () => {
    try {
      const networks = await wirelessNetworksAPI.getAll();
      setWirelessNetworks(networks.filter(n => n.latitude && n.longitude));
    } catch (error) {
      console.error('Error fetching wireless networks:', error);
    }
  };

  const triggerBatchGeocode = async () => {
    if (geocoding) return;
    setGeocoding(true);
    try {
      const locations = people.flatMap(person =>
        (person.locations || [])
          .filter(loc => (!loc.latitude || !loc.longitude) && (loc.address || loc.city || loc.country))
          .map(loc => ({ ...loc, person_id: person.id }))
      );
      if (locations.length === 0) { alert('All locations already have coordinates.'); return; }

      const res = await fetch(`${API_BASE}/geocode/batch-enhanced`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ locations, minConfidence: 30, maxConcurrent: 3 }),
      });

      if (!res.ok) throw new Error('Enhanced geocoding failed');
      const result = await res.json();
      alert(`Geocoding completed!\nProcessed: ${result.summary.total}\nGeocoded: ${result.summary.geocoded}\nCached: ${result.summary.cached}`);
      fetchPeople();
      fetchGeocodingStats();
    } catch (error) {
      // Fallback to simple batch
      try {
        const res = await fetch(`${API_BASE}/geocode/batch`, { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' } });
        if (res.ok) {
          const result = await res.json();
          alert(`Fallback geocoding completed: ${result.totalGeocoded} locations geocoded`);
          fetchPeople();
        } else {
          throw new Error('Both geocoding methods failed');
        }
      } catch (fallbackError) {
        alert(`Failed to geocode locations: ${fallbackError.message}`);
      }
    } finally {
      setGeocoding(false);
    }
  };

  // Search filter
  useEffect(() => {
    if (!searchTerm) { setFilteredPeople(people); return; }
    const lower = searchTerm.toLowerCase();
    const filtered = people.filter(p => {
      const name = `${p.first_name || ''} ${p.last_name || ''}`.toLowerCase();
      return name.includes(lower) ||
        (p.aliases?.some(a => a.toLowerCase().includes(lower))) ||
        (p.case_name?.toLowerCase().includes(lower));
    });

    if (!includeRelated) { setFilteredPeople(filtered); return; }

    const ids = new Set(filtered.map(p => p.id));
    filtered.forEach(p => p.connections?.forEach(c => ids.add(c.person_id)));
    people.forEach(p => p.connections?.forEach(c => { if (ids.has(c.person_id)) ids.add(p.id); }));
    setFilteredPeople(people.filter(p => ids.has(p.id)));
  }, [searchTerm, people, includeRelated]);

  const iconCache = useMemo(() => buildIconCache(), []);

  const markers = useMemo(() => {
    const list = [];
    filteredPeople.forEach(person => {
      person.locations?.forEach((loc, i) => {
        if (!loc.latitude || !loc.longitude) return;
        if (!selectedLocationTypes.includes(loc.type)) return;
        const type = loc.type || 'other';
        const confidence = loc.geocode_confidence || 0;
        const partial = confidence < 50;
        list.push({
          id: `${person.id}-${i}`,
          lat: parseFloat(loc.latitude),
          lng: parseFloat(loc.longitude),
          personId: person.id,
          personName: `${person.first_name || ''} ${person.last_name || ''}`.trim(),
          personCategory: person.category,
          personCaseName: person.case_name,
          locationType: type,
          locationAddress: loc.address,
          locationCity: loc.city,
          locationCountry: loc.country,
          locationConfidence: confidence,
          icon: iconCache[`${type}-${partial ? 'partial' : 'full'}`] || iconCache['other-full'],
          isPartialData: partial,
        });
      });
    });
    if (showNetworks) {
      wirelessNetworks.forEach(n => {
        list.push({
          id: `network-${n.id}`,
          lat: parseFloat(n.latitude),
          lng: parseFloat(n.longitude),
          type: 'wireless_network',
          ssid: n.ssid, bssid: n.bssid, encryption: n.encryption,
          networkType: n.network_type, signalStrength: n.signal_strength,
          areaName: n.area_name, password: n.password, notes: n.notes,
          associatedPersonIds: n.associated_person_ids || [],
          icon: iconCache['wifi'],
        });
      });
    }
    return list;
  }, [filteredPeople, selectedLocationTypes, iconCache, wirelessNetworks, showNetworks]);

  const toggleLocationType = (type) =>
    setSelectedLocationTypes(prev => prev.includes(type) ? prev.filter(t => t !== type) : [...prev, type]);

  const missingCoordinates = useMemo(() => {
    let count = 0;
    people.forEach(p => p.locations?.forEach(loc => {
      if ((!loc.latitude || !loc.longitude) && (loc.address || loc.city || loc.country)) count++;
    }));
    return count;
  }, [people]);

  if (loading && people.length === 0) {
    return (
      <div className="h-full flex flex-col bg-white dark:bg-slate-900 rounded-lg m-4 overflow-hidden border border-slate-200 dark:border-slate-700">
        <div className="h-12 bg-slate-100 dark:bg-slate-800 animate-pulse" />
        <div className="flex-1 bg-slate-200 dark:bg-slate-700 animate-pulse" />
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="h-full flex items-center justify-center bg-white dark:bg-slate-900 rounded-lg m-4 border border-slate-200 dark:border-slate-700">
        <div className="text-center p-8">
          <p className="text-slate-700 dark:text-slate-300 font-medium mb-3">Failed to load map data</p>
          <button
            onClick={() => { setLoadError(false); fetchPeople(); }}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 transition-colors"
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
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4 mb-4 transition-colors">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Global Location Map</h1>
          <div className="flex items-center space-x-4">
            {missingCoordinates > 0 && (
              <button
                onClick={triggerBatchGeocode}
                disabled={geocoding}
                className="px-4 py-2 bg-yellow-600 text-white rounded hover:bg-yellow-700 transition-all flex items-center disabled:opacity-50"
                title={`${missingCoordinates} locations need geocoding`}
              >
                <RefreshCw className={`w-4 h-4 mr-2 ${geocoding ? 'animate-spin' : ''}`} />
                {geocoding ? 'Geocoding...' : `Geocode ${missingCoordinates} Locations`}
              </button>
            )}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500 w-5 h-5" />
              <input
                type="text"
                placeholder="Search people..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="pl-10 pr-3 py-2 bg-white dark:bg-slate-800 dark:text-gray-100 dark:placeholder-gray-600 border border-gray-300 dark:border-gray-600 rounded focus:outline-none focus:border-blue-500 w-64"
              />
            </div>
            <label className="flex items-center space-x-2 cursor-pointer">
              <input type="checkbox" checked={includeRelated} onChange={e => setIncludeRelated(e.target.checked)} className="h-4 w-4 text-blue-600 rounded" />
              <span className="text-sm text-gray-700 dark:text-gray-300">Include related people</span>
            </label>
            <label className="flex items-center space-x-2 cursor-pointer">
              <input type="checkbox" checked={showNetworks} onChange={e => setShowNetworks(e.target.checked)} className="h-4 w-4 text-blue-600 rounded" />
              <span className="text-sm text-gray-700 dark:text-gray-300 flex items-center">
                <Wifi className="w-4 h-4 mr-1" />
                Wireless Networks ({wirelessNetworks.length})
              </span>
            </label>
          </div>
        </div>

        {/* Location type filters */}
        <div className="mt-4 flex items-center space-x-4">
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
            <Filter className="w-4 h-4 inline mr-1" />Filter by type:
          </span>
          <div className="flex flex-wrap gap-2">
            {Object.entries(locationColors).map(([type, color]) => (
              <button
                key={type}
                onClick={() => toggleLocationType(type)}
                className={`px-3 py-1 rounded-full text-xs font-medium text-white transition-all ${selectedLocationTypes.includes(type) ? 'ring-2 ring-offset-2' : 'opacity-50'}`}
                style={{ backgroundColor: color }}
              >
                {type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Map */}
      <div className="flex-1 relative">
        <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 shadow-lg rounded-lg h-full overflow-hidden" style={{ isolation: 'isolate' }}>
          <MapContainer center={[20, 0]} zoom={2} style={{ height: '100%', width: '100%', zIndex: 1 }} worldCopyJump>
            <TileLayer url={OSM_TILE_URL} attribution={OSM_ATTRIBUTION} />
            <MarkerClusterGroup chunkedLoading maxClusterRadius={60} spiderfyOnMaxZoom showCoverageOnHover={false} zoomToBoundsOnClick>
              {markers.map(marker => (
                <Marker key={marker.id} position={[marker.lat, marker.lng]} icon={marker.icon}>
                  <Popup>
                    {marker.type === 'wireless_network' ? (
                      <div className="p-2 min-w-[200px]">
                        <h3 className="font-semibold text-blue-600 dark:text-blue-400 flex items-center">
                          <Wifi className="w-4 h-4 mr-2" />{marker.ssid}
                        </h3>
                        <p className="text-xs text-gray-600 dark:text-gray-400 font-mono">{marker.bssid}</p>
                        <div className="mt-2 border-t dark:border-gray-600 pt-2 space-y-1">
                          {marker.encryption && <p className="text-sm"><span className="font-medium">Security:</span> {marker.encryption}</p>}
                          {marker.networkType && <p className="text-sm"><span className="font-medium">Type:</span> {marker.networkType}</p>}
                          {marker.signalStrength && <p className="text-sm"><span className="font-medium">Signal:</span> {marker.signalStrength} dBm</p>}
                          {marker.areaName && <p className="text-sm text-gray-600 dark:text-gray-400">{marker.areaName}</p>}
                          {marker.notes && <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{marker.notes}</p>}
                          {marker.associatedPersonIds.length > 0 && (
                            <p className="text-xs text-green-600 dark:text-green-400 mt-1">{marker.associatedPersonIds.length} associated person(s)</p>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className="p-2 min-w-[200px]">
                        <h3 className="font-semibold text-gray-900 dark:text-gray-100">{marker.personName}</h3>
                        {marker.personCategory && <p className="text-sm text-gray-600 dark:text-gray-400">{marker.personCategory}</p>}
                        {marker.personCaseName && <p className="text-xs text-blue-600 dark:text-blue-400">Case: {marker.personCaseName}</p>}
                        <div className="mt-2 border-t dark:border-gray-600 pt-2">
                          <div className="flex items-center justify-between mb-1">
                            <p className="text-xs font-medium text-gray-700 dark:text-gray-300">
                              {marker.locationType.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                            </p>
                            {marker.locationConfidence > 0 && (
                              <span className={`text-xs px-2 py-0.5 rounded ${
                                marker.locationConfidence >= 70 ? 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300' :
                                marker.locationConfidence >= 50 ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300' :
                                'bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300'
                              }`}>
                                {marker.locationConfidence >= 70 ? 'High' : marker.locationConfidence >= 50 ? 'Medium' : 'Low'} {marker.locationConfidence}%
                              </span>
                            )}
                          </div>
                          {marker.locationAddress && <p className="text-sm text-gray-800 dark:text-gray-200">{marker.locationAddress}</p>}
                          <p className="text-sm text-gray-600 dark:text-gray-400">
                            {[marker.locationCity, marker.locationCountry].filter(Boolean).join(', ')}
                          </p>
                          {marker.isPartialData && (
                            <p className="text-xs text-orange-600 dark:text-orange-400 mt-1 flex items-center">
                              <AlertCircle className="w-3 h-3 mr-1" />Approximate location
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

          <MapLegend />
          <MapStats
            peopleCount={filteredPeople.length}
            markersCount={markers.length}
            geocodingStats={geocodingStats}
            missingCoordinates={missingCoordinates}
            loading={loading}
            hasMore={hasMore}
            totalPages={totalPages}
            currentPage={currentPage}
            onLoadMore={() => { if (!loading && hasMore) fetchPeople(currentPage + 1); }}
          />

          {/* Add Location toggle */}
          <div className="absolute top-4 right-4 bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-600 shadow-lg rounded p-2 z-10">
            <button
              onClick={() => setShowAddLocation(true)}
              className="p-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-all flex items-center"
              title="Add New Location"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {showAddLocation && (
        <AddLocationModal
          allPeople={allPeople}
          onSuccess={() => { fetchPeople(); fetchGeocodingStats(); }}
          onClose={() => setShowAddLocation(false)}
        />
      )}
    </div>
  );
};

export default GlobalMap;
