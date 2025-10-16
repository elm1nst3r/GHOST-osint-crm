// File: frontend/src/components/WirelessNetworkMap.js
import React, { useEffect, useMemo, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap, useMapEvents } from 'react-leaflet';
import MarkerClusterGroup from 'react-leaflet-cluster';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Lock, Unlock, Wifi, Bluetooth, Radio, Signal } from 'lucide-react';

// Fix Leaflet default marker icon issue
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// Create custom marker icons based on network properties
const createCustomIcon = (network, showLabel = false) => {
  let color;

  // Color by encryption level
  if (network.encryption === 'WPA2' || network.encryption === 'WPA3') {
    color = '#059669'; // Green - Encrypted
  } else if (network.encryption === 'WPA') {
    color = '#D97706'; // Amber - WPA
  } else if (network.encryption === 'WEP') {
    color = '#EA580C'; // Orange - WEP
  } else if (network.encryption === 'Open' || network.encryption === 'None') {
    color = '#DC2626'; // Red - Open
  } else if (network.network_type === 'BLUETOOTH_CLASSIC' || network.network_type === 'BLUETOOTH_LE') {
    color = '#2563EB'; // Blue - Bluetooth
  } else if (network.person_id) {
    color = '#7C3AED'; // Purple - Associated with person
  } else {
    color = '#64748B'; // Gray - Unknown
  }

  // Truncate SSID for display
  const displaySSID = network.ssid.length > 20 ? network.ssid.substring(0, 20) + '...' : network.ssid;

  const markerIcon = `
    <svg width="32" height="42" viewBox="0 0 32 42" xmlns="http://www.w3.org/2000/svg">
      <path d="M16 0C7.163 0 0 7.163 0 16c0 12 16 26 16 26s16-14 16-26C32 7.163 24.837 0 16 0z"
            fill="${color}" stroke="white" stroke-width="2"/>
      <circle cx="16" cy="16" r="6" fill="white" opacity="0.9"/>
    </svg>
  `;

  const labelHTML = showLabel ? `
    <div class="wireless-network-label">
      <div class="label-text">${displaySSID}</div>
    </div>
  ` : '';

  return L.divIcon({
    html: `
      <div class="wireless-marker-container">
        ${markerIcon}
        ${labelHTML}
      </div>
    `,
    className: 'custom-marker-icon',
    iconSize: showLabel ? [32, 62] : [32, 42],
    iconAnchor: [16, 42],
    popupAnchor: [0, -42],
  });
};

// Map bounds component to fit markers
const FitBounds = ({ networks }) => {
  const map = useMap();

  useEffect(() => {
    if (networks && networks.length > 0) {
      const bounds = networks.map(n => [n.latitude, n.longitude]);
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 15 });
    }
  }, [networks, map]);

  return null;
};

// Signal strength indicator
const SignalIndicator = ({ strength }) => {
  if (!strength) return null;

  let bars = 1;
  let color = 'text-red-500';

  if (strength >= -50) {
    bars = 4;
    color = 'text-green-500 dark:text-green-400';
  } else if (strength >= -60) {
    bars = 3;
    color = 'text-green-500 dark:text-green-400';
  } else if (strength >= -70) {
    bars = 2;
    color = 'text-yellow-500 dark:text-yellow-400';
  } else {
    bars = 1;
    color = 'text-red-500 dark:text-red-400';
  }

  return (
    <div className="flex items-center space-x-1">
      <Signal className={`w-3 h-3 ${color}`} />
      <div className="flex space-x-0.5">
        {[1, 2, 3, 4].map((bar) => (
          <div
            key={bar}
            className={`w-1 ${bar <= bars ? color.replace('text-', 'bg-') : 'bg-gray-300 dark:bg-gray-600'}`}
            style={{ height: `${bar * 3}px` }}
          />
        ))}
      </div>
    </div>
  );
};

// Network type icon
const NetworkTypeIcon = ({ type }) => {
  switch (type) {
    case 'BLUETOOTH_CLASSIC':
    case 'BLUETOOTH_LE':
      return <Bluetooth className="w-4 h-4 text-blue-600 dark:text-blue-400" />;
    case 'CELL':
      return <Radio className="w-4 h-4 text-purple-600 dark:text-purple-400" />;
    case 'WIFI':
    default:
      return <Wifi className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />;
  }
};

