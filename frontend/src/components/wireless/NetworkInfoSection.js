import React, { useState } from 'react';
import { Lock, Unlock, Signal, MapPin, Calendar, Edit2, Save } from 'lucide-react';

const getSignalDescription = (signal) => {
  if (!signal) return 'Unknown';
  if (signal >= -50) return 'Excellent';
  if (signal >= -60) return 'Good';
  if (signal >= -70) return 'Fair';
  return 'Weak';
};

const getSignalColor = (signal) => {
  if (!signal) return 'text-gray-500 dark:text-slate-400';
  if (signal >= -60) return 'text-green-600 dark:text-green-400';
  if (signal >= -70) return 'text-yellow-600 dark:text-yellow-400';
  return 'text-red-600 dark:text-red-400';
};

const formatDate = (str) => {
  if (!str) return 'N/A';
  try { return new Date(str).toLocaleString(); } catch { return str; }
};

const inputClass = 'w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-gray-100';

const NetworkInfoSection = ({ network, saving, onSave }) => {
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

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSave = async () => {
    await onSave({
      ...formData,
      tags: formData.tags ? formData.tags.split(',').map(t => t.trim()).filter(Boolean) : null,
      signal_strength: formData.signal_strength ? parseInt(formData.signal_strength) : null,
      channel: formData.channel ? parseInt(formData.channel) : null,
    });
    setEditing(false);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Network Information</h3>
        {!editing && (
          <button
            onClick={() => setEditing(true)}
            className="flex items-center space-x-2 px-3 py-1.5 text-sm font-medium text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
          >
            <Edit2 className="w-4 h-4" /><span>Edit</span>
          </button>
        )}
      </div>

      {editing ? (
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">SSID</label>
            <input type="text" name="ssid" value={formData.ssid} onChange={handleChange} className={inputClass} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Encryption</label>
            <select name="encryption" value={formData.encryption} onChange={handleChange} className={inputClass}>
              <option value="">Unknown</option>
              <option value="WPA3">WPA3</option>
              <option value="WPA2">WPA2</option>
              <option value="WPA">WPA</option>
              <option value="WEP">WEP</option>
              <option value="Open">Open</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Signal Strength (dBm)</label>
            <input type="number" name="signal_strength" value={formData.signal_strength} onChange={handleChange} placeholder="-65" className={inputClass} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Frequency</label>
              <input type="text" name="frequency" value={formData.frequency} onChange={handleChange} placeholder="2.4GHz" className={inputClass} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Channel</label>
              <input type="number" name="channel" value={formData.channel} onChange={handleChange} placeholder="6" className={inputClass} />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Area Name</label>
            <input type="text" name="area_name" value={formData.area_name} onChange={handleChange} placeholder="e.g., Downtown District" className={inputClass} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Tags (comma-separated)</label>
            <input type="text" name="tags" value={formData.tags} onChange={handleChange} placeholder="surveillance, target-area" className={inputClass} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Notes</label>
            <textarea name="notes" value={formData.notes} onChange={handleChange} rows={3} className={inputClass} />
          </div>
          <div className="flex items-center justify-end space-x-3 pt-4">
            <button onClick={() => setEditing(false)} disabled={saving} className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg transition-colors">
              Cancel
            </button>
            <button onClick={handleSave} disabled={saving} className="flex items-center space-x-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-all disabled:opacity-50">
              <Save className="w-4 h-4" /><span>{saving ? 'Saving...' : 'Save Changes'}</span>
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4">
          <div className="flex items-center space-x-2">
            {network.encryption === 'WPA2' || network.encryption === 'WPA3'
              ? <Lock className="w-4 h-4 text-green-600 dark:text-green-400" />
              : <Unlock className="w-4 h-4 text-red-600 dark:text-red-400" />}
            <div>
              <p className="text-xs text-gray-600 dark:text-gray-400">Encryption</p>
              <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{network.encryption || 'Unknown'}</p>
            </div>
          </div>

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

          <div>
            <p className="text-xs text-gray-600 dark:text-gray-400">Type</p>
            <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{network.network_type?.replace(/_/g, ' ') || 'WIFI'}</p>
          </div>

          {(network.frequency || network.channel) && (
            <div>
              <p className="text-xs text-gray-600 dark:text-gray-400">{network.frequency ? 'Frequency' : 'Channel'}</p>
              <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{network.frequency || `Channel ${network.channel}`}</p>
            </div>
          )}

          <div className="col-span-2 flex items-start space-x-2">
            <MapPin className="w-4 h-4 text-gray-600 dark:text-gray-400 mt-0.5" />
            <div>
              <p className="text-xs text-gray-600 dark:text-gray-400">Location</p>
              <p className="text-sm font-medium text-gray-900 dark:text-gray-100 font-mono">
                {network.latitude.toFixed(6)}, {network.longitude.toFixed(6)}
              </p>
              {network.accuracy && <p className="text-xs text-gray-500 dark:text-gray-400">Accuracy: ±{network.accuracy}m</p>}
            </div>
          </div>

          {network.scan_date && (
            <div className="col-span-2 flex items-start space-x-2">
              <Calendar className="w-4 h-4 text-gray-600 dark:text-gray-400 mt-0.5" />
              <div>
                <p className="text-xs text-gray-600 dark:text-gray-400">Scanned</p>
                <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{formatDate(network.scan_date)}</p>
              </div>
            </div>
          )}

          {network.area_name && (
            <div className="col-span-2">
              <p className="text-xs text-gray-600 dark:text-gray-400">Area</p>
              <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{network.area_name}</p>
            </div>
          )}

          {network.tags?.length > 0 && (
            <div className="col-span-2">
              <p className="text-xs text-gray-600 dark:text-gray-400 mb-2">Tags</p>
              <div className="flex flex-wrap gap-2">
                {network.tags.map((tag, i) => (
                  <span key={i} className="px-2 py-1 text-xs font-medium bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-gray-300 rounded">
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          )}

          {network.notes && (
            <div className="col-span-2">
              <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">Notes</p>
              <p className="text-sm text-gray-900 dark:text-gray-100 bg-gray-50 dark:bg-slate-700/50 p-3 rounded-lg">{network.notes}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default NetworkInfoSection;
