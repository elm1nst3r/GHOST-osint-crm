import React from 'react';
import { useTranslation } from 'react-i18next';
import {
  Search, X, ChevronDown, ChevronUp, Calendar, MapPin,
  Tag, Network, Database,
  RefreshCw
} from 'lucide-react';
import { PERSON_CATEGORIES, PERSON_STATUSES, OSINT_DATA_TYPES } from '../../utils/constants';
import { translateOptions } from '../../utils/optionLabels';

const SearchFilters = ({
  searchParams, setSearchParams,
  expandedSections, toggleSection,
  performSearch, resetFilters,
  loading,
  cases, people, customFields, modelOptions,
  onClose,
}) => {
  const { t } = useTranslation();
  // These return normalised { value, label } entries (id and the raw row are
  // preserved). Read `.value`/`.label` off them — the call sites below used to
  // read `.option_value`/`.option_label`, which these getters never produced,
  // so the CRM-status, location-type and connection-type filters rendered blank
  // labels and filtered on `undefined`.
  const personCategories = translateOptions(t, 'person_category', PERSON_CATEGORIES);
  const personStatuses = translateOptions(t, 'person_status', PERSON_STATUSES);
  const osintDataTypes = translateOptions(t, 'osint_data_type', OSINT_DATA_TYPES);
  const byType = (modelType) => translateOptions(t, modelType, modelOptions.filter(opt => opt.model_type === modelType && opt.is_active));
  const getCrmStatuses = () => byType('crm_status');
  const getConnectionTypes = () => byType('connection_type');
  const getLocationTypes = () => byType('location_type');

  return (
<div className="w-96 border-r bg-gray-50 dark:bg-slate-900 overflow-y-auto">
  <div className="p-6 border-b bg-white dark:bg-slate-800">
    <div className="flex items-center justify-between">
      <h2 className="text-xl font-bold text-gray-900 dark:text-slate-100 flex items-center">
        <Search className="w-5 h-5 mr-2" />
        {t('searchFilters.advancedSearch')}
      </h2>
      <button onClick={onClose} className="text-gray-600 dark:text-gray-300 hover:text-gray-700 dark:hover:text-gray-100">
        <X className="w-5 h-5" />
      </button>
    </div>
  </div>
  
  <div className="p-6 space-y-4">
    {/* Basic Search */}
    <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border">
      <button
        onClick={() => toggleSection('basic')}
        className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50"
      >
        <span className="font-medium flex items-center">
          <Search className="w-4 h-4 mr-2" />
          {t('searchFilters.basicSearch')}
        </span>
        {expandedSections.basic ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
      </button>

      {expandedSections.basic && (
        <div className="px-4 pb-4 space-y-3">
          <input
            type="text"
            placeholder={t('searchFilters.searchTextPlaceholder')}
            value={searchParams.searchText}
            onChange={(e) => setSearchParams({ ...searchParams, searchText: e.target.value })}
            className="w-full px-3 py-2 border rounded-md"
          />

          <div>
            <label className="text-sm font-medium text-gray-700 dark:text-slate-300 mb-1 block">{t('searchFilters.searchInLabel')}</label>
            <div className="space-y-2">
              {[
                { value: 'name', label: t('searchFilters.searchInNames') },
                { value: 'aliases', label: t('searchFilters.searchInAliases') },
                { value: 'notes', label: t('propertyDetailModal.notesLabel') },
                { value: 'osint', label: t('personDetailModal.osintData') }
              ].map(option => (
                <label key={option.value} className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={searchParams.searchIn.includes(option.value)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSearchParams({
                          ...searchParams,
                          searchIn: [...searchParams.searchIn, option.value]
                        });
                      } else {
                        setSearchParams({
                          ...searchParams,
                          searchIn: searchParams.searchIn.filter(v => v !== option.value)
                        });
                      }
                    }}
                    className="h-4 w-4 text-blue-600 rounded"
                  />
                  <span className="text-sm">{option.label}</span>
                </label>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
    
    {/* Categories & Status */}
    <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border">
      <button
        onClick={() => toggleSection('categories')}
        className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50"
      >
        <span className="font-medium flex items-center">
          <Tag className="w-4 h-4 mr-2" />
          {t('searchFilters.categoriesAndStatus')}
        </span>
        {expandedSections.categories ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
      </button>

      {expandedSections.categories && (
        <div className="px-4 pb-4 space-y-3">
          <div>
            <label className="text-sm font-medium text-gray-700 dark:text-slate-300 mb-1 block">{t('searchFilters.categoriesLabel')}</label>
            <div className="space-y-1 max-h-32 overflow-y-auto">
              {personCategories.map(cat => (
                <label key={cat.value} className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={searchParams.categories.includes(cat.value)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSearchParams({
                          ...searchParams,
                          categories: [...searchParams.categories, cat.value]
                        });
                      } else {
                        setSearchParams({
                          ...searchParams,
                          categories: searchParams.categories.filter(v => v !== cat.value)
                        });
                      }
                    }}
                    className="h-4 w-4 text-blue-600 rounded"
                  />
                  <span className="text-sm">{cat.label}</span>
                </label>
              ))}
            </div>
          </div>
          
          <div>
            <label className="text-sm font-medium text-gray-700 dark:text-slate-300 mb-1 block">{t('personDetailModal.statusLabel')}</label>
            <div className="space-y-1">
              {personStatuses.map(status => (
                <label key={status.value} className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={searchParams.statuses.includes(status.value)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSearchParams({
                          ...searchParams,
                          statuses: [...searchParams.statuses, status.value]
                        });
                      } else {
                        setSearchParams({
                          ...searchParams,
                          statuses: searchParams.statuses.filter(v => v !== status.value)
                        });
                      }
                    }}
                    className="h-4 w-4 text-blue-600 rounded"
                  />
                  <span className="text-sm">{status.label}</span>
                </label>
              ))}
            </div>
          </div>
          
          <div>
            <label className="text-sm font-medium text-gray-700 dark:text-slate-300 mb-1 block">{t('searchFilters.crmStatusLabel')}</label>
            <div className="space-y-1 max-h-32 overflow-y-auto">
              {getCrmStatuses().map(status => (
                <label key={status.id} className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={searchParams.crmStatuses.includes(status.value)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSearchParams({
                          ...searchParams,
                          crmStatuses: [...searchParams.crmStatuses, status.value]
                        });
                      } else {
                        setSearchParams({
                          ...searchParams,
                          crmStatuses: searchParams.crmStatuses.filter(v => v !== status.value)
                        });
                      }
                    }}
                    className="h-4 w-4 text-blue-600 rounded"
                  />
                  <span className="text-sm">{status.label}</span>
                </label>
              ))}
            </div>
          </div>
          
          <div>
            <label className="text-sm font-medium text-gray-700 dark:text-slate-300 mb-1 block">{t('searchFilters.casesLabel')}</label>
            <div className="space-y-1 max-h-32 overflow-y-auto">
              {cases.map(caseItem => (
                <label key={caseItem.id} className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={searchParams.cases.includes(caseItem.case_name)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSearchParams({
                          ...searchParams,
                          cases: [...searchParams.cases, caseItem.case_name]
                        });
                      } else {
                        setSearchParams({
                          ...searchParams,
                          cases: searchParams.cases.filter(v => v !== caseItem.case_name)
                        });
                      }
                    }}
                    className="h-4 w-4 text-blue-600 rounded"
                  />
                  <span className="text-sm">{caseItem.case_name}</span>
                </label>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
    
    {/* Date Filters */}
    <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border">
      <button
        onClick={() => toggleSection('dates')}
        className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50"
      >
        <span className="font-medium flex items-center">
          <Calendar className="w-4 h-4 mr-2" />
          {t('searchFilters.dateFiltersTitle')}
        </span>
        {expandedSections.dates ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
      </button>

      {expandedSections.dates && (
        <div className="px-4 pb-4 space-y-3">
          <div>
            <label className="text-sm font-medium text-gray-700 dark:text-slate-300 mb-1 block">{t('searchFilters.filterByLabel')}</label>
            <select
              value={searchParams.dateFilter}
              onChange={(e) => setSearchParams({ ...searchParams, dateFilter: e.target.value })}
              className="w-full px-3 py-2 border rounded-md text-sm"
            >
              <option value="all">{t('searchFilters.allDates')}</option>
              <option value="created">{t('searchResults.sortCreatedDate')}</option>
              <option value="updated">{t('searchResults.sortUpdatedDate')}</option>
            </select>
          </div>

          {searchParams.dateFilter !== 'all' && (
            <>
              <div>
                <label className="text-sm font-medium text-gray-700 dark:text-slate-300 mb-1 block">{t('searchFilters.fromLabel')}</label>
                <input
                  type="date"
                  value={searchParams.dateFrom}
                  onChange={(e) => setSearchParams({ ...searchParams, dateFrom: e.target.value })}
                  className="w-full px-3 py-2 border rounded-md text-sm"
                />
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700 dark:text-slate-300 mb-1 block">{t('searchFilters.toLabel')}</label>
                <input
                  type="date"
                  value={searchParams.dateTo}
                  onChange={(e) => setSearchParams({ ...searchParams, dateTo: e.target.value })}
                  className="w-full px-3 py-2 border rounded-md text-sm"
                />
              </div>
            </>
          )}
        </div>
      )}
    </div>

    {/* Location Filters */}
    <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border">
      <button
        onClick={() => toggleSection('locations')}
        className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50"
      >
        <span className="font-medium flex items-center">
          <MapPin className="w-4 h-4 mr-2" />
          {t('searchFilters.locationFiltersTitle')}
        </span>
        {expandedSections.locations ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
      </button>

      {expandedSections.locations && (
        <div className="px-4 pb-4 space-y-3">
          <div>
            <label className="text-sm font-medium text-gray-700 dark:text-slate-300 mb-1 block">{t('searchFilters.locationContainsLabel')}</label>
            <input
              type="text"
              placeholder={t('searchFilters.locationContainsPlaceholder')}
              value={searchParams.locationSearch}
              onChange={(e) => setSearchParams({ ...searchParams, locationSearch: e.target.value })}
              className="w-full px-3 py-2 border rounded-md text-sm"
            />
          </div>

          <div>
            <label className="text-sm font-medium text-gray-700 dark:text-slate-300 mb-1 block">{t('searchFilters.locationTypeLabel')}</label>
            <select
              value={searchParams.locationType}
              onChange={(e) => setSearchParams({ ...searchParams, locationType: e.target.value })}
              className="w-full px-3 py-2 border rounded-md text-sm"
            >
              <option value="">{t('searchFilters.allTypes')}</option>
              {getLocationTypes().map(type => (
                <option key={type.id} value={type.value}>
                  {type.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}
    </div>
    
    {/* Connection Filters */}
    <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border">
      <button
        onClick={() => toggleSection('connections')}
        className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50"
      >
        <span className="font-medium flex items-center">
          <Network className="w-4 h-4 mr-2" />
          {t('searchFilters.connectionFiltersTitle')}
        </span>
        {expandedSections.connections ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
      </button>

      {expandedSections.connections && (
        <div className="px-4 pb-4 space-y-3">
          <div>
            <label className="text-sm font-medium text-gray-700 dark:text-slate-300 mb-1 block">{t('searchFilters.connectedToLabel')}</label>
            <input
              type="text"
              placeholder={t('searchFilters.personNamePlaceholder')}
              value={searchParams.connectedTo}
              onChange={(e) => setSearchParams({ ...searchParams, connectedTo: e.target.value })}
              className="w-full px-3 py-2 border rounded-md text-sm"
            />
          </div>

          <div>
            <label className="text-sm font-medium text-gray-700 dark:text-slate-300 mb-1 block">{t('searchFilters.connectionTypeLabel')}</label>
            <select
              value={searchParams.connectionType}
              onChange={(e) => setSearchParams({ ...searchParams, connectionType: e.target.value })}
              className="w-full px-3 py-2 border rounded-md text-sm"
            >
              <option value="">{t('searchFilters.allTypes')}</option>
              {getConnectionTypes().map(type => (
                <option key={type.id} value={type.value}>
                  {type.label}
                </option>
              ))}
            </select>
          </div>
          
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-sm font-medium text-gray-700 dark:text-slate-300 mb-1 block">{t('searchFilters.minConnectionsLabel')}</label>
              <input
                type="number"
                value={searchParams.minConnections}
                onChange={(e) => setSearchParams({ ...searchParams, minConnections: e.target.value })}
                className="w-full px-3 py-2 border rounded-md text-sm"
                min="0"
              />
            </div>
            
            <div>
              <label className="text-sm font-medium text-gray-700 dark:text-slate-300 mb-1 block">{t('searchFilters.maxConnectionsLabel')}</label>
              <input
                type="number"
                value={searchParams.maxConnections}
                onChange={(e) => setSearchParams({ ...searchParams, maxConnections: e.target.value })}
                className="w-full px-3 py-2 border rounded-md text-sm"
                min="0"
              />
            </div>
          </div>
        </div>
      )}
    </div>
    
    {/* OSINT Filters */}
    <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border">
      <button
        onClick={() => toggleSection('osint')}
        className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50"
      >
        <span className="font-medium flex items-center">
          <Database className="w-4 h-4 mr-2" />
          {t('personDetailModal.osintData')}
        </span>
        {expandedSections.osint ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
      </button>

      {expandedSections.osint && (
        <div className="px-4 pb-4 space-y-3">
          <div>
            <label className="text-sm font-medium text-gray-700 dark:text-slate-300 mb-1 block">{t('searchFilters.osintTypesLabel')}</label>
            <div className="space-y-1">
              {osintDataTypes.map(type => (
                <label key={type.value} className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={searchParams.osintTypes.includes(type.value)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSearchParams({
                          ...searchParams,
                          osintTypes: [...searchParams.osintTypes, type.value]
                        });
                      } else {
                        setSearchParams({
                          ...searchParams,
                          osintTypes: searchParams.osintTypes.filter(v => v !== type.value)
                        });
                      }
                    }}
                    className="h-4 w-4 text-blue-600 rounded"
                  />
                  <span className="text-sm">{type.label}</span>
                </label>
              ))}
            </div>
          </div>
          
          <div>
            <label className="text-sm font-medium text-gray-700 dark:text-slate-300 mb-1 block">{t('searchFilters.osintValueContainsLabel')}</label>
            <input
              type="text"
              placeholder={t('searchFilters.osintValuePlaceholder')}
              value={searchParams.osintValue}
              onChange={(e) => setSearchParams({ ...searchParams, osintValue: e.target.value })}
              className="w-full px-3 py-2 border rounded-md text-sm"
            />
          </div>
        </div>
      )}
    </div>
    
    {/* Custom Fields */}
    {customFields.length > 0 && (
      <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border">
        <button
          onClick={() => toggleSection('custom')}
          className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50"
        >
          <span className="font-medium flex items-center">
            <Tag className="w-4 h-4 mr-2" />
            {t('personDetailModal.customFields')}
          </span>
          {expandedSections.custom ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
        
        {expandedSections.custom && (
          <div className="px-4 pb-4 space-y-3">
            {customFields.map(field => (
              <div key={field.id}>
                <label className="text-sm font-medium text-gray-700 dark:text-slate-300 mb-1 block">
                  {field.field_label}:
                </label>
                {field.field_type === 'select' ? (
                  <select
                    value={searchParams.customFieldFilters[field.field_name] || ''}
                    onChange={(e) => setSearchParams({
                      ...searchParams,
                      customFieldFilters: {
                        ...searchParams.customFieldFilters,
                        [field.field_name]: e.target.value
                      }
                    })}
                    className="w-full px-3 py-2 border rounded-md text-sm"
                  >
                    <option value="">{t('settings.auditLogs.allOption')}</option>
                    {field.options?.map(option => (
                      <option key={option} value={option}>{option}</option>
                    ))}
                  </select>
                ) : (
                  <input
                    type={field.field_type === 'date' ? 'date' : 'text'}
                    value={searchParams.customFieldFilters[field.field_name] || ''}
                    onChange={(e) => setSearchParams({
                      ...searchParams,
                      customFieldFilters: {
                        ...searchParams.customFieldFilters,
                        [field.field_name]: e.target.value
                      }
                    })}
                    className="w-full px-3 py-2 border rounded-md text-sm"
                  />
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    )}
    
    {/* Action Buttons */}
    <div className="space-y-2">
      <button
        onClick={performSearch}
        disabled={loading}
        className="w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 flex items-center justify-center disabled:opacity-50"
      >
        {loading ? (
          <>
            <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
            {t('searchFilters.searchingEllipsis')}
          </>
        ) : (
          <>
            <Search className="w-4 h-4 mr-2" />
            {t('searchFilters.searchButton')}
          </>
        )}
      </button>

      <button
        onClick={resetFilters}
        className="w-full px-4 py-2 bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-slate-300 rounded-md hover:bg-gray-200"
      >
        {t('searchFilters.resetFiltersButton')}
      </button>
    </div>
  </div>
</div>
  );
};

export default SearchFilters;
