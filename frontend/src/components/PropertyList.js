// File: frontend/src/components/PropertyList.js
import React, { useState, useEffect, useCallback, memo } from 'react';
import { useTranslation } from 'react-i18next';
import { FixedSizeList } from 'react-window';
import { Landmark, Search, Plus, Edit2, Trash2, Eye, MapPin, User } from 'lucide-react';
import { propertiesAPI, modelOptionsAPI } from '../utils/api';
import { useData } from '../contexts/DataContext';
import { useUI } from '../contexts/UIContext';

const VIRTUAL_THRESHOLD = 150;
const ITEM_HEIGHT = 150;

const PropertyList = () => {
  const { t } = useTranslation();
  const { properties, fetchProperties, propertiesMeta, loadMoreProperties } = useData();
  const { setShowAddPropertyForm, setEditingProperty, setSelectedPropertyForDetail } = useUI();
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('');
  const [typeOptions, setTypeOptions] = useState([]);
  const [loadingMore, setLoadingMore] = useState(false);

  useEffect(() => {
    modelOptionsAPI.getAll()
      .then(data => setTypeOptions(data.filter(o => o.model_type === 'property_type' && o.is_active)))
      .catch(err => console.error('Error loading property types:', err));
  }, []);

  const handleDelete = async (id) => {
    if (!window.confirm(t('propertyList.confirmDeleteProperty'))) return;
    try {
      await propertiesAPI.remove(id);
      fetchProperties(0);
    } catch (err) {
      alert(t('propertyList.errorDeleteProperty', { message: err.message }));
    }
  };

  const filtered = properties.filter(p => {
    const matchesSearch = searchTerm === '' ||
      (p.name && p.name.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (p.address && p.address.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (p.city && p.city.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesType = filterType === '' || p.property_type === filterType;
    return matchesSearch && matchesType;
  });

  const Card = ({ property }) => (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-sm rounded-lg p-5 hover:shadow-md transition-shadow duration-150 group">
      <div className="flex justify-between items-start mb-3">
        <div className="flex items-center space-x-3 min-w-0">
          <div className="w-11 h-11 rounded-lg bg-gray-100 dark:bg-gray-700 flex items-center justify-center flex-shrink-0">
            <Landmark className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div className="min-w-0">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white truncate">{property.name}</h3>
            {property.property_type && (
              <span className="inline-flex items-center text-xs px-2 py-0.5 rounded bg-emerald-100 dark:bg-emerald-900/30 text-emerald-800 dark:text-emerald-300 capitalize">
                {property.property_type.replace(/_/g, ' ')}
              </span>
            )}
          </div>
        </div>
        <div className="flex space-x-1 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
          <button onClick={() => setSelectedPropertyForDetail(property)} className="p-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-blue-600 dark:text-blue-400 hover:bg-blue-600 hover:text-white transition-colors" title={t('common.view')}><Eye className="w-4 h-4" /></button>
          <button onClick={() => setEditingProperty(property)} className="p-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-600 hover:text-white transition-colors" title={t('common.edit')}><Edit2 className="w-4 h-4" /></button>
          <button onClick={() => handleDelete(property.id)} className="p-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-red-600 dark:text-red-400 hover:bg-red-600 hover:text-white transition-colors" title={t('common.delete')}><Trash2 className="w-4 h-4" /></button>
        </div>
      </div>
      <div className="space-y-1.5 text-sm">
        {(property.address || property.city) && (
          <div className="flex items-center text-gray-700 dark:text-gray-300">
            <MapPin className="w-4 h-4 mr-2 text-gray-400" />
            <span className="truncate">{[property.address, property.city, property.country].filter(Boolean).join(', ')}</span>
          </div>
        )}
        {property.owner_name && property.owner_name.trim() && (
          <div className="flex items-center text-gray-700 dark:text-gray-300">
            <User className="w-4 h-4 mr-2 text-gray-400" />
            <span>{t('propertyList.ownerLabel', { name: property.owner_name })}</span>
          </div>
        )}
      </div>
    </div>
  );

  const renderVirtual = useCallback(({ index, style }) => (
    <div style={{ ...style, paddingBottom: 16 }}><Card property={filtered[index]} /></div>
  // eslint-disable-next-line react-hooks/exhaustive-deps
  ), [filtered]);

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">{t('propertyList.title')}</h1>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-2 flex items-center">
            <Landmark className="w-5 h-5 mr-2 text-emerald-600 dark:text-emerald-400" />
            <span className="font-medium">
              {propertiesMeta.total > properties.length
                ? t('propertyList.countTotal', { count: properties.length, total: propertiesMeta.total })
                : t('propertyList.countSimple', { count: properties.length })}
            </span>
          </p>
        </div>
        <button onClick={() => setShowAddPropertyForm(true)} className="px-6 py-3 bg-blue-600 text-white dark:bg-blue-500 rounded-lg hover:shadow-glow-md transition flex items-center active:scale-[0.97]">
          <Plus className="w-5 h-5 mr-2" />{t('propertyList.addProperty')}
        </button>
      </div>

      <div className="mb-6 flex space-x-4">
        <div className="flex-1 max-w-md relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-blue-600 dark:text-blue-400 w-5 h-5" />
          <input type="text" placeholder={t('propertyList.searchPlaceholder')} value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:border-blue-500 dark:bg-gray-800 dark:text-white dark:placeholder-gray-500" />
        </div>
        <select value={filterType} onChange={(e) => setFilterType(e.target.value)}
          className="px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-800 dark:text-white">
          <option value="">{t('propertyList.allTypes')}</option>
          {typeOptions.map(o => <option key={o.id} value={o.option_value}>{o.option_label}</option>)}
        </select>
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-12 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg">
          <Landmark className="w-12 h-12 text-gray-400 mx-auto mb-3" />
          <p className="text-gray-600 dark:text-gray-400">{t('propertyList.noResultsFound')}</p>
        </div>
      ) : filtered.length >= VIRTUAL_THRESHOLD ? (
        <FixedSizeList height={Math.min(filtered.length * ITEM_HEIGHT, 700)} itemCount={filtered.length} itemSize={ITEM_HEIGHT} width="100%" overscanCount={3}>
          {renderVirtual}
        </FixedSizeList>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filtered.map(p => <Card key={p.id} property={p} />)}
        </div>
      )}

      {propertiesMeta.hasMore && filtered.length === properties.length && (
        <div className="flex flex-col items-center py-6 space-y-2">
          <p className="text-sm text-gray-500 dark:text-gray-400">{t('propertyList.showingOfTotal', { count: properties.length, total: propertiesMeta.total })}</p>
          <button onClick={async () => { setLoadingMore(true); await loadMoreProperties(); setLoadingMore(false); }} disabled={loadingMore}
            className="px-5 py-2.5 bg-blue-600 dark:bg-blue-500 text-white rounded-lg text-sm font-medium disabled:opacity-60">
            {loadingMore ? t('common.loadingEllipsis') : t('common.loadMoreRemaining', { count: propertiesMeta.total - properties.length })}
          </button>
        </div>
      )}
    </div>
  );
};

export default memo(PropertyList);
