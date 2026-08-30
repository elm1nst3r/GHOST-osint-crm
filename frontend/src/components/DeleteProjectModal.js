// File: frontend/src/components/DeleteProjectModal.js
// Confirm + run a full project deletion (issue #88). Fetches the project's
// per-entity row counts, shows what will be destroyed, and — when the project
// holds any data — requires the operator to type the project name back before
// the Delete button enables. Portalled to document.body for the same reason
// as ProjectMembersModal: it's mounted from the sidebar, which is transformed.
import React, { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, X, Loader2 } from 'lucide-react';
import { projectsAPI } from '../utils/api';

// Order shown in the dialog — roughly most-to-least significant.
const ENTITY_ORDER = [
  'people', 'businesses', 'relationships', 'cases', 'properties', 'assets',
  'transactions', 'crypto_wallets', 'wireless_networks', 'travel_history', 'todos',
];

const DeleteProjectModal = ({ project, onClose, onDeleted }) => {
  const { t } = useTranslation();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [confirmText, setConfirmText] = useState('');
  const [deleting, setDeleting] = useState(false);

  const loadStats = useCallback(async () => {
    try {
      setLoading(true);
      setStats(await projectsAPI.getStats(project.id));
      setError('');
    } catch (err) {
      setError(err.message || t('deleteProject.errorStats'));
    } finally {
      setLoading(false);
    }
  }, [project.id, t]);

  useEffect(() => { loadStats(); }, [loadStats]);

  const hasData = stats && stats.total > 0;
  const confirmed = !hasData || confirmText.trim() === project.name;

  const handleDelete = async () => {
    if (!confirmed || deleting) return;
    setDeleting(true);
    setError('');
    try {
      await projectsAPI.delete(project.id, hasData ? project.name : undefined);
      onDeleted();
    } catch (err) {
      setError(err.message || t('deleteProject.errorDelete'));
      setDeleting(false);
    }
  };

  const rows = stats
    ? ENTITY_ORDER
        .map((key) => [key, stats.counts[key] || 0])
        .filter(([, n]) => n > 0)
    : [];

  return createPortal(
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl border border-gray-200 dark:border-gray-700 w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col">
        <div className="p-5 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-red-500" />
            {t('deleteProject.title', { name: project.name })}
          </h2>
          <button onClick={onClose} className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 overflow-y-auto space-y-4">
          {loading ? (
            <div className="flex items-center justify-center py-8 text-gray-500 dark:text-gray-400 gap-2">
              <Loader2 className="w-4 h-4 animate-spin" />{t('common.loadingEllipsis')}
            </div>
          ) : (
            <>
              {hasData ? (
                <>
                  <p className="text-sm text-gray-700 dark:text-gray-300">{t('deleteProject.containsData')}</p>
                  <ul className="border border-gray-200 dark:border-gray-700 rounded-lg divide-y divide-gray-200 dark:divide-gray-700 text-sm">
                    {rows.map(([key, n]) => (
                      <li key={key} className="flex justify-between px-3 py-2">
                        <span className="text-gray-600 dark:text-gray-400">{t(`deleteProject.entities.${key}`)}</span>
                        <span className="font-medium text-gray-900 dark:text-white">{n}</span>
                      </li>
                    ))}
                  </ul>
                  <p className="text-sm font-medium text-red-600 dark:text-red-400">
                    {t('deleteProject.permanentWarning')}
                  </p>
                  <div>
                    <label className="block text-sm text-gray-700 dark:text-gray-300 mb-1">
                      {t('deleteProject.typeNameToConfirm', { name: project.name })}
                    </label>
                    <input
                      type="text"
                      value={confirmText}
                      onChange={(e) => setConfirmText(e.target.value)}
                      autoFocus
                      className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
                      placeholder={project.name}
                    />
                  </div>
                </>
              ) : (
                <p className="text-sm text-gray-700 dark:text-gray-300">{t('deleteProject.empty')}</p>
              )}
            </>
          )}

          {error && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3 text-sm text-red-800 dark:text-red-200">
              {error}
            </div>
          )}
        </div>

        <div className="p-5 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm rounded-lg text-gray-700 dark:text-gray-200 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600"
          >
            {t('common.cancel')}
          </button>
          <button
            onClick={handleDelete}
            disabled={loading || !confirmed || deleting}
            className="px-4 py-2 text-sm rounded-lg bg-red-600 text-white hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
          >
            {deleting && <Loader2 className="w-4 h-4 animate-spin" />}
            {hasData ? t('deleteProject.deleteWithData') : t('common.delete')}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default DeleteProjectModal;
