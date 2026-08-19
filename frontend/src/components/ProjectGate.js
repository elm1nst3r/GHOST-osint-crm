// File: frontend/src/components/ProjectGate.js
// First-run / no-active-project gate (issue #83 follow-up). Renders instead
// of `children` whenever there's no valid activeProjectId -- either because
// this is a brand-new install with zero projects, or because projects exist
// but none is selected (e.g. the stored id pointed at a project that was
// since deleted -- see the stale-localStorage guard in ProjectContext).
// Blocks the whole shell rather than letting list/dashboard views render
// against an undefined project_id filter, which several routes treat as
// "unfiltered" rather than "empty".
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FolderKanban, Plus } from 'lucide-react';
import { useProject } from '../contexts/ProjectContext';
import { projectsAPI } from '../utils/api';

const ProjectGate = ({ children }) => {
  const { t } = useTranslation();
  const { projects, activeProjectId, loaded, setActiveProjectId, refetchProjects } = useProject();
  const [newName, setNewName] = useState('');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState(null);

  if (!loaded || activeProjectId != null) return children;

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!newName.trim()) return;
    setCreating(true);
    setError(null);
    try {
      const created = await projectsAPI.create({ name: newName.trim() });
      await refetchProjects();
      setActiveProjectId(created.id);
    } catch (err) {
      console.error('Error creating project:', err);
      setError(t('projectGate.errorCreate'));
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-[100dvh] bg-slate-50 dark:bg-slate-900 px-4">
      <div className="w-full max-w-md rounded-[var(--radius-card)] border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-lg p-6">
        <div className="flex items-center gap-2 mb-1">
          <FolderKanban className="w-5 h-5 text-accent-primary" />
          <h1 className="text-lg font-semibold text-slate-800 dark:text-slate-100">
            {projects.length === 0 ? t('projectGate.titleFirstRun') : t('projectGate.titlePick')}
          </h1>
        </div>
        <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
          {projects.length === 0 ? t('projectGate.descriptionFirstRun') : t('projectGate.descriptionPick')}
        </p>

        {projects.length > 0 && (
          <div className="mb-4 max-h-56 overflow-y-auto rounded-md border border-slate-200 dark:border-slate-700 divide-y divide-slate-100 dark:divide-slate-700">
            {projects.map((p) => (
              <button
                key={p.id}
                onClick={() => setActiveProjectId(p.id)}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700"
              >
                {p.icon ? <span className="flex-shrink-0 leading-none">{p.icon}</span> : <FolderKanban className="w-4 h-4 text-slate-400 flex-shrink-0" />}
                <span className="truncate">{p.name}</span>
              </button>
            ))}
          </div>
        )}

        <form onSubmit={handleCreate} className="flex gap-2">
          <input
            autoFocus={projects.length === 0}
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder={t('projectGate.namePlaceholder')}
            className="flex-1 min-w-0 px-3 py-2 text-sm border rounded-md dark:bg-slate-700 dark:border-slate-600 dark:text-slate-100"
          />
          <button
            type="submit"
            disabled={creating || !newName.trim()}
            className="flex items-center gap-1 px-3 py-2 text-sm bg-accent-primary text-white rounded-md disabled:opacity-50 flex-shrink-0"
          >
            <Plus className="w-4 h-4" />
            {t('projectGate.create')}
          </button>
        </form>
        {error && <p className="mt-2 text-sm text-red-600 dark:text-red-400">{error}</p>}
      </div>
    </div>
  );
};

export default ProjectGate;
