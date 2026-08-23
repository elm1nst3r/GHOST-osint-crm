// File: frontend/src/components/GlobalMap.js
import React, { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import MarkerClusterGroup from 'react-leaflet-cluster';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Search, RefreshCw, Plus, AlertCircle, Wifi, Filter, Landmark, Package, Receipt } from 'lucide-react';
import { wirelessNetworksAPI, propertiesAPI, assetsAPI, transactionsAPI, modelOptionsAPI } from '../utils/api';
import { useProject } from '../contexts/ProjectContext';
import { OSM_TILE_URL, OSM_ATTRIBUTION } from '../utils/mapConstants';
import { optionLabel } from '../utils/optionLabels';
import { locationColors, buildIconCache, colorForCustomType } from './map/mapUtils';
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
  const { t } = useTranslation();
  const { activeProjectId } = useProject();
  const [people, setPeople] = useState([]);
  const [filteredPeople, setFilteredPeople] = useState([]);
  const [wirelessNetworks, setWirelessNetworks] = useState([]);
  const [showNetworks, setShowNetworks] = useState(true);
  // Transaction-tracking layers (issue #43)
  const [properties, setProperties] = useState([]);
  const [assets, setAssets] = useState([]);
  const [txEvents, setTxEvents] = useState([]);
  const [showProperties, setShowProperties] = useState(true);
  const [showAssets, setShowAssets] = useState(true);
  const [showTransactions, setShowTransactions] = useState(false);
  const [filterTxType, setFilterTxType] = useState('');
  const [filterAssetCategory, setFilterAssetCategory] = useState('');
  const [txTypeOptions, setTxTypeOptions] = useState([]);
  const [assetCategoryOptions, setAssetCategoryOptions] = useState([]);
  // User-defined location types from settings (issue #51): { type: color }
  const [customTypeColors, setCustomTypeColors] = useState({});
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
    fetchTransactionLayers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeProjectId]);

  const fetchTransactionLayers = async () => {
    try {
      const [props, asts, txns] = await Promise.all([
        propertiesAPI.getAll({ limit: 1000, project_id: activeProjectId }),
        assetsAPI.getAll({ limit: 1000, project_id: activeProjectId }),
        transactionsAPI.getAll({ limit: 1000, project_id: activeProjectId }),
      ]);
      setProperties((props.data || []).filter(p => p.latitude && p.longitude));
      setAssets((asts.data || []).filter(a => a.resolved_location && a.resolved_location.latitude != null));
      setTxEvents((txns.data || []).filter(t => t.latitude && t.longitude));
      const opts = await modelOptionsAPI.getAll();
      setTxTypeOptions(opts.filter(o => o.model_type === 'transaction_type' && o.is_active));
      setAssetCategoryOptions(opts.filter(o => o.model_type === 'asset_category' && o.is_active));
      // Custom location types must show up on the map like built-in ones (issue #51)
      const customTypes = opts
        .filter(o => o.model_type === 'location_type' && o.is_active && !(o.option_value in locationColors))
        .map(o => o.option_value);
      if (customTypes.length > 0) {
        setCustomTypeColors(Object.fromEntries(customTypes.map(t => [t, colorForCustomType(t)])));
        setSelectedLocationTypes(prev => [...new Set([...prev, ...customTypes])]);
      }
    } catch (err) {
      console.error('Error fetching transaction map layers:', err);
    }
  };

  const fetchPeople = async (page = 0, limit = 100) => {
    try {
      setLoading(true);
      const projectParam = activeProjectId ? `&project_id=${activeProjectId}` : '';
      const res = await fetch(
        `${API_BASE}/locations?limit=${limit}&offset=${page * limit}&confidence=0&includeUngeocoded=true${projectParam}`,
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
      const projectParam = activeProjectId ? `&project_id=${activeProjectId}` : '';
      const res = await fetch(`${API_BASE}/people?limit=1000${projectParam}`, { credentials: 'include' });
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
      const networks = await wirelessNetworksAPI.getAll({ project_id: activeProjectId });
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
      if (locations.length === 0) { alert(t('globalMap.allCoordinatesHaveCoords')); return; }

      const res = await fetch(`${API_BASE}/geocode/batch-enhanced`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ locations, minConfidence: 30, maxConcurrent: 3 }),
      });

      if (!res.ok) throw new Error('Enhanced geocoding failed');
      const result = await res.json();
      alert(`${t('globalMap.geocodingCompletePrefix')}\n${t('globalMap.processedCount', { count: result.summary.total })}\n${t('globalMap.geocodedCount', { count: result.summary.geocoded })}\n${t('globalMap.cachedCount', { count: result.summary.cached })}`);
      fetchPeople();
      fetchGeocodingStats();
    } catch (error) {
      // Fallback to simple batch
      try {
        const res = await fetch(`${API_BASE}/geocode/batch`, { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' } });
        if (res.ok) {
          const result = await res.json();
          alert(t('globalMap.fallbackGeocodingComplete', { count: result.totalGeocoded }));
          fetchPeople();
        } else {
          throw new Error(t('globalMap.errorBothMethodsFailed'));
        }
      } catch (fallbackError) {
        alert(t('globalMap.errorGeocodeLocations', { message: fallbackError.message }));
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

  const iconCache = useMemo(() => buildIconCache(customTypeColors), [customTypeColors]);
  const allTypeColors = useMemo(() => ({ ...locationColors, ...customTypeColors }), [customTypeColors]);

  // Simple coloured pin icons for the transaction-tracking layers.
  const featureIcons = useMemo(() => {
    const make = (color, glyph) => L.divIcon({
      className: 'ghost-feature-icon',
      html: `<div style="background:${color};width:22px;height:22px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);border:2px solid #fff;box-shadow:0 1px 3px rgba(0,0,0,.4);display:flex;align-items:center;justify-content:center;"><span style="transform:rotate(45deg);font-size:11px;color:#fff;font-weight:bold;">${glyph}</span></div>`,
      iconSize: [22, 22], iconAnchor: [11, 22], popupAnchor: [0, -20],
    });
    return { property: make('#059669', 'P'), asset: make('#ea580c', 'A'), transaction: make('#2563eb', 'T') };
  }, []);

  const markers = useMemo(() => {
    const list = [];
    filteredPeople.forEach(person => {
      person.locations?.forEach((loc, i) => {
        if (!loc.latitude || !loc.longitude) return;
        // Default before the filter check so untyped locations map to 'other'
        // instead of silently vanishing
        const type = loc.type || 'other';
        if (!selectedLocationTypes.includes(type)) return;
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
    if (showProperties) {
      properties.forEach(p => {
        list.push({
          id: `property-${p.id}`, kind: 'property', lat: parseFloat(p.latitude), lng: parseFloat(p.longitude),
          name: p.name, propertyType: p.property_type, address: [p.address, p.city, p.country].filter(Boolean).join(', '),
          ownerName: p.owner_name, icon: featureIcons.property,
        });
      });
    }
    if (showAssets) {
      assets.forEach(a => {
        if (filterAssetCategory && a.category !== filterAssetCategory) return;
        const loc = a.resolved_location;
        list.push({
          id: `asset-${a.id}`, kind: 'asset', lat: parseFloat(loc.latitude), lng: parseFloat(loc.longitude),
          name: a.name, assetCategory: a.category, locationMode: a.location_mode,
          holderName: a.current_holder ? a.current_holder.label : null,
          locLabel: loc.label, icon: featureIcons.asset,
        });
      });
    }
    if (showTransactions) {
      txEvents.forEach(t => {
        if (filterTxType && t.transaction_type !== filterTxType) return;
        list.push({
          id: `tx-${t.id}`, kind: 'transaction', lat: parseFloat(t.latitude), lng: parseFloat(t.longitude),
          txType: t.transaction_type, fromLabel: t.resolved_from && t.resolved_from.label, toLabel: t.resolved_to && t.resolved_to.label,
          subjectLabel: t.resolved_subject && t.resolved_subject.label, value: t.value, currency: t.currency,
          locLabel: t.location_name || t.resolved_location?.label, icon: featureIcons.transaction,
        });
      });
    }
    return list;
  }, [filteredPeople, selectedLocationTypes, iconCache, wirelessNetworks, showNetworks,
      properties, assets, txEvents, showProperties, showAssets, showTransactions,
      filterAssetCategory, filterTxType, featureIcons]);

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
          <p className="text-slate-700 dark:text-slate-300 font-medium mb-3">{t('globalMap.failedToLoad')}</p>
          <button
            onClick={() => { setLoadError(false); fetchPeople(); }}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 transition-colors"
          >
            {t('globalMap.retry')}
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
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{t('globalMap.title')}</h1>
          <div className="flex items-center space-x-4">
            {missingCoordinates > 0 && (
              <button
                onClick={triggerBatchGeocode}
                disabled={geocoding}
                className="px-4 py-2 bg-yellow-600 text-white rounded hover:bg-yellow-700 transition-all flex items-center disabled:opacity-50"
                title={t('globalMap.needsGeocodingTitle', { count: missingCoordinates })}
              >
                <RefreshCw className={`w-4 h-4 mr-2 ${geocoding ? 'animate-spin' : ''}`} />
                {geocoding ? t('globalMap.geocoding') : t('globalMap.geocodeNLocations', { count: missingCoordinates })}
              </button>
            )}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500 w-5 h-5" />
              <input
                type="text"
                placeholder={t('globalMap.searchPeoplePlaceholder')}
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="pl-10 pr-3 py-2 bg-white dark:bg-slate-800 dark:text-gray-100 dark:placeholder-gray-600 border border-gray-300 dark:border-gray-600 rounded focus:outline-none focus:border-blue-500 w-64"
              />
            </div>
            <label className="flex items-center space-x-2 cursor-pointer">
              <input type="checkbox" checked={includeRelated} onChange={e => setIncludeRelated(e.target.checked)} className="h-4 w-4 text-blue-600 rounded" />
              <span className="text-sm text-gray-700 dark:text-gray-300">{t('globalMap.includeRelatedPeople')}</span>
            </label>
            <label className="flex items-center space-x-2 cursor-pointer">
              <input type="checkbox" checked={showNetworks} onChange={e => setShowNetworks(e.target.checked)} className="h-4 w-4 text-blue-600 rounded" />
              <span className="text-sm text-gray-700 dark:text-gray-300 flex items-center">
                <Wifi className="w-4 h-4 mr-1" />
                {t('globalMap.wirelessNetworksCount', { count: wirelessNetworks.length })}
              </span>
            </label>
            <label className="flex items-center space-x-2 cursor-pointer">
              <input type="checkbox" checked={showProperties} onChange={e => setShowProperties(e.target.checked)} className="h-4 w-4 text-emerald-600 rounded" />
              <span className="text-sm text-gray-700 dark:text-gray-300 flex items-center"><Landmark className="w-4 h-4 mr-1" />{t('globalMap.propertiesCount', { count: properties.length })}</span>
            </label>
            <label className="flex items-center space-x-2 cursor-pointer">
              <input type="checkbox" checked={showAssets} onChange={e => setShowAssets(e.target.checked)} className="h-4 w-4 text-orange-600 rounded" />
              <span className="text-sm text-gray-700 dark:text-gray-300 flex items-center"><Package className="w-4 h-4 mr-1" />{t('globalMap.assetsCount', { count: assets.length })}</span>
            </label>
            <label className="flex items-center space-x-2 cursor-pointer">
              <input type="checkbox" checked={showTransactions} onChange={e => setShowTransactions(e.target.checked)} className="h-4 w-4 text-blue-600 rounded" />
              <span className="text-sm text-gray-700 dark:text-gray-300 flex items-center"><Receipt className="w-4 h-4 mr-1" />{t('globalMap.transactionsCount', { count: txEvents.length })}</span>
            </label>
          </div>
        </div>

        {/* Location type filters */}
        <div className="mt-4 flex items-center space-x-4">
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
            <Filter className="w-4 h-4 inline mr-1" />{t('globalMap.filterByType')}
          </span>
          <div className="flex flex-wrap gap-2">
            {Object.entries(allTypeColors).map(([type, color]) => (
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
          {showAssets && (
            <select value={filterAssetCategory} onChange={e => setFilterAssetCategory(e.target.value)}
              className="px-2 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded dark:bg-slate-800 dark:text-gray-100">
              <option value="">{t('globalMap.allAssetCategories')}</option>
              {assetCategoryOptions.map(o => <option key={o.id} value={o.option_value}>{optionLabel(t, 'asset_category', o.option_value, o.option_label)}</option>)}
            </select>
          )}
          {showTransactions && (
            <select value={filterTxType} onChange={e => setFilterTxType(e.target.value)}
              className="px-2 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded dark:bg-slate-800 dark:text-gray-100">
              <option value="">{t('globalMap.allTransactionTypes')}</option>
              {txTypeOptions.map(o => <option key={o.id} value={o.option_value}>{optionLabel(t, 'transaction_type', o.option_value, o.option_label)}</option>)}
            </select>
          )}
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
                    {marker.kind === 'property' ? (
                      <div className="p-2 min-w-[200px]">
                        <h3 className="font-semibold text-emerald-600 dark:text-emerald-400 flex items-center"><Landmark className="w-4 h-4 mr-2" />{marker.name}</h3>
                        {marker.propertyType && <p className="text-xs text-gray-600 dark:text-gray-400 capitalize">{marker.propertyType.replace(/_/g, ' ')}</p>}
                        {marker.address && <p className="text-sm text-gray-800 dark:text-gray-200 mt-1">{marker.address}</p>}
                        {marker.ownerName && marker.ownerName.trim() && <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">{t('globalMap.popup.ownerLabel', { name: marker.ownerName })}</p>}
                      </div>
                    ) : marker.kind === 'asset' ? (
                      <div className="p-2 min-w-[200px]">
                        <h3 className="font-semibold text-orange-600 dark:text-orange-400 flex items-center"><Package className="w-4 h-4 mr-2" />{marker.name}</h3>
                        {marker.assetCategory && <p className="text-xs text-gray-600 dark:text-gray-400 capitalize">{marker.assetCategory.replace(/_/g, ' ')}</p>}
                        <p className="text-sm text-gray-800 dark:text-gray-200 mt-1">{t('globalMap.popup.holderLabel', { name: marker.holderName || t('globalMap.popup.noHolder') })}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">{marker.locLabel} ({(marker.locationMode || '').replace(/_/g, ' ')})</p>
                      </div>
                    ) : marker.kind === 'transaction' ? (
                      <div className="p-2 min-w-[200px]">
                        <h3 className="font-semibold text-blue-600 dark:text-blue-400 flex items-center capitalize"><Receipt className="w-4 h-4 mr-2" />{(marker.txType || '').replace(/_/g, ' ')}</h3>
                        <p className="text-sm text-gray-800 dark:text-gray-200 mt-1">{marker.fromLabel || t('globalMap.popup.noHolder')} → {marker.toLabel || t('globalMap.popup.noHolder')}</p>
                        {marker.subjectLabel && <p className="text-xs text-gray-600 dark:text-gray-400">{t('globalMap.popup.subjectLabel', { label: marker.subjectLabel })}</p>}
                        {marker.value != null && <p className="text-xs text-gray-600 dark:text-gray-400">{t('globalMap.popup.valueLabel', { value: marker.value, currency: marker.currency || '' })}</p>}
                        {marker.locLabel && <p className="text-xs text-gray-500 dark:text-gray-400">{marker.locLabel}</p>}
                      </div>
                    ) : marker.type === 'wireless_network' ? (
                      <div className="p-2 min-w-[200px]">
                        <h3 className="font-semibold text-blue-600 dark:text-blue-400 flex items-center">
                          <Wifi className="w-4 h-4 mr-2" />{marker.ssid}
                        </h3>
                        <p className="text-xs text-gray-600 dark:text-gray-400 font-mono">{marker.bssid}</p>
                        <div className="mt-2 border-t dark:border-gray-600 pt-2 space-y-1">
                          {marker.encryption && <p className="text-sm"><span className="font-medium">{t('globalMap.popup.security')}</span> {marker.encryption}</p>}
                          {marker.networkType && <p className="text-sm"><span className="font-medium">{t('globalMap.popup.type')}</span> {marker.networkType}</p>}
                          {marker.signalStrength && <p className="text-sm"><span className="font-medium">{t('globalMap.popup.signal')}</span> {t('globalMap.popup.signalUnit', { value: marker.signalStrength })}</p>}
                          {marker.areaName && <p className="text-sm text-gray-600 dark:text-gray-400">{marker.areaName}</p>}
                          {marker.notes && <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{marker.notes}</p>}
                          {marker.associatedPersonIds.length > 0 && (
                            <p className="text-xs text-green-600 dark:text-green-400 mt-1">{t('globalMap.popup.associatedPersonsCount', { count: marker.associatedPersonIds.length })}</p>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className="p-2 min-w-[200px]">
                        <h3 className="font-semibold text-gray-900 dark:text-gray-100">{marker.personName}</h3>
                        {marker.personCategory && <p className="text-sm text-gray-600 dark:text-gray-400">{marker.personCategory}</p>}
                        {marker.personCaseName && <p className="text-xs text-blue-600 dark:text-blue-400">{t('globalMap.popup.caseLabel', { name: marker.personCaseName })}</p>}
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
                                {marker.locationConfidence >= 70 ? t('globalMap.popup.confidenceHigh') : marker.locationConfidence >= 50 ? t('globalMap.popup.confidenceMedium') : t('globalMap.popup.confidenceLow')} {marker.locationConfidence}%
                              </span>
                            )}
                          </div>
                          {marker.locationAddress && <p className="text-sm text-gray-800 dark:text-gray-200">{marker.locationAddress}</p>}
                          <p className="text-sm text-gray-600 dark:text-gray-400">
                            {[marker.locationCity, marker.locationCountry].filter(Boolean).join(', ')}
                          </p>
                          {marker.isPartialData && (
                            <p className="text-xs text-orange-600 dark:text-orange-400 mt-1 flex items-center">
                              <AlertCircle className="w-3 h-3 mr-1" />{t('globalMap.popup.approximateLocation')}
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

          <MapLegend typeColors={allTypeColors} />
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
              title={t('globalMap.addNewLocationTitle')}
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
