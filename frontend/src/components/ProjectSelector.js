// File: frontend/src/components/ProjectSelector.js
// Top-of-app project switcher (issue #83): switch, create, and edit
// projects (rename, symbol, cross-linking, archive status, delete). The
// first-run / no-active-project case is handled separately by ProjectGate,
// which wraps AppShell. Deliberately still basic beyond that -- no "all
// projects" merged view, no cross-project admin mode -- those are later
// stages per docs/specs/case-data-isolation.md.
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FolderKanban, Plus, Check, Pencil, Trash2, X } from 'lucide-react';
import { useProject } from '../contexts/ProjectContext';
import { projectsAPI } from '../utils/api';

const EMPTY_EDIT = { name: '', icon: '', status: 'active', allow_cross_linking: false };

const ProjectSelector = ({ compact = false }) => {
  const { t } = useTranslation();
  const { projects, activeProjectId, activeProject, setActiveProjectId, refetchProjects } = useProject();
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState(EMPTY_EDIT);

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

  const startEdit = (e, p) => {
    e.stopPropagation();
    setEditingId(p.id);
    setEditForm({
      name: p.name,
      icon: p.icon || '',
      status: p.status || 'active',
      allow_cross_linking: !!p.allow_cross_linking,
    });
  };

  const cancelEdit = (e) => {
    if (e) e.stopPropagation();
    setEditingId(null);
    setEditForm(EMPTY_EDIT);
  };

  const saveEdit = async (e, id) => {
    e.preventDefault();
    e.stopPropagation();
    if (!editForm.name.trim()) return;
    try {
      await projectsAPI.update(id, { ...editForm, name: editForm.name.trim() });
      await refetchProjects();
      cancelEdit();
    } catch (error) {
      console.error('Error updating project:', error);
      alert(t('projectSelector.errorUpdate'));
    }
  };

  const handleDelete = async (e, p) => {
    e.stopPropagation();
    if (!window.confirm(t('projectSelector.confirmDelete', { name: p.name }))) return;
    try {
      await projectsAPI.delete(p.id);
      await refetchProjects();
      if (activeProjectId === p.id) setActiveProjectId(null);
      cancelEdit();
    } catch (error) {
      console.error('Error deleting project:', error);
      alert(error.message || t('projectSelector.errorDelete'));
    }
  };

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className={`flex items-center gap-2 rounded-[var(--radius-control)] border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors ${compact ? 'px-2 py-1.5 text-xs' : 'px-3 py-2 text-sm w-full'}`}
        title={t('projectSelector.title')}
      >
        {activeProject?.icon ? (
          <span className="flex-shrink-0 leading-none">{activeProject.icon}</span>
        ) : (
          <FolderKanban className={compact ? 'w-3.5 h-3.5 text-slate-500 flex-shrink-0' : 'w-4 h-4 text-slate-500 flex-shrink-0'} />
        )}
        <span className="truncate font-medium text-slate-700 dark:text-slate-200">
          {activeProject ? activeProject.name : t('projectSelector.noneSelected')}
        </span>
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => { setOpen(false); cancelEdit(); }} aria-hidden="true" />
          <div className="absolute left-0 mt-1 w-80 z-50 rounded-[var(--radius-card)] border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-lg py-1 max-h-96 overflow-y-auto">
            {projects.map((p) => (
              <div key={p.id}>
                {editingId === p.id ? (
                  <form onSubmit={(e) => saveEdit(e, p.id)} className="px-3 py-2 space-y-2 bg-slate-50 dark:bg-slate-900">
                    <div className="flex gap-2">
                      <input
                        autoFocus
                        type="text"
                        value={editForm.icon}
                        onChange={(e) => setEditForm((f) => ({ ...f, icon: e.target.value }))}
                        placeholder={t('projectSelector.iconPlaceholder')}
                        maxLength={4}
                        className="w-12 px-2 py-1 text-sm text-center border rounded-md dark:bg-slate-700 dark:border-slate-600 dark:text-slate-100"
                      />
                      <input
                        type="text"
                        value={editForm.name}
                        onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
                        placeholder={t('projectSelector.namePlaceholder')}
                        className="flex-1 min-w-0 px-2 py-1 text-sm border rounded-md dark:bg-slate-700 dark:border-slate-600 dark:text-slate-100"
                      />
                    </div>
                    <select
                      value={editForm.status}
                      onChange={(e) => setEditForm((f) => ({ ...f, status: e.target.value }))}
                      className="w-full px-2 py-1 text-sm border rounded-md dark:bg-slate-700 dark:border-slate-600 dark:text-slate-100"
                    >
                      <option value="active">{t('projectSelector.statusActive')}</option>
                      <option value="on_hold">{t('projectSelector.statusOnHold')}</option>
                      <option value="closed">{t('projectSelector.statusClosed')}</option>
                    </select>
                    <label className="flex items-start gap-2 text-xs text-slate-600 dark:text-slate-400 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={editForm.allow_cross_linking}
                        onChange={(e) => setEditForm((f) => ({ ...f, allow_cross_linking: e.target.checked }))}
                        className="mt-0.5"
                      />
                      <span>{t('projectSelector.allowCrossLinking')}</span>
                    </label>
                    <div className="flex items-center justify-between pt-1">
                      <button
                        type="button"
                        onClick={(e) => handleDelete(e, p)}
                        className="p-1.5 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-md"
                        title={t('common.delete')}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={cancelEdit}
                          className="px-2 py-1 text-xs text-slate-700 dark:text-slate-300 bg-slate-200 dark:bg-slate-700 rounded-md"
                        >
                          {t('common.cancel')}
                        </button>
                        <button
                          type="submit"
                          className="px-2 py-1 text-xs bg-accent-primary text-white rounded-md"
                        >
                          {t('common.save')}
                        </button>
                      </div>
                    </div>
                  </form>
                ) : (
                  <div className="w-full flex items-center gap-1 px-2 py-1 group hover:bg-slate-50 dark:hover:bg-slate-700">
                    <button
                      onClick={() => { setActiveProjectId(p.id); setOpen(false); }}
                      className="flex-1 min-w-0 flex items-center gap-2 px-1 py-1 text-sm text-left text-slate-700 dark:text-slate-200"
                    >
                      {p.icon ? <span className="flex-shrink-0 leading-none">{p.icon}</span> : <span className="w-4 flex-shrink-0" />}
                      <span className="truncate">{p.name}</span>
                      {p.status && p.status !== 'active' && (
                        <span className="text-[10px] uppercase tracking-wide text-slate-400 flex-shrink-0">
                          {t(`projectSelector.status${p.status === 'on_hold' ? 'OnHold' : 'Closed'}`)}
                        </span>
                      )}
                    </button>
                    {p.id === activeProjectId && <Check className="w-4 h-4 text-accent-primary flex-shrink-0" />}
                    <button
                      onClick={(e) => startEdit(e, p)}
                      className="p-1 rounded-md text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 opacity-0 group-hover:opacity-100 flex-shrink-0"
                      title={t('common.edit')}
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>
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
                  <button
                    type="button"
                    onClick={() => { setCreating(false); setNewName(''); }}
                    className="p-1.5 text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 rounded-md flex-shrink-0"
                  >
                    <X className="w-4 h-4" />
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
