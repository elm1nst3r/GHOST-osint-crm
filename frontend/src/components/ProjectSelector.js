// File: frontend/src/components/ProjectSelector.js
// Top-of-app project switcher (issue #83). Deliberately basic for this
// stage: a dropdown + inline "+ New Project", no first-run gate, no "all
// projects" merged view, no cross-project admin mode -- those are later
// stages per docs/specs/case-data-isolation.md.
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FolderKanban, Plus, Check } from 'lucide-react';
import { useProject } from '../contexts/ProjectContext';
import { projectsAPI } from '../utils/api';

const ProjectSelector = ({ compact = false }) => {
  const { t } = useTranslation();
  const { projects, activeProjectId, activeProject, setActiveProjectId, refetchProjects } = useProject();
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!newName.trim()) return;
    try {
      const created = await projectsAPI.create({ name: newName.trim() });
      await refetchProjects();
      setActiveProjectId(created.id);
      setNewName('');
      setCreating(false);
      setOpen(false);
    } catch (error) {
      console.error('Error creating project:', error);
      alert(t('projectSelector.errorCreate'));
    }
  };

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className={`flex items-center gap-2 rounded-[var(--radius-control)] border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors ${compact ? 'px-2 py-1.5 text-xs' : 'px-3 py-2 text-sm w-full'}`}
        title={t('projectSelector.title')}
      >
        <FolderKanban className={compact ? 'w-3.5 h-3.5 text-slate-500 flex-shrink-0' : 'w-4 h-4 text-slate-500 flex-shrink-0'} />
        <span className="truncate font-medium text-slate-700 dark:text-slate-200">
          {activeProject ? activeProject.name : t('projectSelector.noneSelected')}
        </span>
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} aria-hidden="true" />
          <div className="absolute left-0 mt-1 w-64 z-50 rounded-[var(--radius-card)] border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-lg py-1 max-h-80 overflow-y-auto">
            {projects.map((p) => (
              <button
                key={p.id}
                onClick={() => { setActiveProjectId(p.id); setOpen(false); }}
                className="w-full flex items-center justify-between gap-2 px-3 py-2 text-sm text-left hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200"
              >
                <span className="truncate">{p.name}</span>
                {p.id === activeProjectId && <Check className="w-4 h-4 text-accent-primary flex-shrink-0" />}
              </button>
            ))}
            {projects.length === 0 && (
              <p className="px-3 py-2 text-sm text-slate-500 dark:text-slate-400">{t('projectSelector.none')}</p>
            )}
            <div className="border-t border-slate-200 dark:border-slate-700 mt-1 pt-1">
              {creating ? (
                <form onSubmit={handleCreate} className="px-3 py-2 flex gap-2">
                  <input
                    autoFocus
                    type="text"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder={t('projectSelector.namePlaceholder')}
                    className="flex-1 min-w-0 px-2 py-1 text-sm border rounded-md dark:bg-slate-700 dark:border-slate-600 dark:text-slate-100"
                  />
                  <button type="submit" className="px-2 py-1 text-sm bg-accent-primary text-white rounded-md flex-shrink-0">
                    {t('common.add')}
                  </button>
                </form>
              ) : (
                <button
                  onClick={() => setCreating(true)}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left text-accent-primary hover:bg-slate-50 dark:hover:bg-slate-700"
                >
                  <Plus className="w-4 h-4" />
                  {t('projectSelector.newProject')}
                </button>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default ProjectSelector;
