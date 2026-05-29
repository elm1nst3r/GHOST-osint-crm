import React, { useState, useRef } from 'react';
import { Download, Upload, CheckCircle, AlertTriangle } from 'lucide-react';
import { exportAPI, importAPI } from '../../utils/api';

const ImportExportTab = () => {
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [exportSuccess, setExportSuccess] = useState(false);
  const [importSuccess, setImportSuccess] = useState(false);
  const [importPreview, setImportPreview] = useState(null);
  const [showImportPreview, setShowImportPreview] = useState(false);
  const importInputRef = useRef(null);

  const handleExport = async () => {
    try {
      setIsExporting(true);
      setExportSuccess(false);
      await exportAPI.export();
      setExportSuccess(true);
      setTimeout(() => setExportSuccess(false), 3000);
    } catch (error) {
      console.error('Error exporting data:', error);
      alert('Failed to export data: ' + error.message);
    } finally {
      setIsExporting(false);
    }
  };

  const handleImportPreview = async (event) => {
    const file = event.target.files[0];
    if (!file) return;
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      if (!data.version || !data.data) throw new Error('Invalid import file format');
      const counts = {};
      Object.entries(data.data).forEach(([key, arr]) => {
        if (Array.isArray(arr)) counts[key] = arr.length;
      });
      setImportPreview({
        version: data.version,
        exportDate: data.exportDate,
        fileName: file.name,
        fileSize: `${(file.size / 1024).toFixed(1)} KB`,
        counts,
        rawData: data
      });
      setShowImportPreview(true);
    } catch (error) {
      alert('Failed to read import file: ' + error.message);
    }
    event.target.value = '';
  };

  const handleConfirmImport = async () => {
    if (!importPreview) return;
    try {
      setIsImporting(true);
      setImportSuccess(false);
      setShowImportPreview(false);
      await importAPI.import(importPreview.rawData);
      setImportSuccess(true);
      setImportPreview(null);
      setTimeout(() => window.location.reload(), 2000);
    } catch (error) {
      console.error('Error importing data:', error);
      alert('Failed to import data: ' + error.message);
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Export */}
      <div>
        <h3 className="text-lg font-semibold mb-4">Data Export</h3>
        <p className="text-sm text-gray-600 dark:text-slate-400 mb-4">
          Export all your data (people, tools, todos, custom fields, and settings) to a JSON file for backup or migration.
        </p>
        <button onClick={handleExport} disabled={isExporting} className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 flex items-center disabled:opacity-50 disabled:cursor-not-allowed">
          {isExporting ? <><div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>Exporting...</> : <><Download className="w-4 h-4 mr-2" />Export All Data</>}
        </button>
        {exportSuccess && <div className="mt-2 flex items-center text-green-600 text-sm"><CheckCircle className="w-4 h-4 mr-1" />Export completed successfully!</div>}
      </div>

      {/* Import */}
      <div className="pt-6 border-t">
        <h3 className="text-lg font-semibold mb-4">Data Import</h3>
        <p className="text-sm text-gray-600 dark:text-slate-400 mb-4">
          Import data from a previously exported JSON file. This will merge the data with existing records.
        </p>
        <input ref={importInputRef} type="file" accept="application/json" onChange={handleImportPreview} className="hidden" />
        <button onClick={() => importInputRef.current?.click()} disabled={isImporting} className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 flex items-center disabled:opacity-50 disabled:cursor-not-allowed">
          {isImporting ? <><div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>Importing...</> : <><Upload className="w-4 h-4 mr-2" />Import Data</>}
        </button>
        {importSuccess && <div className="mt-2 flex items-center text-green-600 text-sm"><CheckCircle className="w-4 h-4 mr-1" />Import completed successfully! Reloading page...</div>}
        <div className="mt-4 p-4 bg-amber-50 border border-amber-200 rounded-lg">
          <div className="flex items-start">
            <AlertTriangle className="w-5 h-5 text-amber-600 mr-2 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm text-amber-800 font-medium">Important Notes:</p>
              <ul className="text-sm text-amber-700 mt-1 list-disc list-inside">
                <li>Import will merge data with existing records</li>
                <li>Records with matching IDs will be updated</li>
                <li>Always backup your data before importing</li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* Import Preview Modal */}
      {showImportPreview && importPreview && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl p-6 w-full max-w-2xl">
            <h3 className="text-lg font-semibold mb-4">Import Preview</h3>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                {[['File Name', importPreview.fileName], ['File Size', importPreview.fileSize], ['Version', importPreview.version], ['Export Date', importPreview.exportDate ? new Date(importPreview.exportDate).toLocaleString() : 'N/A']].map(([label, value]) => (
                  <div key={label}>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">{label}</label>
                    <p className="text-sm text-gray-900 dark:text-slate-100">{value}</p>
                  </div>
                ))}
              </div>
              <div className="border-t pt-4">
                <h4 className="text-sm font-medium text-gray-700 dark:text-slate-300 mb-3">Records to Import</h4>
                <div className="grid grid-cols-2 gap-3">
                  {Object.entries(importPreview.counts).map(([key, count]) => (
                    <div key={key} className="flex justify-between items-center bg-gray-50 dark:bg-slate-900 px-3 py-2 rounded">
                      <span className="text-sm text-gray-700 dark:text-slate-300 capitalize">{key.replace(/([A-Z])/g, ' $1').trim()}</span>
                      <span className="text-sm font-medium text-gray-900 dark:text-slate-100">{count}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                <div className="flex items-start">
                  <AlertTriangle className="w-5 h-5 text-amber-600 mr-2 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-amber-700">This will merge the imported data with your existing records. Make sure you have a backup before proceeding.</p>
                </div>
              </div>
            </div>
            <div className="flex justify-end space-x-2 mt-6">
              <button onClick={() => { setShowImportPreview(false); setImportPreview(null); }} className="px-4 py-2 text-gray-700 dark:text-slate-300 bg-gray-100 dark:bg-slate-700 rounded-md hover:bg-gray-200">Cancel</button>
              <button onClick={handleConfirmImport} className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700">Confirm Import</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ImportExportTab;
