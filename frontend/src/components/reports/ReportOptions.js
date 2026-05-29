import React from 'react';
import { Settings, FileText, Users, Network, Clock, MapPin, Shield, Check, AlertCircle } from 'lucide-react';

const SECTION_TOGGLES = [
  { key: 'includeSummary',     label: 'Executive Summary',    icon: FileText    },
  { key: 'includePeople',      label: 'People Profiles',      icon: Users       },
  { key: 'includeConnections', label: 'Connections Network',  icon: Network     },
  { key: 'includeTimeline',    label: 'Timeline',             icon: Clock       },
  { key: 'includeLocations',   label: 'Locations',            icon: MapPin      },
  { key: 'includeOsintData',   label: 'OSINT Data',           icon: Shield      },
  { key: 'includeTodos',       label: 'Tasks / Todos',        icon: Check       },
  { key: 'includeAuditLog',    label: 'Audit Trail',          icon: AlertCircle },
  { key: 'includeCharts',      label: 'Charts & Analytics',   icon: FileText    },
];

const ReportOptions = ({ reportOptions, onChange }) => {
  const set = (key, value) => onChange({ ...reportOptions, [key]: value });

  return (
    <div>
      <h3 className="text-lg font-semibold mb-4 flex items-center text-gray-900 dark:text-slate-100">
        <Settings className="w-5 h-5 mr-2" />
        Report Options
      </h3>

      <div className="mb-5">
        <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1.5">
          Report Type
        </label>
        <select
          value={reportOptions.reportType}
          onChange={e => set('reportType', e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-700 text-gray-900 dark:text-slate-100 text-sm"
        >
          <option value="comprehensive">Comprehensive Report</option>
          <option value="summary">Executive Summary</option>
          <option value="person-profile">Person Profile</option>
        </select>
      </div>

      <div className="mb-5">
        <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1.5">
          Date Range
        </label>
        <select
          value={reportOptions.dateRange}
          onChange={e => set('dateRange', e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-700 text-gray-900 dark:text-slate-100 text-sm"
        >
          <option value="all">All Time</option>
          <option value="last-week">Last Week</option>
          <option value="last-month">Last Month</option>
          <option value="last-year">Last Year</option>
        </select>
      </div>

      <div>
        <p className="text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">Include in Report:</p>
        <div className="space-y-2.5">
          {SECTION_TOGGLES.map(({ key, label, icon: Icon }) => (
            <label key={key} className="flex items-center gap-3 cursor-pointer group">
              <input
                type="checkbox"
                checked={reportOptions[key]}
                onChange={e => set(key, e.target.checked)}
                className="h-4 w-4 text-blue-600 rounded border-gray-300 dark:border-slate-600"
              />
              <Icon className="w-4 h-4 text-gray-400 dark:text-slate-500 shrink-0" />
              <span className="text-sm text-gray-700 dark:text-slate-300 group-hover:text-gray-900 dark:group-hover:text-slate-100">
                {label}
              </span>
            </label>
          ))}
        </div>
      </div>
    </div>
  );
};

export default ReportOptions;
