import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Settings, FileText, Users, Network, Clock, MapPin, Shield, Check, AlertCircle } from 'lucide-react';

const ReportOptions = ({ reportOptions, onChange }) => {
  const { t } = useTranslation();
  const set = (key, value) => onChange({ ...reportOptions, [key]: value });

  const SECTION_TOGGLES = useMemo(() => [
    { key: 'includeSummary',     label: t('reportOptions.sections.executiveSummary'),   icon: FileText    },
    { key: 'includePeople',      label: t('reportOptions.sections.peopleProfiles'),     icon: Users       },
    { key: 'includeConnections', label: t('reportOptions.sections.connectionsNetwork'), icon: Network     },
    { key: 'includeTimeline',    label: t('reportOptions.sections.timeline'),           icon: Clock       },
    { key: 'includeLocations',   label: t('reportOptions.sections.locations'),          icon: MapPin      },
    { key: 'includeOsintData',   label: t('reportOptions.sections.osintData'),          icon: Shield      },
    { key: 'includeTodos',       label: t('reportOptions.sections.tasksTodos'),         icon: Check       },
    { key: 'includeAuditLog',    label: t('reportOptions.sections.auditTrail'),         icon: AlertCircle },
    { key: 'includeCharts',      label: t('reportOptions.sections.chartsAnalytics'),    icon: FileText    },
  ], [t]);

  return (
    <div>
      <h3 className="text-lg font-semibold mb-4 flex items-center text-gray-900 dark:text-slate-100">
        <Settings className="w-5 h-5 mr-2" />
        {t('reportOptions.title')}
      </h3>

      <div className="mb-5">
        <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1.5">
          {t('reportOptions.reportTypeLabel')}
        </label>
        <select
          value={reportOptions.reportType}
          onChange={e => set('reportType', e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-700 text-gray-900 dark:text-slate-100 text-sm"
        >
          <option value="comprehensive">{t('reportOptions.typeComprehensive')}</option>
          <option value="summary">{t('reportOptions.typeSummary')}</option>
          <option value="person-profile">{t('reportOptions.typePersonProfile')}</option>
        </select>
      </div>

      <div className="mb-5">
        <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1.5">
          {t('reportOptions.dateRangeLabel')}
        </label>
        <select
          value={reportOptions.dateRange}
          onChange={e => set('dateRange', e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-700 text-gray-900 dark:text-slate-100 text-sm"
        >
          <option value="all">{t('reportOptions.dateAllTime')}</option>
          <option value="last-week">{t('reportOptions.dateLastWeek')}</option>
          <option value="last-month">{t('reportOptions.dateLastMonth')}</option>
          <option value="last-year">{t('reportOptions.dateLastYear')}</option>
        </select>
      </div>

      <div>
        <p className="text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">{t('reportOptions.includeInReport')}</p>
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
