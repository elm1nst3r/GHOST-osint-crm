// File: frontend/src/components/ImportKML.js
import React, { useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { X, Upload, FileText, CheckCircle, AlertCircle, Loader } from 'lucide-react';
import { wirelessNetworksAPI } from '../utils/api';
import { useProject } from '../contexts/ProjectContext';

const ImportKML = ({ onClose, onImportComplete }) => {
  const { t } = useTranslation();
  const { activeProjectId } = useProject();
  const [file, setFile] = useState(null);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState(null);
  const [error, setError] = useState(null);
  const [dragActive, setDragActive] = useState(false);
  const [preview, setPreview] = useState(null);
  const [showPreview, setShowPreview] = useState(false);
  const fileInputRef = useRef(null);

  // Handle drag events
  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  // Handle drop
  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelect(e.dataTransfer.files[0]);
    }
  };

  // Handle file selection
  const handleFileSelect = async (selectedFile) => {
    // Validate file type
    if (!selectedFile.name.toLowerCase().endsWith('.kml')) {
      setError(t('importKmlModal.errorSelectKmlFile'));
      return;
    }

    // Validate file size (max 10MB)
    if (selectedFile.size > 10 * 1024 * 1024) {
      setError(t('importKmlModal.errorFileSizeExceeds'));
      return;
    }

    setFile(selectedFile);
    setError(null);
    setImportResult(null);

    // Generate preview
    await generatePreview(selectedFile);
  };

  // Generate preview from KML file
  const generatePreview = async (kmlFile) => {
    try {
      const text = await kmlFile.text();
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(text, 'text/xml');

      // Check for parsing errors
      const parseError = xmlDoc.querySelector('parsererror');
      if (parseError) {
        throw new Error(t('importKmlModal.errorInvalidKmlFormat'));
      }

      // Count placemarks (wireless networks)
      const placemarks = xmlDoc.querySelectorAll('Placemark');
      const networkCount = placemarks.length;

      // Analyze network types and encryption
      let wifiCount = 0;
      let bluetoothCount = 0;
      let cellCount = 0;
      let encryptedCount = 0;
      let openCount = 0;
      const ssids = new Set();
      const bssids = new Set();

      placemarks.forEach(placemark => {
        const name = placemark.querySelector('name')?.textContent || '';
        const description = placemark.querySelector('description')?.textContent || '';
        const styleUrl = placemark.querySelector('styleUrl')?.textContent || '';

        ssids.add(name);

        // Parse BSSID from description
        const bssidMatch = description.match(/Network ID:\s*([A-Fa-f0-9:]+)/);
        if (bssidMatch) {
          bssids.add(bssidMatch[1]);
        }

        // Determine network type
        if (styleUrl.includes('bluetooth')) {
          bluetoothCount++;
        } else if (styleUrl.includes('cell')) {
          cellCount++;
        } else {
          wifiCount++;
        }

        // Check encryption
        if (description.includes('Encryption:')) {
          const encMatch = description.match(/Encryption:\s*(\w+)/);
          if (encMatch) {
            const encType = encMatch[1].toLowerCase();
            if (encType === 'open' || encType === 'unknown') {
              openCount++;
            } else {
              encryptedCount++;
            }
          }
        }
      });

      setPreview({
        fileName: kmlFile.name,
        fileSize: formatFileSize(kmlFile.size),
        totalNetworks: networkCount,
        uniqueSSIDs: ssids.size,
        uniqueBSSIDs: bssids.size,
        wifiCount,
        bluetoothCount,
        cellCount,
        encryptedCount,
        openCount
      });
      setShowPreview(true);
    } catch (err) {
      console.error('Error generating preview:', err);
      setError(t('importKmlModal.errorParseKmlFile', { message: err.message }));
      setFile(null);
    }
  };

  // Handle file input change
  const handleFileInputChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      handleFileSelect(e.target.files[0]);
    }
  };

  // Format file size
  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  // Confirm and import KML file
  const handleConfirmImport = async () => {
    if (!file) {
      setError(t('importKmlModal.errorSelectFileFirst'));
      return;
    }
    if (!activeProjectId) {
      setError(t('importKmlModal.errorNoActiveProject'));
      return;
    }

    setImporting(true);
    setShowPreview(false);
    setError(null);

    try {
      const result = await wirelessNetworksAPI.importKML(file, activeProjectId);
      setImportResult(result);

      // Call completion callback after short delay
      setTimeout(() => {
        onImportComplete();
      }, 2000);
    } catch (err) {
      console.error('Import error:', err);
      setError(err.message || t('importKmlModal.errorImportKmlFile'));
    } finally {
      setImporting(false);
    }
  };

  // Cancel preview
  const handleCancelPreview = () => {
    setShowPreview(false);
    setPreview(null);
    setFile(null);
  };

  // Reset and close
  const handleClose = () => {
    if (!importing) {
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 dark:bg-black/70 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-white dark:bg-slate-800 rounded-lg-lg shadow-2xl w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-lg bg-gradient-primary flex items-center justify-center">
              <Upload className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                {t('importKmlModal.title')}
              </h2>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-0.5">
                {t('importKmlModal.subtitle')}
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            disabled={importing}
            className="p-2 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <X className="w-5 h-5 text-gray-500 dark:text-gray-400" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* File Upload Area */}
          {!importResult && (
            <div>
              <div
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
                onClick={() => !file && fileInputRef.current?.click()}
                className={`
                  border-2 border-dashed rounded-lg-lg p-8 text-center cursor-pointer
                  transition-all duration-200
                  ${dragActive
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                    : 'border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500'
                  }
                  ${file ? 'bg-gray-50 dark:bg-slate-700/50' : ''}
                `}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".kml"
                  onChange={handleFileInputChange}
                  className="hidden"
                />

                {!file ? (
                  <div className="space-y-3">
                    <div className="w-16 h-16 mx-auto rounded-full bg-gradient-primary flex items-center justify-center">
                      <Upload className="w-8 h-8 text-white" />
                    </div>
                    <div>
                      <p className="text-base font-medium text-gray-900 dark:text-gray-100">
                        {t('importKmlModal.dropHere')}
                      </p>
                      <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                        {t('importKmlModal.maxFileSize')}
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="w-16 h-16 mx-auto rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                      <FileText className="w-8 h-8 text-green-600 dark:text-green-400" />
                    </div>
                    <div>
                      <p className="text-base font-medium text-gray-900 dark:text-gray-100">
                        {file.name}
                      </p>
                      <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                        {formatFileSize(file.size)}
                      </p>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setFile(null);
                          setError(null);
                        }}
                        className="mt-3 text-sm text-blue-600 dark:text-blue-400 hover:underline"
                      >
                        {t('importKmlModal.chooseDifferentFile')}
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* File Preview Info */}
              {file && !showPreview && (
                <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg-lg border border-blue-200 dark:border-blue-800">
                  <div className="flex items-start space-x-3">
                    <FileText className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                        {t('importKmlModal.analyzingFile')}
                      </p>
                      <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                        {t('importKmlModal.generatingPreview')}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="p-4 bg-red-50 dark:bg-red-900/20 rounded-lg-lg border border-red-200 dark:border-red-800">
              <div className="flex items-start space-x-3">
                <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 mt-0.5 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-red-900 dark:text-red-200">
                    {t('importKmlModal.importErrorTitle')}
                  </p>
                  <p className="text-sm text-red-700 dark:text-red-300 mt-1">
                    {error}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Import Progress */}
          {importing && (
            <div className="p-6 bg-blue-50 dark:bg-blue-900/20 rounded-lg-lg border border-blue-200 dark:border-blue-800">
              <div className="flex items-center space-x-4">
                <Loader className="w-6 h-6 text-blue-600 dark:text-blue-400 animate-spin flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                    {t('importKmlModal.importingNetworks')}
                  </p>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                    {t('importKmlModal.parsingKmlSaving')}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Import Results */}
          {importResult && (
            <div className="space-y-4">
              <div className="p-6 bg-green-50 dark:bg-green-900/20 rounded-lg-lg border border-green-200 dark:border-green-800">
                <div className="flex items-start space-x-4">
                  <div className="w-12 h-12 rounded-full bg-green-100 dark:bg-green-900/40 flex items-center justify-center flex-shrink-0">
                    <CheckCircle className="w-6 h-6 text-green-600 dark:text-green-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-base font-semibold text-gray-900 dark:text-gray-100">
                      {t('importKmlModal.importSuccessful')}
                    </p>
                    <p className="text-sm text-gray-700 dark:text-gray-300 mt-1">
                      {importResult.message}
                    </p>
                  </div>
                </div>
              </div>

              {/* Import Statistics */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 bg-white dark:bg-slate-700/50 rounded-lg-lg border border-gray-200 dark:border-gray-700">
                  <p className="text-sm text-gray-600 dark:text-gray-400">{t('importKmlModal.networksImported')}</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-1">
                    {importResult.imported || 0}
                  </p>
                </div>
                <div className="p-4 bg-white dark:bg-slate-700/50 rounded-lg-lg border border-gray-200 dark:border-gray-700">
                  <p className="text-sm text-gray-600 dark:text-gray-400">{t('importKmlModal.errors')}</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-1">
                    {importResult.errors || 0}
                  </p>
                </div>
              </div>

              {/* Error Details */}
              {importResult.errorDetails && importResult.errorDetails.length > 0 && (
                <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg-lg border border-yellow-200 dark:border-yellow-800">
                  <p className="text-sm font-medium text-yellow-900 dark:text-yellow-200 mb-2">
                    {t('importKmlModal.errorDetailsLabel')}
                  </p>
                  <ul className="text-sm text-yellow-800 dark:text-yellow-300 space-y-1">
                    {importResult.errorDetails.slice(0, 5).map((err, idx) => (
                      <li key={idx} className="truncate">• {err}</li>
                    ))}
                    {importResult.errorDetails.length > 5 && (
                      <li className="text-yellow-700 dark:text-yellow-400 italic">
                        {t('importKmlModal.andNMore', { count: importResult.errorDetails.length - 5 })}
                      </li>
                    )}
                  </ul>
                </div>
              )}

              <p className="text-sm text-gray-600 dark:text-gray-400 text-center">
                {t('importKmlModal.closingIn2Seconds')}
              </p>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        {!importResult && (
          <div className="flex items-center justify-end space-x-3 p-6 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-slate-900/50">
            <button
              onClick={handleClose}
              disabled={importing}
              className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300
                       hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg
                       transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {t('common.cancel')}
            </button>
          </div>
        )}
      </div>

      {/* Preview Modal */}
      {showPreview && preview && (
        <div className="fixed inset-0 bg-black/70 dark:bg-black/70 backdrop-blur-sm flex items-center justify-center z-[60]">
          <div className="bg-white dark:bg-slate-800 rounded-lg shadow-2xl w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">
            {/* Preview Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
              <div>
                <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                  {t('importKmlModal.previewTitle')}
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-0.5">
                  {t('importKmlModal.previewSubtitle')}
                </p>
              </div>
              <button
                onClick={handleCancelPreview}
                className="p-2 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-gray-500 dark:text-gray-400" />
              </button>
            </div>

            {/* Preview Content */}
            <div className="p-6 space-y-6">
              {/* File Info */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    {t('importKmlModal.fileNameLabel')}
                  </label>
                  <p className="text-sm text-gray-900 dark:text-gray-100">{preview.fileName}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    {t('importKmlModal.fileSizeLabel')}
                  </label>
                  <p className="text-sm text-gray-900 dark:text-gray-100">{preview.fileSize}</p>
                </div>
              </div>

              {/* Network Statistics */}
              <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
                <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-3">
                  {t('importKmlModal.networksToImport')}
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="flex justify-between items-center bg-gray-50 dark:bg-slate-700/50 px-3 py-2 rounded-lg">
                    <span className="text-sm text-gray-700 dark:text-gray-300">{t('wirelessNetworks.totalNetworks')}</span>
                    <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">{preview.totalNetworks}</span>
                  </div>
                  <div className="flex justify-between items-center bg-gray-50 dark:bg-slate-700/50 px-3 py-2 rounded-lg">
                    <span className="text-sm text-gray-700 dark:text-gray-300">{t('wirelessNetworks.uniqueSsids')}</span>
                    <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">{preview.uniqueSSIDs}</span>
                  </div>
                  <div className="flex justify-between items-center bg-gray-50 dark:bg-slate-700/50 px-3 py-2 rounded-lg">
                    <span className="text-sm text-gray-700 dark:text-gray-300">{t('importKmlModal.uniqueBssids')}</span>
                    <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">{preview.uniqueBSSIDs}</span>
                  </div>
                  <div className="flex justify-between items-center bg-gray-50 dark:bg-slate-700/50 px-3 py-2 rounded-lg">
                    <span className="text-sm text-gray-700 dark:text-gray-300">{t('importKmlModal.wifiNetworks')}</span>
                    <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">{preview.wifiCount}</span>
                  </div>
                  {preview.bluetoothCount > 0 && (
                    <div className="flex justify-between items-center bg-gray-50 dark:bg-slate-700/50 px-3 py-2 rounded-lg">
                      <span className="text-sm text-gray-700 dark:text-gray-300">Bluetooth</span>
                      <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">{preview.bluetoothCount}</span>
                    </div>
                  )}
                  {preview.cellCount > 0 && (
                    <div className="flex justify-between items-center bg-gray-50 dark:bg-slate-700/50 px-3 py-2 rounded-lg">
                      <span className="text-sm text-gray-700 dark:text-gray-300">{t('importKmlModal.cellTowers')}</span>
                      <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">{preview.cellCount}</span>
                    </div>
                  )}
                  <div className="flex justify-between items-center bg-gray-50 dark:bg-slate-700/50 px-3 py-2 rounded-lg">
                    <span className="text-sm text-gray-700 dark:text-gray-300">{t('wirelessNetworks.encrypted')}</span>
                    <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">{preview.encryptedCount}</span>
                  </div>
                  <div className="flex justify-between items-center bg-gray-50 dark:bg-slate-700/50 px-3 py-2 rounded-lg">
                    <span className="text-sm text-gray-700 dark:text-gray-300">{t('importKmlModal.openNetworks')}</span>
                    <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">{preview.openCount}</span>
                  </div>
                </div>
              </div>

              {/* Warning */}
              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                <div className="flex items-start space-x-3">
                  <AlertCircle className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-sm text-blue-900 dark:text-blue-200 font-medium">{t('importKmlModal.noteLabel')}</p>
                    <p className="text-sm text-blue-800 dark:text-blue-300 mt-1">
                      {t('importKmlModal.duplicateNetworksWarning')}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Preview Footer */}
            <div className="flex items-center justify-end space-x-3 p-6 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-slate-900/50">
              <button
                onClick={handleCancelPreview}
                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300
                         hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
              >
                {t('common.cancel')}
              </button>
              <button
                onClick={handleConfirmImport}
                className="px-6 py-2 text-sm font-medium text-white bg-gradient-primary
                         rounded-lg hover:shadow-glass-lg transition-[background-color,box-shadow]
                         flex items-center space-x-2"
              >
                <Upload className="w-4 h-4" />
                <span>{t('settings.importExport.confirmImport')}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ImportKML;
