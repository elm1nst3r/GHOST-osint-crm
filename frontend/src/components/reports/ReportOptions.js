import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Settings, FileText, Users, Building2, Network, MapPin, Shield, Check } from 'lucide-react';
import { REPORT_TYPE_PRESETS, matchesPreset } from '../../utils/reportGenerators';
import { formatPersonName } from '../../utils/personName';

const ReportOptions = ({
  reportOptions,
  onChange,
  scope = { kind: 'all', id: null },
  onScopeChange = () => {},
  cases = [],
  people = [],
  scopeLocked = false,
}) => {
  const { t } = useTranslation();
  const set = (key, value) => onChange({ ...reportOptions, [key]: value });

  // Choosing a type seeds the section checkboxes rather than silently
  // overriding them at generation time, which is what made the checkboxes
  // inert for every type except Comprehensive (issue #77).
  const setReportType = (reportType) => {
    const preset = REPORT_TYPE_PRESETS[reportType];
    onChange({ ...reportOptions, reportType, ...(preset || {}) });
  };

  // Only sections a generator actually produces. `includeTimeline` and
  // `includeAuditLog` used to be listed here but nothing ever read them, so
  // they were switches wired to nothing — removed rather than left lying.
  const SECTION_TOGGLES = useMemo(() => [
    { key: 'includeSummary',     label: t('reportOptions.sections.executiveSummary'),   icon: FileText  },
    { key: 'includePeople',      label: t('reportOptions.sections.peopleProfiles'),     icon: Users     },
    { key: 'includeBusinesses',  label: t('reportOptions.sections.businesses'),         icon: Building2 },
    { key: 'includeConnections', label: t('reportOptions.sections.connectionsNetwork'), icon: Network   },
    { key: 'includeLocations',   label: t('reportOptions.sections.locations'),          icon: MapPin    },
    { key: 'includeOsintData',   label: t('reportOptions.sections.osintData'),          icon: Shield    },
    { key: 'includeTodos',       label: t('reportOptions.sections.tasksTodos'),         icon: Check     },
    { key: 'includeCharts',      label: t('reportOptions.sections.chartsAnalytics'),    icon: FileText  },
  ], [t]);

  const isCustom = !matchesPreset(reportOptions);
  const selectClass = 'w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-700 text-gray-900 dark:text-slate-100 text-sm';

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
        <select value={reportOptions.reportType} onChange={e => setReportType(e.target.value)} className={selectClass}>
          <option value="comprehensive">{t('reportOptions.typeComprehensive')}</option>
          <option value="summary">{t('reportOptions.typeSummary')}</option>
          <option value="person-profile">{t('reportOptions.typePersonProfile')}</option>
        </select>
        <p className="text-xs text-gray-500 dark:text-slate-400 mt-1">{t('reportOptions.reportTypeHint')}</p>
      </div>

      {/* Scope — selectable, not dictated by where the dialog was opened from */}
      <div className="mb-5">
        <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1.5">
          {t('reportOptions.scopeLabel')}
        </label>
        {scopeLocked ? (
          <p className="text-sm text-gray-600 dark:text-slate-400">{t('reportOptions.scopeLockedSelection')}</p>
        ) : (
          <>
            <select
              value={scope.kind}
              onChange={e => onScopeChange({ kind: e.target.value, id: null })}
              className={selectClass}
            >
              <option value="all">{t('reportOptions.scopeAll')}</option>
              <option value="case">{t('reportOptions.scopeCase')}</option>
              <option value="person">{t('reportOptions.scopePerson')}</option>
            </select>

            {scope.kind === 'case' && (
              <select
                value={scope.id || ''}
                onChange={e => onScopeChange({ kind: 'case', id: e.target.value ? Number(e.target.value) : null })}
                className={`${selectClass} mt-2`}
              >
                <option value="">{t('reportOptions.scopeSelectCase')}</option>
                {cases.map(c => <option key={c.id} value={c.id}>{c.case_name}</option>)}
              </select>
            )}

            {scope.kind === 'person' && (
              <select
                value={scope.id || ''}
                onChange={e => onScopeChange({ kind: 'person', id: e.target.value ? Number(e.target.value) : null })}
                className={`${selectClass} mt-2`}
              >
                <option value="">{t('reportOptions.scopeSelectPerson')}</option>
                {people.map(p => <option key={p.id} value={p.id}>{formatPersonName(p)}</option>)}
              </select>
            )}

            {/* A person-profile report with no person selected silently becomes
                a whole-dataset report, so say so rather than letting it happen. */}
            {reportOptions.reportType === 'person-profile' && !(scope.kind === 'person' && scope.id) && (
              <p className="text-xs text-amber-700 dark:text-amber-400 mt-1.5">{t('reportOptions.personProfileNeedsPerson')}</p>
            )}
          </>
        )}
      </div>

      <div className="mb-5">
        <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1.5">
          {t('reportOptions.dateRangeLabel')}
        </label>
        <select value={reportOptions.dateRange} onChange={e => set('dateRange', e.target.value)} className={selectClass}>
          <option value="all">{t('reportOptions.dateAllTime')}</option>
          <option value="last-week">{t('reportOptions.dateLastWeek')}</option>
          <option value="last-month">{t('reportOptions.dateLastMonth')}</option>
          <option value="last-year">{t('reportOptions.dateLastYear')}</option>
        </select>
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <p className="text-sm font-medium text-gray-700 dark:text-slate-300">{t('reportOptions.includeInReport')}</p>
          {isCustom && (
            <button
              type="button"
              onClick={() => setReportType(reportOptions.reportType)}
              className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
            >
              {t('reportOptions.resetToType')}
            </button>
          )}
        </div>
        <div className="space-y-2.5">
          {SECTION_TOGGLES.map(({ key, label, icon: Icon }) => (
            <label key={key} className="flex items-center gap-3 cursor-pointer group">
              <input
                type="checkbox"
                checked={!!reportOptions[key]}
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
