// File: frontend/src/components/ProjectMembersModal.js
// Manage a project's membership (issue #84): who can access this project,
// and whether they're a manager (edits project settings, manages
// membership) or an investigator (full CRUD on the project's data, nothing
// else). Modeled on UserManagement.js's list+role-pill+add-form pattern,
// scoped to one project instead of the whole install. Triggered from
// ProjectSelector's inline edit form, admin/manager only.
import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Users, Plus, Trash2, Shield, UserCog, User, X, AlertCircle } from 'lucide-react';
import { projectMembersAPI } from '../utils/api';
import { usersAPI } from '../utils/authAPI';

const ProjectMembersModal = ({ project, onClose }) => {
  const { t } = useTranslation();
  const [members, setMembers] = useState([]);
  const [directory, setDirectory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [newUserId, setNewUserId] = useState('');
  const [newRole, setNewRole] = useState('investigator');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const [membersData, directoryData] = await Promise.all([
        projectMembersAPI.getAll(project.id),
        usersAPI.getDirectory(),
      ]);
      setMembers(membersData);
      setDirectory(directoryData);
      setError('');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [project.id]);

  useEffect(() => { load(); }, [load]);

  const memberUserIds = new Set(members.map(m => m.user_id));
  const availableUsers = directory.filter(u => !memberUserIds.has(u.id));

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!newUserId) return;
    setSaving(true);
    setError('');
    try {
      await projectMembersAPI.add(project.id, { user_id: parseInt(newUserId, 10), project_role: newRole });
      setNewUserId('');
      await load();
    } catch (err) {
      setError(err.message || t('projectMembers.errorAdd'));
    } finally {
      setSaving(false);
    }
  };

  const handleRoleChange = async (userId, project_role) => {
    setError('');
    try {
      await projectMembersAPI.updateRole(project.id, userId, project_role);
      await load();
    } catch (err) {
      setError(err.message || t('projectMembers.errorUpdateRole'));
    }
  };

  const handleRemove = async (userId) => {
    if (!window.confirm(t('projectMembers.confirmRemove'))) return;
    setError('');
    try {
      await projectMembersAPI.remove(project.id, userId);
      await load();
    } catch (err) {
      setError(err.message || t('projectMembers.errorRemove'));
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl border border-gray-200 dark:border-gray-700 w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <div className="p-5 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center">
            <Users className="w-5 h-5 mr-2 text-accent-primary" />{t('projectMembers.title', { name: project.name })}
          </h2>
          <button onClick={onClose} className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700"><X className="w-5 h-5" /></button>
        </div>

        <div className="p-5 overflow-y-auto space-y-4">
          {error && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3 flex items-start gap-2">
              <AlertCircle className="h-4 w-4 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
              <p className="text-red-800 dark:text-red-200 text-sm">{error}</p>
            </div>
          )}

          {loading ? (
            <div className="text-center py-8 text-gray-500 dark:text-gray-400">{t('common.loadingEllipsis')}</div>
          ) : (
            <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-gray-50 dark:bg-gray-900">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">{t('projectMembers.columnUser')}</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">{t('projectMembers.columnRole')}</th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">{t('settings.users.columnActions')}</th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                  {members.length === 0 && (
                    <tr><td colSpan={3} className="px-4 py-4 text-sm text-gray-500 dark:text-gray-400 text-center">{t('projectMembers.noMembers')}</td></tr>
                  )}
                  {members.map(m => (
                    <tr key={m.id}>
                      <td className="px-4 py-2 whitespace-nowrap">
                        <div className="flex items-center">
                          <User className="w-4 h-4 mr-2 text-gray-400 flex-shrink-0" />
                          <div>
                            <div className="text-sm font-medium text-gray-900 dark:text-white">{m.username}</div>
                            {m.email && <div className="text-xs text-gray-500 dark:text-gray-400">{m.email}</div>}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-2 whitespace-nowrap">
                        <select
                          value={m.project_role}
                          onChange={e => handleRoleChange(m.user_id, e.target.value)}
                          className="text-xs px-2 py-1 border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white"
                        >
                          <option value="investigator">{t('projectMembers.roleInvestigator')}</option>
                          <option value="manager">{t('projectMembers.roleManager')}</option>
                        </select>
                      </td>
                      <td className="px-4 py-2 whitespace-nowrap text-right">
                        <button onClick={() => handleRemove(m.user_id)} className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <form onSubmit={handleAdd} className="flex flex-wrap gap-2 items-end pt-2 border-t border-gray-200 dark:border-gray-700">
            <div className="flex-1 min-w-[10rem]">
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">{t('projectMembers.addMember')}</label>
              <select
                value={newUserId}
                onChange={e => setNewUserId(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
              >
                <option value="">{t('common.selectPlaceholder')}</option>
                {availableUsers.map(u => <option key={u.id} value={u.id}>{u.username}</option>)}
              </select>
            </div>
            <select
              value={newRole}
              onChange={e => setNewRole(e.target.value)}
              className="px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
            >
              <option value="investigator">{t('projectMembers.roleInvestigator')}</option>
              <option value="manager">{t('projectMembers.roleManager')}</option>
            </select>
            <button type="submit" disabled={saving || !newUserId} className="px-4 py-2 bg-accent-primary text-white rounded-lg text-sm disabled:opacity-60 flex items-center gap-1">
              <Plus className="w-4 h-4" />{t('common.add')}
            </button>
          </form>

          <p className="text-xs text-gray-500 dark:text-gray-400 flex items-start gap-1.5">
            <UserCog className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
            <span>{t('projectMembers.roleHint')}</span>
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400 flex items-start gap-1.5">
            <Shield className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
            <span>{t('projectMembers.adminHint')}</span>
          </p>
        </div>
      </div>
    </div>
  );
};

export default ProjectMembersModal;
