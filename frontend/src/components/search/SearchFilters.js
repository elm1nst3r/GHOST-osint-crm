import React from 'react';
import {
  Search, Filter, X, ChevronDown, ChevronUp, Calendar, MapPin,
  Users, Tag, Briefcase, Clock, Network, Database, Phone, Mail,
  Globe, Hash, RefreshCw
} from 'lucide-react';
import { PERSON_CATEGORIES, PERSON_STATUSES, OSINT_DATA_TYPES } from '../../utils/constants';

const SearchFilters = ({
  searchParams, setSearchParams,
  expandedSections, toggleSection,
  performSearch, resetFilters,
  loading,
  cases, people, customFields, modelOptions,
  onClose,
}) => {
  const getCrmStatuses = () => modelOptions.filter(opt => opt.model_type === 'crm_status' && opt.is_active).map(opt => ({ value: opt.option_value, label: opt.option_label }));
  const getConnectionTypes = () => modelOptions.filter(opt => opt.model_type === 'connection_type' && opt.is_active).map(opt => ({ value: opt.option_value, label: opt.option_label }));
  const getLocationTypes = () => modelOptions.filter(opt => opt.model_type === 'location_type' && opt.is_active).map(opt => ({ value: opt.option_value, label: opt.option_label }));

  return (
<div className="w-96 border-r bg-gray-50 dark:bg-slate-900 overflow-y-auto">
  <div className="p-6 border-b bg-white dark:bg-slate-800">
    <div className="flex items-center justify-between">
      <h2 className="text-xl font-bold text-gray-900 dark:text-slate-100 flex items-center">
        <Search className="w-5 h-5 mr-2" />
        Advanced Search
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
          Basic Search
        </span>
        {expandedSections.basic ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
      </button>
      
      {expandedSections.basic && (
        <div className="px-4 pb-4 space-y-3">
          <input
            type="text"
            placeholder="Search text..."
            value={searchParams.searchText}
            onChange={(e) => setSearchParams({ ...searchParams, searchText: e.target.value })}
            className="w-full px-3 py-2 border rounded-md"
          />
          
          <div>
            <label className="text-sm font-medium text-gray-700 dark:text-slate-300 mb-1 block">Search in:</label>
            <div className="space-y-2">
              {[
                { value: 'name', label: 'Names' },
                { value: 'aliases', label: 'Aliases' },
                { value: 'notes', label: 'Notes' },
                { value: 'osint', label: 'OSINT Data' }
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
          Categories & Status
        </span>
        {expandedSections.categories ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
      </button>
      
      {expandedSections.categories && (
        <div className="px-4 pb-4 space-y-3">
          <div>
            <label className="text-sm font-medium text-gray-700 dark:text-slate-300 mb-1 block">Categories:</label>
            <div className="space-y-1 max-h-32 overflow-y-auto">
              {PERSON_CATEGORIES.map(cat => (
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
            <label className="text-sm font-medium text-gray-700 dark:text-slate-300 mb-1 block">Status:</label>
            <div className="space-y-1">
              {PERSON_STATUSES.map(status => (
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
            <label className="text-sm font-medium text-gray-700 dark:text-slate-300 mb-1 block">CRM Status:</label>
            <div className="space-y-1 max-h-32 overflow-y-auto">
              {getCrmStatuses().map(status => (
                <label key={status.id} className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={searchParams.crmStatuses.includes(status.option_value)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSearchParams({
                          ...searchParams,
                          crmStatuses: [...searchParams.crmStatuses, status.option_value]
                        });
                      } else {
                        setSearchParams({
                          ...searchParams,
                          crmStatuses: searchParams.crmStatuses.filter(v => v !== status.option_value)
                        });
                      }
                    }}
                    className="h-4 w-4 text-blue-600 rounded"
                  />
                  <span className="text-sm">{status.option_label}</span>
                </label>
              ))}
            </div>
          </div>
          
          <div>
            <label className="text-sm font-medium text-gray-700 dark:text-slate-300 mb-1 block">Cases:</label>
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
          Date Filters
        </span>
        {expandedSections.dates ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
      </button>
      
      {expandedSections.dates && (
        <div className="px-4 pb-4 space-y-3">
          <div>
            <label className="text-sm font-medium text-gray-700 dark:text-slate-300 mb-1 block">Filter by:</label>
            <select
              value={searchParams.dateFilter}
              onChange={(e) => setSearchParams({ ...searchParams, dateFilter: e.target.value })}
              className="w-full px-3 py-2 border rounded-md text-sm"
            >
              <option value="all">All Dates</option>
              <option value="created">Created Date</option>
              <option value="updated">Updated Date</option>
            </select>
          </div>
          
          {searchParams.dateFilter !== 'all' && (
            <>
              <div>
                <label className="text-sm font-medium text-gray-700 dark:text-slate-300 mb-1 block">From:</label>
                <input
                  type="date"
                  value={searchParams.dateFrom}
                  onChange={(e) => setSearchParams({ ...searchParams, dateFrom: e.target.value })}
                  className="w-full px-3 py-2 border rounded-md text-sm"
                />
              </div>
              
              <div>
                <label className="text-sm font-medium text-gray-700 dark:text-slate-300 mb-1 block">To:</label>
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
          Location Filters
        </span>
        {expandedSections.locations ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
      </button>
      
      {expandedSections.locations && (
        <div className="px-4 pb-4 space-y-3">
          <div>
            <label className="text-sm font-medium text-gray-700 dark:text-slate-300 mb-1 block">Location contains:</label>
            <input
              type="text"
              placeholder="City, state, address..."
              value={searchParams.locationSearch}
              onChange={(e) => setSearchParams({ ...searchParams, locationSearch: e.target.value })}
              className="w-full px-3 py-2 border rounded-md text-sm"
            />
          </div>
          
          <div>
            <label className="text-sm font-medium text-gray-700 dark:text-slate-300 mb-1 block">Location Type:</label>
            <select
              value={searchParams.locationType}
              onChange={(e) => setSearchParams({ ...searchParams, locationType: e.target.value })}
              className="w-full px-3 py-2 border rounded-md text-sm"
            >
              <option value="">All Types</option>
              {getLocationTypes().map(type => (
                <option key={type.id} value={type.option_value}>
                  {type.option_label}
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
          Connection Filters
        </span>
        {expandedSections.connections ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
      </button>
      
      {expandedSections.connections && (
        <div className="px-4 pb-4 space-y-3">
          <div>
            <label className="text-sm font-medium text-gray-700 dark:text-slate-300 mb-1 block">Connected to:</label>
            <input
              type="text"
              placeholder="Person name..."
              value={searchParams.connectedTo}
              onChange={(e) => setSearchParams({ ...searchParams, connectedTo: e.target.value })}
              className="w-full px-3 py-2 border rounded-md text-sm"
            />
          </div>
          
          <div>
            <label className="text-sm font-medium text-gray-700 dark:text-slate-300 mb-1 block">Connection Type:</label>
            <select
              value={searchParams.connectionType}
              onChange={(e) => setSearchParams({ ...searchParams, connectionType: e.target.value })}
              className="w-full px-3 py-2 border rounded-md text-sm"
            >
              <option value="">All Types</option>
              {getConnectionTypes().map(type => (
                <option key={type.id} value={type.option_value}>
                  {type.option_label}
                </option>
              ))}
            </select>
          </div>
          
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-sm font-medium text-gray-700 dark:text-slate-300 mb-1 block">Min connections:</label>
              <input
                type="number"
                value={searchParams.minConnections}
                onChange={(e) => setSearchParams({ ...searchParams, minConnections: e.target.value })}
                className="w-full px-3 py-2 border rounded-md text-sm"
                min="0"
              />
            </div>
            
            <div>
              <label className="text-sm font-medium text-gray-700 dark:text-slate-300 mb-1 block">Max connections:</label>
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
          OSINT Data
        </span>
        {expandedSections.osint ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
      </button>
      
      {expandedSections.osint && (
        <div className="px-4 pb-4 space-y-3">
          <div>
            <label className="text-sm font-medium text-gray-700 dark:text-slate-300 mb-1 block">OSINT Types:</label>
            <div className="space-y-1">
              {OSINT_DATA_TYPES.map(type => (
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
            <label className="text-sm font-medium text-gray-700 dark:text-slate-300 mb-1 block">OSINT Value contains:</label>
            <input
              type="text"
              placeholder="Email, phone, username..."
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
            Custom Fields
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
                    <option value="">All</option>
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
            Searching...
          </>
        ) : (
          <>
            <Search className="w-4 h-4 mr-2" />
            Search
          </>
        )}
      </button>
      
      <button
        onClick={resetFilters}
        className="w-full px-4 py-2 bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-slate-300 rounded-md hover:bg-gray-200"
      >
        Reset Filters
      </button>
    </div>
  </div>
</div>
  );
};

export default SearchFilters;