// Component to track zoom level
const ZoomTracker = ({ setZoom }) => {
  const map = useMapEvents({
    zoomend: () => {
      setZoom(map.getZoom());
    },
  });

  useEffect(() => {
    setZoom(map.getZoom());
  }, [map, setZoom]);

  return null;
};

const WirelessNetworkMap = ({ networks, onNetworkClick, people = [] }) => {
  const [zoom, setZoom] = useState(13);

  // Calculate map center
  const center = useMemo(() => {
    if (!networks || networks.length === 0) {
      return [47.38, 8.18]; // Default center (Zurich area from sample)
    }
    const avgLat = networks.reduce((sum, n) => sum + n.latitude, 0) / networks.length;
    const avgLng = networks.reduce((sum, n) => sum + n.longitude, 0) / networks.length;
    return [avgLat, avgLng];
  }, [networks]);

  // Show labels when zoomed in (zoom level 15 or higher)
  const showLabels = zoom >= 15;

  // Find person name by ID
  const getPersonName = (personId) => {
    const person = people.find(p => p.id === personId);
    return person ? `${person.first_name} ${person.last_name}` : 'Unknown';
  };

  // Format date
  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    try {
      return new Date(dateString).toLocaleString();
    } catch {
      return dateString;
    }
  };

  if (!networks || networks.length === 0) {
    return (
      <div className="h-96 bg-gray-100 dark:bg-slate-800 rounded-glass-lg flex items-center justify-center">
        <div className="text-center">
          <Wifi className="w-12 h-12 text-gray-400 dark:text-gray-600 mx-auto mb-3" />
          <p className="text-gray-600 dark:text-gray-400">No networks to display on map</p>
          <p className="text-sm text-gray-500 dark:text-gray-500 mt-1">
            Import a KML file to see wireless networks
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-[600px] rounded-glass-lg overflow-hidden border border-gray-200 dark:border-gray-700 shadow-lg">
      <MapContainer
        center={center}
        zoom={13}
        style={{ height: '100%', width: '100%' }}
        className="z-0"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        <FitBounds networks={networks} />
        <ZoomTracker setZoom={setZoom} />

        <MarkerClusterGroup
          chunkedLoading
          maxClusterRadius={50}
          spiderfyOnMaxZoom={true}
          showCoverageOnHover={false}
          zoomToBoundsOnClick={true}
        >
          {networks.map((network) => (
            <Marker
              key={network.id}
              position={[network.latitude, network.longitude]}
              icon={createCustomIcon(network, showLabels)}
              eventHandlers={{
                click: () => onNetworkClick && onNetworkClick(network),
              }}
            >
              <Popup className="custom-popup" maxWidth={300}>
                <div className="p-2 min-w-[280px]">
                  {/* SSID Header */}
                  <div className="flex items-start justify-between mb-3 pb-2 border-b border-gray-200 dark:border-gray-700">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center space-x-2">
                        <NetworkTypeIcon type={network.network_type} />
                        <h3 className="font-semibold text-gray-900 dark:text-gray-100 truncate">
                          {network.ssid}
                        </h3>
                      </div>
                      <p className="text-xs text-gray-600 dark:text-gray-400 font-mono mt-1">
                        {network.bssid}
                      </p>
                    </div>
                  </div>

                  {/* Network Details Grid */}
                  <div className="space-y-2">
                    {/* Encryption */}
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-gray-600 dark:text-gray-400">Encryption:</span>
                      <div className="flex items-center space-x-1">
                        {network.encryption === 'WPA2' || network.encryption === 'WPA3' ? (
                          <Lock className="w-3 h-3 text-green-600 dark:text-green-400" />
                        ) : (
                          <Unlock className="w-3 h-3 text-red-600 dark:text-red-400" />
                        )}
                        <span className={`text-xs font-medium ${
                          network.encryption === 'WPA2' || network.encryption === 'WPA3'
                            ? 'text-green-600 dark:text-green-400'
                            : 'text-red-600 dark:text-red-400'
                        }`}>
                          {network.encryption || 'Unknown'}
                        </span>
                      </div>
                    </div>

                    {/* Signal Strength */}
                    {network.signal_strength && (
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-gray-600 dark:text-gray-400">Signal:</span>
                        <div className="flex items-center space-x-2">
                          <span className="text-xs font-medium text-gray-900 dark:text-gray-100">
                            {network.signal_strength} dBm
                          </span>
                          <SignalIndicator strength={network.signal_strength} />
                        </div>
                      </div>
                    )}

                    {/* Network Type */}
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-gray-600 dark:text-gray-400">Type:</span>
                      <span className="text-xs font-medium text-gray-900 dark:text-gray-100">
                        {network.network_type?.replace(/_/g, ' ') || 'WIFI'}
                      </span>
                    </div>

                    {/* Frequency & Channel */}
                    {(network.frequency || network.channel) && (
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-gray-600 dark:text-gray-400">
                          {network.frequency ? 'Frequency:' : 'Channel:'}
                        </span>
                        <span className="text-xs font-medium text-gray-900 dark:text-gray-100">
                          {network.frequency || `Ch ${network.channel}`}
                        </span>
                      </div>
                    )}

                    {/* Scan Date */}
                    {network.scan_date && (
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-gray-600 dark:text-gray-400">Scanned:</span>
                        <span className="text-xs text-gray-900 dark:text-gray-100">
                          {formatDate(network.scan_date)}
                        </span>
                      </div>
                    )}

                    {/* Accuracy */}
                    {network.accuracy && (
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-gray-600 dark:text-gray-400">Accuracy:</span>
                        <span className="text-xs text-gray-900 dark:text-gray-100">
                          ±{network.accuracy}m
                        </span>
                      </div>
                    )}

                    {/* Person Association */}
                    {network.person_id && (
                      <div className="mt-3 pt-2 border-t border-gray-200 dark:border-gray-700">
                        <div className="flex items-start space-x-2">
                          <div className="w-2 h-2 rounded-full bg-purple-500 dark:bg-purple-400 mt-1.5 flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium text-purple-700 dark:text-purple-300">
                              Associated: {getPersonName(network.person_id)}
                            </p>
                            {network.association_confidence && (
                              <p className="text-xs text-purple-600 dark:text-purple-400 mt-0.5 capitalize">
                                {network.association_confidence} confidence
                              </p>
                            )}
                            {network.association_note && (
                              <p className="text-xs text-gray-600 dark:text-gray-400 mt-1 italic">
                                "{network.association_note}"
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Notes */}
                    {network.notes && (
                      <div className="mt-2 p-2 bg-gray-50 dark:bg-slate-700/50 rounded text-xs text-gray-700 dark:text-gray-300">
                        {network.notes}
                      </div>
                    )}
                  </div>

                  {/* Click for details */}
                  {onNetworkClick && (
                    <div className="mt-3 pt-2 border-t border-gray-200 dark:border-gray-700">
                      <button
                        onClick={() => onNetworkClick(network)}
                        className="w-full px-3 py-1.5 text-xs font-medium text-white bg-gradient-primary
                                 rounded hover:shadow-lg transition-all"
                      >
                        View Details
                      </button>
                    </div>
                  )}
                </div>
              </Popup>
            </Marker>
          ))}
        </MarkerClusterGroup>
      </MapContainer>

      {/* Map Legend */}
      <div className="absolute bottom-4 left-4 bg-white dark:bg-slate-800 rounded-glass-lg shadow-lg p-3 z-[1000] border border-gray-200 dark:border-gray-700">
        <p className="text-xs font-semibold text-gray-900 dark:text-gray-100 mb-2">Network Types</p>
        <div className="space-y-1.5">
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 rounded-full bg-green-600" />
            <span className="text-xs text-gray-700 dark:text-gray-300">WPA2/WPA3</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 rounded-full bg-amber-600" />
            <span className="text-xs text-gray-700 dark:text-gray-300">WPA</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 rounded-full bg-orange-600" />
            <span className="text-xs text-gray-700 dark:text-gray-300">WEP</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 rounded-full bg-red-600" />
            <span className="text-xs text-gray-700 dark:text-gray-300">Open</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 rounded-full bg-blue-600" />
            <span className="text-xs text-gray-700 dark:text-gray-300">Bluetooth</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 rounded-full bg-purple-600" />
            <span className="text-xs text-gray-700 dark:text-gray-300">Associated</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default WirelessNetworkMap;
