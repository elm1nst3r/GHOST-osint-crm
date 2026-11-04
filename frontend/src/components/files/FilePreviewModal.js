// File: frontend/src/components/files/FilePreviewModal.js
//
// In-app preview of an uploaded file (issue #97): PDF, images, plain text,
// CSV/TSV as a table, and Word .docx. Everything else is download-only (see
// utils/filePreview.js for the list and the reasoning).
//
// The bytes come from the authenticated /files/:id/content endpoint and are
// rendered here, with a Blob type picked from the allowlist. Word documents
// are converted to HTML in the browser by mammoth and then sanitized with
// DOMPurify. Both libraries load only when a .docx is opened.
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import Papa from 'papaparse';
import { X, Download, ExternalLink, Loader2, AlertTriangle, Copy, Check } from 'lucide-react';
import { filesAPI } from '../../utils/api';
import {
  previewKind, previewBlobType, guessEncoding, decodeText, formatBytes, TEXT_ENCODINGS,
} from '../../utils/filePreview';

const MAX_TEXT_CHARS = 1000000;
const MAX_TABLE_ROWS = 1000;

let purifierPromise = null;
// DOMPurify hooks are global, so configure the instance once. Links in a
// Word document open in a new tab, without sending GHOST as the referrer.
const loadPurifier = () => {
  if (!purifierPromise) {
    purifierPromise = import('dompurify').then((m) => {
      const DOMPurify = m.default || m;
      DOMPurify.addHook('afterSanitizeAttributes', (node) => {
        if (node.tagName === 'A' && node.getAttribute('href')) {
          node.setAttribute('target', '_blank');
          node.setAttribute('rel', 'noopener noreferrer');
        }
      });
      return DOMPurify;
    });
  }
  return purifierPromise;
};

const loadMammoth = () => import('mammoth/mammoth.browser').then((m) => m.default || m);

export const CopyHash = ({ value }) => {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);
  if (!value) return null;
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch { /* clipboard blocked: the full value is in the tooltip */ }
  };
  return (
    <button
      type="button"
      onClick={copy}
      title={t('files.sha256Title', { hash: value })}
      className="inline-flex items-center gap-1 font-mono text-xs text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
    >
      SHA-256 {value.slice(0, 12)}…
      {copied ? <Check className="w-3 h-3 text-green-600" /> : <Copy className="w-3 h-3" />}
    </button>
  );
};

