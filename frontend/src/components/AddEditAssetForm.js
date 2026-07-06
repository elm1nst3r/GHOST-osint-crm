// File: frontend/src/components/AddEditAssetForm.js
import React, { useState, useEffect } from 'react';
import { X, Package } from 'lucide-react';
import { assetsAPI, modelOptionsAPI, casesAPI, transactionsAPI } from '../utils/api';
import { useData } from '../contexts/DataContext';

const inputClass = 'w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:border-blue-500 dark:bg-gray-700 dark:text-white';
const labelClass = 'block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1';

const LOCATION_MODES = [
  { value: 'with_holder', label: 'With current holder (moves automatically)' },
  { value: 'fixed_known', label: 'Pinned to a person\'s known location' },
  { value: 'fixed_custom', label: 'Fixed custom address' },
  { value: 'unknown', label: 'Unknown' },
];

const AddEditAssetForm = ({ asset, onClose }) => {
  const { people, businesses, fetchAssets } = useData();
  const isEdit = !!asset;
  const [categoryOptions, setCategoryOptions] = useState([]);
  const [statusOptions, setStatusOptions] = useState([]);
  const [cases, setCases] = useState([]);
  const [personLocations, setPersonLocations] = useState([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const [form, setForm] = useState({
    name: asset?.name || '',
    category: asset?.category || '',
    identifier: asset?.identifier || '',
    description: asset?.description || '',
    estimated_value: asset?.estimated_value || '',
    currency: asset?.currency || '',
    status: asset?.status || 'active',
    notes: asset?.notes || '',
    case_id: asset?.case_id || '',
    location_mode: asset?.location_mode || 'with_holder',
    location_person_id: asset?.location_person_id || '',
    location_ref: asset?.location_ref || '',
    address: asset?.address || '',
    city: asset?.city || '',
    state: asset?.state || '',
    country: asset?.country || '',
    postal_code: asset?.postal_code || '',
    latitude: asset?.latitude || '',
    longitude: asset?.longitude || '',
  });

  // Create: seeds an acquisition transaction. Edit: records a transfer transaction.
  const [holderKind, setHolderKind] = useState('none');
  const [holderId, setHolderId] = useState('');
  const [holderExternal, setHolderExternal] = useState('');
  const [holderDate, setHolderDate] = useState('');

  useEffect(() => {
    modelOptionsAPI.getAll().then(d => {
      setCategoryOptions(d.filter(o => o.model_type === 'asset_category' && o.is_active));
      setStatusOptions(d.filter(o => o.model_type === 'asset_status' && o.is_active));
    }).catch(() => {});
    casesAPI.getAll().then(setCases).catch(() => {});
  }, []);

  // when fixed_known person changes, load their locations from the people slice
  useEffect(() => {
    if (form.location_mode === 'fixed_known' && form.location_person_id) {
      const p = people.find(pp => String(pp.id) === String(form.location_person_id));
      setPersonLocations(Array.isArray(p?.locations) ? p.locations : []);
    } else {
      setPersonLocations([]);
    }
  }, [form.location_mode, form.location_person_id, people]);

  const update = (k, v) => setForm(prev => ({ ...prev, [k]: v }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) { setError('Name is required'); return; }
    if (form.location_mode === 'fixed_known' && !form.location_person_id) { setError('Pick a person for the pinned location'); return; }
    setSaving(true);
    setError('');
    const payload = {
      ...form,
      estimated_value: form.estimated_value === '' ? null : parseFloat(form.estimated_value),
      latitude: form.latitude === '' ? null : parseFloat(form.latitude),
      longitude: form.longitude === '' ? null : parseFloat(form.longitude),
      location_person_id: form.location_person_id || null,
      location_ref: form.location_ref === '' ? null : form.location_ref,
      case_id: form.case_id || null,
    };
    if (!isEdit && holderKind !== 'none') {
      payload.initial_holder = {
        person_id: holderKind === 'person' ? holderId || null : null,
        business_id: holderKind === 'business' ? holderId || null : null,
        external: holderKind === 'external' ? holderExternal || null : null,
        occurred_on: holderDate || null,
      };
    }
    try {
      if (isEdit) {
        await assetsAPI.update(asset.id, payload);
        if (holderKind !== 'none') {
          await transactionsAPI.create({
            transaction_type: 'transfer',
            subject_asset_id: asset.id,
            to_person_id: holderKind === 'person' ? holderId || null : null,
            to_business_id: holderKind === 'business' ? holderId || null : null,
            to_external: holderKind === 'external' ? holderExternal || null : null,
            occurred_on: holderDate || new Date().toISOString().slice(0, 10),
            case_id: form.case_id || null,
          });
        }
      } else {
        await assetsAPI.create(payload);
      }
      await fetchAssets(0);
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to save asset');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl border border-gray-200 dark:border-gray-700 w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <div className="p-5 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center">
            <Package className="w-5 h-5 mr-2 text-orange-600 dark:text-orange-400" />{isEdit ? 'Edit Asset' : 'Add Asset'}
          </h2>
          <button onClick={onClose} className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700"><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 overflow-y-auto space-y-4">
          {error && <div className="p-3 rounded-lg bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 text-sm">{error}</div>}
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2"><label className={labelClass}>Name *</label><input className={inputClass} value={form.name} onChange={e => update('name', e.target.value)} /></div>
            <div><label className={labelClass}>Category</label>
              <select className={inputClass} value={form.category} onChange={e => update('category', e.target.value)}>
                <option value="">— Select —</option>
                {categoryOptions.map(o => <option key={o.id} value={o.option_value}>{o.option_label}</option>)}
              </select>
            </div>
            <div><label className={labelClass}>Status</label>
              <select className={inputClass} value={form.status} onChange={e => update('status', e.target.value)}>
                {statusOptions.map(o => <option key={o.id} value={o.option_value}>{o.option_label}</option>)}
              </select>
            </div>
            <div><label className={labelClass}>Identifier (serial / VIN / IMEI)</label><input className={inputClass} value={form.identifier} onChange={e => update('identifier', e.target.value)} /></div>
            <div className="grid grid-cols-2 gap-2">
              <div><label className={labelClass}>Est. Value</label><input className={inputClass} value={form.estimated_value} onChange={e => update('estimated_value', e.target.value)} /></div>
              <div><label className={labelClass}>Currency</label><input className={inputClass} value={form.currency} onChange={e => update('currency', e.target.value)} placeholder="USD" /></div>
            </div>
            <div className="col-span-2"><label className={labelClass}>Description</label><textarea className={inputClass} rows={2} value={form.description} onChange={e => update('description', e.target.value)} /></div>
          </div>

          {/* Location model */}
          <div className="p-3 rounded-lg bg-gray-50 dark:bg-gray-900/40 border border-gray-200 dark:border-gray-700 space-y-3">
            <div><label className={labelClass}>Location Mode</label>
              <select className={inputClass} value={form.location_mode} onChange={e => update('location_mode', e.target.value)}>
                {LOCATION_MODES.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
              </select>
            </div>
            {form.location_mode === 'fixed_known' && (
              <div className="grid grid-cols-2 gap-3">
                <div><label className={labelClass}>Person</label>
                  <select className={inputClass} value={form.location_person_id} onChange={e => { update('location_person_id', e.target.value); update('location_ref', ''); }}>
                    <option value="">— Select —</option>
                    {people.map(p => <option key={p.id} value={p.id}>{`${p.first_name || ''} ${p.last_name || ''}`.trim()}</option>)}
                  </select>
                </div>
                <div><label className={labelClass}>Location entry</label>
                  <select className={inputClass} value={form.location_ref} onChange={e => update('location_ref', e.target.value)}>
                    <option value="">— Select —</option>
                    {personLocations.map((loc, idx) => <option key={idx} value={idx}>{(loc.type || loc.location_type || 'location') + ': ' + (loc.location_name || loc.address || [loc.city, loc.country].filter(Boolean).join(', ') || `#${idx}`)}</option>)}
                  </select>
                </div>
              </div>
            )}
            {form.location_mode === 'fixed_custom' && (
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2"><label className={labelClass}>Address</label><input className={inputClass} value={form.address} onChange={e => update('address', e.target.value)} /></div>
                <div><label className={labelClass}>City</label><input className={inputClass} value={form.city} onChange={e => update('city', e.target.value)} /></div>
                <div><label className={labelClass}>Country</label><input className={inputClass} value={form.country} onChange={e => update('country', e.target.value)} /></div>
                <div><label className={labelClass}>Latitude</label><input className={inputClass} value={form.latitude} onChange={e => update('latitude', e.target.value)} placeholder="auto-geocoded if blank" /></div>
                <div><label className={labelClass}>Longitude</label><input className={inputClass} value={form.longitude} onChange={e => update('longitude', e.target.value)} /></div>
              </div>
            )}
          </div>

          {/* Holder: acquisition on create, transfer on edit */}
          <div className="p-3 rounded-lg bg-gray-50 dark:bg-gray-900/40 border border-gray-200 dark:border-gray-700 space-y-3">
              <label className={labelClass}>
                {isEdit
                  ? 'Transfer to New Holder (records a transfer transaction)'
                  : 'Initial Holder (seeds an acquisition transaction)'}
              </label>
              <div className="grid grid-cols-2 gap-3">
                <select className={inputClass} value={holderKind} onChange={e => { setHolderKind(e.target.value); setHolderId(''); }}>
                  <option value="none">— None —</option>
                  <option value="person">Person</option>
                  <option value="business">Business</option>
                  <option value="external">External (free text)</option>
                </select>
                {holderKind === 'person' && (
                  <select className={inputClass} value={holderId} onChange={e => setHolderId(e.target.value)}>
                    <option value="">— Select —</option>
                    {people.map(p => <option key={p.id} value={p.id}>{`${p.first_name || ''} ${p.last_name || ''}`.trim()}</option>)}
                  </select>
                )}
                {holderKind === 'business' && (
                  <select className={inputClass} value={holderId} onChange={e => setHolderId(e.target.value)}>
                    <option value="">— Select —</option>
                    {businesses.map(bz => <option key={bz.id} value={bz.id}>{bz.name}</option>)}
                  </select>
                )}
                {holderKind === 'external' && <input className={inputClass} value={holderExternal} onChange={e => setHolderExternal(e.target.value)} placeholder="External holder name" />}
              </div>
              {holderKind !== 'none' && <div><label className={labelClass}>{isEdit ? 'Transferred on' : 'Acquired on'}</label><input type="date" className={inputClass} value={holderDate} onChange={e => setHolderDate(e.target.value)} /></div>}
            </div>

          <div className="grid grid-cols-2 gap-4">
            <div><label className={labelClass}>Case</label>
              <select className={inputClass} value={form.case_id} onChange={e => update('case_id', e.target.value)}>
                <option value="">— None —</option>
                {cases.map(c => <option key={c.id} value={c.id}>{c.case_name}</option>)}
              </select>
            </div>
            <div className="col-span-2"><label className={labelClass}>Notes</label><textarea className={inputClass} rows={2} value={form.notes} onChange={e => update('notes', e.target.value)} /></div>
          </div>

          <div className="flex justify-end space-x-3 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200">Cancel</button>
            <button type="submit" disabled={saving} className="px-4 py-2 rounded-lg bg-blue-600 text-white disabled:opacity-60">{saving ? 'Saving…' : 'Save'}</button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddEditAssetForm;
