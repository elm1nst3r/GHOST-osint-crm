// File: frontend/src/components/ToolsList.jsx
//
// OSINT tools, in two sections (issue #96):
//   - Integrated tools: GHOST calls them; badge shows Connected / Needs key /
//     Disabled. Run them here, or from a person's OSINT data.
//   - Generic tools: links, as all tools used to be.
// Each card also shows who it's shared with. Admins manage central tools and
// can list everyone's ("Show all tools"); users manage the tools they added.
import { useState, useMemo, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Search, Plus, Edit2, Trash2, Filter, SortAsc, SortDesc, BarChart3, ExternalLink, Upload, Download,
  Plug, Link2, KeyRound, Play, Globe, Lock, FolderOpen, User,
} from 'lucide-react';
import { toolsAPI } from '../utils/api';
import { TOOL_STATUSES, TOOL_CATEGORIES } from '../utils/constants';
import ImportToolsModal from './ImportToolsModal';
import ExportToolsModal from './tools/ExportToolsModal';
import ToolRunModal from './tools/ToolRunModal';
import ToolKeyDialog from './tools/ToolKeyDialog';
import { translateOptions } from '../utils/optionLabels';
import { useData } from '../contexts/DataContext';
import { useUI } from '../contexts/UIContext';
import { useAuth } from '../contexts/AuthContext';
import { useProject } from '../contexts/ProjectContext';

const BADGE = 'inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-full font-medium';

export const ConnectionBadge = ({ tool }) => {
  const { t } = useTranslation();
  const styles = {
    link: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-200',
    connected: 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300',
    needs_key: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300',
    disabled: 'bg-gray-200 text-gray-600 dark:bg-gray-700 dark:text-gray-400',
    missing_integration: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300',
  };
  const Icon = tool.connection_status === 'link' ? Link2 : Plug;
  return (
    <span className={`${BADGE} ${styles[tool.connection_status] || styles.link}`} title={t(`tools.statusHelp_${tool.connection_status}`)}>
      <Icon className="w-3 h-3" />{t(`tools.status_${tool.connection_status}`)}
    </span>
  );
};

const SharingBadge = ({ tool, projects }) => {
  const { t } = useTranslation();
  let Icon = Globe;
  let text = t('tools.sharedEveryone');
  if (tool.visibility === 'private') { Icon = Lock; text = t('tools.sharedPrivate'); }
  if (tool.visibility === 'projects') {
    Icon = FolderOpen;
    const names = tool.project_ids.map((id) => projects.find((p) => p.id === id)?.name).filter(Boolean);
    text = names.length ? names.join(', ') : t('tools.sharedProjects');
  }
  return (
    <span className={`${BADGE} bg-blue-50 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300`} title={t('tools.sharingTitle')}>
      <Icon className="w-3 h-3" /><span className="truncate max-w-48">{text}</span>
    </span>
  );
};

