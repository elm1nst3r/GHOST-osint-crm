// File: frontend/src/components/AddEditTransactionForm.js
import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { X, Receipt } from 'lucide-react';
import { transactionsAPI, modelOptionsAPI, casesAPI } from '../utils/api';
import { useData } from '../contexts/DataContext';

const inputClass = 'w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:border-blue-500 dark:bg-gray-700 dark:text-white';
const labelClass = 'block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1';

const personLabel = (p) => `${p.first_name || ''} ${p.last_name || ''}`.trim();

// Hoisted to module scope so the external-name input keeps focus across re-renders.
// It's a real component (not a plain object), so it can call useTranslation itself.
const PartyPicker = ({ title, kind, setKind, id, setId, external, setExternal, people, businesses }) => {
  const { t } = useTranslation();
  const entities = kind === 'person' ? people : kind === 'business' ? businesses : [];
  return (
    <div className="p-3 rounded-lg bg-gray-50 dark:bg-gray-900/40 border border-gray-200 dark:border-gray-700 space-y-2">
      <label className={labelClass}>{title}</label>
      <select className={inputClass} value={kind} onChange={e => { setKind(e.target.value); setId(''); setExternal(''); }}>
        <option value="none">{t('common.nonePlaceholder')}</option>
        <option value="person">{t('transactionForm.partyPicker.person')}</option>
        <option value="business">{t('transactionForm.partyPicker.business')}</option>
        <option value="external">{t('transactionForm.partyPicker.external')}</option>
      </select>
      {(kind === 'person' || kind === 'business') && (
        <select className={inputClass} value={id} onChange={e => setId(e.target.value)}>
          <option value="">{t('common.selectPlaceholder')}</option>
          {entities.map(ent => <option key={ent.id} value={ent.id}>{kind === 'person' ? personLabel(ent) : ent.name}</option>)}
        </select>
      )}
      {kind === 'external' && <input className={inputClass} value={external} onChange={e => setExternal(e.target.value)} placeholder={t('transactionForm.partyPicker.externalNamePlaceholder')} />}
    </div>
  );
};

