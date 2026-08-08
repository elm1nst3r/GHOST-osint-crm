// File: frontend/src/components/AddEditToolForm.js
import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { X, Globe, AlertCircle, CheckCircle, ExternalLink } from 'lucide-react';
import { toolsAPI } from '../utils/api';
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
  const [newTag, setNewTag] = useState('');
  const [urlPreview, setUrlPreview] = useState('');
  const [isValidUrl, setIsValidUrl] = useState(null);
  const [showUrlPreview, setShowUrlPreview] = useState(false);

  useEffect(() => {
    if (tool) {
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
      let savedTool;
      if (tool) {
        savedTool = await toolsAPI.update(tool.id, formData);
      } else {
        savedTool = await toolsAPI.create(formData);
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

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              {t('toolForm.link')}
              <span className="text-xs text-gray-500 dark:text-slate-400 ml-2">{t('toolForm.linkAutoHint')}</span>
            </label>
            <div className="relative">
              <input
                type="text"
                value={formData.link}
                onChange={handleUrlChange}
                className={`input-base pr-12 ${
                  isValidUrl === true ? 'border-green-400 focus:border-green-500 focus:ring-green-500/25' :
                  isValidUrl === false ? 'border-red-400 focus:border-red-500 focus:ring-red-500/25' :
                  ''
                }`}
                placeholder={t('toolForm.linkPlaceholder')}
              />
              <div className="absolute inset-y-0 right-0 flex items-center pr-3">
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
                    className="ml-2 text-blue-500 hover:text-blue-700"
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
                  <Globe className="w-4 h-4 text-blue-600 dark:text-blue-400 mr-2" />
                  <span className="text-gray-600 dark:text-slate-400 font-medium">{t('toolForm.previewLabel')}</span>
                  <span className={`ml-1 font-mono text-sm ${isValidUrl ? 'text-green-600' : 'text-red-600'}`}>
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
                    className="ml-1.5 text-accent-primary/70 hover:text-accent-primary transition-colors duration-150"
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
    </div>
  );
};

export default AddEditToolForm;