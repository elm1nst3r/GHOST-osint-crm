import React from 'react';
import { ChevronRight } from 'lucide-react';
import { getFullName, resolveOptions } from '../../utils/reportGenerators';

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
  const opts = resolveOptions(reportOptions);
  const { people, selectedCase, selectedPerson } = data;
  const totalConnections = people.reduce((sum, p) => sum + (p.connections?.length || 0), 0);

  const scopeLabel = selectedCase
    ? `Case: ${selectedCase.case_name}`
    : selectedPerson
      ? `Person: ${getFullName(selectedPerson)}`
      : 'All Data';

  return (
    <div>
      <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-slate-100">Report Preview</h3>

      {/* Stats */}
      <div className="bg-gray-50 dark:bg-slate-900 rounded-lg p-4 mb-5">
        <StatRow label="Report Scope" value={scopeLabel} />
        <StatRow label="People Included" value={people.length} />
        <StatRow label="Total Connections" value={totalConnections} />
        <StatRow label="Export Formats" value="Markdown (.md) · Word (.docx)" />
      </div>

      {/* Structure outline */}
      <div>
        <p className="text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">Report Structure:</p>
        <div className="space-y-1.5">
          <SectionEntry label="Cover Page" />
          {opts.includeSummary    && <SectionEntry label="Executive Summary" />}
          {opts.includePeople     && <SectionEntry label={`People Profiles (${people.length} profiles)`} />}
          {opts.includeConnections && <SectionEntry label="Connections Analysis" />}
          {opts.includeLocations  && <SectionEntry label="Location Data" />}
          {opts.includeOsintData  && <SectionEntry label="OSINT Intelligence" />}
          {opts.includeTodos      && <SectionEntry label="Investigation Tasks" />}
          {opts.includeAuditLog   && <SectionEntry label="Activity Timeline" />}
          {opts.includeCharts     && <SectionEntry label="Statistical Analysis" />}
          <SectionEntry label="Report Information" />
        </div>
      </div>

      <div className="mt-5 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
        <p className="text-sm text-blue-700 dark:text-blue-300">
          <strong>Two formats available:</strong> Markdown (.md) includes rich tables and formatting.
          Word (.docx) maximises compatibility with office suites.
        </p>
      </div>
    </div>
  );
};

export default ReportPreview;
