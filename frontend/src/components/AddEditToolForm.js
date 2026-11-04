// File: frontend/src/components/AddEditToolForm.js
import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { X, Globe, AlertCircle, CheckCircle, ExternalLink, Plug, Link2 } from 'lucide-react';
import { toolsAPI, integrationsAPI } from '../utils/api';
import { useAuth } from '../contexts/AuthContext';
import { useProject } from '../contexts/ProjectContext';
import IntegrationBuilder from './tools/builder/IntegrationBuilder';
import { TOOL_CATEGORIES, TOOL_STATUSES } from '../utils/constants';
import { translateOptions } from '../utils/optionLabels';

const AddEditToolForm = ({ tool, onSave, onCancel }) => {
  const { t } = useTranslation();
  const toolCategories = translateOptions(t, 'tool_category', TOOL_CATEGORIES);
  const toolStatuses = translateOptions(t, 'tool_status', TOOL_STATUSES);
  const [formData, setFormData] = useState({
    name: '',
    link: '',
    description: '',
    category: '',
    status: '',
    tags: [],
    notes: ''
  });
  // Integrated tools and sharing (issue #96).
  const { currentUser } = useAuth();
  const { projects } = useProject();
  const isAdmin = currentUser?.role === 'admin';
  // Admins create central tools; everyone else their own.
  const isCentral = tool ? tool.owner_user_id == null : isAdmin;
  const [integrations, setIntegrations] = useState([]);
  const [sharing, setSharing] = useState({
    kind: 'link', integration_id: '', visibility: isCentral ? 'all' : 'private', project_ids: [], enabled: true, credential_mode: 'shared',
  });
  const [sharedKey, setSharedKey] = useState('');
  const [showBuilder, setShowBuilder] = useState(false);

  // A new integration from the builder: select it and fill in the tool.
  const handleBuilt = async (summary, testKey) => {
    setShowBuilder(false);
    const list = await integrationsAPI.getAll().catch(() => null);
    if (list) setIntegrations(list);
    setSharing((s) => ({ ...s, integration_id: summary.id, credential_mode: 'shared' }));
    setFormData((f) => ({
      ...f,
      name: f.name || summary.name,
      description: f.description || summary.description || '',
      link: f.link || summary.homepage || '',
    }));
    if (testKey) setSharedKey(testKey);
  };
  const [newTag, setNewTag] = useState('');
  const [urlPreview, setUrlPreview] = useState('');
  const [isValidUrl, setIsValidUrl] = useState(null);
  const [showUrlPreview, setShowUrlPreview] = useState(false);

  useEffect(() => {
    integrationsAPI.getAll().then(setIntegrations).catch((err) => console.error('Error loading integrations:', err));
  }, []);

  useEffect(() => {
    if (tool) {
      setSharing({
        kind: tool.kind || 'link',
        integration_id: tool.integration_id || '',
        visibility: tool.visibility || (tool.owner_user_id == null ? 'all' : 'private'),
        project_ids: tool.project_ids || [],
        enabled: tool.enabled !== false,
        credential_mode: tool.credential_mode || 'shared',
      });
      setFormData({
        name: tool.name || '',
        link: tool.link || '',
        description: tool.description || '',
        category: tool.category || '',
        status: tool.status || '',
        tags: tool.tags || [],
        notes: tool.notes || ''
      });
    }
  }, [tool]);

  // URL handling functions
  const formatUrl = (url) => {
    if (!url) return '';
    
    // Don't modify if already has protocol
    if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('ftp://')) {
      return url;
    }
    
    // Add https:// prefix for common web patterns
    if (url.startsWith('www.') || (url.includes('.') && !url.includes(' '))) {
      return `https://${url}`;
    }
    
    return url;
  };

  const validateUrl = (url) => {
    if (!url) return null;
    
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  };

  const handleUrlChange = (e) => {
    const rawValue = e.target.value;
    const formattedUrl = formatUrl(rawValue);
    
    setFormData({ ...formData, link: formattedUrl });
    setUrlPreview(formattedUrl);
    setIsValidUrl(validateUrl(formattedUrl));
    setShowUrlPreview(!!formattedUrl);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    try {
      const payload = {
        ...formData,
        kind: sharing.kind,
        integration_id: sharing.kind === 'integration' ? sharing.integration_id : null,
        visibility: sharing.visibility,
        project_ids: sharing.visibility === 'projects' ? sharing.project_ids : [],
        enabled: sharing.enabled,
        credential_mode: sharing.credential_mode,
      };
      let savedTool;
      if (tool) {
        savedTool = await toolsAPI.update(tool.id, payload);
      } else {
        savedTool = await toolsAPI.create(payload);
      }
      if (sharedKey.trim() && sharing.kind === 'integration' && sharing.credential_mode === 'shared') {
        await toolsAPI.setKey(savedTool.id, 'shared', sharedKey.trim());
      }
      onSave(savedTool);
    } catch (error) {
      console.error('Error saving tool:', error);
      alert(t('toolForm.errorSaveTool', { message: error.message }));
    }
  };

  const addTag = () => {
    if (newTag.trim() && !formData.tags.includes(newTag.trim())) {
      setFormData({ ...formData, tags: [...formData.tags, newTag.trim()] });
      setNewTag('');
    }
  };

  const removeTag = (tagToRemove) => {
    setFormData({
      ...formData,
      tags: formData.tags.filter(tag => tag !== tagToRemove)
    });
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="glass-heavy rounded-glass-xl shadow-glass-xl w-full max-w-2xl max-h-[90vh] overflow-hidden">
        <div className="p-6 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">
              {tool ? t('toolForm.editTitle') : t('toolForm.addTitle')}
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              {tool ? t('toolForm.editSubtitle') : t('toolForm.addSubtitle')}
            </p>
          </div>
          <button
            onClick={onCancel}
            className="p-2 rounded-[var(--radius-control)] text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 hover:text-slate-700 dark:hover:text-slate-200 transition-colors duration-150 active:scale-[0.97]"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <div className="overflow-y-auto max-h-[calc(90vh-140px)]">
          <form onSubmit={handleSubmit} className="p-6 space-y-6">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">{t('toolForm.toolNameRequired')}</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="input-base"
                placeholder={t('toolForm.toolNamePlaceholder')}
                required
              />
            </div>

          {/* Type: link or integration (issue #96) */}
          <div>
            <span className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">{t('tools.typeLabel')}</span>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {[['link', Link2, 'tools.typeLink', 'tools.typeLinkHelp'], ['integration', Plug, 'tools.typeIntegration', 'tools.typeIntegrationHelp']].map(([value, Icon, label, help]) => (
                <label key={value} className={`flex items-start gap-2 p-3 rounded-lg border cursor-pointer ${sharing.kind === value ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' : 'border-slate-200 dark:border-slate-700'}`}>
                  <input type="radio" className="mt-1" checked={sharing.kind === value} onChange={() => setSharing({ ...sharing, kind: value })} />
                  <span>
                    <span className="flex items-center gap-1.5 font-medium text-slate-900 dark:text-slate-100"><Icon className="w-4 h-4" />{t(label)}</span>
                    <span className="block text-xs text-slate-500 dark:text-slate-400">{t(help)}</span>
                  </span>
                </label>
              ))}
            </div>
          </div>

          {sharing.kind === 'integration' && (() => {
            const chosen = integrations.find((i) => i.id === sharing.integration_id);
            const needsKey = chosen && chosen.auth.type !== 'none';
            return (
              <div className="space-y-3 p-4 rounded-lg border border-slate-200 dark:border-slate-700">
                <label className="block">
                  <span className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">{t('tools.integrationLabel')}</span>
                  <select
                    className="input-base"
                    value={sharing.integration_id}
                    required
                    onChange={(e) => {
                      if (e.target.value === '__build__') { setShowBuilder(true); return; }
                      const next = integrations.find((i) => i.id === e.target.value);
                      setSharing({ ...sharing, integration_id: e.target.value });
                      if (next) {
                        setFormData((f) => ({
                          ...f,
                          name: f.name || next.name,
                          description: f.description || next.description || '',
                          link: f.link || next.homepage || '',
                        }));
                      }
                    }}
                  >
                    <option value="">{t('tools.chooseIntegration')}</option>
                    {integrations.map((i) => (
                      <option key={i.id} value={i.id}>{i.name}{i.source === 'imported' ? ` (${t('tools.community')})` : ''}</option>
                    ))}
                    {isAdmin && <option value="__build__">{t('builder.buildNewOption')}</option>}
                  </select>
                  {isAdmin && (
                    <button type="button" onClick={() => setShowBuilder(true)} className="mt-1 text-xs text-blue-600 dark:text-blue-400 hover:underline">
                      {t('builder.buildNewLink')}
                    </button>
                  )}
                </label>
                {chosen && (
                  <div className="text-xs text-slate-600 dark:text-slate-300 space-y-1">
                    <p>{t('tools.sendsTo', { host: chosen.host })}</p>
                    <p>{t('tools.operationsLine', { list: chosen.operations.map((o) => o.label).join(' · ') })}</p>
                    <p>{chosen.auth.type === 'none' ? t('tools.noKeyNeeded') : chosen.auth.required ? t('tools.keyRequired') : t('tools.keyOptional')}</p>
                    {chosen.terms && <a href={chosen.terms} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-blue-600 dark:text-blue-400">{t('tools.providerTerms')}<ExternalLink className="w-3 h-3" /></a>}
                  </div>
                )}
                {needsKey && (
                  <fieldset className="space-y-2">
                    <legend className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">{t('tools.keyModeLabel')}</legend>
                    <label className="flex items-start gap-2 text-sm cursor-pointer">
                      <input type="radio" className="mt-1" checked={sharing.credential_mode === 'shared'} onChange={() => setSharing({ ...sharing, credential_mode: 'shared' })} />
                      <span>{t('tools.keyModeSharedOption')}<span className="block text-xs text-slate-500">{t('tools.keyModeSharedHelp')}</span></span>
                    </label>
                    <label className="flex items-start gap-2 text-sm cursor-pointer">
                      <input type="radio" className="mt-1" checked={sharing.credential_mode === 'per_user'} onChange={() => setSharing({ ...sharing, credential_mode: 'per_user' })} />
                      <span>{t('tools.keyModePerUserOption')}<span className="block text-xs text-slate-500">{t('tools.keyModePerUserHelp')}</span></span>
                    </label>
                    {sharing.credential_mode === 'shared' && (
                      <input
                        type="password"
                        autoComplete="off"
                        className="input-base"
                        value={sharedKey}
                        onChange={(e) => setSharedKey(e.target.value)}
                        placeholder={tool?.has_shared_key ? t('tools.replaceKeyPlaceholder') : t('tools.sharedKeyPlaceholder')}
                      />
                    )}
                  </fieldset>
                )}
              </div>
            );
          })()}

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              {t('toolForm.link')}
              <span className="text-xs text-gray-500 dark:text-slate-400 ms-2">{t('toolForm.linkAutoHint')}</span>
            </label>
            <div className="relative">
              <input
                type="text"
                value={formData.link}
                onChange={handleUrlChange}
                className={`input-base pe-12 ${
                  isValidUrl === true ? 'border-green-400 focus:border-green-500 focus:ring-green-500/25' :
                  isValidUrl === false ? 'border-red-400 focus:border-red-500 focus:ring-red-500/25' :
                  ''
                }`}
                placeholder={t('toolForm.linkPlaceholder')}
              />
              <div className="absolute inset-y-0 end-0 flex items-center pe-3">
                {isValidUrl === true && (
                  <CheckCircle className="w-5 h-5 text-green-500" />
                )}
                {isValidUrl === false && (
                  <AlertCircle className="w-5 h-5 text-red-500" />
                )}
                {isValidUrl === true && formData.link && (
                  <a
                    href={formData.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="ms-2 text-blue-500 hover:text-blue-700"
                    title={t('toolForm.testLink')}
                  >
                    <ExternalLink className="w-4 h-4" />
                  </a>
                )}
              </div>
            </div>
            {showUrlPreview && formData.link && (
              <div className="mt-3 p-3 glass rounded-[var(--radius-control)]">
                <div className="flex items-center">
                  <Globe className="w-4 h-4 text-blue-600 dark:text-blue-400 me-2" />
                  <span className="text-gray-600 dark:text-slate-400 font-medium">{t('toolForm.previewLabel')}</span>
                  <span className={`ms-1 font-mono text-sm ${isValidUrl ? 'text-green-600' : 'text-red-600'}`}>
                    {urlPreview}
                  </span>
                </div>
              </div>
            )}
          </div>
          
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">{t('toolForm.description')}</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="input-base resize-none"
              rows="3"
              placeholder={t('toolForm.descriptionPlaceholder')}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">{t('toolForm.category')}</label>
              <select
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                className="input-base"
              >
                <option value="">{t('toolForm.selectCategory')}</option>
                {toolCategories.map(cat => (
                  <option key={cat.value} value={cat.value}>{cat.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">{t('toolForm.status')}</label>
              <select
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                className="input-base"
              >
                <option value="">{t('toolForm.selectStatus')}</option>
                {toolStatuses.map(status => (
                  <option key={status.value} value={status.value}>{status.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">{t('toolForm.tags')}</label>
            <div className="flex space-x-2 mb-3">
              <input
                type="text"
                value={newTag}
                onChange={(e) => setNewTag(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addTag())}
                placeholder={t('toolForm.tagPlaceholder')}
                className="input-base flex-1"
              />
              <button
                type="button"
                onClick={addTag}
                className="btn btn-primary"
              >
                {t('common.add')}
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {formData.tags.map((tag, index) => (
                <span key={index} className="inline-flex items-center px-2.5 py-1 rounded-md text-sm font-medium bg-accent-primary/10 text-accent-primary">
                  {tag}
                  <button
                    type="button"
                    onClick={() => removeTag(tag)}
                    className="ms-1.5 text-accent-primary/70 hover:text-accent-primary transition-colors duration-150"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">{t('toolForm.notes')}</label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              className="input-base resize-none"
              rows="3"
              placeholder={t('toolForm.notesPlaceholder')}
            />
          </div>

          {/* Who can use it (issue #96) */}
          <fieldset className="space-y-2">
            <legend className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">{t('tools.sharingLabel')}</legend>
            <label className="flex items-start gap-2 text-sm cursor-pointer">
              <input type="radio" className="mt-1" checked={sharing.visibility !== 'projects'} onChange={() => setSharing({ ...sharing, visibility: isCentral ? 'all' : 'private' })} />
              <span>{isCentral ? t('tools.visibilityAll') : t('tools.visibilityPrivate')}
                <span className="block text-xs text-slate-500">{isCentral ? t('tools.visibilityAllHelp') : t('tools.visibilityPrivateHelp')}</span></span>
            </label>
            <label className="flex items-start gap-2 text-sm cursor-pointer">
              <input type="radio" className="mt-1" checked={sharing.visibility === 'projects'} onChange={() => setSharing({ ...sharing, visibility: 'projects' })} />
              <span>{isCentral ? t('tools.visibilityProjects') : t('tools.visibilityShareProjects')}
                <span className="block text-xs text-slate-500">{isCentral ? t('tools.visibilityProjectsHelp') : t('tools.visibilityShareProjectsHelp')}</span></span>
            </label>
            {sharing.visibility === 'projects' && (
              <div className="ms-6 grid grid-cols-1 md:grid-cols-2 gap-1 max-h-40 overflow-y-auto">
                {projects.map((p) => (
                  <label key={p.id} className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                      type="checkbox"
                      checked={sharing.project_ids.includes(p.id)}
                      onChange={(e) => setSharing({
                        ...sharing,
                        project_ids: e.target.checked ? [...sharing.project_ids, p.id] : sharing.project_ids.filter((id) => id !== p.id),
                      })}
                    />
                    {p.name}
                  </label>
                ))}
              </div>
            )}
            <label className="flex items-center gap-2 text-sm cursor-pointer pt-2">
              <input type="checkbox" checked={sharing.enabled} onChange={(e) => setSharing({ ...sharing, enabled: e.target.checked })} />
              {t('tools.enabledLabel')}
            </label>
          </fieldset>

          <div className="flex justify-end space-x-3 pt-6 border-t border-slate-200 dark:border-slate-700">
            <button
              type="button"
              onClick={onCancel}
              className="btn btn-secondary"
            >
              {t('common.cancel')}
            </button>
            <button
              type="submit"
              className="btn btn-primary"
            >
              {tool ? t('toolForm.updateTool') : t('toolForm.createTool')}
            </button>
          </div>
          </form>
        </div>
      </div>
      {showBuilder && <IntegrationBuilder onClose={() => setShowBuilder(false)} onInstalled={handleBuilt} />}
    </div>
  );
};

export default AddEditToolForm;