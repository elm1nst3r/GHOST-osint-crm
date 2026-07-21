// File: frontend/src/components/AddEditPropertyForm.js
import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { X, Landmark } from 'lucide-react';
import { propertiesAPI, modelOptionsAPI, casesAPI } from '../utils/api';
import { useData } from '../contexts/DataContext';

const inputClass = 'w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:border-blue-500 dark:bg-gray-700 dark:text-white';
const labelClass = 'block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1';

const AddEditPropertyForm = ({ property, onClose }) => {
  const { t } = useTranslation();
  const { people, fetchProperties } = useData();
  const isEdit = !!property;
  const [typeOptions, setTypeOptions] = useState([]);
  const [cases, setCases] = useState([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    name: property?.name || '',
    property_type: property?.property_type || '',
    description: property?.description || '',
    address: property?.address || '',
    city: property?.city || '',
    state: property?.state || '',
    country: property?.country || '',
    postal_code: property?.postal_code || '',
    latitude: property?.latitude || '',
    longitude: property?.longitude || '',
    owner_person_id: property?.owner_person_id || '',
    case_id: property?.case_id || '',
    notes: property?.notes || '',
  });

  useEffect(() => {
    modelOptionsAPI.getAll().then(d => setTypeOptions(d.filter(o => o.model_type === 'property_type' && o.is_active))).catch(() => {});
    casesAPI.getAll().then(setCases).catch(() => {});
  }, []);

  const update = (k, v) => setForm(prev => ({ ...prev, [k]: v }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) { setError(t('propertyForm.errorNameRequired')); return; }
    setSaving(true);
    setError('');
    const payload = {
      ...form,
      latitude: form.latitude === '' ? null : parseFloat(form.latitude),
      longitude: form.longitude === '' ? null : parseFloat(form.longitude),
      owner_person_id: form.owner_person_id || null,
      case_id: form.case_id || null,
    };
    try {
      if (isEdit) await propertiesAPI.update(property.id, payload);
      else await propertiesAPI.create(payload);
      await fetchProperties(0);
      onClose();
    } catch (err) {
      setError(err.message || t('propertyForm.errorSaveProperty'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl border border-gray-200 dark:border-gray-700 w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <div className="p-5 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center">
            <Landmark className="w-5 h-5 mr-2 text-emerald-600 dark:text-emerald-400" />
            {isEdit ? t('propertyForm.editTitle') : t('propertyForm.addTitle')}
          </h2>
          <button onClick={onClose} className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700"><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 overflow-y-auto space-y-4">
          {error && <div className="p-3 rounded-lg bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 text-sm">{error}</div>}
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className={labelClass}>{t('propertyForm.nameRequired')}</label>
              <input className={inputClass} value={form.name} onChange={e => update('name', e.target.value)} />
            </div>
            <div>
              <label className={labelClass}>{t('propertyForm.propertyType')}</label>
              <select className={inputClass} value={form.property_type} onChange={e => update('property_type', e.target.value)}>
                <option value="">{t('common.selectPlaceholder')}</option>
                {typeOptions.map(o => <option key={o.id} value={o.option_value}>{o.option_label}</option>)}
              </select>
            </div>
            <div>
              <label className={labelClass}>{t('propertyForm.currentKnownOwner')}</label>
              <select className={inputClass} value={form.owner_person_id} onChange={e => update('owner_person_id', e.target.value)}>
                <option value="">{t('common.nonePlaceholder')}</option>
                {people.map(p => <option key={p.id} value={p.id}>{`${p.first_name || ''} ${p.last_name || ''}`.trim()}</option>)}
              </select>
            </div>
            <div className="col-span-2">
              <label className={labelClass}>{t('propertyForm.address')}</label>
              <input className={inputClass} value={form.address} onChange={e => update('address', e.target.value)} />
            </div>
            <div><label className={labelClass}>{t('propertyForm.city')}</label><input className={inputClass} value={form.city} onChange={e => update('city', e.target.value)} /></div>
            <div><label className={labelClass}>{t('propertyForm.state')}</label><input className={inputClass} value={form.state} onChange={e => update('state', e.target.value)} /></div>
            <div><label className={labelClass}>{t('propertyForm.country')}</label><input className={inputClass} value={form.country} onChange={e => update('country', e.target.value)} /></div>
            <div><label className={labelClass}>{t('propertyForm.postalCode')}</label><input className={inputClass} value={form.postal_code} onChange={e => update('postal_code', e.target.value)} /></div>
            <div><label className={labelClass}>{t('propertyForm.latitudeOptional')}</label><input className={inputClass} value={form.latitude} onChange={e => update('latitude', e.target.value)} placeholder={t('common.autoGeocodedHint')} /></div>
            <div><label className={labelClass}>{t('propertyForm.longitudeOptional')}</label><input className={inputClass} value={form.longitude} onChange={e => update('longitude', e.target.value)} /></div>
            <div className="col-span-2">
              <label className={labelClass}>{t('propertyForm.case')}</label>
              <select className={inputClass} value={form.case_id} onChange={e => update('case_id', e.target.value)}>
                <option value="">{t('common.nonePlaceholder')}</option>
                {cases.map(c => <option key={c.id} value={c.id}>{c.case_name}</option>)}
              </select>
            </div>
            <div className="col-span-2">
              <label className={labelClass}>{t('propertyForm.description')}</label>
              <textarea className={inputClass} rows={2} value={form.description} onChange={e => update('description', e.target.value)} />
            </div>
            <div className="col-span-2">
              <label className={labelClass}>{t('propertyForm.notes')}</label>
              <textarea className={inputClass} rows={2} value={form.notes} onChange={e => update('notes', e.target.value)} />
            </div>
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

export default AddEditPropertyForm;
