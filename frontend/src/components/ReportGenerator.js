import React, { useState, useEffect } from 'react';
import { FileText, Download, Loader2, X } from 'lucide-react';
import { peopleAPI, casesAPI, todosAPI, businessesAPI, locationsAPI } from '../utils/api';
import { downloadMarkdown, downloadWord } from '../utils/reportGenerators';
import ReportOptions from './reports/ReportOptions';
import ReportPreview from './reports/ReportPreview';

const DEFAULT_OPTIONS = {
  includeSummary: true,
  includePeople: true,
  includeConnections: true,
  includeTimeline: true,
  includeLocations: true,
  includeOsintData: true,
  includeTodos: true,
  includeAuditLog: false,
  includeCharts: true,
  reportType: 'comprehensive',
  dateRange: 'all',
};

const ReportGenerator = ({ caseId = null, personId = null, customPeopleIds = null, onClose }) => {
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [reportOptions, setReportOptions] = useState(DEFAULT_OPTIONS);
  const [data, setData] = useState({
    cases: [], people: [], businesses: [], locations: [], todos: [],
    selectedCase: null, selectedPerson: null,
  });

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [caseId, personId]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [casesData, peopleRaw, businessesData, locationsData, todosData] = await Promise.all([
        casesAPI.getAll(),
        peopleAPI.getAll({ limit: 10000 }),
        businessesAPI.getAll(),
        locationsAPI.getAll(),
        todosAPI.getAll(),
      ]);

      // peopleAPI.getAll returns { data, meta } due to returnMeta: true
      const peopleData = peopleRaw?.data ?? peopleRaw ?? [];

      let filteredPeople = peopleData;
      let selectedCase = null;
      let selectedPerson = null;

      if (customPeopleIds?.length > 0) {
        filteredPeople = peopleData.filter(p => customPeopleIds.includes(p.id));
      } else if (caseId) {
        selectedCase = casesData.find(c => c.id === caseId) ?? null;
        filteredPeople = peopleData.filter(p => p.case_name === selectedCase?.case_name);
      } else if (personId) {
        selectedPerson = peopleData.find(p => p.id === personId) ?? null;
        if (selectedPerson?.case_name) {
          selectedCase = casesData.find(c => c.case_name === selectedPerson.case_name) ?? null;
          filteredPeople = peopleData.filter(p => p.case_name === selectedPerson.case_name);
        }
      }

      setData({
        cases: casesData, people: filteredPeople,
        businesses: businessesData, locations: locationsData,
        todos: todosData, selectedCase, selectedPerson,
      });
    } catch (error) {
      console.error('Error fetching report data:', error);
      alert('Failed to fetch data for report');
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadMarkdown = async () => {
    setGenerating(true);
    try {
      downloadMarkdown(data, reportOptions);
    } catch (error) {
      console.error('Error generating Markdown report:', error);
      alert('Failed to generate Markdown report: ' + error.message);
    } finally {
      setGenerating(false);
    }
  };

  const handleDownloadWord = async () => {
    setGenerating(true);
    try {
      await downloadWord(data, reportOptions);
    } catch (error) {
      console.error('Error generating Word report:', error);
      alert('Failed to generate Word report: ' + error.message);
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">

        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 dark:border-slate-700 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <FileText className="w-5 h-5 text-blue-600" />
            <h2 className="text-xl font-bold text-gray-900 dark:text-slate-100">Generate Investigation Report</h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:text-slate-500 dark:hover:text-slate-300 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        {loading ? (
          <div className="flex-1 flex items-center justify-center gap-2 text-gray-500 dark:text-slate-400">
            <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
            <span>Loading data…</span>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto p-6">
            <div className="grid grid-cols-2 gap-8">
              <ReportOptions reportOptions={reportOptions} onChange={setReportOptions} />
              <ReportPreview data={data} reportOptions={reportOptions} />
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 dark:border-slate-700 flex items-center justify-end gap-3 shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-gray-700 dark:text-slate-300 bg-gray-100 dark:bg-slate-700 rounded-md hover:bg-gray-200 dark:hover:bg-slate-600 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleDownloadMarkdown}
            disabled={generating || loading}
            className="px-4 py-2 text-sm bg-white dark:bg-slate-700 border border-gray-300 dark:border-slate-600 text-gray-700 dark:text-slate-300 rounded-md hover:bg-gray-50 dark:hover:bg-slate-600 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            Download .md
          </button>
          <button
            onClick={handleDownloadWord}
            disabled={generating || loading}
            className="px-4 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            Download .docx
          </button>
        </div>

      </div>
    </div>
  );
};

export default ReportGenerator;
