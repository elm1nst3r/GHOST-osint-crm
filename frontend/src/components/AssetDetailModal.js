// File: frontend/src/components/AssetDetailModal.js
import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Package, X, Edit2, MapPin, User, Hash } from 'lucide-react';
import { assetsAPI } from '../utils/api';
import { useUI } from '../contexts/UIContext';
import ChainOfCustodyTimeline from './ChainOfCustodyTimeline';
import { formatMoney, formatDate, prettyType } from '../utils/transactionFormat';

const AssetDetailModal = ({ asset: initial, onClose }) => {
  const { t } = useTranslation();
  const { setEditingAsset } = useUI();
  const [asset, setAsset] = useState(initial);
  const [tab, setTab] = useState('details');

  useEffect(() => {
    assetsAPI.getById(initial.id).then(setAsset).catch(err => console.error('Error loading asset:', err));
  }, [initial.id]);

  const loc = asset.resolved_location;

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl border border-gray-200 dark:border-gray-700 w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        <div className="p-5 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
          <div className="flex items-center space-x-3">
            <div className="w-12 h-12 rounded-lg bg-gray-100 dark:bg-gray-700 flex items-center justify-center"><Package className="w-6 h-6 text-orange-600 dark:text-orange-400" /></div>
            <div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">{asset.name}</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 capitalize">{[asset.category, asset.status].filter(Boolean).join(' · ').replace(/_/g, ' ')}</p>
            </div>
          </div>
          <div className="flex space-x-2">
            <button onClick={() => { onClose(); setEditingAsset(asset); }} className="p-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-blue-600 dark:text-blue-400 hover:bg-blue-600 hover:text-white"><Edit2 className="w-5 h-5" /></button>
            <button onClick={onClose} className="p-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-red-600 hover:text-white"><X className="w-5 h-5" /></button>
          </div>
        </div>

        <div className="border-b border-gray-200 dark:border-gray-700 flex">
          {['details', 'custody'].map(tabId => (
            <button key={tabId} onClick={() => setTab(tabId)} className={`px-5 py-3 text-sm font-medium capitalize border-b-2 ${tab === tabId ? 'border-blue-500 text-blue-600 dark:text-blue-400' : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}>{tabId === 'custody' ? t('assetDetailModal.chainOfCustodyTab') : t('propertyDetailModal.tab_details')}</button>
          ))}
        </div>

        <div className="overflow-y-auto p-5" style={{ maxHeight: 'calc(90vh - 170px)' }}>
          {tab === 'details' && (
            <div className="space-y-4 text-sm">
              <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 text-blue-800 dark:text-blue-300 flex items-center">
                <User className="w-4 h-4 mr-2" />{t('assetDetailModal.currentHolder')} <strong className="ml-1">{asset.current_holder ? asset.current_holder.label : t('assetDetailModal.noneValue')}</strong>
                {asset.holder_since ? <span className="ml-1">{t('propertyDetailModal.sinceDate', { date: formatDate(asset.holder_since) })}</span> : null}
              </div>
              {asset.identifier && <div className="flex items-center text-gray-700 dark:text-gray-300"><Hash className="w-4 h-4 mr-2 text-gray-400" />{asset.identifier}</div>}
              {asset.estimated_value != null && <div className="text-gray-700 dark:text-gray-300">{t('assetDetailModal.estimatedValue', { value: formatMoney(asset.estimated_value, asset.currency) })}</div>}
              <div className="p-3 rounded-lg bg-gray-50 dark:bg-gray-900/40 border border-gray-200 dark:border-gray-700">
                <div className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1 flex items-center"><MapPin className="w-3 h-3 mr-1" />{t('assetDetailModal.resolvedLocation', { mode: prettyType(asset.location_mode) })}</div>
                {loc && loc.latitude != null ? (
                  <div className="text-gray-800 dark:text-gray-200">{loc.label || t('assetDetailModal.located')} · {Number(loc.latitude).toFixed(4)}, {Number(loc.longitude).toFixed(4)} <span className="text-xs text-gray-500">({loc.source})</span></div>
                ) : <div className="text-gray-500 dark:text-gray-400">{t('assetDetailModal.locationUnknown')}</div>}
              </div>
              {asset.description && <div><h4 className="font-semibold text-gray-900 dark:text-white mb-1">{t('propertyDetailModal.descriptionLabel')}</h4><p className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{asset.description}</p></div>}
              {asset.notes && <div><h4 className="font-semibold text-gray-900 dark:text-white mb-1">{t('propertyDetailModal.notesLabel')}</h4><p className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{asset.notes}</p></div>}
            </div>
          )}
          {tab === 'custody' && <ChainOfCustodyTimeline chain={asset.chain_of_custody || []} emptyText={t('assetDetailModal.noCustodyMovements')} />}
        </div>
      </div>
    </div>
  );
};

export default AssetDetailModal;