const AddEditTransactionForm = ({ transaction, onClose }) => {
  const { t } = useTranslation();
  const { people, businesses, assets, properties, fetchTransactions } = useData();
  const isEdit = !!transaction;
  const [typeOptions, setTypeOptions] = useState([]);
  const [itemCategoryOptions, setItemCategoryOptions] = useState([]);
  const [cases, setCases] = useState([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const initialPartyKind = (txn, dir) => {
    if (!txn) return 'none';
    if (txn[`${dir}_person_id`]) return 'person';
    if (txn[`${dir}_business_id`]) return 'business';
    if (txn[`${dir}_external`]) return 'external';
    return 'none';
  };
  const initialSubjectKind = (txn) => {
    if (!txn) return 'item';
    if (txn.subject_asset_id) return 'asset';
    if (txn.subject_business_id) return 'business';
    if (txn.subject_property_id) return 'property';
    return 'item';
  };
  const initialLocationKind = (txn) => {
    if (!txn) return 'none';
    if (txn.location_business_id) return 'business';
    if (txn.location_property_id) return 'property';
    if (txn.location_name || txn.city || txn.address) return 'place';
    return 'none';
  };

  const [transaction_type, setType] = useState(transaction?.transaction_type || '');
  const [fromKind, setFromKind] = useState(initialPartyKind(transaction, 'from'));
  const [fromId, setFromId] = useState(transaction?.from_person_id || transaction?.from_business_id || '');
  const [fromExternal, setFromExternal] = useState(transaction?.from_external || '');
  const [toKind, setToKind] = useState(initialPartyKind(transaction, 'to'));
  const [toId, setToId] = useState(transaction?.to_person_id || transaction?.to_business_id || '');
  const [toExternal, setToExternal] = useState(transaction?.to_external || '');

  const [subjectKind, setSubjectKind] = useState(initialSubjectKind(transaction));
  const [itemLabel, setItemLabel] = useState(transaction?.item_label || '');
  const [itemCategory, setItemCategory] = useState(transaction?.item_category || '');
  const [subjectId, setSubjectId] = useState(transaction?.subject_asset_id || transaction?.subject_business_id || transaction?.subject_property_id || '');

  const [value, setValue] = useState(transaction?.value || '');
  const [currency, setCurrency] = useState(transaction?.currency || '');
  const [occurredOn, setOccurredOn] = useState(transaction?.occurred_on ? String(transaction.occurred_on).slice(0, 10) : '');

  const [locationKind, setLocationKind] = useState(initialLocationKind(transaction));
  const [locationId, setLocationId] = useState(transaction?.location_business_id || transaction?.location_property_id || '');
  const [place, setPlace] = useState({
    location_name: transaction?.location_name || '', address: transaction?.address || '',
    city: transaction?.city || '', state: transaction?.state || '', country: transaction?.country || '', postal_code: transaction?.postal_code || '',
  });

  const [caseId, setCaseId] = useState(transaction?.case_id || '');
  const [notes, setNotes] = useState(transaction?.notes || '');

  useEffect(() => {
    modelOptionsAPI.getAll().then(d => {
      setTypeOptions(d.filter(o => o.model_type === 'transaction_type' && o.is_active));
      setItemCategoryOptions(d.filter(o => o.model_type === 'transaction_item_category' && o.is_active));
    }).catch(() => {});
    casesAPI.getAll().then(setCases).catch(() => {});
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!transaction_type) { setError(t('transactionForm.errorTypeRequired')); return; }
    if (fromKind === 'none' && toKind === 'none') { setError(t('transactionForm.errorPartyRequired')); return; }

    const payload = {
      transaction_type,
      from_person_id: fromKind === 'person' ? fromId || null : null,
      from_business_id: fromKind === 'business' ? fromId || null : null,
      from_external: fromKind === 'external' ? fromExternal || null : null,
      to_person_id: toKind === 'person' ? toId || null : null,
      to_business_id: toKind === 'business' ? toId || null : null,
      to_external: toKind === 'external' ? toExternal || null : null,
      subject_asset_id: subjectKind === 'asset' ? subjectId || null : null,
      subject_business_id: subjectKind === 'business' ? subjectId || null : null,
      subject_property_id: subjectKind === 'property' ? subjectId || null : null,
      item_label: subjectKind === 'item' ? itemLabel || null : null,
      item_category: subjectKind === 'item' ? itemCategory || null : null,
      value: value === '' ? null : parseFloat(value),
      currency: currency || null,
      occurred_on: occurredOn || null,
      location_business_id: locationKind === 'business' ? locationId || null : null,
      location_property_id: locationKind === 'property' ? locationId || null : null,
      location_name: locationKind === 'place' ? place.location_name || null : null,
      address: locationKind === 'place' ? place.address || null : null,
      city: locationKind === 'place' ? place.city || null : null,
      state: locationKind === 'place' ? place.state || null : null,
      country: locationKind === 'place' ? place.country || null : null,
      postal_code: locationKind === 'place' ? place.postal_code || null : null,
      case_id: caseId || null,
      notes: notes || null,
    };
    setSaving(true);
    setError('');
    try {
      if (isEdit) await transactionsAPI.update(transaction.id, payload);
      else await transactionsAPI.create(payload);
      await fetchTransactions(0);
      onClose();
    } catch (err) {
      setError(err.message || t('transactionForm.errorSaveTransaction'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl border border-gray-200 dark:border-gray-700 w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        <div className="p-5 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center"><Receipt className="w-5 h-5 mr-2 text-blue-600 dark:text-blue-400" />{isEdit ? t('transactionForm.editTitle') : t('transactionForm.addTitle')}</h2>
          <button onClick={onClose} className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700"><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 overflow-y-auto space-y-4">
          {error && <div className="p-3 rounded-lg bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 text-sm">{error}</div>}

          <div className="grid grid-cols-2 gap-4">
            <div><label className={labelClass}>{t('transactionForm.typeRequired')}</label>
              <select className={inputClass} value={transaction_type} onChange={e => setType(e.target.value)}>
                <option value="">{t('common.selectPlaceholder')}</option>
                {typeOptions.map(o => <option key={o.id} value={o.option_value}>{o.option_label}</option>)}
              </select>
            </div>
            <div><label className={labelClass}>{t('transactionForm.date')}</label><input type="date" className={inputClass} value={occurredOn} onChange={e => setOccurredOn(e.target.value)} /></div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <PartyPicker title={t('transactionForm.fromTitle')} kind={fromKind} setKind={setFromKind} id={fromId} setId={setFromId} external={fromExternal} setExternal={setFromExternal} people={people} businesses={businesses} />
            <PartyPicker title={t('transactionForm.toTitle')} kind={toKind} setKind={setToKind} id={toId} setId={setToId} external={toExternal} setExternal={setToExternal} people={people} businesses={businesses} />
          </div>

          {/* Subject picker */}
          <div className="p-3 rounded-lg bg-gray-50 dark:bg-gray-900/40 border border-gray-200 dark:border-gray-700 space-y-2">
            <label className={labelClass}>{t('transactionForm.subject')}</label>
            <select className={inputClass} value={subjectKind} onChange={e => { setSubjectKind(e.target.value); setSubjectId(''); }}>
              <option value="item">{t('transactionForm.subjectItem')}</option>
              <option value="asset">{t('transactionForm.subjectAsset')}</option>
              <option value="business">{t('transactionForm.subjectBusiness')}</option>
              <option value="property">{t('transactionForm.subjectProperty')}</option>
            </select>
            {subjectKind === 'item' && (
              <div className="grid grid-cols-2 gap-3">
                <input className={inputClass} value={itemLabel} onChange={e => setItemLabel(e.target.value)} placeholder={t('transactionForm.itemLabelPlaceholder')} />
                <select className={inputClass} value={itemCategory} onChange={e => setItemCategory(e.target.value)}>
                  <option value="">{t('transactionForm.categoryPlaceholder')}</option>
                  {itemCategoryOptions.map(o => <option key={o.id} value={o.option_value}>{o.option_label}</option>)}
                </select>
              </div>
            )}
            {subjectKind === 'asset' && (
              <select className={inputClass} value={subjectId} onChange={e => setSubjectId(e.target.value)}>
                <option value="">{t('transactionForm.selectAssetPlaceholder')}</option>
                {assets.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            )}
            {subjectKind === 'business' && (
              <select className={inputClass} value={subjectId} onChange={e => setSubjectId(e.target.value)}>
                <option value="">{t('transactionForm.selectBusinessPlaceholder')}</option>
                {businesses.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            )}
            {subjectKind === 'property' && (
              <select className={inputClass} value={subjectId} onChange={e => setSubjectId(e.target.value)}>
                <option value="">{t('transactionForm.selectPropertyPlaceholder')}</option>
                {properties.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div><label className={labelClass}>{t('transactionForm.value')}</label><input className={inputClass} value={value} onChange={e => setValue(e.target.value)} placeholder={t('transactionForm.valuePlaceholder')} /></div>
            <div><label className={labelClass}>{t('transactionForm.currency')}</label><input className={inputClass} value={currency} onChange={e => setCurrency(e.target.value)} placeholder={t('transactionForm.currencyPlaceholder')} /></div>
          </div>

          {/* Location picker */}
          <div className="p-3 rounded-lg bg-gray-50 dark:bg-gray-900/40 border border-gray-200 dark:border-gray-700 space-y-2">
            <label className={labelClass}>{t('transactionForm.whereItHappened')}</label>
            <select className={inputClass} value={locationKind} onChange={e => { setLocationKind(e.target.value); setLocationId(''); }}>
              <option value="none">{t('common.nonePlaceholder')}</option>
              <option value="business">{t('transactionForm.locationBusinessVenue')}</option>
              <option value="property">{t('transactionForm.locationProperty')}</option>
              <option value="place">{t('transactionForm.locationPlaceFreeText')}</option>
            </select>
            {locationKind === 'business' && (
              <select className={inputClass} value={locationId} onChange={e => setLocationId(e.target.value)}>
                <option value="">{t('transactionForm.selectBusinessPlaceholder')}</option>
                {businesses.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            )}
            {locationKind === 'property' && (
              <select className={inputClass} value={locationId} onChange={e => setLocationId(e.target.value)}>
                <option value="">{t('transactionForm.selectPropertyPlaceholder')}</option>
                {properties.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            )}
            {locationKind === 'place' && (
              <div className="grid grid-cols-2 gap-3">
                <input className={inputClass} value={place.location_name} onChange={e => setPlace({ ...place, location_name: e.target.value })} placeholder={t('transactionForm.placeNamePlaceholder')} />
                <input className={inputClass} value={place.address} onChange={e => setPlace({ ...place, address: e.target.value })} placeholder={t('transactionForm.addressPlaceholder')} />
                <input className={inputClass} value={place.city} onChange={e => setPlace({ ...place, city: e.target.value })} placeholder={t('transactionForm.cityPlaceholder')} />
                <input className={inputClass} value={place.country} onChange={e => setPlace({ ...place, country: e.target.value })} placeholder={t('transactionForm.countryPlaceholder')} />
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div><label className={labelClass}>{t('transactionForm.case')}</label>
              <select className={inputClass} value={caseId} onChange={e => setCaseId(e.target.value)}>
                <option value="">{t('common.nonePlaceholder')}</option>
                {cases.map(c => <option key={c.id} value={c.id}>{c.case_name}</option>)}
              </select>
            </div>
            <div className="col-span-2"><label className={labelClass}>{t('transactionForm.notes')}</label><textarea className={inputClass} rows={2} value={notes} onChange={e => setNotes(e.target.value)} /></div>
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

export default AddEditTransactionForm;
