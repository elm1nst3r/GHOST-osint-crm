import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Lock, Unlock, Signal, MapPin, Calendar, Edit2, Save } from 'lucide-react';

const getSignalColor = (signal) => {
  if (!signal) return 'text-gray-500 dark:text-slate-400';
  if (signal >= -60) return 'text-green-600 dark:text-green-400';
  if (signal >= -70) return 'text-yellow-600 dark:text-yellow-400';
  return 'text-red-600 dark:text-red-400';
};

const inputClass = 'w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-gray-100';

const NetworkInfoSection = ({ network, saving, onSave }) => {
  const { t } = useTranslation();

  const getSignalDescription = (signal) => {
    if (!signal) return t('wirelessNetworks.unknown');
    if (signal >= -50) return t('wirelessNetworks.signalExcellent');
    if (signal >= -60) return t('wirelessNetworks.signalGood');
    if (signal >= -70) return t('wirelessNetworks.signalFair');
    return t('wirelessNetworks.signalWeak');
  };

  const formatDate = (str) => {
    if (!str) return t('wirelessNetworkMap.notAvailable');
    try { return new Date(str).toLocaleString(); } catch { return str; }
  };

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
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{t('networkInfoSection.networkInformation')}</h3>
        {!editing && (
          <button
            onClick={() => setEditing(true)}
            className="flex items-center space-x-2 px-3 py-1.5 text-sm font-medium text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
          >
            <Edit2 className="w-4 h-4" /><span>{t('common.edit')}</span>
          </button>
        )}
      </div>

      {editing ? (
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('networkInfoSection.ssidLabel')}</label>
            <input type="text" name="ssid" value={formData.ssid} onChange={handleChange} className={inputClass} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('networkInfoSection.encryptionLabel')}</label>
            <select name="encryption" value={formData.encryption} onChange={handleChange} className={inputClass}>
              <option value="">{t('wirelessNetworks.unknown')}</option>
              <option value="WPA3">WPA3</option>
              <option value="WPA2">WPA2</option>
              <option value="WPA">WPA</option>
              <option value="WEP">WEP</option>
              <option value="Open">{t('wirelessNetworks.encryptionOpen')}</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('networkInfoSection.signalStrengthDbmLabel')}</label>
            <input type="number" name="signal_strength" value={formData.signal_strength} onChange={handleChange} placeholder={t('networkInfoSection.signalPlaceholder')} className={inputClass} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('networkInfoSection.frequencyLabel')}</label>
              <input type="text" name="frequency" value={formData.frequency} onChange={handleChange} placeholder={t('networkInfoSection.frequencyPlaceholder')} className={inputClass} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('networkInfoSection.channelLabel')}</label>
              <input type="number" name="channel" value={formData.channel} onChange={handleChange} placeholder={t('networkInfoSection.channelPlaceholder')} className={inputClass} />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('networkInfoSection.areaNameLabel')}</label>
            <input type="text" name="area_name" value={formData.area_name} onChange={handleChange} placeholder={t('networkInfoSection.areaNamePlaceholder')} className={inputClass} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('networkInfoSection.tagsCommaLabel')}</label>
            <input type="text" name="tags" value={formData.tags} onChange={handleChange} placeholder={t('networkInfoSection.tagsPlaceholder')} className={inputClass} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('networkInfoSection.notesLabel')}</label>
            <textarea name="notes" value={formData.notes} onChange={handleChange} rows={3} className={inputClass} />
          </div>
          <div className="flex items-center justify-end space-x-3 pt-4">
            <button onClick={() => setEditing(false)} disabled={saving} className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg transition-colors">
              {t('common.cancel')}
            </button>
            <button onClick={handleSave} disabled={saving} className="flex items-center space-x-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-all disabled:opacity-50">
              <Save className="w-4 h-4" /><span>{saving ? t('common.savingDots') : t('settings.profile.saveChanges')}</span>
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
              <p className="text-xs text-gray-600 dark:text-gray-400">{t('networkInfoSection.encryptionLabel')}</p>
              <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{network.encryption || t('wirelessNetworks.unknown')}</p>
            </div>
          </div>

          {network.signal_strength && (
            <div className="flex items-center space-x-2">
              <Signal className={`w-4 h-4 ${getSignalColor(network.signal_strength)}`} />
              <div>
                <p className="text-xs text-gray-600 dark:text-gray-400">{t('networkInfoSection.signalLabel')}</p>
                <p className={`text-sm font-medium ${getSignalColor(network.signal_strength)}`}>
                  {t('wirelessNetworks.signalDbm', { value: network.signal_strength, strength: getSignalDescription(network.signal_strength) })}
                </p>
              </div>
            </div>
          )}

          <div>
            <p className="text-xs text-gray-600 dark:text-gray-400">{t('networkInfoSection.typeLabel')}</p>
            <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{network.network_type?.replace(/_/g, ' ') || 'WIFI'}</p>
          </div>

          {(network.frequency || network.channel) && (
            <div>
              <p className="text-xs text-gray-600 dark:text-gray-400">{network.frequency ? t('networkInfoSection.frequencyLabel') : t('networkInfoSection.channelLabel')}</p>
              <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{network.frequency || t('networkInfoSection.channelValue', { channel: network.channel })}</p>
            </div>
          )}

          <div className="col-span-2 flex items-start space-x-2">
            <MapPin className="w-4 h-4 text-gray-600 dark:text-gray-400 mt-0.5" />
            <div>
              <p className="text-xs text-gray-600 dark:text-gray-400">{t('networkInfoSection.locationLabel')}</p>
              <p className="text-sm font-medium text-gray-900 dark:text-gray-100 font-mono">
                {network.latitude != null && network.longitude != null
                  ? `${network.latitude.toFixed(6)}, ${network.longitude.toFixed(6)}`
                  : '—'}
              </p>
              {network.accuracy && <p className="text-xs text-gray-500 dark:text-gray-400">{t('networkInfoSection.accuracyValue', { label: t('networkInfoSection.accuracyLabel'), value: network.accuracy })}</p>}
            </div>
          </div>

          {network.scan_date && (
            <div className="col-span-2 flex items-start space-x-2">
              <Calendar className="w-4 h-4 text-gray-600 dark:text-gray-400 mt-0.5" />
              <div>
                <p className="text-xs text-gray-600 dark:text-gray-400">{t('networkInfoSection.scannedLabel')}</p>
                <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{formatDate(network.scan_date)}</p>
              </div>
            </div>
          )}

          {network.area_name && (
            <div className="col-span-2">
              <p className="text-xs text-gray-600 dark:text-gray-400">{t('networkInfoSection.areaLabel')}</p>
              <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{network.area_name}</p>
            </div>
          )}

          {network.tags?.length > 0 && (
            <div className="col-span-2">
              <p className="text-xs text-gray-600 dark:text-gray-400 mb-2">{t('networkInfoSection.tagsLabel')}</p>
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
              <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">{t('networkInfoSection.notesLabel')}</p>
              <p className="text-sm text-gray-900 dark:text-gray-100 bg-gray-50 dark:bg-slate-700/50 p-3 rounded-lg">{network.notes}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default NetworkInfoSection;