const FilePreviewModal = ({ file, onClose, onDownload }) => {
  const { t, i18n } = useTranslation();
  const kind = previewKind(file);
  const [status, setStatus] = useState('loading');
  const [error, setError] = useState('');
  const [blobUrl, setBlobUrl] = useState(null);
  const [encoding, setEncoding] = useState('utf-8');
  const [docxHtml, setDocxHtml] = useState('');
  const [showRaw, setShowRaw] = useState(false);
  const bytesRef = useRef(null);

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  useEffect(() => {
    let cancelled = false;
    let url = null;
    (async () => {
      try {
        const blob = await filesAPI.fetchContent(file.id, { preview: true });
        if (cancelled) return;
        if (kind === 'pdf' || kind === 'image') {
          url = URL.createObjectURL(new Blob([blob], { type: previewBlobType(file, kind) }));
          setBlobUrl(url);
        } else if (kind === 'text' || kind === 'table') {
          const bytes = new Uint8Array(await blob.arrayBuffer());
          bytesRef.current = bytes;
          setEncoding(guessEncoding(bytes, i18n.language));
        } else if (kind === 'docx') {
          const [mammoth, DOMPurify] = await Promise.all([loadMammoth(), loadPurifier()]);
          const result = await mammoth.convertToHtml({ arrayBuffer: await blob.arrayBuffer() });
          if (cancelled) return;
          setDocxHtml(DOMPurify.sanitize(result.value, { USE_PROFILES: { html: true } }));
        }
        if (!cancelled) setStatus('ready');
      } catch (err) {
        if (cancelled) return;
        setError(err.message || '');
        setStatus('error');
      }
    })();
    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
    };
    // file.id identifies the content; kind/language only matter at load.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [file.id]);

  const fullText = useMemo(
    () => (status === 'ready' && bytesRef.current ? decodeText(bytesRef.current, encoding) : ''),
    [status, encoding]
  );
  const truncated = fullText.length > MAX_TEXT_CHARS;
  const text = truncated ? fullText.slice(0, MAX_TEXT_CHARS) : fullText;

  // One row more than shown, to know whether to say the table was cut off.
  const tableRows = useMemo(() => {
    if (kind !== 'table' || status !== 'ready' || showRaw) return null;
    return Papa.parse(fullText, { skipEmptyLines: true, preview: MAX_TABLE_ROWS + 2 }).data;
  }, [kind, status, showRaw, fullText]);

  const body = () => {
    if (!kind) {
      return <p className="p-8 text-center text-gray-600 dark:text-gray-400">{t('files.previewUnavailable')}</p>;
    }
    if (status === 'loading') {
      return (
        <div className="flex items-center justify-center gap-2 p-12 text-gray-500 dark:text-gray-400">
          <Loader2 className="w-5 h-5 animate-spin" />{t('files.previewLoading')}
        </div>
      );
    }
    if (status === 'error') {
      return (
        <div className="p-8 text-center text-red-600 dark:text-red-400 flex flex-col items-center gap-2">
          <AlertTriangle className="w-6 h-6" />
          <p>{t('files.previewError')}</p>
          {error && <p className="text-xs text-gray-500">{error}</p>}
        </div>
      );
    }
    if (kind === 'pdf') {
      return <iframe title={file.original_name} src={blobUrl} className="w-full h-[75vh] bg-white" />;
    }
    if (kind === 'image') {
      return (
        <div className="flex items-center justify-center p-4 bg-gray-100 dark:bg-gray-900 min-h-[40vh]">
          <img src={blobUrl} alt={file.original_name} className="max-w-full max-h-[75vh] object-contain" />
        </div>
      );
    }
    if (kind === 'docx') {
      return (
        <div className="bg-gray-100 dark:bg-gray-900 p-4 md:p-8">
          {/* eslint-disable-next-line react/no-danger -- sanitized by DOMPurify above */}
          <div className="docx-preview mx-auto max-w-3xl bg-white text-gray-900 shadow rounded p-6 md:p-10" dangerouslySetInnerHTML={{ __html: docxHtml }} />
          <p className="mx-auto max-w-3xl mt-3 text-xs text-gray-500 dark:text-gray-400">{t('files.docxNote')}</p>
        </div>
      );
    }
    if (tableRows) {
      const [header, ...rows] = tableRows;
      const shown = rows.slice(0, MAX_TABLE_ROWS);
      return (
        <div className="overflow-auto max-h-[75vh]">
          <table className="min-w-full text-xs border-collapse">
            <thead className="sticky top-0 bg-gray-100 dark:bg-gray-700">
              <tr>
                {(header || []).map((h, i) => (
                  <th key={i} className="px-2 py-1.5 text-start font-semibold text-gray-700 dark:text-gray-200 border-b border-gray-200 dark:border-gray-600 whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {shown.map((row, r) => (
                <tr key={r} className="odd:bg-white even:bg-gray-50 dark:odd:bg-gray-800 dark:even:bg-gray-800/60">
                  {row.map((cell, c) => (
                    <td key={c} className="px-2 py-1 text-gray-800 dark:text-gray-200 border-b border-gray-100 dark:border-gray-700 whitespace-nowrap">{cell}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          {rows.length > MAX_TABLE_ROWS && (
            <p className="p-3 text-xs text-gray-500 dark:text-gray-400">{t('files.tableTruncated', { count: MAX_TABLE_ROWS })}</p>
          )}
        </div>
      );
    }
    return (
      <div className="max-h-[75vh] overflow-auto">
        <pre className="p-4 text-xs font-mono whitespace-pre-wrap break-words text-gray-800 dark:text-gray-200">{text}</pre>
        {truncated && <p className="px-4 pb-4 text-xs text-gray-500 dark:text-gray-400">{t('files.textTruncated')}</p>}
      </div>
    );
  };

  const isTextual = kind === 'text' || kind === 'table';

  return createPortal(
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[60] p-2 md:p-4" onClick={onClose}>
      <div
        className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl border border-gray-200 dark:border-gray-700 w-full max-w-5xl max-h-[95vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={file.original_name}
      >
        <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex flex-wrap items-start gap-3 justify-between">
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-gray-900 dark:text-white break-all">{file.original_name}</h2>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-xs text-gray-500 dark:text-gray-400">
              <span>{formatBytes(file.size_bytes)}</span>
              <CopyHash value={file.sha256} />
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {isTextual && status === 'ready' && (
              <select
                value={encoding}
                onChange={(e) => setEncoding(e.target.value)}
                title={t('files.encodingLabel')}
                aria-label={t('files.encodingLabel')}
                className="px-2 py-1.5 text-xs border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
              >
                {TEXT_ENCODINGS.map((enc) => <option key={enc} value={enc}>{enc.toUpperCase()}</option>)}
              </select>
            )}
            {kind === 'table' && status === 'ready' && (
              <button
                type="button"
                onClick={() => setShowRaw((v) => !v)}
                className="px-3 py-1.5 text-xs rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                {showRaw ? t('files.showAsTable') : t('files.showAsText')}
              </button>
            )}
            {blobUrl && (
              <a
                href={blobUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 px-3 py-1.5 text-xs rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                <ExternalLink className="w-3.5 h-3.5" />{t('files.openInNewTab')}
              </a>
            )}
            <button
              type="button"
              onClick={() => onDownload(file)}
              className="inline-flex items-center gap-1 px-3 py-1.5 text-xs rounded-lg bg-blue-600 text-white hover:bg-blue-700"
            >
              <Download className="w-3.5 h-3.5" />{t('files.download')}
            </button>
            <button type="button" onClick={onClose} aria-label={t('common.close')} className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
        <div className="flex-1 min-h-0 overflow-auto">{body()}</div>
      </div>
    </div>,
    document.body
  );
};

export default FilePreviewModal;
