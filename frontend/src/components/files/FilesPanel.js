// File: frontend/src/components/files/FilesPanel.js
//
// Upload, list, preview, download and delete files (issue #97). Used in two
// places:
//   - a person's Files tab:  <FilesPanel personId={..} projectId={..} />
//   - the project Files page: <FilesPanel projectId={..} showPerson />
// The project page lists every file in the project, including the ones
// attached to people, with the person's name on each.
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Upload, Search, Eye, Download, Edit2, Trash2, Loader2, FileText, Image as ImageIcon,
  FileSpreadsheet, File as FileIcon, User, X, Check,
} from 'lucide-react';
import { filesAPI, saveBlob } from '../../utils/api';
import { useAuth } from '../../contexts/AuthContext';
import { useProject } from '../../contexts/ProjectContext';
import { formatPersonName } from '../../utils/personName';
import { previewKind, formatBytes } from '../../utils/filePreview';
import FilePreviewModal, { CopyHash } from './FilePreviewModal';

const LIST_LIMIT = 1000;

const kindIcon = (kind) => {
  if (kind === 'image') return ImageIcon;
  if (kind === 'table') return FileSpreadsheet;
  if (kind === 'pdf' || kind === 'docx' || kind === 'text') return FileText;
  return FileIcon;
};

const personOf = (f) =>
  f.person_id ? { first_name: f.person_first_name, patronymic: f.person_patronymic, last_name: f.person_last_name } : null;

