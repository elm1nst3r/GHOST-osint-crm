// Advanced Search title, close button and the choice of what to search:
// people (with their filters) or the saved records across the CRM (#120).
import { useTranslation } from 'react-i18next';
import { Search, X, Users, Database } from 'lucide-react';

const SearchHeader = ({ mode, onModeChange, onClose }) => {
  const { t } = useTranslation();
  const tab = (value, Icon, label) => (
    <button
      type="button"
      role="tab"
      aria-selected={mode === value}
      onClick={() => onModeChange(value)}
      className={`inline-flex items-center gap-x-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
        mode === value
          ? 'bg-white dark:bg-slate-700 text-gray-900 dark:text-slate-100 shadow-xs'
          : 'text-gray-600 dark:text-slate-400 hover:text-gray-900 dark:hover:text-slate-100'
      }`}
    >
      <Icon className="w-4 h-4" />{label}
    </button>
  );
  return (
    <div className="p-6 border-b bg-white dark:bg-slate-800 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-gray-900 dark:text-slate-100 flex items-center">
          <Search className="w-5 h-5 me-2" />
          {t('searchFilters.advancedSearch')}
        </h2>
        <button onClick={onClose} aria-label={t('common.close')} className="text-gray-600 dark:text-gray-300 hover:text-gray-700 dark:hover:text-gray-100">
          <X className="w-5 h-5" />
        </button>
      </div>
      <div role="tablist" aria-label={t('recordSearch.modeLabel')} className="inline-flex p-1 rounded-lg bg-gray-100 dark:bg-slate-900">
        {tab('people', Users, t('recordSearch.modePeople'))}
        {tab('records', Database, t('recordSearch.modeRecords'))}
      </div>
    </div>
  );
};

export default SearchHeader;
