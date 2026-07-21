// File: frontend/src/components/AssetsList.js
import React, { useState, useEffect, useCallback, memo } from 'react';
import { useTranslation } from 'react-i18next';
import { FixedSizeList } from 'react-window';
import { Package, Search, Plus, Edit2, Trash2, Eye, MapPin, User, Hash } from 'lucide-react';
import { assetsAPI, modelOptionsAPI } from '../utils/api';
import { useData } from '../contexts/DataContext';
import { useUI } from '../contexts/UIContext';

const VIRTUAL_THRESHOLD = 150;
const ITEM_HEIGHT = 160;

const AssetsList = () => {
  const { t } = useTranslation();
  const { assets, fetchAssets, assetsMeta, loadMoreAssets } = useData();
  const { setShowAddAssetForm, setEditingAsset, setSelectedAssetForDetail } = useUI();
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [categoryOptions, setCategoryOptions] = useState([]);
  const [statusOptions, setStatusOptions] = useState([]);
  const [loadingMore, setLoadingMore] = useState(false);

  useEffect(() => {
    modelOptionsAPI.getAll().then(d => {
      setCategoryOptions(d.filter(o => o.model_type === 'asset_category' && o.is_active));
      setStatusOptions(d.filter(o => o.model_type === 'asset_status' && o.is_active));
    }).catch(err => console.error('Error loading asset options:', err));
  }, []);

  const handleDelete = async (id) => {
    if (!window.confirm(t('assetsList.confirmDeleteAsset'))) return;
    try { await assetsAPI.remove(id); fetchAssets(0); }
    catch (err) { alert(t('assetsList.errorDeleteAsset', { message: err.message })); }
  };

  const filtered = assets.filter(a => {
    const matchesSearch = searchTerm === '' ||
      (a.name && a.name.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (a.identifier && a.identifier.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesCategory = filterCategory === '' || a.category === filterCategory;
    const matchesStatus = filterStatus === '' || a.status === filterStatus;
    return matchesSearch && matchesCategory && matchesStatus;
  });

  const Card = ({ asset }) => (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-sm rounded-lg p-5 hover:shadow-md transition-shadow group">
      <div className="flex justify-between items-start mb-3">
        <div className="flex items-center space-x-3 min-w-0">
          <div className="w-11 h-11 rounded-lg bg-gray-100 dark:bg-gray-700 flex items-center justify-center flex-shrink-0">
            <Package className="w-6 h-6 text-orange-600 dark:text-orange-400" />
          </div>
          <div className="min-w-0">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white truncate">{asset.name}</h3>
            <div className="flex items-center gap-2 flex-wrap">
              {asset.category && <span className="text-xs px-2 py-0.5 rounded bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-300 capitalize">{asset.category.replace(/_/g, ' ')}</span>}
              {asset.status && <span className="text-xs px-2 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 capitalize">{asset.status}</span>}
            </div>
          </div>
        </div>
        <div className="flex space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button onClick={() => setSelectedAssetForDetail(asset)} className="p-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-blue-600 dark:text-blue-400 hover:bg-blue-600 hover:text-white" title={t('common.view')}><Eye className="w-4 h-4" /></button>
          <button onClick={() => setEditingAsset(asset)} className="p-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-600 hover:text-white" title={t('common.edit')}><Edit2 className="w-4 h-4" /></button>
          <button onClick={() => handleDelete(asset.id)} className="p-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-red-600 dark:text-red-400 hover:bg-red-600 hover:text-white" title={t('common.delete')}><Trash2 className="w-4 h-4" /></button>
        </div>
      </div>
      <div className="space-y-1.5 text-sm">
        {asset.identifier && <div className="flex items-center text-gray-700 dark:text-gray-300"><Hash className="w-4 h-4 mr-2 text-gray-400" /><span className="truncate">{asset.identifier}</span></div>}
        <div className="flex items-center text-gray-700 dark:text-gray-300"><User className="w-4 h-4 mr-2 text-gray-400" />{t('assetsList.holderLabel', { name: asset.current_holder ? asset.current_holder.label : t('assetsList.noHolder') })}</div>
        {asset.resolved_location && asset.resolved_location.latitude != null && (
          <div className="flex items-center text-gray-700 dark:text-gray-300"><MapPin className="w-4 h-4 mr-2 text-gray-400" /><span className="truncate">{asset.resolved_location.label || t('assetsList.locatedFallback')} ({asset.location_mode?.replace(/_/g, ' ')})</span></div>
        )}
      </div>
    </div>
  );

  const renderVirtual = useCallback(({ index, style }) => (
    <div style={{ ...style, paddingBottom: 16 }}><Card asset={filtered[index]} /></div>
  // eslint-disable-next-line react-hooks/exhaustive-deps
  ), [filtered]);

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">{t('assetsList.title')}</h1>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-2 flex items-center">
            <Package className="w-5 h-5 mr-2 text-orange-600 dark:text-orange-400" />
            <span className="font-medium">
              {assetsMeta.total > assets.length
                ? t('assetsList.countTotal', { count: assets.length, total: assetsMeta.total })
                : t('assetsList.countSimple', { count: assets.length })}
            </span>
          </p>
        </div>
        <button onClick={() => setShowAddAssetForm(true)} className="px-6 py-3 bg-blue-600 text-white dark:bg-blue-500 rounded-lg hover:shadow-glow-md transition flex items-center active:scale-[0.97]">
          <Plus className="w-5 h-5 mr-2" />{t('assetsList.addAsset')}
        </button>
      </div>

      <div className="mb-6 flex space-x-4">
        <div className="flex-1 max-w-md relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-blue-600 dark:text-blue-400 w-5 h-5" />
          <input type="text" placeholder={t('assetsList.searchPlaceholder')} value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:border-blue-500 dark:bg-gray-800 dark:text-white dark:placeholder-gray-500" />
        </div>
        <select value={filterCategory} onChange={e => setFilterCategory(e.target.value)} className="px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-800 dark:text-white">
          <option value="">{t('assetsList.allCategories')}</option>
          {categoryOptions.map(o => <option key={o.id} value={o.option_value}>{o.option_label}</option>)}
        </select>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-800 dark:text-white">
          <option value="">{t('assetsList.allStatuses')}</option>
          {statusOptions.map(o => <option key={o.id} value={o.option_value}>{o.option_label}</option>)}
        </select>
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-12 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg">
          <Package className="w-12 h-12 text-gray-400 mx-auto mb-3" />
          <p className="text-gray-600 dark:text-gray-400">{t('assetsList.noResultsFound')}</p>
        </div>
      ) : filtered.length >= VIRTUAL_THRESHOLD ? (
        <FixedSizeList height={Math.min(filtered.length * ITEM_HEIGHT, 700)} itemCount={filtered.length} itemSize={ITEM_HEIGHT} width="100%" overscanCount={3}>
          {renderVirtual}
        </FixedSizeList>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filtered.map(a => <Card key={a.id} asset={a} />)}
        </div>
      )}

      {assetsMeta.hasMore && filtered.length === assets.length && (
        <div className="flex flex-col items-center py-6 space-y-2">
          <p className="text-sm text-gray-500 dark:text-gray-400">{t('assetsList.showingOfTotal', { count: assets.length, total: assetsMeta.total })}</p>
          <button onClick={async () => { setLoadingMore(true); await loadMoreAssets(); setLoadingMore(false); }} disabled={loadingMore}
            className="px-5 py-2.5 bg-blue-600 dark:bg-blue-500 text-white rounded-lg text-sm font-medium disabled:opacity-60">
            {loadingMore ? t('common.loadingEllipsis') : t('common.loadMoreRemaining', { count: assetsMeta.total - assets.length })}
          </button>
        </div>
      )}
    </div>
  );
};

export default memo(AssetsList);
