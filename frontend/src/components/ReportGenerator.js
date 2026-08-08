import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { FileText, Download, Loader2, X } from 'lucide-react';
import { peopleAPI, casesAPI, todosAPI, businessesAPI, locationsAPI, ledgerAPI } from '../utils/api';
import { downloadMarkdown, downloadWord, downloadLedgerMarkdown, downloadLedgerWord, REPORT_TYPE_PRESETS } from '../utils/reportGenerators';
import ReportOptions from './reports/ReportOptions';
import ReportPreview from './reports/ReportPreview';
import LedgerReportPanel from './reports/LedgerReportPanel';

const DEFAULT_OPTIONS = {
  ...REPORT_TYPE_PRESETS.comprehensive,
  reportType: 'comprehensive',
  dateRange: 'all',
};

const ReportGenerator = ({ caseId = null, personId = null, customPeopleIds = null, ledgerEntity = null, onClose }) => {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  // Opened from a person, start on the person-profile type — otherwise the
  // default 'comprehensive' produced a whole-case report with that person's
  // name on the front, which read as "there is no person report" (issue #63).
  const [reportOptions, setReportOptions] = useState(
    personId
      // Apply the preset's sections too, not just the type name — otherwise
      // the dialog opens claiming "Person Profile" while still carrying the
      // comprehensive section set (issue #77).
      ? { ...DEFAULT_OPTIONS, ...REPORT_TYPE_PRESETS['person-profile'], reportType: 'person-profile' }
      : DEFAULT_OPTIONS
  );
  const [ledger, setLedger] = useState(null);
  // Scope used to be dictated entirely by how the dialog was opened, so from
  // the dashboard it was permanently "All data" with no way to narrow it —
  // and picking the Person Profile type did nothing, because there was no
  // person to profile (issue #77). It is now selectable, seeded from the
  // entry point.
  const [scope, setScope] = useState(
    caseId ? { kind: 'case', id: caseId }
      : personId ? { kind: 'person', id: personId }
        : { kind: 'all', id: null }
  );
  const [allCases, setAllCases] = useState([]);
  const [allPeople, setAllPeople] = useState([]);
  const [data, setData] = useState({
    cases: [], people: [], businesses: [], locations: [], todos: [],
    selectedCase: null, selectedPerson: null,
  });

  useEffect(() => {
    if (ledgerEntity) fetchLedger();
    else fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scope.kind, scope.id, ledgerEntity]);

  const fetchLedger = async () => {
    setLoading(true);
    try {
      const data = await ledgerAPI.get(ledgerEntity.type, ledgerEntity.id);
      setLedger(data);
    } catch (error) {
      console.error('Error fetching ledger:', error);
      alert(t('reportGenerator.errorFetchLedger'));
    } finally {
      setLoading(false);
    }
  };

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

      setAllCases(casesData);
      setAllPeople(peopleData);

      let filteredPeople = peopleData;
      let selectedCase = null;
      let selectedPerson = null;

      if (customPeopleIds?.length > 0) {
        filteredPeople = peopleData.filter(p => customPeopleIds.includes(p.id));
      } else if (scope.kind === 'case' && scope.id) {
        selectedCase = casesData.find(c => c.id === scope.id) ?? null;
        filteredPeople = peopleData.filter(p => p.case_name === selectedCase?.case_name);
      } else if (scope.kind === 'person' && scope.id) {
        selectedPerson = peopleData.find(p => p.id === scope.id) ?? null;
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
      alert(t('reportGenerator.errorFetchData'));
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadMarkdown = async () => {
    setGenerating(true);
    try {
      if (ledgerEntity) downloadLedgerMarkdown(ledger);
      else downloadMarkdown(data, reportOptions);
    } catch (error) {
      console.error('Error generating Markdown report:', error);
      alert(t('reportGenerator.errorGenerateMarkdown', { message: error.message }));
    } finally {
      setGenerating(false);
    }
  };

  const handleDownloadWord = async () => {
    setGenerating(true);
    try {
      if (ledgerEntity) await downloadLedgerWord(ledger);
      else await downloadWord(data, reportOptions);
    } catch (error) {
      console.error('Error generating Word report:', error);
      alert(t('reportGenerator.errorGenerateWord', { message: error.message }));
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
            <h2 className="text-xl font-bold text-gray-900 dark:text-slate-100">{ledgerEntity ? t('reportGenerator.ledgerTitle') : t('reportGenerator.investigationTitle')}</h2>
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
            <span>{t('reportGenerator.loadingData')}</span>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto p-6">
            {ledgerEntity ? (
              <LedgerReportPanel ledger={ledger} />
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <ReportOptions
                  reportOptions={reportOptions}
                  onChange={setReportOptions}
                  scope={scope}
                  onScopeChange={setScope}
                  cases={allCases}
                  people={allPeople}
                  scopeLocked={customPeopleIds?.length > 0}
                />
                <ReportPreview data={data} reportOptions={reportOptions} />
              </div>
            )}
          </div>
        )}

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 dark:border-slate-700 flex items-center justify-end gap-3 shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-gray-700 dark:text-slate-300 bg-gray-100 dark:bg-slate-700 rounded-md hover:bg-gray-200 dark:hover:bg-slate-600 transition-colors"
          >
            {t('common.cancel')}
          </button>
          <button
            onClick={handleDownloadMarkdown}
            disabled={generating || loading}
            className="px-4 py-2 text-sm bg-white dark:bg-slate-700 border border-gray-300 dark:border-slate-600 text-gray-700 dark:text-slate-300 rounded-md hover:bg-gray-50 dark:hover:bg-slate-600 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            {t('reportGenerator.downloadMd')}
          </button>
          <button
            onClick={handleDownloadWord}
            disabled={generating || loading}
            className="px-4 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            {t('reportGenerator.downloadDocx')}
          </button>
        </div>

      </div>
    </div>
  );
};

export default ReportGenerator;
