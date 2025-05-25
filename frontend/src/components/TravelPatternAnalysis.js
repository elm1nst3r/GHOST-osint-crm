// File: frontend/src/components/TravelPatternAnalysis.js
import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, CircleMarker } from 'react-leaflet';
import { 
  MapPin, Calendar, Clock, TrendingUp, BarChart2, 
  Plane, Car, Train, Ship, AlertCircle, Plus,
  Edit2, Trash2, X, Save, Globe, Activity
} from 'lucide-react';
import { travelHistoryAPI } from '../utils/api';
import { TRAVEL_PURPOSES, TRANSPORTATION_MODES } from '../utils/constants';
import L from 'leaflet';

const TravelPatternAnalysis = ({ personId, personName }) => {
  const [travelData, setTravelData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeView, setActiveView] = useState('timeline'); // timeline, map, statistics, add
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingTravel, setEditingTravel] = useState(null);
  const [formData, setFormData] = useState({
    location_type: 'travel',
    location_name: '',
    address: '',
    city: '',
    state: '',
    country: '',
    postal_code: '',
    latitude: null,
    longitude: null,
    arrival_date: '',
    departure_date: '',
    purpose: '',
    transportation_mode: '',
    notes: ''
  });

  useEffect(() => {
    fetchTravelData();
  }, [personId]);

  const fetchTravelData = async () => {
    try {
      setLoading(true);
      const data = await travelHistoryAPI.analyze(personId);
      setTravelData(data);
    } catch (err) {
      console.error('Error fetching travel data:', err);
      setError('Failed to load travel data');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    try {
      if (editingTravel) {
        await travelHistoryAPI.update(editingTravel.id, formData);
      } else {
        await travelHistoryAPI.create(personId, formData);
      }
      
      fetchTravelData();
      resetForm();
    } catch (err) {
      console.error('Error saving travel record:', err);
      alert('Failed to save travel record');
    }
  };

  const handleDelete = async (travelId) => {
    if (window.confirm('Are you sure you want to delete this travel record?')) {
      try {
        await travelHistoryAPI.delete(travelId);
        fetchTravelData();
      } catch (err) {
        console.error('Error deleting travel record:', err);
        alert('Failed to delete travel record');
      }
    }
  };

  const resetForm = () => {
    setFormData({
      location_type: 'travel',
      location_name: '',
      address: '',
      city: '',
      state: '',
      country: '',
      postal_code: '',
      latitude: null,
      longitude: null,
      arrival_date: '',
      departure_date: '',
      purpose: '',
      transportation_mode: '',
      notes: ''
    });
    setEditingTravel(null);
    setShowAddForm(false);
  };

  const geocodeAddress = async () => {
    if (!formData.address && !formData.city && !formData.country) {
      alert('Please enter an address, city, or country to geocode');
      return;
    }

    const query = [formData.address, formData.city, formData.state, formData.country]
      .filter(Boolean)
      .join(', ');

    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1`
      );
      const data = await response.json();
      
      if (data && data.length > 0) {
        setFormData({
          ...formData,
          latitude: parseFloat(data[0].lat),
          longitude: parseFloat(data[0].lon)
        });
        alert('Location geocoded successfully!');
      } else {
        alert('Could not find coordinates for this address');
      }
    } catch (err) {
      console.error('Geocoding error:', err);
      alert('Failed to geocode address');
    }
  };

  const getTransportIcon = (mode) => {
    const icons = {
      airplane: Plane,
      train: Train,
      car: Car,
      ship: Ship,
      private_jet: Plane,
      helicopter: Plane,
    };
    const Icon = icons[mode] || MapPin;
    return <Icon className="w-4 h-4" />;
  };

  const getDuration = (arrival, departure) => {
    if (!arrival || !departure) return 'N/A';
    const days = Math.floor((new Date(departure) - new Date(arrival)) / (1000 * 60 * 60 * 24));
    return `${days} day${days !== 1 ? 's' : ''}`;
  };

  const formatDate = (date) => {
    if (!date) return 'N/A';
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading travel data...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto" />
          <p className="mt-4 text-red-600">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with Navigation */}
      <div className="bg-white rounded-lg shadow-sm p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">Travel Pattern Analysis</h3>
          <button
            onClick={() => setShowAddForm(true)}
            className="px-3 py-1 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 flex items-center"
          >
            <Plus className="w-4 h-4 mr-1" />
            Add Travel Record
          </button>
        </div>
        
        <div className="flex space-x-2">
          <button
            onClick={() => setActiveView('timeline')}
            className={`px-4 py-2 rounded-md text-sm ${
              activeView === 'timeline' 
                ? 'bg-blue-600 text-white' 
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            <Calendar className="w-4 h-4 inline mr-1" />
            Timeline
          </button>
          <button
            onClick={() => setActiveView('map')}
            className={`px-4 py-2 rounded-md text-sm ${
              activeView === 'map' 
                ? 'bg-blue-600 text-white' 
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            <Globe className="w-4 h-4 inline mr-1" />
            Map View
          </button>
          <button
            onClick={() => setActiveView('statistics')}
            className={`px-4 py-2 rounded-md text-sm ${
              activeView === 'statistics' 
                ? 'bg-blue-600 text-white' 
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            <BarChart2 className="w-4 h-4 inline mr-1" />
            Statistics
          </button>
        </div>
      </div>

      {/* Add/Edit Form */}
      {(showAddForm || editingTravel) && (
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h4 className="text-lg font-semibold mb-4">
            {editingTravel ? 'Edit Travel Record' : 'Add Travel Record'}
          </h4>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Location Name</label>
                <input
                  type="text"
                  value={formData.location_name}
                  onChange={(e) => setFormData({ ...formData, location_name: e.target.value })}
                  className="w-full px-3 py-2 border rounded-md"
                  placeholder="e.g., Hilton Paris"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Purpose</label>
                <select
                  value={formData.purpose}
                  onChange={(e) => setFormData({ ...formData, purpose: e.target.value })}
                  className="w-full px-3 py-2 border rounded-md"
                >
                  <option value="">Select Purpose</option>
                  {TRAVEL_PURPOSES.map(purpose => (
                    <option key={purpose.value} value={purpose.value}>
                      {purpose.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">City *</label>
                <input
                  type="text"
                  value={formData.city}
                  onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                  className="w-full px-3 py-2 border rounded-md"
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">State/Province</label>
                <input
                  type="text"
                  value={formData.state}
                  onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                  className="w-full px-3 py-2 border rounded-md"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Country *</label>
                <input
                  type="text"
                  value={formData.country}
                  onChange={(e) => setFormData({ ...formData, country: e.target.value })}
                  className="w-full px-3 py-2 border rounded-md"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Street Address</label>
              <div className="flex space-x-2">
                <input
                  type="text"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  className="flex-1 px-3 py-2 border rounded-md"
                />
                <button
                  type="button"
                  onClick={geocodeAddress}
                  className="px-3 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700"
                  title="Get coordinates"
                >
                  <MapPin className="w-4 h-4" />
                </button>
              </div>
              {formData.latitude && formData.longitude && (
                <p className="text-xs text-gray-500 mt-1">
                  Coordinates: {formData.latitude.toFixed(6)}, {formData.longitude.toFixed(6)}
                </p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Arrival Date *</label>
                <input
                  type="datetime-local"
                  value={formData.arrival_date}
                  onChange={(e) => setFormData({ ...formData, arrival_date: e.target.value })}
                  className="w-full px-3 py-2 border rounded-md"
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Departure Date</label>
                <input
                  type="datetime-local"
                  value={formData.departure_date}
                  onChange={(e) => setFormData({ ...formData, departure_date: e.target.value })}
                  className="w-full px-3 py-2 border rounded-md"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Transportation Mode</label>
              <select
                value={formData.transportation_mode}
                onChange={(e) => setFormData({ ...formData, transportation_mode: e.target.value })}
                className="w-full px-3 py-2 border rounded-md"
              >
                <option value="">Select Transportation</option>
                {TRANSPORTATION_MODES.map(mode => (
                  <option key={mode.value} value={mode.value}>
                    {mode.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
              <textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                className="w-full px-3 py-2 border rounded-md"
                rows="3"
              />
            </div>

            <div className="flex justify-end space-x-2">
              <button
                type="button"
                onClick={resetForm}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
              >
                {editingTravel ? 'Update' : 'Save'} Travel Record
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Content based on active view */}
      {activeView === 'timeline' && (
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h4 className="text-lg font-semibold mb-4">Travel Timeline</h4>
          {travelData?.history?.length > 0 ? (
            <div className="space-y-4">
              {travelData.history.map((travel, index) => (
                <div key={travel.id} className="border-l-4 border-blue-500 pl-4 pb-4 relative">
                  <div className="absolute -left-2 top-0 w-4 h-4 bg-blue-500 rounded-full"></div>
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center space-x-2 mb-1">
                        <h5 className="font-semibold">
                          {travel.city}, {travel.country}
                        </h5>
                        {travel.transportation_mode && (
                          <span className="text-gray-500">
                            {getTransportIcon(travel.transportation_mode)}
                          </span>
                        )}
                      </div>
                      {travel.location_name && (
                        <p className="text-sm text-gray-600">{travel.location_name}</p>
                      )}
                      <div className="flex items-center space-x-4 text-sm text-gray-500 mt-1">
                        <span className="flex items-center">
                          <Calendar className="w-3 h-3 mr-1" />
                          {formatDate(travel.arrival_date)} - {formatDate(travel.departure_date)}
                        </span>
                        <span className="flex items-center">
                          <Clock className="w-3 h-3 mr-1" />
                          {getDuration(travel.arrival_date, travel.departure_date)}
                        </span>
                        {travel.purpose && (
                          <span className="px-2 py-1 bg-gray-100 rounded text-xs">
                            {TRAVEL_PURPOSES.find(p => p.value === travel.purpose)?.label || travel.purpose}
                          </span>
                        )}
                      </div>
                      {travel.notes && (
                        <p className="text-sm text-gray-600 mt-2">{travel.notes}</p>
                      )}
                    </div>
                    <div className="flex space-x-1">
                      <button
                        onClick={() => {
                          setEditingTravel(travel);
                          setFormData({
                            ...travel,
                            arrival_date: travel.arrival_date ? 
                              new Date(travel.arrival_date).toISOString().slice(0, 16) : '',
                            departure_date: travel.departure_date ? 
                              new Date(travel.departure_date).toISOString().slice(0, 16) : ''
                          });
                        }}
                        className="text-gray-600 hover:text-gray-700"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(travel.id)}
                        className="text-red-600 hover:text-red-700"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500 text-center py-8">No travel history recorded yet.</p>
          )}
        </div>
      )}

      {activeView === 'map' && (
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h4 className="text-lg font-semibold mb-4">Travel Map</h4>
          <div className="h-96 rounded-lg overflow-hidden">
            <MapContainer
              center={[20, 0]}
              zoom={2}
              style={{ height: '100%', width: '100%' }}
            >
              <TileLayer
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              />
              
              {/* Travel locations */}
              {travelData?.history?.filter(t => t.latitude && t.longitude).map((travel, index) => (
                <CircleMarker
                  key={travel.id}
                  center={[travel.latitude, travel.longitude]}
                  radius={8}
                  fillColor="#3b82f6"
                  fillOpacity={0.8}
                  color="#1e40af"
                  weight={2}
                >
                  <Popup>
                    <div className="p-2">
                      <h5 className="font-semibold">{travel.city}, {travel.country}</h5>
                      {travel.location_name && <p className="text-sm">{travel.location_name}</p>}
                      <p className="text-xs text-gray-600 mt-1">
                        {formatDate(travel.arrival_date)} - {formatDate(travel.departure_date)}
                      </p>
                      {travel.purpose && (
                        <p className="text-xs mt-1">
                          Purpose: {TRAVEL_PURPOSES.find(p => p.value === travel.purpose)?.label}
                        </p>
                      )}
                    </div>
                  </Popup>
                </CircleMarker>
              ))}
              
              {/* Travel routes (connect consecutive locations) */}
              {travelData?.history?.length > 1 && (() => {
                const validLocations = travelData.history
                  .filter(t => t.latitude && t.longitude)
                  .sort((a, b) => new Date(a.arrival_date) - new Date(b.arrival_date));
                
                return validLocations.slice(0, -1).map((travel, index) => {
                  const nextTravel = validLocations[index + 1];
                  return (
                    <Polyline
                      key={`route-${travel.id}-${nextTravel.id}`}
                      positions={[
                        [travel.latitude, travel.longitude],
                        [nextTravel.latitude, nextTravel.longitude]
                      ]}
                      color="#6b7280"
                      weight={2}
                      opacity={0.6}
                      dashArray="5, 5"
                    />
                  );
                });
              })()}
            </MapContainer>
          </div>
        </div>
      )}

      {activeView === 'statistics' && travelData && (
        <div className="space-y-6">
          {/* Summary Statistics */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-white rounded-lg shadow-sm p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Countries Visited</p>
                  <p className="text-2xl font-bold text-blue-600">
                    {travelData.statistics?.countries_visited || 0}
                  </p>
                </div>
                <Globe className="w-8 h-8 text-blue-400" />
              </div>
            </div>
            
            <div className="bg-white rounded-lg shadow-sm p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Cities Visited</p>
                  <p className="text-2xl font-bold text-green-600">
                    {travelData.statistics?.cities_visited || 0}
                  </p>
                </div>
                <MapPin className="w-8 h-8 text-green-400" />
              </div>
            </div>
            
            <div className="bg-white rounded-lg shadow-sm p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Total Trips</p>
                  <p className="text-2xl font-bold text-purple-600">
                    {travelData.statistics?.total_trips || 0}
                  </p>
                </div>
                <Activity className="w-8 h-8 text-purple-400" />
              </div>
            </div>
            
            <div className="bg-white rounded-lg shadow-sm p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Avg Trip Duration</p>
                  <p className="text-2xl font-bold text-orange-600">
                    {Math.round(travelData.statistics?.avg_trip_duration || 0)} days
                  </p>
                </div>
                <Clock className="w-8 h-8 text-orange-400" />
              </div>
            </div>
          </div>

          {/* Most Visited Locations */}
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h4 className="text-lg font-semibold mb-4">Most Visited Locations</h4>
            {travelData.frequentLocations?.length > 0 ? (
              <div className="space-y-2">
                {travelData.frequentLocations.map((location, index) => (
                  <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center space-x-3">
                      <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center text-sm font-semibold text-blue-600">
                        {index + 1}
                      </div>
                      <div>
                        <p className="font-medium">{location.city}, {location.country}</p>
                      </div>
                    </div>
                    <div className="text-sm text-gray-600">
                      {location.visit_count} visit{location.visit_count > 1 ? 's' : ''}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500 text-center py-4">No location data available</p>
            )}
          </div>

          {/* Travel by Purpose */}
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h4 className="text-lg font-semibold mb-4">Travel by Purpose</h4>
            {travelData.travelByPurpose?.length > 0 ? (
              <div className="space-y-2">
                {travelData.travelByPurpose.map((purpose, index) => {
                  const purposeLabel = TRAVEL_PURPOSES.find(p => p.value === purpose.purpose)?.label || purpose.purpose || 'Unknown';
                  const percentage = Math.round((purpose.count / travelData.statistics.total_trips) * 100);
                  
                  return (
                    <div key={index} className="space-y-1">
                      <div className="flex justify-between text-sm">
                        <span className="font-medium">{purposeLabel}</span>
                        <span className="text-gray-600">{purpose.count} trips ({percentage}%)</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className="bg-blue-600 h-2 rounded-full"
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-gray-500 text-center py-4">No purpose data available</p>
            )}
          </div>

          {/* Travel Patterns */}
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h4 className="text-lg font-semibold mb-4">Travel Patterns & Insights</h4>
            <div className="space-y-3">
              {travelData.statistics?.first_trip && (
                <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
                  <span className="text-sm font-medium text-blue-900">First Recorded Trip</span>
                  <span className="text-sm text-blue-700">{formatDate(travelData.statistics.first_trip)}</span>
                </div>
              )}
              
              {travelData.statistics?.last_trip && (
                <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
                  <span className="text-sm font-medium text-green-900">Most Recent Trip</span>
                  <span className="text-sm text-green-700">{formatDate(travelData.statistics.last_trip)}</span>
                </div>
              )}
              
              {travelData.monthlyFrequency?.length > 0 && (() => {
                const currentYear = new Date().getFullYear();
                const thisYearTrips = travelData.monthlyFrequency
                  .filter(m => m.year === currentYear)
                  .reduce((sum, m) => sum + parseInt(m.trips), 0);
                
                return (
                  <div className="flex items-center justify-between p-3 bg-purple-50 rounded-lg">
                    <span className="text-sm font-medium text-purple-900">Trips This Year</span>
                    <span className="text-sm text-purple-700">{thisYearTrips} trips</span>
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TravelPatternAnalysis;