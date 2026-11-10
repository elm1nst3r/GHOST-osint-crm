import { useImperativeHandle, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { optionLabel } from '../../utils/optionLabels';
import { editOsintEntry } from '../../utils/entryEdits';
import { Pencil, Trash2 } from 'lucide-react';

// `ref.withPending(list)`: the list with an entry still in the form applied,
// so Save doesn't drop it (#112).
const OsintSection = ({ ref, osintData, osintDataTypes, onChange }) => {
  const { t } = useTranslation();
  const emptyItem = () => ({ type: osintDataTypes[0]?.value || 'Email', value: '', notes: '' });
  const [newItem, setNewItem] = useState(emptyItem);
  // Index of the entry being edited in the form above the list (issue #109).
  const [editing, setEditing] = useState(null);
  const valueField = useRef(null);

  const reset = () => { setNewItem(emptyItem()); setEditing(null); };

  const submit = () => {
    if (!newItem.value.trim()) return;
    if (editing === null) onChange([...osintData, { ...newItem }]);
    else onChange(osintData.map((item, i) => (i === editing ? editOsintEntry(item, newItem) : item)));
    reset();
  };

  useImperativeHandle(ref, () => ({
    withPending: (list) => {
      if (!newItem.value.trim()) return list;
      if (editing === null) return [...list, { ...newItem }];
      return list.map((item, i) => (i === editing ? editOsintEntry(item, newItem) : item));
    },
  }));

  const startEdit = (i) => {
    const item = osintData[i];
    setEditing(i);
    setNewItem({ type: item.type, value: item.value ?? '', notes: item.notes ?? '' });
    valueField.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    valueField.current?.focus({ preventScroll: true });
  };

  const remove = (i) => {
    onChange(osintData.filter((_, idx) => idx !== i));
    if (editing === i) reset();
    else if (editing !== null && i < editing) setEditing(editing - 1);
  };

  // A type that is no longer in the Data Model still shows while editing.
  const types = osintDataTypes.some((ot) => ot.value === newItem.type)
    ? osintDataTypes
    : [...osintDataTypes, { value: newItem.type, label: optionLabel(t, 'osint_data_type', newItem.type) }];

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{t('personForm.osint.label')}</label>

      <div className="space-y-2 mb-2">
        <div className={`flex flex-wrap gap-2 ${editing !== null ? 'p-2 rounded-lg ring-2 ring-blue-500' : ''}`}>
          <select
            value={newItem.type}
            onChange={e => setNewItem({ ...newItem, type: e.target.value })}
            className="px-3 py-2 border rounded-md focus:outline-hidden focus:ring-2 focus:ring-blue-500 dark:bg-slate-700 dark:text-gray-100 dark:border-gray-600"
          >
            {types.map(ot => <option key={ot.value} value={ot.value}>{ot.label}</option>)}
          </select>
          <input
            ref={valueField}
            type="text"
            value={newItem.value}
            onChange={e => setNewItem({ ...newItem, value: e.target.value })}
            placeholder={t('personForm.osint.value')}
            className="flex-1 px-3 py-2 border rounded-md focus:outline-hidden focus:ring-2 focus:ring-blue-500 dark:bg-slate-700 dark:text-gray-100 dark:border-gray-600"
          />
          <input
            type="text"
            value={newItem.notes}
            onChange={e => setNewItem({ ...newItem, notes: e.target.value })}
            placeholder={t('personForm.notesOptionalPlaceholder')}
            className="flex-1 px-3 py-2 border rounded-md focus:outline-hidden focus:ring-2 focus:ring-blue-500 dark:bg-slate-700 dark:text-gray-100 dark:border-gray-600"
          />
          <button type="button" onClick={submit} className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700">
            {editing === null ? t('common.add') : t('common.save')}
          </button>
          {editing !== null && (
            <button type="button" onClick={reset} className="px-4 py-2 border dark:border-gray-600 rounded-md text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-800">
              {t('common.cancel')}
            </button>
          )}
        </div>
      </div>

      <div className="space-y-2">
        {osintData.map((item, i) => (
          <div key={i} className={`flex items-center justify-between gap-x-3 p-3 bg-gray-50 dark:bg-slate-900 rounded-lg ${editing === i ? 'ring-1 ring-blue-500' : ''}`}>
            <div className="min-w-0">
              <span className="font-medium">{optionLabel(t, 'osint_data_type', item.type)}:</span> <bdi>{item.value}</bdi>
              {item.notes && <span className="text-sm text-gray-600 dark:text-slate-400 ms-2">({item.notes})</span>}
            </div>
            <div className="flex items-center gap-x-3 shrink-0">
              <button type="button" onClick={() => startEdit(i)} title={t('common.edit')} aria-label={t('common.edit')} className="text-gray-500 hover:text-blue-600 dark:text-gray-400 dark:hover:text-blue-400">
                <Pencil className="w-4 h-4" />
              </button>
              <button type="button" onClick={() => remove(i)} title={t('common.delete')} aria-label={t('common.delete')} className="text-red-600 hover:text-red-700">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default OsintSection;
