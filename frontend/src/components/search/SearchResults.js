import React from 'react';
import { Search, Download, SortAsc, SortDesc, Network, Phone, Mail, Globe, Hash, Tag, Briefcase, MapPin, FileText, Database, Users, Clock, CheckCircle, AlertCircle } from 'lucide-react';
import ReportGenerator from '../ReportGenerator';

const SearchResults = ({
  results, totalResults, loading,
  searchParams, setSearchParams,
  selectedResultIds, setSelectedResultIds,
  onSelectPerson,
  exportResults,
  showReportGenerator, setShowReportGenerator,
}) => {
  const getFullName = (person) => `${person.first_name || ''} ${person.last_name || ''}`.trim();

  return (
<div className="flex-1 flex flex-col">
  <div className="p-6 border-b bg-white dark:bg-slate-800">
    <div className="flex items-center justify-between">
      <div>
        <h3 className="text-lg font-semibold">Search Results</h3>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          {totalResults > 0 ? `Found ${totalResults} results` : 'No search performed yet'}
        </p>
      </div>
      
      <div className="flex items-center space-x-2">
        {/* Sorting */}
        <div className="flex items-center space-x-2">
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Sort by:</label>
          <select
            value={searchParams.sortBy}
            onChange={(e) => setSearchParams({ ...searchParams, sortBy: e.target.value })}
            className="px-3 py-1 border rounded-md text-sm"
          >
            <option value="name">Name</option>
            <option value="created_at">Created Date</option>
            <option value="updated_at">Updated Date</option>
            <option value="connections">Connections</option>
          </select>
          
          <button
            onClick={() => setSearchParams({
              ...searchParams,
              sortOrder: searchParams.sortOrder === 'asc' ? 'desc' : 'asc'
            })}
            className="p-1 hover:bg-gray-100 rounded"
          >
            {searchParams.sortOrder === 'asc' ? (
              <SortAsc className="w-4 h-4" />
            ) : (
              <SortDesc className="w-4 h-4" />
            )}
          </button>
        </div>
        
        {results.length > 0 && (
          <>
            <button
              onClick={exportResults}
              className="px-3 py-1 bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-slate-300 rounded-md hover:bg-gray-200 flex items-center text-sm"
            >
              <Download className="w-4 h-4 mr-1" />
              Export CSV
            </button>
            
            <button
              onClick={() => setShowReportGenerator(true)}
              disabled={selectedResultIds.length === 0}
              className="px-3 py-1 bg-blue-600 text-white rounded-md hover:bg-blue-700 flex items-center text-sm disabled:opacity-50"
            >
              <FileText className="w-4 h-4 mr-1" />
              Generate Report ({selectedResultIds.length})
            </button>
          </>
        )}
      </div>
    </div>
  </div>
  
  {/* Results List */}
  <div className="flex-1 overflow-y-auto p-6">
    {results.length > 0 ? (
      <div className="space-y-4">
        <div className="flex items-center space-x-2 text-sm text-gray-600 dark:text-gray-400">
          <input
            type="checkbox"
            checked={selectedResultIds.length === results.length}
            onChange={(e) => {
              if (e.target.checked) {
                setSelectedResultIds(results.map(r => r.id));
              } else {
                setSelectedResultIds([]);
              }
            }}
            className="h-4 w-4 text-blue-600 rounded"
          />
          <span>Select all</span>
        </div>
        
        {results.map(person => (
          <div key={person.id} className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border p-4 hover:shadow-md transition-shadow">
            <div className="flex items-start justify-between">
              <div className="flex items-start space-x-3">
                <input
                  type="checkbox"
                  checked={selectedResultIds.includes(person.id)}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setSelectedResultIds([...selectedResultIds, person.id]);
                    } else {
                      setSelectedResultIds(selectedResultIds.filter(id => id !== person.id));
                    }
                  }}
                  className="h-4 w-4 text-blue-600 rounded mt-1"
                />
                
                <div>
                  <h4 className="font-semibold text-gray-900 dark:text-gray-100">
                    {getFullName(person)}
                    {person.date_of_birth && (
                      <span className="text-gray-500 dark:text-slate-400 font-normal text-sm ml-2">
                        ({new Date().getFullYear() - new Date(person.date_of_birth).getFullYear()} years old)
                      </span>
                    )}
                  </h4>
                  
                  {person.aliases && person.aliases.length > 0 && (
                    <p className="text-sm text-gray-600 dark:text-gray-400">AKA: {person.aliases.join(', ')}</p>
                  )}
                  
                  <div className="mt-2 flex flex-wrap gap-2">
                    {person.category && (
                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300">
                        <Tag className="w-3 h-3 mr-1" />
                        {person.category}
                      </span>
                    )}
                    
                    {person.status && (
                      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs ${
                        person.status === 'Open' ? 'bg-green-100 text-green-800' :
                        person.status === 'Being Investigated' ? 'bg-yellow-100 text-yellow-800' :
                        'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
                      }`}>
                        {person.status}
                      </span>
                    )}
                    
                    {person.case_name && (
                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-purple-100 text-purple-800">
                        <Briefcase className="w-3 h-3 mr-1" />
                        {person.case_name}
                      </span>
                    )}
                    
                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300">
                      <Network className="w-3 h-3 mr-1" />
                      {person.connections?.length || 0} connections
                    </span>
                    
                    {person.locations && person.locations.length > 0 && (
                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300">
                        <MapPin className="w-3 h-3 mr-1" />
                        {person.locations.length} locations
                      </span>
                    )}
                    
                    {person.osint_data && person.osint_data.length > 0 && (
                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300">
                        <Database className="w-3 h-3 mr-1" />
                        {person.osint_data.length} OSINT
                      </span>
                    )}
                  </div>
                  
                  <p className="text-xs text-gray-500 dark:text-slate-400 mt-2">
                    Updated {new Date(person.updated_at || person.created_at).toLocaleDateString()}
                  </p>
                </div>
              </div>
              
              <button
                onClick={() => onSelectPerson(person)}
                className="px-3 py-1 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm"
              >
                View Details
              </button>
            </div>
          </div>
        ))}
      </div>
    ) : (
      <div className="text-center py-12">
        <Search className="w-12 h-12 text-gray-400 dark:text-slate-500 mx-auto mb-4" />
        <p className="text-gray-500 dark:text-gray-500 dark:text-gray-400">
          {totalResults === 0 && searchParams.searchText ? 
            'No results found. Try adjusting your search criteria.' : 
            'Use the filters on the left to search for people.'}
        </p>
      </div>
    )}
  </div>
</div>
  );
};

export default SearchResults;
