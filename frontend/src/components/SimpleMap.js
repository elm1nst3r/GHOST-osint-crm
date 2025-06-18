// File: frontend/src/components/SimpleMap.js
import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { RefreshCw, MapPin, Users } from 'lucide-react';

// Fix leaflet default icon
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

const SimpleMap = () => {
  const [locations, setLocations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchLocations();
  }, []);

  const fetchLocations = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';
      const response = await fetch(`${API_BASE_URL}/locations?limit=100&confidence=0&includeUngeocoded=false`);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch locations: ${response.status}`);
      }
      
      const result = await response.json();
      console.log('Locations data:', result);
      
      // Transform data for map display
      const mapLocations = [];
      if (result.data && Array.isArray(result.data)) {
        result.data.forEach(person => {
          if (person.locations && Array.isArray(person.locations)) {
            person.locations.forEach(location => {
              if (location.latitude && location.longitude) {
                mapLocations.push({
                  id: `${person.id}-${location.id || Math.random()}`,
                  lat: parseFloat(location.latitude),
                  lng: parseFloat(location.longitude),
                  personName: `${person.first_name || ''} ${person.last_name || ''}`.trim(),
                  address: location.address || '',
                  city: location.city || '',
                  country: location.country || '',
                  type: location.type || 'other'
                });
              }
            });
          }
        });
      }
      
      setLocations(mapLocations);
      console.log('Processed locations for map:', mapLocations);
      
    } catch (err) {
      console.error('Error fetching locations:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center bg-gray-50 border border-gray-200 rounded-lg">
        <div className="text-center p-8">
          <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-2 text-blue-600" />
          <span className="text-gray-700 font-medium">Loading map...</span>
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
            onClick={fetchLocations}
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
          <h1 className="text-2xl font-bold text-gray-900">Location Map</h1>
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2 text-sm text-gray-600">
              <MapPin className="w-4 h-4" />
              <span>{locations.length} locations</span>
            </div>
            <button
              onClick={fetchLocations}
              className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Map Container */}
      <div className="flex-1 bg-white border border-gray-200 rounded-b-lg overflow-hidden">
        {locations.length === 0 ? (
          <div className="h-full flex items-center justify-center text-gray-500">
            <div className="text-center">
              <MapPin className="w-12 h-12 mx-auto mb-4 text-gray-300" />
              <p>No locations with coordinates found</p>
              <p className="text-sm mt-2">Add addresses to people and geocode them to see locations on the map</p>
            </div>
          </div>
        ) : (
          <MapContainer
            center={locations.length > 0 ? [locations[0].lat, locations[0].lng] : [40.7128, -74.0060]}
            zoom={locations.length === 1 ? 10 : 2}
            style={{ height: '100%', width: '100%' }}
            className="z-0"
          >
            <TileLayer
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            />
            
            {locations.map((location) => (
              <Marker
                key={location.id}
                position={[location.lat, location.lng]}
              >
                <Popup>
                  <div className="p-2">
                    <h3 className="font-semibold">{location.personName}</h3>
                    <p className="text-sm text-gray-600">{location.type.replace(/_/g, ' ')}</p>
                    <div className="mt-2">
                      {location.address && <p className="text-sm">{location.address}</p>}
                      <p className="text-sm text-gray-600">
                        {[location.city, location.country].filter(Boolean).join(', ')}
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        {location.lat.toFixed(4)}, {location.lng.toFixed(4)}
                      </p>
                    </div>
                  </div>
                </Popup>
              </Marker>
            ))}
          </MapContainer>
        )}
      </div>
    </div>
  );
};

export default SimpleMap;