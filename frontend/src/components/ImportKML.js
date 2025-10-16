// File: frontend/src/components/ImportKML.js
import React, { useState, useRef } from 'react';
import { X, Upload, FileText, CheckCircle, AlertCircle, Loader } from 'lucide-react';
import { wirelessNetworksAPI } from '../utils/api';

const ImportKML = ({ onClose, onImportComplete }) => {
  const [file, setFile] = useState(null);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState(null);
  const [error, setError] = useState(null);
  const [dragActive, setDragActive] = useState(false);
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
  const handleFileSelect = (selectedFile) => {
    // Validate file type
    if (!selectedFile.name.toLowerCase().endsWith('.kml')) {
      setError('Please select a KML file (.kml)');
      return;
    }

    // Validate file size (max 10MB)
    if (selectedFile.size > 10 * 1024 * 1024) {
      setError('File size exceeds 10MB limit');
      return;
    }

    setFile(selectedFile);
    setError(null);
    setImportResult(null);
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

  // Import KML file
  const handleImport = async () => {
    if (!file) {
      setError('Please select a file first');
      return;
    }

    setImporting(true);
    setError(null);

    try {
      const result = await wirelessNetworksAPI.importKML(file);
      setImportResult(result);

      // Call completion callback after short delay
      setTimeout(() => {
        onImportComplete();
      }, 2000);
    } catch (err) {
      console.error('Import error:', err);
      setError(err.message || 'Failed to import KML file');
    } finally {
      setImporting(false);
    }
  };

  // Reset and close
  const handleClose = () => {
    if (!importing) {
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 dark:bg-black/70 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-white dark:bg-slate-800 rounded-glass-lg shadow-2xl w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-glass bg-gradient-primary flex items-center justify-center">
              <Upload className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                Import WiGLE KML File
              </h2>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-0.5">
                Upload your WiGLE wardriving export
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            disabled={importing}
            className="p-2 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-glass-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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
                  border-2 border-dashed rounded-glass-lg p-8 text-center cursor-pointer
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
                        Drop KML file here or click to browse
                      </p>
                      <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                        Maximum file size: 10MB
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
                        Choose different file
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* File Preview Info */}
              {file && (
                <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-glass-lg border border-blue-200 dark:border-blue-800">
                  <div className="flex items-start space-x-3">
                    <FileText className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                        Ready to import
                      </p>
                      <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                        This will parse the KML file and import all wireless networks found.
                        Duplicate networks will be updated if newer signal data is available.
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="p-4 bg-red-50 dark:bg-red-900/20 rounded-glass-lg border border-red-200 dark:border-red-800">
              <div className="flex items-start space-x-3">
                <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 mt-0.5 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-red-900 dark:text-red-200">
                    Import Error
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
            <div className="p-6 bg-blue-50 dark:bg-blue-900/20 rounded-glass-lg border border-blue-200 dark:border-blue-800">
              <div className="flex items-center space-x-4">
                <Loader className="w-6 h-6 text-blue-600 dark:text-blue-400 animate-spin flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                    Importing wireless networks...
                  </p>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                    Parsing KML file and saving network data to database
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Import Results */}
          {importResult && (
            <div className="space-y-4">
              <div className="p-6 bg-green-50 dark:bg-green-900/20 rounded-glass-lg border border-green-200 dark:border-green-800">
                <div className="flex items-start space-x-4">
                  <div className="w-12 h-12 rounded-full bg-green-100 dark:bg-green-900/40 flex items-center justify-center flex-shrink-0">
                    <CheckCircle className="w-6 h-6 text-green-600 dark:text-green-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-base font-semibold text-gray-900 dark:text-gray-100">
                      Import Successful!
                    </p>
                    <p className="text-sm text-gray-700 dark:text-gray-300 mt-1">
                      {importResult.message}
                    </p>
                  </div>
                </div>
              </div>

              {/* Import Statistics */}
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-white dark:bg-slate-700/50 rounded-glass-lg border border-gray-200 dark:border-gray-700">
                  <p className="text-sm text-gray-600 dark:text-gray-400">Networks Imported</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-1">
                    {importResult.imported || 0}
                  </p>
                </div>
                <div className="p-4 bg-white dark:bg-slate-700/50 rounded-glass-lg border border-gray-200 dark:border-gray-700">
                  <p className="text-sm text-gray-600 dark:text-gray-400">Errors</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-1">
                    {importResult.errors || 0}
                  </p>
                </div>
              </div>

              {/* Error Details */}
              {importResult.errorDetails && importResult.errorDetails.length > 0 && (
                <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-glass-lg border border-yellow-200 dark:border-yellow-800">
                  <p className="text-sm font-medium text-yellow-900 dark:text-yellow-200 mb-2">
                    Error Details:
                  </p>
                  <ul className="text-sm text-yellow-800 dark:text-yellow-300 space-y-1">
                    {importResult.errorDetails.slice(0, 5).map((err, idx) => (
                      <li key={idx} className="truncate">• {err}</li>
                    ))}
                    {importResult.errorDetails.length > 5 && (
                      <li className="text-yellow-700 dark:text-yellow-400 italic">
                        ... and {importResult.errorDetails.length - 5} more
                      </li>
                    )}
                  </ul>
                </div>
              )}

              <p className="text-sm text-gray-600 dark:text-gray-400 text-center">
                Closing in 2 seconds...
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
                       hover:bg-gray-100 dark:hover:bg-slate-700 rounded-glass-lg
                       transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Cancel
            </button>
            <button
              onClick={handleImport}
              disabled={!file || importing}
              className="px-6 py-2 text-sm font-medium text-white bg-gradient-primary
                       rounded-glass-lg hover:shadow-glow-lg transition-all
                       disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:shadow-none
                       flex items-center space-x-2"
            >
              {importing ? (
                <>
                  <Loader className="w-4 h-4 animate-spin" />
                  <span>Importing...</span>
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4" />
                  <span>Import Networks</span>
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default ImportKML;
