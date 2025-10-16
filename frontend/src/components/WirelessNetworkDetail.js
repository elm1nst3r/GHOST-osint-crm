// File: frontend/src/components/WirelessNetworkDetail.js
import React, { useState } from 'react';
import { X, Wifi, Lock, Unlock, Signal, MapPin, User, Edit2, Trash2, Save, Calendar, Bluetooth, Radio, Tag } from 'lucide-react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { wirelessNetworksAPI } from '../utils/api';

// Fix Leaflet default marker icon
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

const WirelessNetworkDetail = ({ network, onClose, onUpdate, onDelete, people = [] }) => {
  const [editing, setEditing] = useState(false);
  const [formData, setFormData] = useState({
    ssid: network.ssid || '',
    bssid: network.bssid || '',
    encryption: network.encryption || '',
    signal_strength: network.signal_strength || '',
    frequency: network.frequency || '',
    channel: network.channel || '',
    network_type: network.network_type || 'WIFI',
    notes: network.notes || '',
    area_name: network.area_name || '',
    tags: network.tags ? network.tags.join(', ') : '',
  });

  const [associating, setAssociating] = useState(false);
  const [associationData, setAssociationData] = useState({
    person_id: network.person_id || '',
    association_note: network.association_note || '',
    association_confidence: network.association_confidence || 'possible',
  });

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  // Get signal strength description
  const getSignalDescription = (signal) => {
    if (!signal) return 'Unknown';
    if (signal >= -50) return 'Excellent';
    if (signal >= -60) return 'Good';
    if (signal >= -70) return 'Fair';
    return 'Weak';
  };

  // Get signal color
  const getSignalColor = (signal) => {
    if (!signal) return 'text-gray-500';
    if (signal >= -50) return 'text-green-600 dark:text-green-400';
    if (signal >= -60) return 'text-green-600 dark:text-green-400';
    if (signal >= -70) return 'text-yellow-600 dark:text-yellow-400';
    return 'text-red-600 dark:text-red-400';
  };

  // Network type icon
  const getNetworkTypeIcon = () => {
    switch (network.network_type) {
      case 'BLUETOOTH_CLASSIC':
      case 'BLUETOOTH_LE':
        return <Bluetooth className="w-6 h-6 text-blue-600 dark:text-blue-400" />;
      case 'CELL':
        return <Radio className="w-6 h-6 text-purple-600 dark:text-purple-400" />;
      case 'WIFI':
      default:
        return <Wifi className="w-6 h-6 text-cyan-600 dark:text-cyan-400" />;
    }
  };

  // Handle form input change
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  // Handle association input change
  const handleAssociationChange = (e) => {
    const { name, value } = e.target;
    setAssociationData(prev => ({ ...prev, [name]: value }));
  };

  // Save network updates
  const handleSave = async () => {
    setSaving(true);
    setError(null);

    try {
      const updateData = {
        ...formData,
        tags: formData.tags ? formData.tags.split(',').map(t => t.trim()).filter(Boolean) : null,
        signal_strength: formData.signal_strength ? parseInt(formData.signal_strength) : null,
        channel: formData.channel ? parseInt(formData.channel) : null,
      };

      await wirelessNetworksAPI.update(network.id, updateData);
      setEditing(false);
      onUpdate && onUpdate();
    } catch (err) {
      console.error('Error updating network:', err);
      setError(err.message || 'Failed to update network');
    } finally {
      setSaving(false);
    }
  };

  // Save person association
  const handleSaveAssociation = async () => {
    if (!associationData.person_id) {
      setError('Please select a person');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      await wirelessNetworksAPI.associate(
        network.id,
        associationData.person_id,
        associationData.association_note,
        associationData.association_confidence
      );
      setAssociating(false);
      onUpdate && onUpdate();
    } catch (err) {
      console.error('Error associating network:', err);
      setError(err.message || 'Failed to associate network');
    } finally {
      setSaving(false);
    }
  };

  // Remove association
  const handleRemoveAssociation = async () => {
    if (!window.confirm('Remove person association from this network?')) return;

    setSaving(true);
    setError(null);

    try {
      await wirelessNetworksAPI.removeAssociation(network.id);
      setAssociationData({
        person_id: '',
        association_note: '',
        association_confidence: 'possible',
      });
      onUpdate && onUpdate();
    } catch (err) {
      console.error('Error removing association:', err);
      setError(err.message || 'Failed to remove association');
    } finally {
      setSaving(false);
    }
  };

  // Delete network
  const handleDelete = async () => {
    if (!window.confirm(`Delete network "${network.ssid}"?`)) return;

    try {
      await wirelessNetworksAPI.delete(network.id);
      onDelete && onDelete();
      onClose();
    } catch (err) {
      console.error('Error deleting network:', err);
      setError(err.message || 'Failed to delete network');
    }
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

  // Get person name
  const getPersonName = (personId) => {
    const person = people.find(p => p.id === personId);
    return person ? `${person.first_name} ${person.last_name}` : 'Unknown';
  };

  return (
    <div className="fixed inset-0 bg-black/50 dark:bg-black/70 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-white dark:bg-slate-800 rounded-glass-lg shadow-2xl w-full max-w-3xl mx-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center space-x-3">
            <div className="w-12 h-12 rounded-glass bg-gradient-primary flex items-center justify-center">
              {getNetworkTypeIcon()}
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 truncate">
                {network.ssid}
              </h2>
              <p className="text-sm text-gray-600 dark:text-gray-400 font-mono">
                {network.bssid}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-glass-sm transition-colors"
          >
            <X className="w-5 h-5 text-gray-500 dark:text-gray-400" />
          </button>
        </div>

        {/* Error Message */}
        {error && (
          <div className="m-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-glass-lg">
            <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
          </div>
        )}

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Network Information */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                Network Information
              </h3>
              {!editing && (
                <button
                  onClick={() => setEditing(true)}
                  className="flex items-center space-x-2 px-3 py-1.5 text-sm font-medium text-blue-600 dark:text-blue-400
                           hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-glass transition-colors"
                >
                  <Edit2 className="w-4 h-4" />
                  <span>Edit</span>
                </button>
              )}
            </div>

            {editing ? (
              <div className="space-y-4">
                {/* SSID */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    SSID
                  </label>
                  <input
                    type="text"
                    name="ssid"
                    value={formData.ssid}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-glass-lg
                             bg-white dark:bg-slate-700 text-gray-900 dark:text-gray-100"
                  />
                </div>

                {/* Encryption */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Encryption
                  </label>
                  <select
                    name="encryption"
                    value={formData.encryption}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-glass-lg
                             bg-white dark:bg-slate-700 text-gray-900 dark:text-gray-100"
                  >
                    <option value="">Unknown</option>
                    <option value="WPA3">WPA3</option>
                    <option value="WPA2">WPA2</option>
                    <option value="WPA">WPA</option>
                    <option value="WEP">WEP</option>
                    <option value="Open">Open</option>
                  </select>
                </div>

                {/* Signal Strength */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Signal Strength (dBm)
                  </label>
                  <input
                    type="number"
                    name="signal_strength"
                    value={formData.signal_strength}
                    onChange={handleInputChange}
                    placeholder="-65"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-glass-lg
                             bg-white dark:bg-slate-700 text-gray-900 dark:text-gray-100"
                  />
                </div>

                {/* Frequency & Channel */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Frequency
                    </label>
                    <input
                      type="text"
                      name="frequency"
                      value={formData.frequency}
                      onChange={handleInputChange}
                      placeholder="2.4GHz"
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-glass-lg
                               bg-white dark:bg-slate-700 text-gray-900 dark:text-gray-100"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Channel
                    </label>
                    <input
                      type="number"
                      name="channel"
                      value={formData.channel}
                      onChange={handleInputChange}
                      placeholder="6"
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-glass-lg
                               bg-white dark:bg-slate-700 text-gray-900 dark:text-gray-100"
                    />
                  </div>
                </div>

                {/* Area Name */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Area Name
                  </label>
                  <input
                    type="text"
                    name="area_name"
                    value={formData.area_name}
                    onChange={handleInputChange}
                    placeholder="e.g., Downtown District"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-glass-lg
                             bg-white dark:bg-slate-700 text-gray-900 dark:text-gray-100"
                  />
                </div>

                {/* Tags */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Tags (comma-separated)
                  </label>
                  <input
                    type="text"
                    name="tags"
                    value={formData.tags}
                    onChange={handleInputChange}
                    placeholder="surveillance, target-area"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-glass-lg
                             bg-white dark:bg-slate-700 text-gray-900 dark:text-gray-100"
                  />
                </div>

                {/* Notes */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Notes
                  </label>
                  <textarea
                    name="notes"
                    value={formData.notes}
                    onChange={handleInputChange}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-glass-lg
                             bg-white dark:bg-slate-700 text-gray-900 dark:text-gray-100"
                  />
                </div>

                {/* Edit Actions */}
                <div className="flex items-center justify-end space-x-3 pt-4">
                  <button
                    onClick={() => setEditing(false)}
                    disabled={saving}
                    className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300
                             hover:bg-gray-100 dark:hover:bg-slate-700 rounded-glass-lg transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    className="flex items-center space-x-2 px-4 py-2 text-sm font-medium text-white
                             bg-gradient-primary rounded-glass-lg hover:shadow-glow-lg transition-all
                             disabled:opacity-50"
                  >
                    <Save className="w-4 h-4" />
                    <span>{saving ? 'Saving...' : 'Save Changes'}</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-4">
                {/* Encryption */}
                <div className="flex items-center space-x-2">
                  {network.encryption === 'WPA2' || network.encryption === 'WPA3' ? (
                    <Lock className="w-4 h-4 text-green-600 dark:text-green-400" />
                  ) : (
                    <Unlock className="w-4 h-4 text-red-600 dark:text-red-400" />
                  )}
                  <div>
                    <p className="text-xs text-gray-600 dark:text-gray-400">Encryption</p>
                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                      {network.encryption || 'Unknown'}
                    </p>
                  </div>
                </div>

                {/* Signal */}
                {network.signal_strength && (
                  <div className="flex items-center space-x-2">
                    <Signal className={`w-4 h-4 ${getSignalColor(network.signal_strength)}`} />
                    <div>
                      <p className="text-xs text-gray-600 dark:text-gray-400">Signal</p>
                      <p className={`text-sm font-medium ${getSignalColor(network.signal_strength)}`}>
                        {network.signal_strength} dBm ({getSignalDescription(network.signal_strength)})
                      </p>
                    </div>
                  </div>
                )}

                {/* Type */}
                <div>
                  <p className="text-xs text-gray-600 dark:text-gray-400">Type</p>
                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                    {network.network_type?.replace(/_/g, ' ') || 'WIFI'}
                  </p>
                </div>

                {/* Frequency/Channel */}
                {(network.frequency || network.channel) && (
                  <div>
                    <p className="text-xs text-gray-600 dark:text-gray-400">
                      {network.frequency ? 'Frequency' : 'Channel'}
                    </p>
                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                      {network.frequency || `Channel ${network.channel}`}
                    </p>
                  </div>
                )}

                {/* Location */}
                <div className="col-span-2 flex items-start space-x-2">
                  <MapPin className="w-4 h-4 text-gray-600 dark:text-gray-400 mt-0.5" />
                  <div>
                    <p className="text-xs text-gray-600 dark:text-gray-400">Location</p>
                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100 font-mono">
                      {network.latitude.toFixed(6)}, {network.longitude.toFixed(6)}
                    </p>
                    {network.accuracy && (
                      <p className="text-xs text-gray-500 dark:text-gray-500">
                        Accuracy: ±{network.accuracy}m
                      </p>
                    )}
                  </div>
                </div>

                {/* Scan Date */}
                {network.scan_date && (
                  <div className="col-span-2 flex items-start space-x-2">
                    <Calendar className="w-4 h-4 text-gray-600 dark:text-gray-400 mt-0.5" />
                    <div>
                      <p className="text-xs text-gray-600 dark:text-gray-400">Scanned</p>
                      <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                        {formatDate(network.scan_date)}
                      </p>
                    </div>
                  </div>
                )}

                {/* Area Name */}
                {network.area_name && (
                  <div className="col-span-2">
                    <p className="text-xs text-gray-600 dark:text-gray-400">Area</p>
                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                      {network.area_name}
                    </p>
                  </div>
                )}

                {/* Tags */}
                {network.tags && network.tags.length > 0 && (
                  <div className="col-span-2">
                    <p className="text-xs text-gray-600 dark:text-gray-400 mb-2">Tags</p>
                    <div className="flex flex-wrap gap-2">
                      {network.tags.map((tag, idx) => (
                        <span
                          key={idx}
                          className="px-2 py-1 text-xs font-medium bg-gray-100 dark:bg-slate-700
                                   text-gray-700 dark:text-gray-300 rounded-glass-sm"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Notes */}
                {network.notes && (
                  <div className="col-span-2">
                    <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">Notes</p>
                    <p className="text-sm text-gray-900 dark:text-gray-100 bg-gray-50 dark:bg-slate-700/50
                               p-3 rounded-glass">
                      {network.notes}
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Map Preview */}
          <div className="pt-6 border-t border-gray-200 dark:border-gray-700">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
              Location Preview
            </h3>
            <div className="h-64 rounded-glass-lg overflow-hidden border border-gray-200 dark:border-gray-700">
              <MapContainer
                center={[network.latitude, network.longitude]}
                zoom={16}
                style={{ height: '100%', width: '100%' }}
                scrollWheelZoom={false}
              >
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                <Marker position={[network.latitude, network.longitude]}>
                  <Popup>
                    <div className="p-2">
                      <p className="font-semibold text-sm">{network.ssid}</p>
                      <p className="text-xs text-gray-600">{network.bssid}</p>
                      <p className="text-xs text-gray-500 mt-1">
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

          {/* Person Association */}
          <div className="pt-6 border-t border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                Person Association
              </h3>
              {!associating && !network.person_id && (
                <button
                  onClick={() => setAssociating(true)}
                  className="flex items-center space-x-2 px-3 py-1.5 text-sm font-medium text-blue-600 dark:text-blue-400
                           hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-glass transition-colors"
                >
                  <User className="w-4 h-4" />
                  <span>Associate Person</span>
                </button>
              )}
            </div>

            {network.person_id && !associating ? (
              <div className="p-4 bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-glass-lg">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <p className="text-sm font-medium text-purple-900 dark:text-purple-200">
                      {getPersonName(network.person_id)}
                    </p>
                    {network.association_confidence && (
                      <p className="text-xs text-purple-700 dark:text-purple-300 mt-1 capitalize">
                        {network.association_confidence} confidence
                      </p>
                    )}
                    {network.association_note && (
                      <p className="text-sm text-purple-800 dark:text-purple-200 mt-2 italic">
                        "{network.association_note}"
                      </p>
                    )}
                  </div>
                  <button
                    onClick={handleRemoveAssociation}
                    disabled={saving}
                    className="ml-3 p-1.5 text-purple-600 dark:text-purple-400 hover:bg-purple-100
                             dark:hover:bg-purple-900/30 rounded transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ) : associating ? (
              <div className="space-y-4">
                {/* Person Select */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Select Person
                  </label>
                  <select
                    name="person_id"
                    value={associationData.person_id}
                    onChange={handleAssociationChange}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-glass-lg
                             bg-white dark:bg-slate-700 text-gray-900 dark:text-gray-100"
                  >
                    <option value="">-- Select Person --</option>
                    {people.map(person => (
                      <option key={person.id} value={person.id}>
                        {person.first_name} {person.last_name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Confidence */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Confidence Level
                  </label>
                  <select
                    name="association_confidence"
                    value={associationData.association_confidence}
                    onChange={handleAssociationChange}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-glass-lg
                             bg-white dark:bg-slate-700 text-gray-900 dark:text-gray-100"
                  >
                    <option value="investigating">Investigating</option>
                    <option value="possible">Possible</option>
                    <option value="probable">Probable</option>
                    <option value="confirmed">Confirmed</option>
                  </select>
                </div>

                {/* Note */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Association Note
                  </label>
                  <textarea
                    name="association_note"
                    value={associationData.association_note}
                    onChange={handleAssociationChange}
                    rows={3}
                    placeholder="Why this network is associated with this person..."
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-glass-lg
                             bg-white dark:bg-slate-700 text-gray-900 dark:text-gray-100"
                  />
                </div>

                {/* Association Actions */}
                <div className="flex items-center justify-end space-x-3 pt-4">
                  <button
                    onClick={() => setAssociating(false)}
                    disabled={saving}
                    className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300
                             hover:bg-gray-100 dark:hover:bg-slate-700 rounded-glass-lg transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSaveAssociation}
                    disabled={saving || !associationData.person_id}
                    className="flex items-center space-x-2 px-4 py-2 text-sm font-medium text-white
                             bg-gradient-primary rounded-glass-lg hover:shadow-glow-lg transition-all
                             disabled:opacity-50"
                  >
                    <Save className="w-4 h-4" />
                    <span>{saving ? 'Saving...' : 'Save Association'}</span>
                  </button>
                </div>
              </div>
            ) : (
              <p className="text-sm text-gray-600 dark:text-gray-400">
                No person associated with this network
              </p>
            )}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between p-6 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-slate-900/50">
          <button
            onClick={handleDelete}
            className="flex items-center space-x-2 px-4 py-2 text-sm font-medium text-red-600 dark:text-red-400
                     hover:bg-red-50 dark:hover:bg-red-900/20 rounded-glass-lg transition-colors"
          >
            <Trash2 className="w-4 h-4" />
            <span>Delete Network</span>
          </button>

          <button
            onClick={onClose}
            className="px-6 py-2 text-sm font-medium text-white bg-gradient-primary
                     rounded-glass-lg hover:shadow-glow-lg transition-all"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default WirelessNetworkDetail;
