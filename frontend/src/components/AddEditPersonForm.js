// File: frontend/src/components/AddEditPersonForm.js
import React, { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { X, AlertCircle } from 'lucide-react';
import { peopleAPI, modelOptionsAPI, casesAPI } from '../utils/api';
import { PERSON_CATEGORIES, PERSON_STATUSES, OSINT_DATA_TYPES, CONNECTION_TYPES, LOCATION_TYPES, CRM_STATUSES, updateDynamicConstants } from '../utils/constants';
import { translateOptions } from '../utils/optionLabels';
import { mergeOptionMeta } from '../utils/useModelOptions';
import { personNameOrder } from '../utils/personName';
import { useData } from '../contexts/DataContext';
import { useUI } from '../contexts/UIContext';
import LocationsSection from './person-form/LocationsSection';
import OsintSection from './person-form/OsintSection';
import ConnectionsSection from './person-form/ConnectionsSection';
import CustomFieldsSection from './person-form/CustomFieldsSection';

const EMPTY_FORM = {
  firstName: '', lastName: '', patronymic: '', aliases: [], dateOfBirth: '', category: '',
  status: '', crmStatus: '', caseName: '', profilePictureUrl: '', notes: '',
  osintData: [], attachments: [], connections: [], locations: [], custom_fields: {},
};

const AddEditPersonForm = () => {
  const { t, i18n } = useTranslation();
  const { people, customFields, fetchPeople } = useData();
  const { editingPerson, setEditingPerson, setShowAddPersonForm } = useUI();
  const person = editingPerson;

  const handleClose = () => { setEditingPerson(null); setShowAddPersonForm(false); };

  const [formData, setFormData] = useState(EMPTY_FORM);
  const [newAlias, setNewAlias] = useState('');
  const [connectionTypes, setConnectionTypes] = useState(CONNECTION_TYPES);
  const [locationTypes, setLocationTypes] = useState(LOCATION_TYPES);
  const [crmStatuses, setCrmStatuses] = useState(CRM_STATUSES);
  const [osintDataTypes, setOsintDataTypes] = useState(OSINT_DATA_TYPES);
  // Categories and statuses are configurable in Settings → Data Model too;
  // rendering them from the constants meant admin-added options never showed
  // up here at all (issue #67).
  const [categories, setCategories] = useState(PERSON_CATEGORIES);
  const [statuses, setStatuses] = useState(PERSON_STATUSES);
  const personCategories = useMemo(() => translateOptions(t, 'person_category', categories), [t, categories]);
  const personStatuses = useMemo(() => translateOptions(t, 'person_status', statuses), [t, statuses]);
  const tCrmStatuses = useMemo(() => translateOptions(t, 'crm_status', crmStatuses), [t, crmStatuses]);
  const tLocationTypes = useMemo(() => translateOptions(t, 'location_type', locationTypes), [t, locationTypes]);
  const tOsintDataTypes = useMemo(() => translateOptions(t, 'osint_data_type', osintDataTypes), [t, osintDataTypes]);
  const tConnectionTypes = useMemo(() => translateOptions(t, 'connection_type', connectionTypes), [t, connectionTypes]);
  const [existingCases, setExistingCases] = useState([]);
  const [caseExists, setCaseExists] = useState(false);
  const [optionsLoadError, setOptionsLoadError] = useState(false);

  useEffect(() => {
    const loadModelOptions = async () => {
      try {
        const options = await modelOptionsAPI.getAll();
        updateDynamicConstants(options);
        const pick = (type) => options
          .filter(o => o.model_type === type && o.is_active)
          .sort((a, b) => a.display_order - b.display_order)
          .map(o => ({ value: o.option_value, label: o.option_label }));
        const conn = pick('connection_type'); if (conn.length) setConnectionTypes(conn);
        const loc  = pick('location_type');  if (loc.length)  setLocationTypes(loc);
        const crm  = pick('crm_status');     if (crm.length)  setCrmStatuses(crm);
        const osint = pick('osint_data_type'); if (osint.length) setOsintDataTypes(osint);
        const cat = pick('person_category'); if (cat.length) setCategories(mergeOptionMeta(cat, PERSON_CATEGORIES));
        const stat = pick('person_status');  if (stat.length) setStatuses(mergeOptionMeta(stat, PERSON_STATUSES));
      } catch { setOptionsLoadError(true); }
    };
    const loadCases = async () => {
      try { setExistingCases(await casesAPI.getAll()); }
      catch { setOptionsLoadError(true); }
    };
    loadModelOptions();
    loadCases();
  }, []);

  useEffect(() => {
    if (person) {
      setFormData({
        firstName: person.first_name || '',
        lastName: person.last_name || '',
        patronymic: person.patronymic || '',
        aliases: person.aliases || [],
        dateOfBirth: person.date_of_birth ? person.date_of_birth.split('T')[0] : '',
        category: person.category || '',
        status: person.status || '',
        crmStatus: person.crm_status || '',
        caseName: person.case_name || '',
        profilePictureUrl: person.profile_picture_url || '',
        notes: person.notes || '',
        osintData: person.osint_data || [],
        attachments: person.attachments || [],
        connections: person.connections || [],
        locations: person.locations || [],
        custom_fields: person.custom_fields || {},
      });
    }
  }, [person]);

  useEffect(() => {
    if (formData.caseName) {
      setCaseExists(existingCases.some(c => c.case_name.toLowerCase() === formData.caseName.toLowerCase()));
    } else {
      setCaseExists(false);
    }
  }, [formData.caseName, existingCases]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (formData.caseName && !caseExists) {
      try {
        await casesAPI.create({
          case_name: formData.caseName,
          description: `Auto-created from person: ${formData.firstName} ${formData.lastName}`,
          status: 'active',
        });
      } catch (error) { console.error('Error creating case:', error); }
    }
    try {
      if (person) await peopleAPI.update(person.id, { ...formData, dateOfBirth: formData.dateOfBirth || null });
      else        await peopleAPI.create({ ...formData, dateOfBirth: formData.dateOfBirth || null });
      handleClose();
      fetchPeople();
    } catch (error) {
      console.error('Error saving person:', error);
      alert(t('personForm.errorSavePerson', { message: error.message }));
    }
  };

  const set = (key, val) => setFormData(f => ({ ...f, [key]: val }));

  const addAlias = () => {
    if (newAlias.trim()) { set('aliases', [...formData.aliases, newAlias.trim()]); setNewAlias(''); }
  };

  const getSimilarCases = () => {
    if (!formData.caseName || formData.caseName.length < 2) return [];
    return existingCases.filter(c => c.case_name.toLowerCase().includes(formData.caseName.toLowerCase())).slice(0, 5);
  };

  const inputClass = 'w-full px-3 py-2 border dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-slate-700 dark:text-gray-100';

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b dark:border-gray-600">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            {person ? t('personForm.editTitle') : t('personForm.addTitle')}
          </h2>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {optionsLoadError && (
            <div className="flex items-center gap-2 px-4 py-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg text-sm text-amber-700 dark:text-amber-400">
              <AlertCircle className="w-4 h-4 shrink-0" />
              {t('personForm.optionsLoadError')}
            </div>
          )}

          {/* Name */}
          {/* Field order follows the naming convention of the active language —
              Russian and neighbours lead with the family name (issue #61). */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {personNameOrder(i18n.language).map(field => (
              <div key={field}>
                {field === 'first_name' && (
                  <>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{t('personForm.firstNameRequired')}</label>
                    <input type="text" value={formData.firstName} onChange={e => set('firstName', e.target.value)} className={inputClass} required />
                  </>
                )}
                {field === 'patronymic' && (
                  <>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{t('personForm.patronymic')}</label>
                    <input type="text" value={formData.patronymic} onChange={e => set('patronymic', e.target.value)} className={inputClass} />
                  </>
                )}
                {field === 'last_name' && (
                  <>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{t('personForm.lastName')}</label>
                    <input type="text" value={formData.lastName} onChange={e => set('lastName', e.target.value)} className={inputClass} />
                  </>
                )}
              </div>
            ))}
          </div>

          {/* DOB + Category */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{t('personForm.dateOfBirth')}</label>
              <input type="date" value={formData.dateOfBirth} onChange={e => set('dateOfBirth', e.target.value)} className={inputClass} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{t('personForm.category')}</label>
              <select value={formData.category} onChange={e => set('category', e.target.value)} className={inputClass}>
                <option value="">{t('personForm.selectCategory')}</option>
                {personCategories.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </div>
          </div>

          {/* Status + CRM Status */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{t('personForm.status')}</label>
              <select value={formData.status} onChange={e => set('status', e.target.value)} className={inputClass}>
                <option value="">{t('personForm.selectStatus')}</option>
                {personStatuses.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{t('personForm.crmStatus')}</label>
              <select value={formData.crmStatus} onChange={e => set('crmStatus', e.target.value)} className={inputClass}>
                <option value="">{t('personForm.selectCrmStatus')}</option>
                {tCrmStatuses.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </div>
          </div>

          {/* Case + Profile pic */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{t('personForm.caseName')}</label>
              <div className="relative">
                <input
                  type="text"
                  value={formData.caseName}
                  onChange={e => set('caseName', e.target.value)}
                  placeholder={t('personForm.caseNamePlaceholder')}
                  className={inputClass}
                />
                {formData.caseName && !caseExists && (
                  <div className="absolute right-2 top-2">
                    <span className="text-xs text-orange-600 flex items-center">
                      <AlertCircle className="w-3 h-3 mr-1" />{t('personForm.newCaseWillBeCreated')}
                    </span>
                  </div>
                )}
              </div>
              {getSimilarCases().length > 0 && (
                <div className="mt-1 p-2 bg-gray-50 dark:bg-slate-900 rounded-md">
                  <p className="text-xs text-gray-600 dark:text-slate-400 mb-1">{t('personForm.similarCases')}</p>
                  <div className="space-y-1">
                    {getSimilarCases().map(c => (
                      <button key={c.id} type="button" onClick={() => set('caseName', c.case_name)} className="text-xs text-blue-600 hover:text-blue-700 block">
                        {c.case_name}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{t('personForm.profilePictureUrl')}</label>
              <input type="url" value={formData.profilePictureUrl} onChange={e => set('profilePictureUrl', e.target.value)} className={inputClass} />
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{t('personForm.notes')}</label>
            <textarea value={formData.notes} onChange={e => set('notes', e.target.value)} className={inputClass} rows="3" />
          </div>

          {/* Aliases */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{t('personForm.aliases')}</label>
            <div className="flex flex-wrap gap-2 mb-2">
              <input
                type="text"
                value={newAlias}
                onChange={e => setNewAlias(e.target.value)}
                onKeyPress={e => e.key === 'Enter' && (e.preventDefault(), addAlias())}
                placeholder={t('personForm.addAliasPlaceholder')}
                className="flex-1 px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-slate-700 dark:text-gray-100 dark:border-gray-600"
              />
              <button type="button" onClick={addAlias} className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700">{t('common.add')}</button>
            </div>
            <div className="flex flex-wrap gap-2">
              {formData.aliases.map((alias, i) => (
                <span key={i} className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-gray-100 dark:bg-slate-700">
                  {alias}
                  <button type="button" onClick={() => set('aliases', formData.aliases.filter((_, idx) => idx !== i))} className="ml-2 text-gray-500 dark:text-slate-400 hover:text-red-500">
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>
          </div>

          <LocationsSection
            locations={formData.locations}
            locationTypes={tLocationTypes}
            onChange={val => set('locations', val)}
          />

          <OsintSection
            osintData={formData.osintData}
            osintDataTypes={tOsintDataTypes}
            onChange={val => set('osintData', val)}
          />

          <ConnectionsSection
            connections={formData.connections}
            connectionTypes={tConnectionTypes}
            people={people}
            currentPersonId={person?.id}
            onChange={val => set('connections', val)}
          />

          <CustomFieldsSection
            customFields={customFields}
            values={formData.custom_fields}
            onChange={val => set('custom_fields', val)}
          />

          {/* Actions */}
          <div className="flex justify-end space-x-3 pt-6 border-t dark:border-gray-600">
            <button type="button" onClick={handleClose} className="px-4 py-2 text-gray-700 dark:text-slate-300 bg-gray-100 dark:bg-slate-700 rounded-md hover:bg-gray-200">
              {t('common.cancel')}
            </button>
            <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700">
              {person ? t('personForm.updatePerson') : t('personForm.createPerson')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddEditPersonForm;
