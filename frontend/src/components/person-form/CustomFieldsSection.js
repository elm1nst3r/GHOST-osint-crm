import React from 'react';

const CustomFieldsSection = ({ customFields, values, onChange }) => {
  const active = customFields.filter(f => f.is_active);
  if (active.length === 0) return null;

  const set = (name, value) => onChange({ ...values, [name]: value });

  const inputClass = 'w-full px-3 py-2 border dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-slate-700 dark:text-gray-100';

  return (
    <div>
      <h3 className="text-lg font-semibold mb-3 text-gray-900 dark:text-gray-100">Custom Fields</h3>
      <div className="space-y-4">
        {active.map(field => (
          <div key={field.id}>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{field.field_label}</label>
            {field.field_type === 'text' && (
              <input type="text" value={values[field.field_name] || ''} onChange={e => set(field.field_name, e.target.value)} className={inputClass} />
            )}
            {field.field_type === 'select' && (
              <select value={values[field.field_name] || ''} onChange={e => set(field.field_name, e.target.value)} className={inputClass}>
                <option value="">Select {field.field_label}</option>
                {field.options?.map(o => <option key={o} value={o}>{o}</option>)}
              </select>
            )}
            {field.field_type === 'textarea' && (
              <textarea value={values[field.field_name] || ''} onChange={e => set(field.field_name, e.target.value)} className={inputClass} rows="3" />
            )}
            {field.field_type === 'date' && (
              <input type="date" value={values[field.field_name] || ''} onChange={e => set(field.field_name, e.target.value)} className={inputClass} />
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default CustomFieldsSection;
