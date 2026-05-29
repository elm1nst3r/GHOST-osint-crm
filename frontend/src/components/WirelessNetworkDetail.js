// File: frontend/src/components/WirelessNetworkDetail.js
import React, { useState } from 'react';
import { X, Wifi, Bluetooth, Radio, Trash2 } from 'lucide-react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { wirelessNetworksAPI } from '../utils/api';
import { OSM_TILE_URL, OSM_ATTRIBUTION } from '../utils/mapConstants';
import NetworkInfoSection from './wireless/NetworkInfoSection';
import NetworkAssociation from './wireless/NetworkAssociation';

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

const getNetworkTypeIcon = (type) => {
  if (type === 'BLUETOOTH_CLASSIC' || type === 'BLUETOOTH_LE')
    return <Bluetooth className="w-6 h-6 text-blue-600 dark:text-blue-400" />;
  if (type === 'CELL')
    return <Radio className="w-6 h-6 text-purple-600 dark:text-purple-400" />;
  return <Wifi className="w-6 h-6 text-cyan-600 dark:text-cyan-400" />;
};

const WirelessNetworkDetail = ({ network, onClose, onUpdate, onDelete, people = [] }) => {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const handleSaveNetwork = async (data) => {
    setSaving(true);
    setError(null);
    try {
      await wirelessNetworksAPI.update(network.id, data);
      onUpdate?.();
    } catch (err) {
      setError(err.message || 'Failed to update network');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveAssociation = async (data) => {
    if (!data.person_id) { setError('Please select a person'); return; }
    setSaving(true);
    setError(null);
    try {
      await wirelessNetworksAPI.associate(network.id, data.person_id, data.association_note, data.association_confidence);
      onUpdate?.();
    } catch (err) {
      setError(err.message || 'Failed to associate network');
    } finally {
      setSaving(false);
    }
  };

  const handleRemoveAssociation = async () => {
    if (!window.confirm('Remove person association from this network?')) return;
    setSaving(true);
    setError(null);
    try {
      await wirelessNetworksAPI.removeAssociation(network.id);
      onUpdate?.();
    } catch (err) {
      setError(err.message || 'Failed to remove association');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm(`Delete network "${network.ssid}"?`)) return;
    try {
      await wirelessNetworksAPI.delete(network.id);
      onDelete?.();
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to delete network');
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-white dark:bg-slate-800 rounded-lg shadow-2xl w-full max-w-3xl mx-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center space-x-3">
            <div className="w-12 h-12 rounded-lg bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center">
              {getNetworkTypeIcon(network.network_type)}
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 truncate">{network.ssid}</h2>
              <p className="text-sm text-gray-600 dark:text-gray-400 font-mono">{network.bssid}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg transition-colors">
            <X className="w-5 h-5 text-gray-500 dark:text-gray-400" />
          </button>
        </div>

        {error && (
          <div className="m-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
            <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
          </div>
        )}

        <div className="p-6 space-y-6">
          <NetworkInfoSection network={network} saving={saving} onSave={handleSaveNetwork} />

          {/* Map preview */}
          <div className="pt-6 border-t border-gray-200 dark:border-gray-700">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Location Preview</h3>
            <div className="h-64 rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700">
              <MapContainer center={[network.latitude, network.longitude]} zoom={16} style={{ height: '100%', width: '100%' }} scrollWheelZoom={false}>
                <TileLayer attribution={OSM_ATTRIBUTION} url={OSM_TILE_URL} />
                <Marker position={[network.latitude, network.longitude]}>
                  <Popup>
                    <div className="p-2">
                      <p className="font-semibold text-sm">{network.ssid}</p>
                      <p className="text-xs text-gray-600 dark:text-gray-400">{network.bssid}</p>
                      <p className="text-xs text-gray-500 dark:text-slate-400 mt-1">
                        {network.latitude.toFixed(6)}, {network.longitude.toFixed(6)}
                      </p>
                    </div>
                  </Popup>
                </Marker>
              </MapContainer>
            </div>
            <p className="text-xs text-gray-600 dark:text-gray-400 mt-2">
              Coordinates: {network.latitude.toFixed(6)}, {network.longitude.toFixed(6)}
              {network.accuracy && <span> • Accuracy: ±{network.accuracy}m</span>}
            </p>
          </div>

          <NetworkAssociation
            network={network}
            people={people}
            saving={saving}
            onSave={handleSaveAssociation}
            onRemove={handleRemoveAssociation}
          />
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-6 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-slate-900/50">
          <button onClick={handleDelete} className="flex items-center space-x-2 px-4 py-2 text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors">
            <Trash2 className="w-4 h-4" /><span>Delete Network</span>
          </button>
          <button onClick={onClose} className="px-6 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-all">
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default WirelessNetworkDetail;
