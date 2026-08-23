// File: frontend/src/components/WirelessNetworks.js
import React, { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Wifi, Upload, Map as MapIcon, List, Search,
  Trash2, User, Signal,
  Radio, Bluetooth, RefreshCw, BarChart3, Lock, Unlock, Plus
} from 'lucide-react';
import { wirelessNetworksAPI, peopleAPI } from '../utils/api';
import WirelessNetworkMap from './WirelessNetworkMap';
import WirelessNetworkDetail from './WirelessNetworkDetail';
import ImportKML from './ImportKML';
import AddNetworkForm from './AddNetworkForm';
import { useProject } from '../contexts/ProjectContext';

const WirelessNetworks = () => {
  const { t } = useTranslation();
  const { activeProjectId } = useProject();
  const [networks, setNetworks] = useState([]);
  const [people, setPeople] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState('list'); // 'list' or 'map'
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedNetwork, setSelectedNetwork] = useState(null);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showAddNetworkModal, setShowAddNetworkModal] = useState(false);
  const [selectedNetworks, setSelectedNetworks] = useState([]);
  const [filters, setFilters] = useState({
    network_type: '',
    encryption: '',
    person_id: '',
    import_source: '',
    signal_min: '',
    signal_max: '',
  });
  const [importSources, setImportSources] = useState([]);

  useEffect(() => {
    fetchNetworks();
    fetchStats();
    fetchPeople();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters, activeProjectId]);

  const fetchNetworks = async () => {
    try {
      setLoading(true);
      const data = await wirelessNetworksAPI.getAll({ ...filters, project_id: activeProjectId });
      setNetworks(data);

      // Extract unique import sources
      const sources = [...new Set(data.map(n => n.import_source).filter(Boolean))];
      setImportSources(sources);
    } catch (error) {
      console.error('Error fetching networks:', error);
      alert(t('wirelessNetworks.errorFetchNetworks'));
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const data = await wirelessNetworksAPI.getStats({ project_id: activeProjectId });
      setStats(data);
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

  const fetchPeople = async () => {
    try {
      const { data: peopleList } = await peopleAPI.getAll({ project_id: activeProjectId });
      setPeople(peopleList);
    } catch (error) {
      console.error('Error fetching people:', error);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm(t('wirelessNetworks.confirmDeleteNetwork'))) return;

    try {
      await wirelessNetworksAPI.delete(id);
      fetchNetworks();
      fetchStats();
    } catch (error) {
      console.error('Error deleting network:', error);
      alert(t('wirelessNetworks.errorDeleteNetwork'));
    }
  };

  const handleBulkDelete = async () => {
    if (selectedNetworks.length === 0) {
      alert(t('wirelessNetworks.selectNetworksToDelete'));
      return;
    }

    if (!window.confirm(t('wirelessNetworks.confirmBulkDelete', { count: selectedNetworks.length }))) return;

    try {
      await wirelessNetworksAPI.bulkDelete(selectedNetworks, activeProjectId);
      setSelectedNetworks([]);
      fetchNetworks();
      fetchStats();
    } catch (error) {
      console.error('Error bulk deleting:', error);
      alert(t('wirelessNetworks.errorBulkDelete'));
    }
  };

  const handleImportComplete = () => {
    setShowImportModal(false);
    fetchNetworks();
    fetchStats();
  };

  const toggleNetworkSelection = (id) => {
    setSelectedNetworks(prev =>
      prev.includes(id) ? prev.filter(nid => nid !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    if (selectedNetworks.length === filteredNetworks.length) {
      setSelectedNetworks([]);
    } else {
      setSelectedNetworks(filteredNetworks.map(n => n.id));
    }
  };

  // Filter and search
  const filteredNetworks = useMemo(() => {
    return networks.filter(network => {
      const matchesSearch = searchTerm === '' ||
        network.ssid?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        network.bssid?.toLowerCase().includes(searchTerm.toLowerCase());

      return matchesSearch;
    });
  }, [networks, searchTerm]);

  const getEncryptionIcon = (encryption) => {
    if (encryption === 'WPA2' || encryption === 'WPA3') {
      return <Lock className="w-4 h-4 text-green-600 dark:text-green-400" />;
    }
    return <Unlock className="w-4 h-4 text-red-600 dark:text-red-400" />;
  };

  const getNetworkTypeIcon = (type) => {
    switch (type) {
      case 'BLUETOOTH_CLASSIC':
      case 'BLUETOOTH_LE':
        return <Bluetooth className="w-4 h-4 text-blue-600 dark:text-blue-400" />;
      case 'CELL':
        return <Radio className="w-4 h-4 text-purple-600 dark:text-purple-400" />;
      default:
        return <Wifi className="w-4 h-4 text-blue-600 dark:text-blue-400" />;
    }
  };

  const getSignalStrength = (signal) => {
    if (!signal) return t('wirelessNetworks.unknown');
    if (signal >= -50) return t('wirelessNetworks.signalExcellent');
    if (signal >= -60) return t('wirelessNetworks.signalGood');
    if (signal >= -70) return t('wirelessNetworks.signalFair');
    return t('wirelessNetworks.signalWeak');
  };

  const getSignalColor = (signal) => {
    if (!signal) return 'text-gray-500 dark:text-slate-400';
    if (signal >= -50) return 'text-green-600 dark:text-green-400';
    if (signal >= -60) return 'text-blue-600 dark:text-blue-400';
    if (signal >= -70) return 'text-yellow-600 dark:text-yellow-400';
    return 'text-red-600 dark:text-red-400';
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-gray-900 to-gray-600 dark:from-gray-100 dark:to-gray-300 bg-clip-text text-transparent">
            {t('wirelessNetworks.title')}
          </h1>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            {t('wirelessNetworks.subtitle')}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowAddNetworkModal(true)}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-all duration-300 flex items-center"
          >
            <Plus className="w-4 h-4 mr-2" />
            {t('wirelessNetworks.addNetwork')}
          </button>
          <button
            onClick={() => setShowImportModal(true)}
            className="px-4 py-2 bg-accent-primary text-white rounded-lg hover:bg-accent-primary-hover transition-all duration-300 flex items-center"
          >
            <Upload className="w-4 h-4 mr-2" />
            {t('wirelessNetworks.importKml')}
          </button>
          <button
            onClick={fetchNetworks}
            className="px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:shadow-md transition-all duration-300"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Statistics Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white dark:bg-gray-800 backdrop-blur-xl border border-gray-300 dark:border-gray-600 shadow-glass-lg rounded-lg-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">{t('wirelessNetworks.totalNetworks')}</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{stats.total || 0}</p>
              </div>
              <Wifi className="w-8 h-8 text-blue-600 dark:text-blue-400" />
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 backdrop-blur-xl border border-gray-300 dark:border-gray-600 shadow-glass-lg rounded-lg-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">{t('wirelessNetworks.uniqueSsids')}</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{stats.unique_ssids || 0}</p>
              </div>
              <BarChart3 className="w-8 h-8 text-blue-600 dark:text-blue-400" />
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 backdrop-blur-xl border border-gray-300 dark:border-gray-600 shadow-glass-lg rounded-lg-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">{t('wirelessNetworks.associated')}</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{stats.associated_count || 0}</p>
              </div>
              <User className="w-8 h-8 text-green-600 dark:text-green-400" />
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 backdrop-blur-xl border border-gray-300 dark:border-gray-600 shadow-glass-lg rounded-lg-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">{t('wirelessNetworks.encrypted')}</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{stats.encrypted_count || 0}</p>
              </div>
              <Lock className="w-8 h-8 text-purple-600 dark:text-purple-400" />
            </div>
          </div>
        </div>
      )}

      {/* Search and Filters */}
      <div className="bg-white dark:bg-gray-800 backdrop-blur-xl border border-gray-300 dark:border-gray-600 shadow-glass-lg rounded-lg-lg p-4">
        <div className="space-y-4">
          {/* Row 1: Search and Type/Encryption */}
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 dark:text-slate-500 w-5 h-5" />
              <input
                type="text"
                placeholder={t('wirelessNetworks.searchPlaceholder')}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 glass border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:border-accent-primary dark:text-gray-100 dark:bg-slate-700"
              />
            </div>

            <select
              value={filters.network_type}
              onChange={(e) => setFilters({ ...filters, network_type: e.target.value })}
              className="px-3 py-2 glass border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:border-accent-primary dark:text-gray-100 dark:bg-slate-700"
            >
              <option value="">{t('wirelessNetworks.allTypes')}</option>
              <option value="WIFI">{t('wirelessNetworks.typeWifi')}</option>
              <option value="BLUETOOTH_CLASSIC">{t('wirelessNetworks.typeBluetoothClassic')}</option>
              <option value="BLUETOOTH_LE">{t('wirelessNetworks.typeBluetoothLe')}</option>
              <option value="CELL">{t('wirelessNetworks.typeCellTower')}</option>
            </select>

            <select
              value={filters.encryption}
              onChange={(e) => setFilters({ ...filters, encryption: e.target.value })}
              className="px-3 py-2 glass border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:border-accent-primary dark:text-gray-100 dark:bg-slate-700"
            >
              <option value="">{t('wirelessNetworks.allEncryption')}</option>
              <option value="WPA3">WPA3</option>
              <option value="WPA2">WPA2</option>
              <option value="WPA">WPA</option>
              <option value="WEP">WEP</option>
              <option value="Open">{t('wirelessNetworks.encryptionOpen')}</option>
              <option value="Unknown">{t('wirelessNetworks.unknown')}</option>
            </select>
          </div>

          {/* Row 2: Signal Strength, Person, Import Source */}
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex gap-2 items-center">
              <label className="text-sm text-gray-700 dark:text-gray-300 whitespace-nowrap">
                {t('wirelessNetworks.signalDbmLabel')}
              </label>
              <input
                type="number"
                placeholder={t('wirelessNetworks.minPlaceholder')}
                value={filters.signal_min}
                onChange={(e) => setFilters({ ...filters, signal_min: e.target.value })}
                className="w-24 px-3 py-2 glass border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:border-accent-primary dark:text-gray-100 dark:bg-slate-700"
              />
              <span className="text-gray-600 dark:text-gray-400">{t('wirelessNetworks.to')}</span>
              <input
                type="number"
                placeholder={t('wirelessNetworks.maxPlaceholder')}
                value={filters.signal_max}
                onChange={(e) => setFilters({ ...filters, signal_max: e.target.value })}
                className="w-24 px-3 py-2 glass border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:border-accent-primary dark:text-gray-100 dark:bg-slate-700"
              />
            </div>

            <select
              value={filters.person_id}
              onChange={(e) => setFilters({ ...filters, person_id: e.target.value })}
              className="flex-1 px-3 py-2 glass border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:border-accent-primary dark:text-gray-100 dark:bg-slate-700"
            >
              <option value="">{t('wirelessNetworks.allPeople')}</option>
              {people.map(person => (
                <option key={person.id} value={person.id}>
                  {person.first_name} {person.last_name}
                </option>
              ))}
            </select>

            <select
              value={filters.import_source}
              onChange={(e) => setFilters({ ...filters, import_source: e.target.value })}
              className="flex-1 px-3 py-2 glass border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:border-accent-primary dark:text-gray-100 dark:bg-slate-700"
            >
              <option value="">{t('wirelessNetworks.allKmlFiles')}</option>
              {importSources.map((source, idx) => (
                <option key={idx} value={source}>
                  {source}
                </option>
              ))}
            </select>
          </div>

          {/* Row 3: View Mode Buttons */}
          <div className="flex gap-2">
            <button
              onClick={() => setViewMode('list')}
              className={`px-3 py-2 rounded-lg transition-all ${
                viewMode === 'list'
                  ? 'bg-blue-600 text-white dark:bg-blue-500'
                  : 'bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300'
              }`}
            >
              <List className="w-5 h-5" />
            </button>
            <button
              onClick={() => setViewMode('map')}
              className={`px-3 py-2 rounded-lg transition-all ${
                viewMode === 'map'
                  ? 'bg-blue-600 text-white dark:bg-blue-500'
                  : 'bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300'
              }`}
            >
              <MapIcon className="w-5 h-5" />
            </button>
          </div>
        </div>

        {selectedNetworks.length > 0 && (
          <div className="mt-4 flex items-center justify-between bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
            <span className="text-sm text-blue-800 dark:text-blue-300">
              {t('wirelessNetworks.networksSelected', { count: selectedNetworks.length })}
            </span>
            <button
              onClick={handleBulkDelete}
              className="px-3 py-1 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-all text-sm flex items-center"
            >
              <Trash2 className="w-4 h-4 mr-1" />
              {t('wirelessNetworks.deleteSelected')}
            </button>
          </div>
        )}
      </div>

      {/* View Content */}
      {loading ? (
        <div className="bg-white dark:bg-gray-800 backdrop-blur-xl border border-gray-300 dark:border-gray-600 shadow-glass-lg rounded-lg-lg p-12 text-center">
          <RefreshCw className="w-8 h-8 animate-spin text-blue-600 dark:text-blue-400 mx-auto mb-4" />
          <p className="text-gray-600 dark:text-gray-400">{t('wirelessNetworks.loadingNetworks')}</p>
        </div>
      ) : viewMode === 'map' ? (
        <WirelessNetworkMap
          networks={filteredNetworks}
          onNetworkClick={setSelectedNetwork}
        />
      ) : (
        <div className="bg-white dark:bg-gray-800 backdrop-blur-xl border border-gray-300 dark:border-gray-600 shadow-glass-lg rounded-lg-lg overflow-hidden">
          {filteredNetworks.length === 0 ? (
            <div className="p-12 text-center">
              <Wifi className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
              <p className="text-gray-600 dark:text-gray-400 font-medium">{t('wirelessNetworks.noNetworksFound')}</p>
              <p className="text-sm text-gray-500 dark:text-gray-500 mt-2">
                {t('wirelessNetworks.importToGetStarted')}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-slate-800 border-b border-gray-200 dark:border-gray-700">
                  <tr>
                    <th className="px-4 py-3 text-left">
                      <input
                        type="checkbox"
                        checked={selectedNetworks.length === filteredNetworks.length && filteredNetworks.length > 0}
                        onChange={toggleSelectAll}
                        className="rounded"
                      />
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase">{t('wirelessNetworks.columnSsid')}</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase">{t('wirelessNetworks.columnBssid')}</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase">{t('wirelessNetworks.columnType')}</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase">{t('wirelessNetworks.columnEncryption')}</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase">{t('wirelessNetworks.columnSignal')}</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase">{t('wirelessNetworks.columnPerson')}</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase">{t('wirelessNetworks.columnActions')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {filteredNetworks.map((network) => (
                    <tr
                      key={network.id}
                      className="hover:bg-gray-50 dark:hover:bg-slate-800/50 transition-colors cursor-pointer"
                      onClick={() => setSelectedNetwork(network)}
                    >
                      <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={selectedNetworks.includes(network.id)}
                          onChange={() => toggleNetworkSelection(network.id)}
                          className="rounded"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center">
                          {getNetworkTypeIcon(network.network_type)}
                          <span className="ml-2 font-medium text-gray-900 dark:text-gray-100">{network.ssid || t('wirelessNetworks.hiddenSsid')}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400 font-mono">{network.bssid}</td>
                      <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">{network.network_type}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center">
                          {getEncryptionIcon(network.encryption)}
                          <span className="ml-2 text-sm text-gray-600 dark:text-gray-400">{network.encryption || t('wirelessNetworks.unknown')}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {network.signal_strength && (
                          <div className="flex items-center">
                            <Signal className={`w-4 h-4 mr-1 ${getSignalColor(network.signal_strength)}`} />
                            <span className={`text-sm ${getSignalColor(network.signal_strength)}`}>
                              {t('wirelessNetworks.signalDbm', { value: network.signal_strength, strength: getSignalStrength(network.signal_strength) })}
                            </span>
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {network.person_id && (
                          <span className="inline-flex items-center px-2 py-1 rounded-lg text-xs bg-green-100 dark:bg-green-900/40 text-green-800 dark:text-green-300">
                            <User className="w-3 h-3 mr-1" />
                            {t('wirelessNetworks.associated')}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => handleDelete(network.id)}
                          className="text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Modals */}
      {showAddNetworkModal && (
        <AddNetworkForm
          onClose={() => setShowAddNetworkModal(false)}
          onSuccess={() => {
            fetchNetworks();
            fetchStats();
          }}
        />
      )}

      {showImportModal && (
        <ImportKML
          onClose={() => setShowImportModal(false)}
          onImportComplete={handleImportComplete}
        />
      )}

      {selectedNetwork && (
        <WirelessNetworkDetail
          network={selectedNetwork}
          people={people}
          onClose={() => setSelectedNetwork(null)}
          onUpdate={fetchNetworks}
        />
      )}
    </div>
  );
};

export default WirelessNetworks;
