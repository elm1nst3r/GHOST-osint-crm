import React, { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, Edit2, Trash2, ChevronDown, ChevronRight } from 'lucide-react';
import { modelOptionsAPI } from '../../utils/api';
import CustomFieldManager from '../CustomFieldManager';
import { useData } from '../../contexts/DataContext';

const EMPTY_FORM = { option_value: '', option_label: '', display_order: 999, is_active: true };

const DataModelTab = () => {
  const { t } = useTranslation();
  const { customFields, fetchCustomFields } = useData();
  const MODEL_TYPE_LABELS = useMemo(() => ({
    person_category: t('settings.dataModel.types.personCategory'),
    person_status: t('settings.dataModel.types.personStatus'),
    crm_status: t('settings.dataModel.types.crmStatus'),
    task_status: t('settings.dataModel.types.taskStatus'),
    connection_type: t('settings.dataModel.types.connectionType'),
    location_type: t('settings.dataModel.types.locationType'),
    osint_data_type: t('settings.dataModel.types.osintDataType'),
    transaction_type: t('settings.dataModel.types.transactionType'),
    transaction_item_category: t('settings.dataModel.types.transactionItemCategory'),
    asset_category: t('settings.dataModel.types.assetCategory'),
    asset_status: t('settings.dataModel.types.assetStatus'),
    property_type: t('settings.dataModel.types.propertyType'),
    crypto_wallet_network: t('settings.dataModel.types.cryptoWalletNetwork'),
    crypto_wallet_tag: t('settings.dataModel.types.cryptoWalletTag'),
  }), [t]);
  const [modelOptions, setModelOptions] = useState([]);
  const [showAddOptionForm, setShowAddOptionForm] = useState(false);
  const [editingOption, setEditingOption] = useState(null);
  const [selectedModelType, setSelectedModelType] = useState('person_category');
  const [optionForm, setOptionForm] = useState(EMPTY_FORM);
  const [expandedGroups, setExpandedGroups] = useState({});

  useEffect(() => {
    fetchModelOptions();
  }, []);

  const fetchModelOptions = async () => {
    try {
      const data = await modelOptionsAPI.getAll();
      setModelOptions(data);
      const groups = {};
      [...new Set(data.map(opt => opt.model_type))].forEach(t => { groups[t] = false; });
      setExpandedGroups(groups);
    } catch (err) {
      console.error('Error fetching model options:', err);
    }
  };

  const toggleGroup = (modelType) => setExpandedGroups(prev => ({ ...prev, [modelType]: !prev[modelType] }));

  const handleAddOption = async () => {
    if (!optionForm.option_value || !optionForm.option_label) {
      alert(t('settings.dataModel.errorFillValueAndLabel'));
      return;
    }
    try {
      await modelOptionsAPI.create({ model_type: selectedModelType, ...optionForm });
      fetchModelOptions();
      setShowAddOptionForm(false);
      setOptionForm(EMPTY_FORM);
    } catch (err) {
      alert(t('settings.dataModel.errorAddOption', { message: err.message }));
    }
  };

  const handleUpdateOption = async () => {
    if (!editingOption) return;
    try {
      await modelOptionsAPI.update(editingOption.id, {
        option_label: optionForm.option_label,
        display_order: optionForm.display_order,
        is_active: optionForm.is_active,
      });
      fetchModelOptions();
      setEditingOption(null);
      setOptionForm(EMPTY_FORM);
    } catch (err) {
      alert(t('settings.dataModel.errorUpdateOption'));
    }
  };

  const handleDeleteOption = async (id) => {
    if (!window.confirm(t('settings.dataModel.confirmDeleteOption'))) return;
    try {
      await modelOptionsAPI.delete(id);
      fetchModelOptions();
    } catch (err) {
      alert(t('settings.dataModel.errorDeleteOption'));
    }
  };

  return (
    <div className="space-y-6">
      <CustomFieldManager customFields={customFields} fetchCustomFields={fetchCustomFields} />

      <div className="pt-6 border-t">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 mb-1">
          <h3 className="text-lg font-semibold">{t('settings.dataModel.predefinedOptions')}</h3>
          <button onClick={() => setShowAddOptionForm(!showAddOptionForm)} className="px-3 py-1 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 flex items-center">
            <Plus className="w-4 h-4 mr-1" />{t('settings.dataModel.addOption')}
          </button>
        </div>
        {/* Labels are shown here exactly as stored, never translated — this is
            the screen where you edit the stored value, so translating it would
            mean editing one string while looking at another. Everywhere else in
            the app these labels go through utils/optionLabels.js and appear in
            the active language. */}
        <p className="text-sm text-gray-500 dark:text-slate-400 mb-4">{t('settings.dataModel.storedLabelsHint')}</p>

        {showAddOptionForm && (
          <div className="mb-6 p-4 bg-gray-50 dark:bg-slate-900 rounded-lg">
            <h4 className="font-medium mb-3">{t('settings.dataModel.addNewOption')}</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">{t('settings.dataModel.category')}</label>
                <select value={selectedModelType} onChange={(e) => setSelectedModelType(e.target.value)} className="w-full px-3 py-2 border rounded-md text-sm">
                  {Object.entries(MODEL_TYPE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">{t('settings.dataModel.displayOrder')}</label>
                <input type="number" value={optionForm.display_order} onChange={(e) => setOptionForm({ ...optionForm, display_order: parseInt(e.target.value) || 999 })} className="w-full px-3 py-2 border rounded-md text-sm" />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">{t('settings.dataModel.internalValueRequired')}</label>
                <input type="text" value={optionForm.option_value} onChange={(e) => setOptionForm({ ...optionForm, option_value: e.target.value })} className="w-full px-3 py-2 border rounded-md text-sm" placeholder={t('settings.dataModel.internalValuePlaceholder')} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">{t('settings.dataModel.displayLabelRequired')}</label>
                <input type="text" value={optionForm.option_label} onChange={(e) => setOptionForm({ ...optionForm, option_label: e.target.value })} className="w-full px-3 py-2 border rounded-md text-sm" placeholder={t('settings.dataModel.displayLabelPlaceholder')} />
              </div>
            </div>
            <div className="flex items-center mb-3">
              <input type="checkbox" id="new_is_active" checked={optionForm.is_active} onChange={(e) => setOptionForm({ ...optionForm, is_active: e.target.checked })} className="h-4 w-4 text-blue-600 rounded" />
              <label htmlFor="new_is_active" className="ml-2 text-sm text-gray-700 dark:text-gray-300">{t('settings.dataModel.activeCheckboxLabel')}</label>
            </div>
            <div className="flex justify-end space-x-2">
              <button onClick={() => { setShowAddOptionForm(false); setOptionForm(EMPTY_FORM); }} className="px-3 py-1 text-gray-700 dark:text-slate-300 bg-gray-200 dark:bg-slate-600 text-sm rounded-md hover:bg-gray-300">{t('common.cancel')}</button>
              <button onClick={handleAddOption} className="px-3 py-1 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700">{t('settings.dataModel.addOption')}</button>
            </div>
          </div>
        )}

        {Object.entries(MODEL_TYPE_LABELS).map(([modelType, label]) => {
          const typeOptions = modelOptions.filter(opt => opt.model_type === modelType);
          return (
            <div key={modelType} className="mb-4 border rounded-lg">
              <button onClick={() => toggleGroup(modelType)} className="w-full px-4 py-3 bg-gray-50 dark:bg-slate-900 hover:bg-gray-100 rounded-t-lg flex items-center justify-between transition-colors">
                <div className="flex items-center space-x-2">
                  {expandedGroups[modelType] ? <ChevronDown className="w-4 h-4 text-gray-500 dark:text-slate-400" /> : <ChevronRight className="w-4 h-4 text-gray-500 dark:text-slate-400" />}
                  <h4 className="font-medium text-gray-700 dark:text-gray-300">{label}</h4>
                  <span className="text-sm text-gray-500 dark:text-gray-400">({t('settings.dataModel.optionsCount', { count: typeOptions.length })})</span>
                </div>
              </button>
              {expandedGroups[modelType] && (
                <div className="p-4 space-y-2 bg-white dark:bg-slate-800 rounded-b-lg">
                  {typeOptions.length === 0 ? (
                    <p className="text-sm text-gray-500 dark:text-slate-400 text-center py-4">{t('settings.dataModel.noOptionsDefined')}</p>
                  ) : (
                    typeOptions.sort((a, b) => a.display_order - b.display_order).map(option => (
                      <div key={option.id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-slate-900 rounded-lg">
                        <div className="flex items-center space-x-3">
                          <span className="text-sm text-gray-500 dark:text-gray-400">#{option.display_order}</span>
                          <div>
                            <div className="font-medium">{option.option_label}</div>
                            <div className="text-sm text-gray-600 dark:text-gray-400">{t('settings.dataModel.valueLabel', { value: option.option_value })}</div>
                          </div>
                        </div>
                        <div className="flex items-center space-x-2">
                          <span className={`px-2 py-1 text-xs rounded ${option.is_active ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-400' : 'bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-slate-400'}`}>
                            {option.is_active ? t('settings.dataModel.active') : t('settings.dataModel.inactive')}
                          </span>
                          <button onClick={() => { setEditingOption(option); setOptionForm({ option_value: option.option_value, option_label: option.option_label, display_order: option.display_order, is_active: option.is_active }); }} className="text-gray-600 dark:text-slate-400 hover:text-gray-700" title={t('common.edit')}><Edit2 className="w-4 h-4" /></button>
                          <button onClick={() => handleDeleteOption(option.id)} className="text-red-600 hover:text-red-700" title={t('common.delete')}><Trash2 className="w-4 h-4" /></button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Edit Option Modal */}
      {editingOption && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl p-6 w-full max-w-sm max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-semibold mb-4">{t('settings.dataModel.editOption')}</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">{t('settings.dataModel.internalValue')}</label>
                <input type="text" value={optionForm.option_value} disabled className="w-full px-3 py-2 border rounded-md text-sm bg-gray-100 dark:bg-slate-700" />
                <p className="text-xs text-gray-500 dark:text-slate-400 mt-1">{t('settings.dataModel.internalValueCannotChange')}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">{t('settings.dataModel.displayLabel')}</label>
                <input type="text" value={optionForm.option_label} onChange={(e) => setOptionForm({ ...optionForm, option_label: e.target.value })} className="w-full px-3 py-2 border rounded-md text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">{t('settings.dataModel.displayOrder')}</label>
                <input type="number" value={optionForm.display_order} onChange={(e) => setOptionForm({ ...optionForm, display_order: parseInt(e.target.value) || 999 })} className="w-full px-3 py-2 border rounded-md text-sm" />
              </div>
              <div className="flex items-center">
                <input type="checkbox" id="edit_is_active" checked={optionForm.is_active} onChange={(e) => setOptionForm({ ...optionForm, is_active: e.target.checked })} className="h-4 w-4 text-blue-600 rounded" />
                <label htmlFor="edit_is_active" className="ml-2 text-sm text-gray-700 dark:text-gray-300">{t('settings.dataModel.active')}</label>
              </div>
            </div>
            <div className="flex justify-end space-x-2 mt-6">
              <button onClick={() => { setEditingOption(null); setOptionForm(EMPTY_FORM); }} className="px-4 py-2 text-gray-700 dark:text-slate-300 bg-gray-100 dark:bg-slate-700 rounded-md hover:bg-gray-200">{t('common.cancel')}</button>
              <button onClick={handleUpdateOption} className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700">{t('settings.dataModel.update')}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DataModelTab;
