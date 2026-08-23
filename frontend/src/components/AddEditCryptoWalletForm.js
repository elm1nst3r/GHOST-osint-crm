// File: frontend/src/components/AddEditCryptoWalletForm.js
// Modeled on AddEditAssetForm.js, without the location-model complexity a
// wallet doesn't have. Tags are a multi-select over crypto_wallet_tag
// options (model_type-backed suggestions) plus free-form additions, backed
// by the tags text[] column (issue #82).
import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { X, Wallet } from 'lucide-react';
import { cryptoWalletsAPI, casesAPI } from '../utils/api';
import { useData } from '../contexts/DataContext';
import { useProject } from '../contexts/ProjectContext';
import { useModelOptions } from '../utils/useModelOptions';
import { CRYPTO_WALLET_NETWORKS, CRYPTO_WALLET_TAGS } from '../utils/constants';
import { optionLabel } from '../utils/optionLabels';

const inputClass = 'w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:border-blue-500 dark:bg-gray-700 dark:text-white';
const labelClass = 'block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1';

const AddEditCryptoWalletForm = ({ wallet, onClose }) => {
  const { t } = useTranslation();
  const { fetchCryptoWallets } = useData();
  const { activeProjectId } = useProject();
  const isEdit = !!wallet;
  const networkOptions = useModelOptions('crypto_wallet_network', CRYPTO_WALLET_NETWORKS);
  const tagOptions = useModelOptions('crypto_wallet_tag', CRYPTO_WALLET_TAGS);
  const [cases, setCases] = useState([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [newTag, setNewTag] = useState('');

  const [form, setForm] = useState({
    address: wallet?.address || '',
    network: wallet?.network || '',
    label: wallet?.label || '',
    tags: Array.isArray(wallet?.tags) ? wallet.tags : [],
    external_reference_url: wallet?.external_reference_url || '',
    notes: wallet?.notes || '',
    status: wallet?.status || 'active',
    case_id: wallet?.case_id || '',
  });

  useEffect(() => {
    casesAPI.getAll({ project_id: activeProjectId }).then(setCases).catch(() => {});
  }, [activeProjectId]);

  const update = (k, v) => setForm(prev => ({ ...prev, [k]: v }));

  const toggleTag = (value) => {
    setForm(prev => ({
      ...prev,
      tags: prev.tags.includes(value) ? prev.tags.filter(t => t !== value) : [...prev.tags, value],
    }));
  };

  const addCustomTag = () => {
    const value = newTag.trim();
    if (value && !form.tags.includes(value)) update('tags', [...form.tags, value]);
    setNewTag('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.address.trim()) { setError(t('cryptoWalletForm.errorAddressRequired')); return; }
    if (!isEdit && !activeProjectId) { setError(t('cryptoWalletForm.errorNoActiveProject')); return; }
    setSaving(true);
    setError('');
    const payload = { ...form, case_id: form.case_id || null };
    try {
      if (isEdit) {
        await cryptoWalletsAPI.update(wallet.id, payload);
      } else {
        await cryptoWalletsAPI.create({ ...payload, project_id: activeProjectId });
      }
      await fetchCryptoWallets(0);
      onClose();
    } catch (err) {
      setError(err.message || t('cryptoWalletForm.errorSave'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl border border-gray-200 dark:border-gray-700 w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <div className="p-5 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center">
            <Wallet className="w-5 h-5 mr-2 text-purple-600 dark:text-purple-400" />{isEdit ? t('cryptoWalletForm.editTitle') : t('cryptoWalletForm.addTitle')}
          </h2>
          <button onClick={onClose} className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700"><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 overflow-y-auto space-y-4">
          {error && <div className="p-3 rounded-lg bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 text-sm">{error}</div>}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="col-span-2"><label className={labelClass}>{t('cryptoWalletForm.addressRequired')}</label><input className={`${inputClass} font-mono`} value={form.address} onChange={e => update('address', e.target.value)} /></div>
            <div><label className={labelClass}>{t('cryptoWalletForm.network')}</label>
              <select className={inputClass} value={form.network} onChange={e => update('network', e.target.value)}>
                <option value="">{t('common.selectPlaceholder')}</option>
                {networkOptions.map(o => <option key={o.value} value={o.value}>{optionLabel(t, 'crypto_wallet_network', o.value, o.label)}</option>)}
              </select>
            </div>
            <div><label className={labelClass}>{t('cryptoWalletForm.status')}</label>
              <select className={inputClass} value={form.status} onChange={e => update('status', e.target.value)}>
                <option value="active">{t('cryptoWalletForm.statusActive')}</option>
                <option value="archived">{t('cryptoWalletForm.statusArchived')}</option>
              </select>
            </div>
            <div className="col-span-2"><label className={labelClass}>{t('cryptoWalletForm.label')}</label><input className={inputClass} value={form.label} onChange={e => update('label', e.target.value)} /></div>
            <div className="col-span-2"><label className={labelClass}>{t('cryptoWalletForm.externalReferenceUrl')}</label><input className={inputClass} value={form.external_reference_url} onChange={e => update('external_reference_url', e.target.value)} placeholder={t('cryptoWalletForm.externalReferenceUrlPlaceholder')} /></div>
          </div>

          <div>
            <label className={labelClass}>{t('cryptoWalletForm.tags')}</label>
            <div className="flex flex-wrap gap-2 mb-2">
              {tagOptions.map(o => (
                <button type="button" key={o.value} onClick={() => toggleTag(o.value)}
                  className={`text-xs px-2.5 py-1 rounded-full border ${form.tags.includes(o.value) ? 'bg-accent-primary text-white border-accent-primary' : 'bg-gray-50 dark:bg-gray-700 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600'}`}>
                  {optionLabel(t, 'crypto_wallet_tag', o.value, o.label)}
                </button>
              ))}
              {form.tags.filter(tg => !tagOptions.some(o => o.value === tg)).map(tg => (
                <button type="button" key={tg} onClick={() => toggleTag(tg)} className="text-xs px-2.5 py-1 rounded-full border bg-accent-primary text-white border-accent-primary">
                  {tg}
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              <input className={inputClass} value={newTag} onChange={e => setNewTag(e.target.value)}
                placeholder={t('cryptoWalletForm.addTagPlaceholder')}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addCustomTag(); } }} />
              <button type="button" onClick={addCustomTag} className="px-3 py-2 rounded-lg bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 text-sm">{t('common.add')}</button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div><label className={labelClass}>{t('assetForm.case')}</label>
              <select className={inputClass} value={form.case_id} onChange={e => update('case_id', e.target.value)}>
                <option value="">{t('common.nonePlaceholder')}</option>
                {cases.map(c => <option key={c.id} value={c.id}>{c.case_name}</option>)}
              </select>
            </div>
            <div className="col-span-2"><label className={labelClass}>{t('cryptoWalletForm.notes')}</label><textarea className={inputClass} rows={2} value={form.notes} onChange={e => update('notes', e.target.value)} /></div>
          </div>

          <div className="flex justify-end space-x-3 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200">{t('common.cancel')}</button>
            <button type="submit" disabled={saving} className="px-4 py-2 rounded-lg bg-blue-600 text-white disabled:opacity-60">{saving ? t('common.saving') : t('common.save')}</button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddEditCryptoWalletForm;
