// File: frontend/src/components/CryptoWalletDetailModal.js
// Modeled on AssetDetailModal.js. Adds a relationships panel that reads/
// writes the `relationships` table directly via relationshipsAPI (issue
// #82) -- wallets have no legacy JSONB connections field to sync into, so
// this is the write-of-record UI for wallet<->person/business/wallet links,
// unlike ConnectionsSection.js's person<->person path.
import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Wallet, X, Edit2, ExternalLink, Plus, Trash2 } from 'lucide-react';
import { cryptoWalletsAPI, relationshipsAPI } from '../utils/api';
import { useUI } from '../contexts/UIContext';
import { useData } from '../contexts/DataContext';
import { useProject } from '../contexts/ProjectContext';
import { optionLabel } from '../utils/optionLabels';

const inputClass = 'w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:border-blue-500 dark:bg-gray-700 dark:text-white text-sm';

const ENTITY_LABEL = { person: 'p', business: 'b', crypto_wallet: 'w' };

const CryptoWalletDetailModal = ({ wallet: initial, onClose }) => {
  const { t } = useTranslation();
  const { setEditingCryptoWallet } = useUI();
  const { people, businesses, cryptoWallets } = useData();
  const { activeProjectId } = useProject();
  const [wallet, setWallet] = useState(initial);
  const [newType, setNewType] = useState('person');
  const [newTargetId, setNewTargetId] = useState('');
  const [newRelType, setNewRelType] = useState('other');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const reload = useCallback(() => {
    cryptoWalletsAPI.getById(initial.id).then(setWallet).catch(err => console.error('Error loading wallet:', err));
  }, [initial.id]);

  useEffect(() => { reload(); }, [reload]);

  const entityLabel = (entityType, entityId) => {
    if (entityType === 'person') {
      const p = people.find(pp => pp.id === entityId);
      return p ? `${p.first_name || ''} ${p.last_name || ''}`.trim() : `${t('cryptoWalletDetailModal.person')} #${entityId}`;
    }
    if (entityType === 'business') {
      const b = businesses.find(bb => bb.id === entityId);
      return b ? b.name : `${t('cryptoWalletDetailModal.business')} #${entityId}`;
    }
    const w = cryptoWallets.find(ww => ww.id === entityId);
    return w ? (w.label || w.address) : `${t('cryptoWalletDetailModal.wallet')} #${entityId}`;
  };

  const targetOptions = newType === 'person' ? people : newType === 'business' ? businesses : cryptoWallets.filter(w => w.id !== wallet.id);

  const handleAddRelationship = async (e) => {
    e.preventDefault();
    if (!newTargetId) return;
    setSaving(true);
    setError('');
    try {
      await relationshipsAPI.create({
        project_id: activeProjectId,
        case_id: wallet.case_id || null,
        source_type: 'crypto_wallet',
        source_id: wallet.id,
        target_type: newType,
        target_id: parseInt(newTargetId, 10),
        relationship_type: newRelType || 'other',
      });
      setNewTargetId('');
      reload();
    } catch (err) {
      setError(err.message || t('cryptoWalletDetailModal.errorAddRelationship'));
    } finally {
      setSaving(false);
    }
  };

  const handleRemoveRelationship = async (relationshipId) => {
    if (!window.confirm(t('cryptoWalletDetailModal.confirmRemoveRelationship'))) return;
    try {
      await relationshipsAPI.remove(relationshipId);
      reload();
    } catch (err) {
      alert(err.message || t('cryptoWalletDetailModal.errorRemoveRelationship'));
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl border border-gray-200 dark:border-gray-700 w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <div className="p-5 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
          <div className="flex items-center space-x-3 min-w-0">
            <div className="w-12 h-12 rounded-lg bg-gray-100 dark:bg-gray-700 flex items-center justify-center flex-shrink-0"><Wallet className="w-6 h-6 text-purple-600 dark:text-purple-400" /></div>
            <div className="min-w-0">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white truncate">{wallet.label || wallet.address}</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 font-mono truncate">{wallet.address}</p>
            </div>
          </div>
          <div className="flex space-x-2 flex-shrink-0">
            <button onClick={() => { onClose(); setEditingCryptoWallet(wallet); }} className="p-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-blue-600 dark:text-blue-400 hover:bg-blue-600 hover:text-white"><Edit2 className="w-5 h-5" /></button>
            <button onClick={onClose} className="p-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-red-600 hover:text-white"><X className="w-5 h-5" /></button>
          </div>
        </div>

        <div className="overflow-y-auto p-5 space-y-4 text-sm">
          <div className="flex items-center gap-2 flex-wrap">
            {wallet.network && <span className="text-xs px-2 py-0.5 rounded bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-300">{optionLabel(t, 'crypto_wallet_network', wallet.network, wallet.network)}</span>}
            {(wallet.tags || []).map(tag => (
              <span key={tag} className="text-xs px-2 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300">{optionLabel(t, 'crypto_wallet_tag', tag, tag)}</span>
            ))}
          </div>

          {wallet.external_reference_url && (
            <a href={wallet.external_reference_url} target="_blank" rel="noreferrer" className="flex items-center text-blue-600 dark:text-blue-400 hover:underline">
              <ExternalLink className="w-4 h-4 mr-1.5" />{t('cryptoWalletDetailModal.viewExternalReference')}
            </a>
          )}

          {wallet.notes && <div><h4 className="font-semibold text-gray-900 dark:text-white mb-1">{t('cryptoWalletForm.notes')}</h4><p className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{wallet.notes}</p></div>}

          <div className="p-3 rounded-lg bg-gray-50 dark:bg-gray-900/40 border border-gray-200 dark:border-gray-700">
            <h4 className="font-semibold text-gray-900 dark:text-white mb-2">{t('cryptoWalletDetailModal.relationships')}</h4>
            {(wallet.connections || []).length === 0 ? (
              <p className="text-gray-500 dark:text-gray-400 text-xs">{t('cryptoWalletDetailModal.noRelationships')}</p>
            ) : (
              <ul className="space-y-1.5 mb-3">
                {wallet.connections.map(c => (
                  <li key={c.relationship_id} className="flex items-center justify-between gap-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md px-3 py-1.5">
                    <span className="truncate">
                      <span className="text-xs uppercase text-gray-400 mr-1.5">[{ENTITY_LABEL[c.entity_type] || c.entity_type}]</span>
                      {entityLabel(c.entity_type, c.entity_id)}
                      <span className="text-xs text-gray-500 dark:text-gray-400 ml-1.5">({c.type})</span>
                    </span>
                    <button onClick={() => handleRemoveRelationship(c.relationship_id)} className="p-1 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 rounded flex-shrink-0"><Trash2 className="w-3.5 h-3.5" /></button>
                  </li>
                ))}
              </ul>
            )}

            <form onSubmit={handleAddRelationship} className="flex flex-wrap gap-2 items-end">
              <select className={`${inputClass} w-auto`} value={newType} onChange={e => { setNewType(e.target.value); setNewTargetId(''); }}>
                <option value="person">{t('cryptoWalletDetailModal.person')}</option>
                <option value="business">{t('cryptoWalletDetailModal.business')}</option>
                <option value="crypto_wallet">{t('cryptoWalletDetailModal.wallet')}</option>
              </select>
              <select className={`${inputClass} flex-1 min-w-[10rem]`} value={newTargetId} onChange={e => setNewTargetId(e.target.value)}>
                <option value="">{t('common.selectPlaceholder')}</option>
                {targetOptions.map(o => (
                  <option key={o.id} value={o.id}>{newType === 'person' ? `${o.first_name || ''} ${o.last_name || ''}`.trim() : (o.name || o.label || o.address)}</option>
                ))}
              </select>
              <input className={`${inputClass} w-32`} value={newRelType} onChange={e => setNewRelType(e.target.value)} placeholder={t('cryptoWalletDetailModal.relationshipTypePlaceholder')} />
              <button type="submit" disabled={saving || !newTargetId} className="px-3 py-2 rounded-lg bg-accent-primary text-white text-sm disabled:opacity-60 flex items-center gap-1">
                <Plus className="w-4 h-4" />{t('common.add')}
              </button>
            </form>
            {error && <p className="text-red-600 dark:text-red-400 text-xs mt-2">{error}</p>}
          </div>
        </div>
      </div>
    </div>
  );
};

export default CryptoWalletDetailModal;