const FilesPanel = ({ projectId, personId, showPerson = false }) => {
  const { t, i18n } = useTranslation();
  const { currentUser } = useAuth();
  const { projects } = useProject();
  const [files, setFiles] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [personFilter, setPersonFilter] = useState('');
  const [uploads, setUploads] = useState([]);
  const [dragOver, setDragOver] = useState(false);
  const [editing, setEditing] = useState(null);
  const [previewFile, setPreviewFile] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const inputRef = useRef(null);

  const canUpload = Boolean(personId || projectId);

  const load = useCallback(async (q) => {
    setLoading(true);
    setError('');
    try {
      const res = await filesAPI.getAll({
        person_id: personId,
        project_id: personId ? undefined : projectId,
        q,
        limit: LIST_LIMIT,
      });
      setFiles(res.data || []);
      setTotal(res.meta?.total ?? (res.data || []).length);
    } catch (err) {
      setError(t('files.errorLoad', { message: err.message }));
    } finally {
      setLoading(false);
    }
  }, [personId, projectId, t]);

  // Debounced search; also the initial load.
  useEffect(() => {
    const h = setTimeout(() => load(query.trim()), query ? 300 : 0);
    return () => clearTimeout(h);
  }, [load, query]);

  const canDelete = (f) => {
    if (!currentUser) return false;
    if (currentUser.role === 'admin') return true;
    if (f.uploaded_by != null && Number(f.uploaded_by) === Number(currentUser.id)) return true;
    const role = projects.find((p) => p.id === f.project_id)?.my_role;
    return role === 'owner' || role === 'manager';
  };

  const uploadFiles = async (fileList) => {
    const list = Array.from(fileList || []);
    if (list.length === 0 || !canUpload) return;
    const fields = personId ? { person_id: personId } : { project_id: projectId };
    const startKey = Date.now();
    setUploads((u) => [...u, ...list.map((f, i) => ({ key: `${startKey}-${i}`, name: f.name, progress: 0, error: '' }))]);

    for (let i = 0; i < list.length; i += 1) {
      const key = `${startKey}-${i}`;
      const setOne = (patch) => setUploads((u) => u.map((x) => (x.key === key ? { ...x, ...patch } : x)));
      try {
        await filesAPI.upload(list[i], fields, (p) => setOne({ progress: p }));
        setUploads((u) => u.filter((x) => x.key !== key));
      } catch (err) {
        const message = err.status === 413
          ? (err.limitBytes ? t('files.errorTooLarge', { limit: formatBytes(err.limitBytes) }) : t('files.errorTooLargeProxy'))
          : err.message;
        setOne({ error: message, progress: 0 });
      }
    }
    load(query.trim());
  };

  const download = async (f) => {
    setBusyId(f.id);
    try {
      const blob = await filesAPI.fetchContent(f.id);
      saveBlob(blob, f.original_name);
    } catch (err) {
      alert(t('files.errorDownload', { message: err.message }));
    } finally {
      setBusyId(null);
    }
  };

  const remove = async (f) => {
    if (!window.confirm(t('files.confirmDelete', { name: f.original_name }))) return;
    try {
      await filesAPI.remove(f.id);
      setFiles((list) => list.filter((x) => x.id !== f.id));
      setTotal((n) => Math.max(0, n - 1));
    } catch (err) {
      alert(t('files.errorDelete', { message: err.message }));
    }
  };

  const saveDescription = async () => {
    if (!editing) return;
    try {
      const updated = await filesAPI.update(editing.id, { description: editing.description });
      setFiles((list) => list.map((x) => (x.id === updated.id ? updated : x)));
      setEditing(null);
    } catch (err) {
      alert(t('files.errorSave', { message: err.message }));
    }
  };

  // Person filter options come from the files themselves, so it needs no
  // separate people fetch and never lists someone with no files.
  const peopleInList = showPerson
    ? Array.from(new Map(files.filter((f) => f.person_id).map((f) => [f.person_id, personOf(f)])).entries())
    : [];
  const visible = files.filter((f) => {
    if (!personFilter) return true;
    if (personFilter === 'project') return !f.person_id;
    return String(f.person_id) === personFilter;
  });

  const dateFmt = (d) => {
    try { return new Date(d).toLocaleString(i18n.language); } catch { return d; }
  };

  return (
    <div
      className={`relative ${dragOver ? 'ring-2 ring-blue-500 rounded-lg' : ''}`}
      onDragOver={(e) => { if (canUpload && e.dataTransfer?.types?.includes('Files')) { e.preventDefault(); setDragOver(true); } }}
      onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setDragOver(false); }}
      onDrop={(e) => { if (!canUpload) return; e.preventDefault(); setDragOver(false); uploadFiles(e.dataTransfer.files); }}
    >
      {/* Toolbar */}
      <div className="flex flex-col md:flex-row md:items-center gap-3 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('files.searchPlaceholder')}
            className="w-full pl-9 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white text-sm"
          />
        </div>
        {showPerson && (
          <select
            value={personFilter}
            onChange={(e) => setPersonFilter(e.target.value)}
            aria-label={t('files.personFilterLabel')}
            className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white text-sm"
          >
            <option value="">{t('files.allFiles')}</option>
            <option value="project">{t('files.projectLevelOnly')}</option>
            {peopleInList.map(([id, p]) => (
              <option key={id} value={String(id)}>{formatPersonName(p, `#${id}`)}</option>
            ))}
          </select>
        )}
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={!canUpload}
          title={canUpload ? undefined : t('files.selectProjectFirst')}
          className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white text-sm hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Upload className="w-4 h-4" />{t('files.upload')}
        </button>
        <input
          ref={inputRef}
          type="file"
          multiple
          className="hidden"
          onChange={(e) => { uploadFiles(e.target.files); e.target.value = ''; }}
        />
      </div>

      {canUpload && (
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
          {personId ? t('files.dropHintPerson') : t('files.dropHintProject')}
        </p>
      )}

      {/* Uploads in progress / failed */}
      {uploads.length > 0 && (
        <div className="space-y-2 mb-4">
          {uploads.map((u) => (
            <div key={u.key} className="p-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/60">
              <div className="flex items-center justify-between gap-2 text-sm">
                <span className="truncate text-gray-800 dark:text-gray-200">{u.name}</span>
                {u.error ? (
                  <button type="button" onClick={() => setUploads((list) => list.filter((x) => x.key !== u.key))} aria-label={t('common.close')} className="text-gray-400 hover:text-gray-600">
                    <X className="w-4 h-4" />
                  </button>
                ) : (
                  <span className="text-xs text-gray-500">{Math.round(u.progress * 100)}%</span>
                )}
              </div>
              {u.error ? (
                <p className="text-xs text-red-600 dark:text-red-400 mt-1">{t('files.errorUpload', { message: u.error })}</p>
              ) : (
                <div className="h-1.5 mt-2 rounded bg-gray-200 dark:bg-gray-700 overflow-hidden">
                  <div className="h-full bg-blue-600 transition-[width]" style={{ width: `${Math.round(u.progress * 100)}%` }} />
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {error && <p className="text-sm text-red-600 dark:text-red-400 mb-3">{error}</p>}

      {loading && files.length === 0 ? (
        <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400 py-8 justify-center">
          <Loader2 className="w-4 h-4 animate-spin" />{t('common.loadingEllipsis')}
        </div>
      ) : visible.length === 0 ? (
        <div className="text-center py-10 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg text-gray-500 dark:text-gray-400">
          <FileIcon className="w-8 h-8 mx-auto mb-2 opacity-60" />
          <p className="text-sm">{query || personFilter ? t('files.noMatches') : t('files.empty')}</p>
        </div>
      ) : (
        <ul className="space-y-2">
          {visible.map((f) => {
            const kind = previewKind(f);
            const Icon = kindIcon(kind);
            const person = personOf(f);
            const isEditing = editing?.id === f.id;
            return (
              <li key={f.id} className="p-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
                <div className="flex items-start gap-3">
                  <Icon className="w-5 h-5 mt-0.5 flex-shrink-0 text-gray-500 dark:text-gray-400" />
                  <div className="flex-1 min-w-0">
                    <button
                      type="button"
                      onClick={() => (kind ? setPreviewFile(f) : download(f))}
                      className="text-left font-medium text-gray-900 dark:text-white hover:text-blue-600 dark:hover:text-blue-400 break-all"
                    >
                      {f.original_name}
                    </button>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-xs text-gray-500 dark:text-gray-400">
                      <span>{formatBytes(f.size_bytes)}</span>
                      <span>{dateFmt(f.created_at)}</span>
                      {f.uploaded_by_username && <span>{t('files.uploadedBy', { name: f.uploaded_by_username })}</span>}
                      {showPerson && (
                        <span className="inline-flex items-center gap-1">
                          <User className="w-3 h-3" />
                          {person ? formatPersonName(person, `#${f.person_id}`) : t('files.projectLevel')}
                        </span>
                      )}
                      <CopyHash value={f.sha256} />
                    </div>
                    {isEditing ? (
                      <div className="mt-2 flex flex-col gap-2">
                        <textarea
                          value={editing.description}
                          onChange={(e) => setEditing({ ...editing, description: e.target.value })}
                          rows={2}
                          maxLength={2000}
                          placeholder={t('files.descriptionPlaceholder')}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white text-sm"
                          autoFocus
                        />
                        <div className="flex gap-2">
                          <button type="button" onClick={saveDescription} className="inline-flex items-center gap-1 px-3 py-1 text-xs rounded-lg bg-blue-600 text-white hover:bg-blue-700">
                            <Check className="w-3.5 h-3.5" />{t('common.save')}
                          </button>
                          <button type="button" onClick={() => setEditing(null)} className="px-3 py-1 text-xs rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200">
                            {t('common.cancel')}
                          </button>
                        </div>
                      </div>
                    ) : (
                      f.description && <p className="mt-1 text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{f.description}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    {kind && (
                      <button type="button" onClick={() => setPreviewFile(f)} title={t('files.preview')} aria-label={t('files.preview')} className="p-1.5 rounded text-gray-500 hover:text-blue-600 hover:bg-gray-100 dark:hover:bg-gray-700">
                        <Eye className="w-4 h-4" />
                      </button>
                    )}
                    <button type="button" onClick={() => download(f)} disabled={busyId === f.id} title={t('files.download')} aria-label={t('files.download')} className="p-1.5 rounded text-gray-500 hover:text-blue-600 hover:bg-gray-100 dark:hover:bg-gray-700">
                      {busyId === f.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                    </button>
                    <button type="button" onClick={() => setEditing({ id: f.id, description: f.description || '' })} title={t('files.editDescription')} aria-label={t('files.editDescription')} className="p-1.5 rounded text-gray-500 hover:text-blue-600 hover:bg-gray-100 dark:hover:bg-gray-700">
                      <Edit2 className="w-4 h-4" />
                    </button>
                    {canDelete(f) && (
                      <button type="button" onClick={() => remove(f)} title={t('common.delete')} aria-label={t('common.delete')} className="p-1.5 rounded text-gray-500 hover:text-red-600 hover:bg-gray-100 dark:hover:bg-gray-700">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {total > files.length && (
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-3">{t('files.showingFirst', { shown: files.length, total })}</p>
      )}

      {previewFile && (
        <FilePreviewModal file={previewFile} onClose={() => setPreviewFile(null)} onDownload={download} />
      )}
    </div>
  );
};

export default FilesPanel;
