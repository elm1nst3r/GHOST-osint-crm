// File: frontend/src/components/CryptoWalletsList.js
// Crypto wallet entity list (issue #82), modeled on AssetsList.js.
import React, { useState, useCallback, memo } from 'react';
import { useTranslation } from 'react-i18next';
import { FixedSizeList } from 'react-window';
import { Wallet, Search, Plus, Edit2, Trash2, Eye, ExternalLink } from 'lucide-react';
import { cryptoWalletsAPI } from '../utils/api';
import { useData } from '../contexts/DataContext';
import { useUI } from '../contexts/UIContext';
import { useModelOptions } from '../utils/useModelOptions';
import { CRYPTO_WALLET_NETWORKS, CRYPTO_WALLET_TAGS } from '../utils/constants';
import { optionLabel } from '../utils/optionLabels';

const VIRTUAL_THRESHOLD = 150;
const ITEM_HEIGHT = 130;

const CryptoWalletsList = () => {
  const { t } = useTranslation();
  const { cryptoWallets, fetchCryptoWallets, cryptoWalletsMeta, loadMoreCryptoWallets } = useData();
  const { setShowAddCryptoWalletForm, setEditingCryptoWallet, setSelectedCryptoWalletForDetail } = useUI();
  const [searchTerm, setSearchTerm] = useState('');
  const [filterNetwork, setFilterNetwork] = useState('');
  const [filterTag, setFilterTag] = useState('');
  const [loadingMore, setLoadingMore] = useState(false);

  const networkOptions = useModelOptions('crypto_wallet_network', CRYPTO_WALLET_NETWORKS);
  const tagOptions = useModelOptions('crypto_wallet_tag', CRYPTO_WALLET_TAGS);

  const handleDelete = async (id) => {
    if (!window.confirm(t('cryptoWalletsList.confirmDelete'))) return;
    try { await cryptoWalletsAPI.remove(id); fetchCryptoWallets(0); }
    catch (err) { alert(t('cryptoWalletsList.errorDelete', { message: err.message })); }
  };

  const filtered = cryptoWallets.filter(w => {
    const matchesSearch = searchTerm === '' ||
      (w.address && w.address.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (w.label && w.label.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesNetwork = filterNetwork === '' || w.network === filterNetwork;
    const matchesTag = filterTag === '' || (Array.isArray(w.tags) && w.tags.includes(filterTag));
    return matchesSearch && matchesNetwork && matchesTag;
  });

  const Card = ({ wallet }) => (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-sm rounded-lg p-5 hover:shadow-md transition-shadow group">
      <div className="flex justify-between items-start mb-3">
        <div className="flex items-center space-x-3 min-w-0">
          <div className="w-11 h-11 rounded-lg bg-gray-100 dark:bg-gray-700 flex items-center justify-center flex-shrink-0">
            <Wallet className="w-6 h-6 text-purple-600 dark:text-purple-400" />
          </div>
          <div className="min-w-0">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white truncate">{wallet.label || wallet.address}</h3>
            <div className="flex items-center gap-2 flex-wrap">
              {wallet.network && <span className="text-xs px-2 py-0.5 rounded bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-300">{optionLabel(t, 'crypto_wallet_network', wallet.network, wallet.network)}</span>}
              {(wallet.tags || []).map(tag => (
                <span key={tag} className="text-xs px-2 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300">{optionLabel(t, 'crypto_wallet_tag', tag, tag)}</span>
              ))}
            </div>
          </div>
        </div>
        <div className="flex space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button onClick={() => setSelectedCryptoWalletForDetail(wallet)} className="p-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-blue-600 dark:text-blue-400 hover:bg-blue-600 hover:text-white" title={t('common.view')}><Eye className="w-4 h-4" /></button>
          <button onClick={() => setEditingCryptoWallet(wallet)} className="p-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-600 hover:text-white" title={t('common.edit')}><Edit2 className="w-4 h-4" /></button>
          <button onClick={() => handleDelete(wallet.id)} className="p-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-red-600 dark:text-red-400 hover:bg-red-600 hover:text-white" title={t('common.delete')}><Trash2 className="w-4 h-4" /></button>
        </div>
      </div>
      <div className="space-y-1.5 text-sm">
        <div className="text-gray-700 dark:text-gray-300 font-mono text-xs truncate">{wallet.address}</div>
        {wallet.external_reference_url && (
          <a href={wallet.external_reference_url} target="_blank" rel="noreferrer" className="flex items-center text-blue-600 dark:text-blue-400 hover:underline">
            <ExternalLink className="w-3.5 h-3.5 mr-1.5" />{t('cryptoWalletsList.externalReference')}
          </a>
        )}
      </div>
    </div>
  );

  const renderVirtual = useCallback(({ index, style }) => (
    <div style={{ ...style, paddingBottom: 16 }}><Card wallet={filtered[index]} /></div>
  // eslint-disable-next-line react-hooks/exhaustive-deps
  ), [filtered]);

  return (
    <div className="p-6">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">{t('cryptoWalletsList.title')}</h1>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-2 flex items-center">
            <Wallet className="w-5 h-5 mr-2 text-purple-600 dark:text-purple-400" />
            <span className="font-medium">
              {cryptoWalletsMeta.total > cryptoWallets.length
                ? t('cryptoWalletsList.countTotal', { count: cryptoWallets.length, total: cryptoWalletsMeta.total })
                : t('cryptoWalletsList.countSimple', { count: cryptoWallets.length })}
            </span>
          </p>
        </div>
        <button onClick={() => setShowAddCryptoWalletForm(true)} className="px-6 py-3 bg-accent-primary text-white rounded-lg hover:bg-accent-primary-hover transition flex items-center active:scale-[0.97]">
          <Plus className="w-5 h-5 mr-2" />{t('cryptoWalletsList.addWallet')}
        </button>
      </div>

      <div className="mb-6 flex flex-wrap gap-4">
        <div className="flex-1 max-w-md relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-blue-600 dark:text-blue-400 w-5 h-5" />
          <input type="text" placeholder={t('cryptoWalletsList.searchPlaceholder')} value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:border-blue-500 dark:bg-gray-800 dark:text-white dark:placeholder-gray-500" />
        </div>
        <select value={filterNetwork} onChange={e => setFilterNetwork(e.target.value)} className="px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-800 dark:text-white">
          <option value="">{t('cryptoWalletsList.allNetworks')}</option>
          {networkOptions.map(o => <option key={o.value} value={o.value}>{optionLabel(t, 'crypto_wallet_network', o.value, o.label)}</option>)}
        </select>
        <select value={filterTag} onChange={e => setFilterTag(e.target.value)} className="px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-800 dark:text-white">
          <option value="">{t('cryptoWalletsList.allTags')}</option>
          {tagOptions.map(o => <option key={o.value} value={o.value}>{optionLabel(t, 'crypto_wallet_tag', o.value, o.label)}</option>)}
        </select>
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-12 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg">
          <Wallet className="w-12 h-12 text-gray-400 mx-auto mb-3" />
          <p className="text-gray-600 dark:text-gray-400">{t('cryptoWalletsList.noResultsFound')}</p>
        </div>
      ) : filtered.length >= VIRTUAL_THRESHOLD ? (
        <FixedSizeList height={Math.min(filtered.length * ITEM_HEIGHT, 700)} itemCount={filtered.length} itemSize={ITEM_HEIGHT} width="100%" overscanCount={3}>
          {renderVirtual}
        </FixedSizeList>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filtered.map(w => <Card key={w.id} wallet={w} />)}
        </div>
      )}

      {cryptoWalletsMeta.hasMore && filtered.length === cryptoWallets.length && (
        <div className="flex flex-col items-center py-6 space-y-2">
          <p className="text-sm text-gray-500 dark:text-gray-400">{t('cryptoWalletsList.showingOfTotal', { count: cryptoWallets.length, total: cryptoWalletsMeta.total })}</p>
          <button onClick={async () => { setLoadingMore(true); await loadMoreCryptoWallets(); setLoadingMore(false); }} disabled={loadingMore}
            className="px-5 py-2.5 bg-blue-600 dark:bg-blue-500 text-white rounded-lg text-sm font-medium disabled:opacity-60">
            {loadingMore ? t('common.loadingEllipsis') : t('common.loadMoreRemaining', { count: cryptoWalletsMeta.total - cryptoWallets.length })}
          </button>
        </div>
      )}
    </div>
  );
};

export default memo(CryptoWalletsList);
