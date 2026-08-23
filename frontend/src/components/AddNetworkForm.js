// File: frontend/src/components/AddNetworkForm.js
import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { X, Wifi, MapPin, Lock, Plus } from 'lucide-react';
import { wirelessNetworksAPI, peopleAPI, businessesAPI } from '../utils/api';
import { useProject } from '../contexts/ProjectContext';

const AddNetworkForm = ({ onClose, onSuccess }) => {
  const { t } = useTranslation();
  const { activeProjectId } = useProject();
  const [people, setPeople] = useState([]);
  const [businesses, setBusinesses] = useState([]);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    ssid: '',
    bssid: '',
    latitude: '',
    longitude: '',
    address: '',
    password: '',
    encryption: 'WPA2',
    network_type: 'WIFI',
    signal_strength: '',
    frequency: '',
    channel: '',
    associated_person_ids: [],
    associated_business_ids: [],
    area_name: '',
    notes: '',
    scan_date: new Date().toISOString().slice(0, 16)
  });

  useEffect(() => {
    fetchPeopleAndBusinesses();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeProjectId]);

  const fetchPeopleAndBusinesses = async () => {
    try {
      const [{ data: peopleData }, businessData] = await Promise.all([
        peopleAPI.getAll({ project_id: activeProjectId }),
        businessesAPI.getAll({ project_id: activeProjectId })
      ]);
      setPeople(peopleData);
      setBusinesses(businessData);
    } catch (error) {
      console.error('Error fetching data:', error);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleMultiSelect = (e, field) => {
    const selected = Array.from(e.target.selectedOptions, option => parseInt(option.value));
    setFormData(prev => ({ ...prev, [field]: selected }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Validation
    if (!formData.ssid) {
      alert(t('addNetworkForm.errorSsidRequired'));
      return;
    }

    // If location is provided, both lat and long must be present
    if ((formData.latitude && !formData.longitude) || (!formData.latitude && formData.longitude)) {
      alert(t('addNetworkForm.errorLatLongBothRequired'));
      return;
    }

    if (!activeProjectId) {
      alert(t('addNetworkForm.errorNoActiveProject'));
      return;
    }

    setLoading(true);

    try {
      const payload = {
        ...formData,
        latitude: parseFloat(formData.latitude),
        longitude: parseFloat(formData.longitude),
        signal_strength: formData.signal_strength ? parseInt(formData.signal_strength) : null,
        channel: formData.channel ? parseInt(formData.channel) : null,
        import_source: 'Manual Entry',
        scan_date: formData.scan_date ? new Date(formData.scan_date).toISOString() : new Date().toISOString(),
        project_id: activeProjectId,
      };

      await wirelessNetworksAPI.create(payload);
      alert(t('addNetworkForm.successNetworkAdded'));
      onSuccess();
      onClose();
    } catch (error) {
      console.error('Error adding network:', error);
      alert(t('addNetworkForm.errorAddNetwork', { message: error.response?.data?.error || error.message }));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl border border-gray-200 dark:border-gray-700 w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
          <div className="flex items-center space-x-3">
            <Wifi className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{t('addNetworkForm.title')}</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-red-600 hover:text-white transition-all duration-300"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="overflow-y-auto p-6 space-y-6">
          {/* Network Identification */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 flex items-center">
              <Wifi className="w-5 h-5 mr-2 text-gray-400 dark:text-slate-500" />
              {t('addNetworkForm.networkIdentification')}
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  {t('addNetworkForm.ssidLabel')} <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="ssid"
                  value={formData.ssid}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:border-blue-500 dark:bg-gray-700 dark:text-gray-100"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  {t('addNetworkForm.bssidLabel')}
                </label>
                <input
                  type="text"
                  name="bssid"
                  value={formData.bssid}
                  onChange={handleInputChange}
                  placeholder={t('addNetworkForm.bssidPlaceholder')}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:border-blue-500 dark:bg-gray-700 dark:text-gray-100 font-mono"
                />
              </div>
            </div>
          </div>

          {/* Location */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 flex items-center">
              <MapPin className="w-5 h-5 mr-2 text-gray-400 dark:text-slate-500" />
              {t('businessForm.location')}
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  {t('addNetworkForm.latitude')}
                </label>
                <input
                  type="number"
                  name="latitude"
                  value={formData.latitude}
                  onChange={handleInputChange}
                  step="any"
                  placeholder={t('addNetworkForm.latitudePlaceholder')}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:border-blue-500 dark:bg-gray-700 dark:text-gray-100"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  {t('addNetworkForm.longitude')}
                </label>
                <input
                  type="number"
                  name="longitude"
                  value={formData.longitude}
                  onChange={handleInputChange}
                  step="any"
                  placeholder={t('addNetworkForm.longitudePlaceholder')}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:border-blue-500 dark:bg-gray-700 dark:text-gray-100"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {t('addNetworkForm.areaNameAddressLabel')}
              </label>
              <input
                type="text"
                name="area_name"
                value={formData.area_name}
                onChange={handleInputChange}
                placeholder={t('addNetworkForm.areaNameAddressPlaceholder')}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:border-blue-500 dark:bg-gray-700 dark:text-gray-100"
              />
            </div>
          </div>

          {/* Security */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 flex items-center">
              <Lock className="w-5 h-5 mr-2 text-gray-400 dark:text-slate-500" />
              {t('addNetworkForm.security')}
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  {t('addNetworkForm.encryptionProtocolLabel')}
                </label>
                <select
                  name="encryption"
                  value={formData.encryption}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:border-blue-500 dark:bg-gray-700 dark:text-gray-100"
                >
                  <option value="WPA3">WPA3</option>
                  <option value="WPA2">WPA2</option>
                  <option value="WPA">WPA</option>
                  <option value="WEP">WEP</option>
                  <option value="Open">{t('addNetworkForm.encryptionOpenNoSecurity')}</option>
                  <option value="Unknown">{t('wirelessNetworks.unknown')}</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  {t('addNetworkForm.passwordLabel')}
                </label>
                <input
                  type="text"
                  name="password"
                  value={formData.password}
                  onChange={handleInputChange}
                  placeholder={t('addNetworkForm.passwordPlaceholder')}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:border-blue-500 dark:bg-gray-700 dark:text-gray-100"
                />
              </div>
            </div>
          </div>

          {/* Technical Details */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{t('addNetworkForm.technicalDetails')}</h3>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  {t('addNetworkForm.networkTypeLabel')}
                </label>
                <select
                  name="network_type"
                  value={formData.network_type}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:border-blue-500 dark:bg-gray-700 dark:text-gray-100"
                >
                  <option value="WIFI">{t('wirelessNetworks.typeWifi')}</option>
                  <option value="BLUETOOTH_CLASSIC">{t('wirelessNetworks.typeBluetoothClassic')}</option>
                  <option value="BLUETOOTH_LE">{t('wirelessNetworks.typeBluetoothLe')}</option>
                  <option value="CELL">{t('wirelessNetworks.typeCellTower')}</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  {t('networkInfoSection.signalStrengthDbmLabel')}
                </label>
                <input
                  type="number"
                  name="signal_strength"
                  value={formData.signal_strength}
                  onChange={handleInputChange}
                  placeholder={t('networkInfoSection.signalPlaceholder')}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:border-blue-500 dark:bg-gray-700 dark:text-gray-100"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  {t('networkInfoSection.channelLabel')}
                </label>
                <input
                  type="number"
                  name="channel"
                  value={formData.channel}
                  onChange={handleInputChange}
                  placeholder={t('networkInfoSection.channelPlaceholder')}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:border-blue-500 dark:bg-gray-700 dark:text-gray-100"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  {t('networkInfoSection.frequencyLabel')}
                </label>
                <select
                  name="frequency"
                  value={formData.frequency}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:border-blue-500 dark:bg-gray-700 dark:text-gray-100"
                >
                  <option value="">{t('wirelessNetworks.unknown')}</option>
                  <option value="2.4GHz">{t('addNetworkForm.freq24')}</option>
                  <option value="5GHz">{t('addNetworkForm.freq5')}</option>
                  <option value="6GHz">{t('addNetworkForm.freq6')}</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  {t('addNetworkForm.scanDateTimeLabel')}
                </label>
                <input
                  type="datetime-local"
                  name="scan_date"
                  value={formData.scan_date}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:border-blue-500 dark:bg-gray-700 dark:text-gray-100"
                />
              </div>
            </div>
          </div>

          {/* Associations */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 flex items-center">
              <Plus className="w-5 h-5 mr-2 text-gray-400 dark:text-slate-500" />
              {t('addNetworkForm.associationsTitle')}
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  {t('addNetworkForm.associatedPeopleLabel')}
                </label>
                <select
                  multiple
                  size="5"
                  onChange={(e) => handleMultiSelect(e, 'associated_person_ids')}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:border-blue-500 dark:bg-gray-700 dark:text-gray-100"
                >
                  {people.map(person => (
                    <option key={person.id} value={person.id}>
                      {person.first_name} {person.last_name}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  {t('addNetworkForm.selectedPersonsCount', { count: formData.associated_person_ids.length })}
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  {t('addNetworkForm.associatedBusinessesLabel')}
                </label>
                <select
                  multiple
                  size="5"
                  onChange={(e) => handleMultiSelect(e, 'associated_business_ids')}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:border-blue-500 dark:bg-gray-700 dark:text-gray-100"
                >
                  {businesses.map(business => (
                    <option key={business.id} value={business.id}>
                      {business.name}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  {t('addNetworkForm.selectedBusinessesCount', { count: formData.associated_business_ids.length })}
                </p>
              </div>
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {t('addNetworkForm.notes')}
            </label>
            <textarea
              name="notes"
              value={formData.notes}
              onChange={handleInputChange}
              rows="3"
              placeholder={t('addNetworkForm.notesPlaceholder')}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:border-blue-500 dark:bg-gray-700 dark:text-gray-100"
            />
          </div>

          {/* Actions */}
          <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200 dark:border-gray-700">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600 transition-all duration-300"
            >
              {t('common.cancel')}
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 bg-blue-600 text-white dark:bg-blue-500 rounded-lg hover:bg-blue-700 dark:hover:bg-blue-600 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  {t('addNetworkForm.adding')}
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4 mr-2" />
                  {t('wirelessNetworks.addNetwork')}
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddNetworkForm;
