import React from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronRight } from 'lucide-react';
import { getFullName, resolveOptions, subjectsOf } from '../../utils/reportGenerators';

const StatRow = ({ label, value }) => (
  <div className="flex items-center justify-between py-1.5 border-b border-gray-100 dark:border-slate-700 last:border-0">
    <span className="text-sm font-medium text-gray-700 dark:text-slate-300">{label}</span>
    <span className="text-sm text-gray-600 dark:text-slate-400">{value}</span>
  </div>
);

const SectionEntry = ({ label }) => (
  <div className="flex items-center text-sm text-gray-600 dark:text-slate-400">
    <ChevronRight className="w-4 h-4 mr-1 text-gray-400 dark:text-slate-500 shrink-0" />
    {label}
  </div>
);

const ReportPreview = ({ data, reportOptions }) => {
  const { t } = useTranslation();
  const opts = resolveOptions(reportOptions);
  const { people, selectedCase, selectedPerson } = data;
  // Mirror what the generators will actually emit, so the preview counts match
  // the downloaded file for a person-profile report.
  const subjects = subjectsOf(people, opts, selectedPerson);
  const totalConnections = subjects.reduce((sum, p) => sum + (p.connections?.length || 0), 0);

  const scopeLabel = selectedCase
    ? t('reportPreview.caseScopeLabel', { name: selectedCase.case_name })
    : selectedPerson
      ? t('reportPreview.personScopeLabel', { name: getFullName(selectedPerson) })
      : t('reportPreview.allData');

  return (
    <div>
      <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-slate-100">{t('reportPreview.title')}</h3>

      {/* Stats */}
      <div className="bg-gray-50 dark:bg-slate-900 rounded-lg p-4 mb-5">
        <StatRow label={t('reportPreview.reportScope')} value={scopeLabel} />
        <StatRow label={t('reportPreview.peopleIncluded')} value={subjects.length} />
        <StatRow label={t('reportPreview.totalConnections')} value={totalConnections} />
        <StatRow label={t('reportPreview.exportFormats')} value={t('reportPreview.exportFormatsValue')} />
      </div>

      {/* Structure outline */}
      <div>
        <p className="text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">{t('reportPreview.reportStructure')}</p>
        <div className="space-y-1.5">
          <SectionEntry label={t('reportPreview.coverPage')} />
          {opts.includeSummary    && <SectionEntry label={t('reportOptions.sections.executiveSummary')} />}
          {opts.includePeople     && <SectionEntry label={t('reportPreview.peopleProfilesCount', { count: subjects.length })} />}
          {opts.includeConnections && <SectionEntry label={t('reportPreview.connectionsAnalysis')} />}
          {opts.includeLocations  && <SectionEntry label={t('reportPreview.locationData')} />}
          {opts.includeOsintData  && <SectionEntry label={t('reportPreview.osintIntelligence')} />}
          {opts.includeTodos      && <SectionEntry label={t('reportPreview.investigationTasks')} />}
          {opts.includeAuditLog   && <SectionEntry label={t('reportPreview.activityTimeline')} />}
          {opts.includeCharts     && <SectionEntry label={t('reportPreview.statisticalAnalysis')} />}
          <SectionEntry label={t('reportPreview.reportInformation')} />
        </div>
      </div>

      <div className="mt-5 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
        <p className="text-sm text-blue-700 dark:text-blue-300">
          <strong>{t('reportPreview.twoFormatsStrong')}</strong>{t('reportPreview.twoFormatsRest')}
        </p>
      </div>
    </div>
  );
};

export default ReportPreview;
