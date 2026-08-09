// File: frontend/src/components/ImportToolsModal.js
//
// Bulk import for OSINT tools: paste or upload a CSV/TSV/JSON list.
//
// Deliberately a two-step flow — parse and preview, then commit. Tool lists
// come from other people's spreadsheets with unpredictable columns, so seeing
// what will be created (and what will be skipped as a duplicate) before
// anything is written is worth the extra click. Existing bulk entry elsewhere
// in the app imports first and reports afterwards via an alert; this doesn't.

import React, { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { X, Upload, FileText, AlertTriangle, Check } from 'lucide-react';
import { toolsAPI } from '../utils/api';
import { useData } from '../contexts/DataContext';
import { parseToolImport, markDuplicates } from '../utils/toolImport';

const ImportToolsModal = ({ onClose }) => {
  const { t } = useTranslation();
  const { tools: existingTools, fetchTools } = useData();
  const fileRef = useRef(null);

  const [text, setText] = useState('');
  const [parsed, setParsed] = useState(null);
  const [mode, setMode] = useState('skip');
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const handleFile = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => { setText(e.target.result); setParsed(null); setResult(null); };
    reader.readAsText(file);
    event.target.value = '';
  };

  const preview = () => {
    setError(null);
    setResult(null);
    const { tools, errors, format } = parseToolImport(text);
    setParsed({ tools: markDuplicates(tools, existingTools || []), errors, format });
  };

  const runImport = async () => {
    if (!parsed) return;
    // Rows already present are dropped client-side when skipping, so the
    // counts in the preview match what the server is asked to do.
    const payload = parsed.tools
      .filter((tool) => !tool.duplicateInFile)
      .filter((tool) => mode === 'update' || !tool.duplicateOfExisting)
      .map(({ duplicateOfExisting, duplicateInFile, ...tool }) => tool);

    if (payload.length === 0) { setError('nothing'); return; }

    setImporting(true);
    setError(null);
    try {
      const res = await toolsAPI.bulkImport({ tools: payload, mode });
      setResult(res);
      await fetchTools();
    } catch (err) {
      setError(err.message || 'failed');
    } finally {
      setImporting(false);
    }
  };

  const newCount = parsed?.tools.filter((x) => !x.duplicateOfExisting && !x.duplicateInFile).length || 0;
  const existingCount = parsed?.tools.filter((x) => x.duplicateOfExisting).length || 0;
  const dupeInFileCount = parsed?.tools.filter((x) => x.duplicateInFile).length || 0;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl w-full max-w-3xl max-h-[90vh] flex flex-col">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-slate-700 flex items-center justify-between shrink-0">
          <h2 className="text-lg font-semibold flex items-center gap-2 text-gray-900 dark:text-slate-100">
            <Upload className="w-5 h-5" />
            {t('toolImport.title')}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-slate-300">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {!result && (
            <>
              <p className="text-sm text-gray-600 dark:text-slate-400">{t('toolImport.description')}</p>

              <div className="flex flex-wrap items-center gap-3">
                <button
                  onClick={() => fileRef.current?.click()}
                  className="px-3 py-2 text-sm rounded-md border border-gray-300 dark:border-slate-600 text-gray-700 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-700 flex items-center gap-2"
                >
                  <FileText className="w-4 h-4" />
                  {t('toolImport.chooseFile')}
                </button>
                <input ref={fileRef} type="file" accept=".csv,.tsv,.json,.txt" onChange={handleFile} className="hidden" />
                <span className="text-xs text-gray-500 dark:text-slate-400">{t('toolImport.orPaste')}</span>
              </div>

              <textarea
                value={text}
                onChange={(e) => { setText(e.target.value); setParsed(null); }}
                rows={8}
                spellCheck={false}
                placeholder={t('toolImport.placeholder')}
                className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-700 text-gray-900 dark:text-slate-100 text-sm font-mono"
              />

              <p className="text-xs text-gray-500 dark:text-slate-400">{t('toolImport.columnsHint')}</p>

              {parsed && (
                <div className="space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-sm">
                    <div className="p-3 rounded-md bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800">
                      <div className="font-semibold text-green-800 dark:text-green-300">{newCount}</div>
                      <div className="text-xs text-green-700 dark:text-green-400">{t('toolImport.willBeCreated')}</div>
                    </div>
                    <div className="p-3 rounded-md bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
                      <div className="font-semibold text-amber-800 dark:text-amber-300">{existingCount}</div>
                      <div className="text-xs text-amber-700 dark:text-amber-400">
                        {mode === 'update' ? t('toolImport.willBeUpdated') : t('toolImport.willBeSkipped')}
                      </div>
                    </div>
                    <div className="p-3 rounded-md bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-700">
                      <div className="font-semibold text-gray-800 dark:text-slate-200">{parsed.errors.length + dupeInFileCount}</div>
                      <div className="text-xs text-gray-600 dark:text-slate-400">{t('toolImport.problemRows')}</div>
                    </div>
                  </div>

                  {existingCount > 0 && (
                    <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-slate-300">
                      <input
                        type="checkbox"
                        checked={mode === 'update'}
                        onChange={(e) => setMode(e.target.checked ? 'update' : 'skip')}
                        className="h-4 w-4 text-blue-600 rounded"
                      />
                      {t('toolImport.updateExisting')}
                    </label>
                  )}

                  {parsed.errors.length > 0 && (
                    <div className="p-3 rounded-md bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 max-h-40 overflow-y-auto">
                      <p className="text-sm font-medium text-red-800 dark:text-red-300 flex items-center gap-2 mb-1">
                        <AlertTriangle className="w-4 h-4" />
                        {t('toolImport.rowsSkipped')}
                      </p>
                      <ul className="text-xs text-red-700 dark:text-red-400 space-y-0.5">
                        {parsed.errors.slice(0, 20).map((e, i) => (
                          <li key={i}>{e.row ? t('toolImport.rowPrefix', { row: e.row }) : ''}{e.message}</li>
                        ))}
                        {parsed.errors.length > 20 && <li>{t('toolImport.andMore', { count: parsed.errors.length - 20 })}</li>}
                      </ul>
                    </div>
                  )}

                  {parsed.tools.length > 0 && (
                    <div className="border border-gray-200 dark:border-slate-700 rounded-md overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead className="bg-gray-50 dark:bg-slate-900 text-left">
                          <tr>
                            <th className="px-3 py-2 font-medium">{t('toolImport.colName')}</th>
                            <th className="px-3 py-2 font-medium">{t('toolImport.colLink')}</th>
                            <th className="px-3 py-2 font-medium">{t('toolImport.colCategory')}</th>
                            <th className="px-3 py-2 font-medium">{t('toolImport.colStatus2')}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {parsed.tools.slice(0, 10).map((tool, i) => (
                            <tr key={i} className="border-t border-gray-100 dark:border-slate-700">
                              <td className="px-3 py-1.5">{tool.name}</td>
                              <td className="px-3 py-1.5 truncate max-w-[14rem] text-gray-500 dark:text-slate-400">{tool.link}</td>
                              <td className="px-3 py-1.5 text-gray-500 dark:text-slate-400">{tool.category}</td>
                              <td className="px-3 py-1.5 text-xs">
                                {tool.duplicateInFile
                                  ? <span className="text-gray-500">{t('toolImport.dupInFile')}</span>
                                  : tool.duplicateOfExisting
                                    ? <span className="text-amber-700 dark:text-amber-400">{mode === 'update' ? t('toolImport.update') : t('toolImport.skip')}</span>
                                    : <span className="text-green-700 dark:text-green-400">{t('toolImport.create')}</span>}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      {parsed.tools.length > 10 && (
                        <p className="px-3 py-2 text-xs text-gray-500 dark:text-slate-400">
                          {t('toolImport.previewTruncated', { count: parsed.tools.length - 10 })}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              )}

              {error && (
                <p className="text-sm text-red-600 dark:text-red-400">
                  {error === 'nothing' ? t('toolImport.nothingToImport') : t('toolImport.importFailed')}
                </p>
              )}
            </>
          )}

          {result && (
            <div className="space-y-3">
              <p className="text-sm font-medium text-green-700 dark:text-green-400 flex items-center gap-2">
                <Check className="w-4 h-4" />
                {t('toolImport.done')}
              </p>
              <ul className="text-sm text-gray-700 dark:text-slate-300 space-y-1">
                <li>{t('toolImport.resultCreated', { count: result.created })}</li>
                <li>{t('toolImport.resultUpdated', { count: result.updated })}</li>
                <li>{t('toolImport.resultSkipped', { count: result.skipped })}</li>
              </ul>
              {result.errors?.length > 0 && (
                <div className="p-3 rounded-md bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 max-h-40 overflow-y-auto">
                  <ul className="text-xs text-red-700 dark:text-red-400 space-y-0.5">
                    {result.errors.map((e, i) => <li key={i}>{e.name}: {e.message}</li>)}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t border-gray-200 dark:border-slate-700 flex items-center justify-end gap-3 shrink-0">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-700 dark:text-slate-300 bg-gray-100 dark:bg-slate-700 rounded-md hover:bg-gray-200 dark:hover:bg-slate-600">
            {result ? t('common.close') : t('common.cancel')}
          </button>
          {!result && !parsed && (
            <button onClick={preview} disabled={!text.trim()} className="px-4 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50">
              {t('toolImport.preview')}
            </button>
          )}
          {!result && parsed && (
            <button onClick={runImport} disabled={importing} className="px-4 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50">
              {importing ? t('toolImport.importing') : t('toolImport.importCount', { count: newCount + (mode === 'update' ? existingCount : 0) })}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default ImportToolsModal;