const ToolsList = () => {
  const { t } = useTranslation();
  const toolCategories = translateOptions(t, 'tool_category', TOOL_CATEGORIES);
  const toolStatuses = translateOptions(t, 'tool_status', TOOL_STATUSES);
  const { tools, fetchTools } = useData();
  const { setShowAddToolForm, setEditingTool } = useUI();
  const { currentUser } = useAuth();
  const { projects, activeProjectId } = useProject();
  const isAdmin = currentUser?.role === 'admin';

  const [section, setSection] = useState('integrated');
  const [showAll, setShowAll] = useState(false);
  const [allTools, setAllTools] = useState([]);
  const [allowUserTools, setAllowUserTools] = useState(true);
  const [showImport, setShowImport] = useState(false);
  const [showExport, setShowExport] = useState(false);
  const [runTool, setRunTool] = useState(null);
  const [keyDialog, setKeyDialog] = useState(null);
  const [toolSearchTerm, setToolSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [sortBy, setSortBy] = useState('name');
  const [sortOrder, setSortOrder] = useState('asc');
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    toolsAPI.getSettings().then((s) => setAllowUserTools(Boolean(s.allow_user_tools))).catch(() => {});
  }, []);

  const loadAll = useCallback(() => {
    if (!isAdmin) return;
    toolsAPI.getAll({ all: true }).then(setAllTools).catch((err) => console.error('Error fetching all tools:', err));
  }, [isAdmin]);

  useEffect(() => { if (showAll) loadAll(); }, [showAll, loadAll]);

  const refresh = useCallback(() => { fetchTools(); if (showAll) loadAll(); }, [fetchTools, showAll, loadAll]);

  const source = showAll ? allTools : tools;
  const integratedCount = source.filter((x) => x.kind === 'integration').length;
  const genericCount = source.length - integratedCount;

  const filteredAndSortedTools = useMemo(() => {
    const term = toolSearchTerm.toLowerCase();
    const filtered = source.filter((tool) => {
      if ((section === 'integrated') !== (tool.kind === 'integration')) return false;
      const matchesSearch = term === '' ||
        tool.name.toLowerCase().includes(term) ||
        (tool.category && tool.category.toLowerCase().includes(term)) ||
        (tool.tags && tool.tags.some((tag) => tag.toLowerCase().includes(term))) ||
        (tool.description && tool.description.toLowerCase().includes(term)) ||
        (tool.integration?.name && tool.integration.name.toLowerCase().includes(term));
      const matchesCategory = filterCategory === '' || tool.category === filterCategory;
      const matchesStatus = filterStatus === '' || tool.status === filterStatus;
      return matchesSearch && matchesCategory && matchesStatus;
    });

    filtered.sort((a, b) => {
      let compareValue;
      switch (sortBy) {
        case 'name': compareValue = a.name.localeCompare(b.name); break;
        case 'category': compareValue = (a.category || '').localeCompare(b.category || ''); break;
        case 'status': compareValue = (a.status || '').localeCompare(b.status || ''); break;
        case 'created': compareValue = new Date(a.created_at || 0) - new Date(b.created_at || 0); break;
        default: compareValue = 0;
      }
      return sortOrder === 'asc' ? compareValue : -compareValue;
    });
    return filtered;
  }, [source, section, toolSearchTerm, filterCategory, filterStatus, sortBy, sortOrder]);

  const handleDelete = async (tool) => {
    if (!window.confirm(t('toolsList.confirmDeleteTool'))) return;
    try {
      await toolsAPI.delete(tool.id);
      refresh();
    } catch (error) {
      console.error('Error deleting tool:', error);
      alert(t('toolsList.errorDeleteTool'));
    }
  };

  const getStatusColor = (status) => {
    const statusConfig = TOOL_STATUSES.find((s) => s.value === status);
    const colorMap = {
      green: 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-400',
      blue: 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-400',
      yellow: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-400',
      red: 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-400',
      gray: 'bg-gray-100 dark:bg-slate-700 text-gray-800 dark:text-slate-200',
    };
    return colorMap[statusConfig?.color] || 'bg-gray-100 dark:bg-slate-700 text-gray-800 dark:text-slate-200';
  };

  const canAdd = isAdmin || allowUserTools;
  const iconButton = 'p-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-600 dark:text-gray-300 transition-colors';

  const tabClass = (active) => `inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
    active ? 'bg-blue-600 text-white' : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
  }`;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:justify-between md:items-start gap-4">
        <div>
          <h1 className="text-3xl font-bold bg-linear-to-r from-gray-900 to-gray-600 dark:from-gray-100 dark:to-gray-300 bg-clip-text text-transparent">
            {t('toolsList.title')}
          </h1>
          <div className="flex flex-wrap items-center gap-4 mt-2">
            <div className="flex items-center text-sm text-gray-600 dark:text-gray-400">
              <BarChart3 className="w-4 h-4 me-1 text-blue-600 dark:text-blue-400" />
              <span className="font-medium">{t('toolsList.toolsCount', { count: source.length })}</span>
            </div>
            {isAdmin && (
              <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 cursor-pointer">
                <input type="checkbox" checked={showAll} onChange={(e) => setShowAll(e.target.checked)} />
                {t('tools.showAll')}
              </label>
            )}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={() => setShowExport(true)}
            className="px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors flex items-center"
          >
            <Download className="w-5 h-5 me-2" />{t('tools.export')}
          </button>
          {canAdd && (
            <button
              onClick={() => setShowImport(true)}
              className="px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors flex items-center"
            >
              <Upload className="w-5 h-5 me-2" />{t('toolsList.importTools')}
            </button>
          )}
          {canAdd && (
            <button
              onClick={() => setShowAddToolForm(true)}
              className="px-6 py-3 bg-accent-primary text-white rounded-lg hover:bg-accent-primary-hover transition-all duration-300 flex items-center group"
            >
              <Plus className="w-5 h-5 me-2" />{t('toolsList.addTool')}
            </button>
          )}
        </div>
      </div>

      {!canAdd && <p className="text-sm text-gray-500 dark:text-gray-400">{t('tools.userToolsOff')}</p>}

      {/* Sections */}
      <div className="flex flex-wrap gap-2" role="tablist">
        <button type="button" role="tab" aria-selected={section === 'integrated'} onClick={() => setSection('integrated')} className={tabClass(section === 'integrated')}>
          <Plug className="w-4 h-4" />{t('tools.sectionIntegrated')}<span className="opacity-80">({integratedCount})</span>
        </button>
        <button type="button" role="tab" aria-selected={section === 'generic'} onClick={() => setSection('generic')} className={tabClass(section === 'generic')}>
          <Link2 className="w-4 h-4" />{t('tools.sectionGeneric')}<span className="opacity-80">({genericCount})</span>
        </button>
      </div>
      <p className="text-sm text-gray-600 dark:text-gray-400">
        {section === 'integrated' ? t('tools.sectionIntegratedHelp') : t('tools.sectionGenericHelp')}
      </p>

      {/* Search and Filters */}
      <div className="bg-white dark:bg-gray-800 backdrop-blur-xl border border-gray-300 dark:border-gray-600 shadow-glass-lg rounded-lg-lg p-6">
        <div className="flex flex-col space-y-4">
          <div className="flex flex-wrap gap-4">
            <div className="flex-1 relative min-w-48">
              <Search className="absolute inset-s-3 top-1/2 transform -translate-y-1/2 text-blue-600 dark:text-blue-400 w-5 h-5" />
              <input
                type="text"
                placeholder={t('toolsList.searchPlaceholder')}
                value={toolSearchTerm}
                onChange={(e) => setToolSearchTerm(e.target.value)}
                className="w-full ps-10 pe-4 py-3 glass border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-hidden focus:border-accent-primary focus:shadow-md transition-all duration-300"
              />
            </div>
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 transition-all duration-300 flex items-center ${
                showFilters ? 'bg-blue-600 text-white dark:bg-blue-500' : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100'
              }`}
            >
              <Filter className="w-5 h-5 me-2" />{t('relationshipManager.filters')}
            </button>
          </div>

          {showFilters && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 border-t border-gray-200 dark:border-gray-700">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{t('toolsList.categoryLabel')}</label>
                <select value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)} className="w-full px-3 py-2 glass border border-gray-300 dark:border-gray-600 rounded-lg dark:text-gray-100 dark:bg-slate-800">
                  <option value="">{t('toolsList.allCategories')}</option>
                  {toolCategories.map((cat) => <option key={cat.value} value={cat.value}>{cat.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{t('toolsList.statusLabel')}</label>
                <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="w-full px-3 py-2 glass border border-gray-300 dark:border-gray-600 rounded-lg dark:text-gray-100 dark:bg-slate-800">
                  <option value="">{t('toolsList.allStatuses')}</option>
                  {toolStatuses.map((status) => <option key={status.value} value={status.value}>{status.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{t('toolsList.sortByLabel')}</label>
                <div className="flex gap-x-2">
                  <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} className="flex-1 px-3 py-2 glass border border-gray-300 dark:border-gray-600 rounded-lg dark:text-gray-100 dark:bg-slate-800">
                    <option value="name">{t('toolsList.sortName')}</option>
                    <option value="category">{t('toolsList.categoryLabel')}</option>
                    <option value="status">{t('toolsList.statusLabel')}</option>
                    <option value="created">{t('toolsList.sortDateAdded')}</option>
                  </select>
                  <button
                    onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                    className="px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-600 dark:text-gray-300"
                    title={sortOrder === 'asc' ? t('toolsList.sortDescendingTitle') : t('toolsList.sortAscendingTitle')}
                  >
                    {sortOrder === 'asc' ? <SortAsc className="w-4 h-4" /> : <SortDesc className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Tools Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredAndSortedTools.map((tool) => {
          const isIntegration = tool.kind === 'integration';
          const perUser = tool.credential_mode === 'per_user';
          const keyRequired = tool.integration?.auth?.type && tool.integration.auth.type !== 'none';
          return (
            <div key={tool.id} className={`bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 shadow-glass-lg rounded-lg-lg p-5 flex flex-col ${tool.enabled ? '' : 'opacity-70'}`}>
              <div className="flex justify-between items-start gap-2 mb-2">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 wrap-break-word">{tool.name}</h3>
                {tool.can_manage && (
                  <div className="flex gap-x-1 shrink-0">
                    <button onClick={() => setEditingTool(tool)} className={`${iconButton} hover:bg-blue-700 hover:text-white`} title={t('common.edit')} aria-label={t('common.edit')}>
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button onClick={() => handleDelete(tool)} className={`${iconButton} hover:bg-red-600 hover:text-white`} title={t('common.delete')} aria-label={t('common.delete')}>
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>

              <div className="flex flex-wrap gap-1.5 mb-3">
                <ConnectionBadge tool={tool} />
                <SharingBadge tool={tool} projects={projects} />
                {tool.owner_user_id && (
                  <span className={`${BADGE} bg-purple-50 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300`}>
                    <User className="w-3 h-3" />{tool.owner_user_id === currentUser?.id ? t('tools.ownedByYou') : t('tools.ownedBy', { name: tool.owner_username })}
                  </span>
                )}
              </div>

              {isIntegration && tool.integration && (
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                  {tool.integration.name === tool.name ? tool.integration.host : t('tools.integrationLine', { name: tool.integration.name, host: tool.integration.host })}
                  {keyRequired && <> · {perUser ? t('tools.keyModePerUser') : t('tools.keyModeShared')}</>}
                </p>
              )}

              {tool.description && <p className="text-gray-600 dark:text-gray-400 text-sm mb-3 leading-relaxed">{tool.description}</p>}

              {tool.category && (
                <div className="mb-2">
                  <span className="inline-block px-2 py-1 text-xs rounded-lg bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400 font-medium">{tool.category}</span>
                </div>
              )}

              {tool.tags && tool.tags.length > 0 && (
                <div className="mb-3 flex flex-wrap gap-1">
                  {tool.tags.map((tag) => (
                    <span key={tag} className="inline-block px-2 py-1 text-xs rounded-lg bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400 font-medium">{tag}</span>
                  ))}
                </div>
              )}

              <div className="mt-auto pt-2 flex flex-wrap gap-2">
                {isIntegration && tool.connection_status === 'connected' && (
                  <button onClick={() => setRunTool(tool)} className="inline-flex items-center px-3 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 text-sm font-medium">
                    <Play className="w-4 h-4 me-1.5" />{t('tools.search')}
                  </button>
                )}
                {isIntegration && keyRequired && tool.integration && (perUser || tool.can_manage) && (
                  <button
                    onClick={() => setKeyDialog({ tool, scope: perUser ? 'mine' : 'shared' })}
                    className="inline-flex items-center px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 text-sm"
                  >
                    <KeyRound className="w-4 h-4 me-1.5" />
                    {perUser ? (tool.has_my_key ? t('tools.yourKey') : t('tools.addYourKey')) : (tool.has_shared_key ? t('tools.sharedKey') : t('tools.addSharedKey'))}
                  </button>
                )}
                {tool.link && (
                  <a
                    href={tool.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-blue-600 dark:text-blue-400 hover:bg-blue-700 hover:text-white transition-colors text-sm font-medium"
                  >
                    <ExternalLink className="w-4 h-4 me-1.5" />{t('toolsList.visitTool')}
                  </a>
                )}
              </div>

              {tool.status && (
                <div className="mt-3">
                  <span className={`inline-block px-3 py-1 text-xs rounded-lg font-medium ${getStatusColor(tool.status)}`}>{tool.status}</span>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {filteredAndSortedTools.length === 0 && (
        <div className="text-center py-12">
          <div className="bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 shadow-glass-lg rounded-lg-lg p-8 max-w-md mx-auto">
            <div className="text-gray-400 dark:text-gray-500 mb-4">
              {section === 'integrated' ? <Plug className="w-12 h-12 mx-auto opacity-50" /> : <Search className="w-12 h-12 mx-auto opacity-50" />}
            </div>
            <p className="text-gray-600 dark:text-gray-400 font-medium">
              {toolSearchTerm || filterCategory || filterStatus ? t('toolsList.noToolsFound') : (section === 'integrated' ? t('tools.emptyIntegrated') : t('tools.emptyGeneric'))}
            </p>
            {section === 'integrated' && !toolSearchTerm && canAdd && (
              <p className="text-gray-500 text-sm mt-2">{t('tools.emptyIntegratedHint')}</p>
            )}
          </div>
        </div>
      )}

      {showImport && <ImportToolsModal onClose={() => { setShowImport(false); refresh(); }} />}
      {showExport && <ExportToolsModal onClose={() => setShowExport(false)} activeProjectId={activeProjectId} />}
      {runTool && <ToolRunModal tools={[runTool]} initialTool={runTool} onClose={() => setRunTool(null)} />}
      {keyDialog && (
        <ToolKeyDialog tool={keyDialog.tool} scope={keyDialog.scope} onClose={() => { setKeyDialog(null); refresh(); }} onChanged={refresh} />
      )}
    </div>
  );
};

export default ToolsList;
