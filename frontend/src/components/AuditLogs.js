import React, { useState, useEffect } from 'react';
import { FileText, Filter, Calendar, User, Activity } from 'lucide-react';
import { auditLogsAPI } from '../utils/authAPI';

const AuditLogs = () => {
  const [logs, setLogs] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filters, setFilters] = useState({
    entity_type: '',
    action: '',
    user_id: '',
    start_date: '',
    end_date: '',
    limit: 50,
    offset: 0
  });
  const [total, setTotal] = useState(0);

  useEffect(() => {
    loadLogs();
    loadStats();
  }, [filters]);

  const loadLogs = async () => {
    try {
      setLoading(true);
      const data = await auditLogsAPI.getAll(filters);
      setLogs(data.logs);
      setTotal(data.total);
      setError('');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async () => {
    try {
      const data = await auditLogsAPI.getStats({
        start_date: filters.start_date,
        end_date: filters.end_date
      });
      setStats(data);
    } catch (err) {
      console.error('Failed to load stats:', err);
    }
  };

  const handleFilterChange = (key, value) => {
    setFilters({ ...filters, [key]: value, offset: 0 });
  };

  const handlePageChange = (newOffset) => {
    setFilters({ ...filters, offset: newOffset });
  };

  const formatValue = (value) => {
    if (!value) return '-';
    try {
      const parsed = JSON.parse(value);
      if (typeof parsed === 'object') {
        return JSON.stringify(parsed, null, 2);
      }
      return value;
    } catch {
      return value;
    }
  };

  const getActionColor = (action) => {
    switch (action) {
      case 'create':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'update':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
      case 'delete':
        return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
    }
  };

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
          <FileText className="h-6 w-6" />
          Audit Logs
        </h1>
        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
          Track all changes and activities in the system
        </p>
      </div>

      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
            <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">
              Recent Activity
            </h3>
            <div className="space-y-1">
              {stats.byAction.slice(0, 3).map((item) => (
                <div key={item.action} className="flex justify-between text-sm">
                  <span className="text-gray-700 dark:text-gray-300 capitalize">{item.action}</span>
                  <span className="font-medium text-gray-900 dark:text-white">{item.count}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
            <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">
              By Entity Type
            </h3>
            <div className="space-y-1">
              {stats.byEntityType.slice(0, 3).map((item) => (
                <div key={item.entity_type} className="flex justify-between text-sm">
                  <span className="text-gray-700 dark:text-gray-300 capitalize">{item.entity_type}</span>
                  <span className="font-medium text-gray-900 dark:text-white">{item.count}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
            <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">
              Top Users
            </h3>
            <div className="space-y-1">
              {stats.byUser.slice(0, 3).map((item) => (
                <div key={item.id} className="flex justify-between text-sm">
                  <span className="text-gray-700 dark:text-gray-300">{item.username || 'System'}</span>
                  <span className="font-medium text-gray-900 dark:text-white">{item.count}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow mb-6 p-4">
        <div className="flex items-center gap-2 mb-4">
          <Filter className="h-5 w-5 text-gray-500 dark:text-gray-400" />
          <h2 className="font-medium text-gray-900 dark:text-white">Filters</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Entity Type
            </label>
            <select
              value={filters.entity_type}
              onChange={(e) => handleFilterChange('entity_type', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white text-sm"
            >
              <option value="">All</option>
              <option value="person">Person</option>
              <option value="tool">Tool</option>
              <option value="case">Case</option>
              <option value="user">User</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Action
            </label>
            <select
              value={filters.action}
              onChange={(e) => handleFilterChange('action', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white text-sm"
            >
              <option value="">All</option>
              <option value="create">Create</option>
              <option value="update">Update</option>
              <option value="delete">Delete</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Start Date
            </label>
            <input
              type="date"
              value={filters.start_date}
              onChange={(e) => handleFilterChange('start_date', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white text-sm"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              End Date
            </label>
            <input
              type="date"
              value={filters.end_date}
              onChange={(e) => handleFilterChange('end_date', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white text-sm"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Limit
            </label>
            <select
              value={filters.limit}
              onChange={(e) => handleFilterChange('limit', parseInt(e.target.value))}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white text-sm"
            >
              <option value="25">25</option>
              <option value="50">50</option>
              <option value="100">100</option>
              <option value="200">200</option>
            </select>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-8 text-gray-600 dark:text-gray-400">Loading audit logs...</div>
      ) : error ? (
        <div className="text-center py-8 text-red-600 dark:text-red-400">{error}</div>
      ) : (
        <>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-900">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Timestamp
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    User
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Action
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Entity
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Field
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Changes
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {logs.map((log) => (
                  <tr key={log.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                      {new Date(log.created_at).toLocaleString()}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm">
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4 text-gray-400" />
                        <span className="text-gray-900 dark:text-white">
                          {log.username || 'System'}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getActionColor(log.action)}`}>
                        {log.action}
                      </span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                      {log.entity_type} #{log.entity_id}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                      {log.field_name || '-'}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400 max-w-xs truncate">
                      {log.field_name && (
                        <div className="space-y-1">
                          <div className="text-xs">
                            <span className="font-medium">Old:</span>{' '}
                            <span className="text-red-600 dark:text-red-400">
                              {formatValue(log.old_value)}
                            </span>
                          </div>
                          <div className="text-xs">
                            <span className="font-medium">New:</span>{' '}
                            <span className="text-green-600 dark:text-green-400">
                              {formatValue(log.new_value)}
                            </span>
                          </div>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-4 flex items-center justify-between">
            <div className="text-sm text-gray-700 dark:text-gray-300">
              Showing {filters.offset + 1} to {Math.min(filters.offset + filters.limit, total)} of {total} entries
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => handlePageChange(Math.max(0, filters.offset - filters.limit))}
                disabled={filters.offset === 0}
                className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Previous
              </button>
              <button
                onClick={() => handlePageChange(filters.offset + filters.limit)}
                disabled={filters.offset + filters.limit >= total}
                className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default AuditLogs;
