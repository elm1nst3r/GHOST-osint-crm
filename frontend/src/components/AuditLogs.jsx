import { useState, useEffect, useEffectEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { FileText, Filter, User } from 'lucide-react';
import { auditLogsAPI } from '../utils/authAPI';
import { formatDateTime } from '../utils/format';

// Old and new values are stored as text, often JSON (a whole address list,
// or a full record on create/delete). Pretty-printed and wrapped inside the
// cell; long ones collapsed to a few lines with "Show all" (issue #107).
const formatValue = (value) => {
  if (value === null || value === undefined || value === '') return '-';
  try {
    const parsed = JSON.parse(value);
    return typeof parsed === 'object' && parsed !== null ? JSON.stringify(parsed, null, 2) : String(value);
  } catch {
    return String(value);
  }
};

const COLLAPSED_LINES = 6;
const isLong = (text) => text.split('\n').length > COLLAPSED_LINES || text.length > 400;

function ChangeValue({ label, value, toneClass }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const text = formatValue(value);
  const long = isLong(text);
  return (
    <div className="text-xs">
      <span className="font-medium">{label}</span>
      <pre dir="ltr" className={`mt-0.5 font-mono whitespace-pre-wrap wrap-break-word ${toneClass} ${long && !open ? 'line-clamp-6' : ''}`}>{text}</pre>
      {long && (
        <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} className="mt-0.5 text-blue-600 dark:text-blue-400 hover:underline">
          {open ? t('settings.auditLogs.showLess') : t('settings.auditLogs.showAll')}
        </button>
      )}
    </div>
  );
}

const AuditLogs = () => {
  const { t } = useTranslation();
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

  const getActionColor = (action) => {
    switch (action) {
      case 'create':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'update':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
      case 'delete':
        return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
      case 'view':
      case 'download':
        return 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
    }
  };

  // Reload whenever the filters change; the loaders read the latest state.
  const reload = useEffectEvent(() => {
    loadLogs();
    loadStats();
  });
  useEffect(() => {
    reload();
  }, [filters]);

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
          <FileText className="h-6 w-6" />
          {t('settings.tabs.auditLogs')}
        </h1>
        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
          {t('settings.auditLogs.subtitle')}
        </p>
      </div>

      {stats && (
        <div data-volatile className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-4">
            <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">
              {t('settings.auditLogs.recentActivity')}
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

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-4">
            <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">
              {t('settings.auditLogs.byEntityType')}
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

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-4">
            <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">
              {t('settings.auditLogs.topUsers')}
            </h3>
            <div className="space-y-1">
              {stats.byUser.slice(0, 3).map((item) => (
                <div key={item.id} className="flex justify-between text-sm">
                  <span className="text-gray-700 dark:text-gray-300">{item.username || t('settings.auditLogs.systemUser')}</span>
                  <span className="font-medium text-gray-900 dark:text-white">{item.count}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm mb-6 p-4">
        <div className="flex items-center gap-2 mb-4">
          <Filter className="h-5 w-5 text-gray-500 dark:text-gray-400" />
          <h2 className="font-medium text-gray-900 dark:text-white">{t('relationshipManager.filters')}</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {t('settings.auditLogs.entityTypeLabel')}
            </label>
            <select
              value={filters.entity_type}
              onChange={(e) => handleFilterChange('entity_type', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white text-sm"
            >
              <option value="">{t('settings.auditLogs.allOption')}</option>
              <option value="person">{t('settings.auditLogs.entityPerson')}</option>
              <option value="tool">{t('settings.auditLogs.entityTool')}</option>
              <option value="case">{t('settings.auditLogs.entityCase')}</option>
              <option value="user">{t('settings.auditLogs.entityUser')}</option>
              <option value="file">{t('settings.auditLogs.entityFile')}</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {t('settings.auditLogs.actionLabel')}
            </label>
            <select
              value={filters.action}
              onChange={(e) => handleFilterChange('action', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white text-sm"
            >
              <option value="">{t('settings.auditLogs.allOption')}</option>
              <option value="create">{t('settings.auditLogs.actionCreate')}</option>
              <option value="update">{t('settings.auditLogs.actionUpdate')}</option>
              <option value="delete">{t('settings.auditLogs.actionDelete')}</option>
              <option value="view">{t('settings.auditLogs.actionView')}</option>
              <option value="download">{t('settings.auditLogs.actionDownload')}</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {t('settings.auditLogs.startDateLabel')}
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
              {t('settings.auditLogs.endDateLabel')}
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
              {t('settings.auditLogs.limitLabel')}
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
        <div className="text-center py-8 text-gray-600 dark:text-gray-400">{t('settings.auditLogs.loadingLogs')}</div>
      ) : error ? (
        <div className="text-center py-8 text-red-600 dark:text-red-400">{error}</div>
      ) : (
        <>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-900">
                <tr>
                  <th className="px-4 py-3 text-start text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    {t('settings.auditLogs.columnTimestamp')}
                  </th>
                  <th className="px-4 py-3 text-start text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    {t('settings.users.columnUser')}
                  </th>
                  <th className="px-4 py-3 text-start text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    {t('settings.auditLogs.actionLabel')}
                  </th>
                  <th className="px-4 py-3 text-start text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    {t('settings.auditLogs.columnEntity')}
                  </th>
                  <th className="px-4 py-3 text-start text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    {t('settings.auditLogs.columnField')}
                  </th>
                  <th className="px-4 py-3 text-start text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    {t('settings.auditLogs.columnChanges')}
                  </th>
                </tr>
              </thead>
              <tbody data-volatile className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {logs.map((log) => (
                  <tr key={log.id} className="align-top hover:bg-gray-50 dark:hover:bg-gray-700">
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                      {formatDateTime(log.created_at)}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm">
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4 text-gray-400 dark:text-slate-500" />
                        <span className="text-gray-900 dark:text-white">
                          {log.username || t('settings.auditLogs.systemUser')}
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
                    <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400 min-w-64 max-w-xl">
                      {log.field_name && (
                        <div className="space-y-2">
                          <ChangeValue label={t('settings.auditLogs.oldValueLabel')} value={log.old_value} toneClass="text-red-600 dark:text-red-400" />
                          <ChangeValue label={t('settings.auditLogs.newValueLabel')} value={log.new_value} toneClass="text-green-600 dark:text-green-400" />
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
              {t('settings.auditLogs.showingEntries', {
                from: filters.offset + 1,
                to: Math.min(filters.offset + filters.limit, total),
                total,
              })}
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => handlePageChange(Math.max(0, filters.offset - filters.limit))}
                disabled={filters.offset === 0}
                className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {t('settings.auditLogs.previous')}
              </button>
              <button
                onClick={() => handlePageChange(filters.offset + filters.limit)}
                disabled={filters.offset + filters.limit >= total}
                className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {t('settings.auditLogs.next')}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default AuditLogs;
