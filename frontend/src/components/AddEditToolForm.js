// File: frontend/src/components/AddEditToolForm.js
import React, { useState, useEffect } from 'react';
import { X, Globe, AlertCircle, CheckCircle, ExternalLink } from 'lucide-react';
import { toolsAPI } from '../utils/api';
import { TOOL_CATEGORIES, TOOL_STATUSES } from '../utils/constants';

const AddEditToolForm = ({ tool, onSave, onCancel }) => {
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
      alert('Failed to save tool: ' + error.message);
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
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="glass-card backdrop-blur-xl border border-white/30 shadow-glass-xl rounded-glass-xl w-full max-w-2xl max-h-[90vh] overflow-hidden">
        <div className="p-6 border-b border-white/20 flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold bg-gradient-to-r from-gray-900 to-gray-600 bg-clip-text text-transparent">
              {tool ? 'Edit Tool' : 'Add New Tool'}
            </h2>
            <p className="text-sm text-gray-600 mt-1">
              {tool ? 'Update tool information and settings' : 'Add a new OSINT tool to your directory'}
            </p>
          </div>
          <button
            onClick={onCancel}
            className="p-2 glass-button rounded-glass text-gray-600 hover:bg-gradient-danger hover:text-white transition-all duration-300"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <div className="overflow-y-auto max-h-[calc(90vh-140px)]">
          <form onSubmit={handleSubmit} className="p-6 space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Tool Name *</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-4 py-3 glass border border-white/30 rounded-glass focus:outline-none focus:border-accent-primary focus:shadow-glow-sm transition-all duration-300"
                placeholder="Enter tool name"
                required
              />
            </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Link
              <span className="text-xs text-gray-500 ml-2">(Auto-adds https:// if needed)</span>
            </label>
            <div className="relative">
              <input
                type="text"
                value={formData.link}
                onChange={handleUrlChange}
                className={`w-full px-4 py-3 pr-12 glass border rounded-glass focus:outline-none transition-all duration-300 ${
                  isValidUrl === true ? 'border-green-300 focus:border-green-500 focus:shadow-glow-sm' :
                  isValidUrl === false ? 'border-red-300 focus:border-red-500 focus:shadow-glow-sm' :
                  'border-white/30 focus:border-accent-primary focus:shadow-glow-sm'
                }`}
                placeholder="www.example.com or https://example.com"
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
                    title="Test link"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </a>
                )}
              </div>
            </div>
            {showUrlPreview && formData.link && (
              <div className="mt-3 p-3 glass rounded-glass border border-white/20">
                <div className="flex items-center">
                  <Globe className="w-4 h-4 text-accent-primary mr-2" />
                  <span className="text-gray-600 font-medium">Preview: </span>
                  <span className={`ml-1 font-mono text-sm ${isValidUrl ? 'text-green-600' : 'text-red-600'}`}>
                    {urlPreview}
                  </span>
                </div>
              </div>
            )}
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full px-4 py-3 glass border border-white/30 rounded-glass focus:outline-none focus:border-accent-primary focus:shadow-glow-sm transition-all duration-300 resize-none"
              rows="3"
              placeholder="Describe what this tool does and how it helps with OSINT investigations..."
            />
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Category</label>
              <select
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                className="w-full px-4 py-3 glass border border-white/30 rounded-glass focus:outline-none focus:border-accent-primary focus:shadow-glow-sm transition-all duration-300"
              >
                <option value="">Select Category</option>
                {TOOL_CATEGORIES.map(cat => (
                  <option key={cat.value} value={cat.value}>{cat.label}</option>
                ))}
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
              <select
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                className="w-full px-4 py-3 glass border border-white/30 rounded-glass focus:outline-none focus:border-accent-primary focus:shadow-glow-sm transition-all duration-300"
              >
                <option value="">Select Status</option>
                {TOOL_STATUSES.map(status => (
                  <option key={status.value} value={status.value}>{status.label}</option>
                ))}
              </select>
            </div>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Tags</label>
            <div className="flex space-x-2 mb-3">
              <input
                type="text"
                value={newTag}
                onChange={(e) => setNewTag(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addTag())}
                placeholder="Add a tag (e.g., investigation, social-media, free)"
                className="flex-1 px-4 py-3 glass border border-white/30 rounded-glass focus:outline-none focus:border-accent-primary focus:shadow-glow-sm transition-all duration-300"
              />
              <button
                type="button"
                onClick={addTag}
                className="px-6 py-3 bg-gradient-primary text-white rounded-glass hover:shadow-glow-md transition-all duration-300 font-medium"
              >
                Add
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {formData.tags.map((tag, index) => (
                <span key={index} className="inline-flex items-center px-3 py-1 glass rounded-glass text-sm bg-gradient-to-r from-accent-primary to-accent-secondary text-white">
                  {tag}
                  <button
                    type="button"
                    onClick={() => removeTag(tag)}
                    className="ml-2 text-white/80 hover:text-white transition-colors"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Notes</label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              className="w-full px-4 py-3 glass border border-white/30 rounded-glass focus:outline-none focus:border-accent-primary focus:shadow-glow-sm transition-all duration-300 resize-none"
              rows="3"
              placeholder="Additional notes, usage tips, or special considerations..."
            />
          </div>
          
          <div className="flex justify-end space-x-3 pt-6 border-t border-white/20">
            <button
              type="button"
              onClick={onCancel}
              className="px-6 py-3 glass-button rounded-glass text-gray-700 hover:bg-gradient-secondary hover:text-white transition-all duration-300 font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-6 py-3 bg-gradient-primary text-white rounded-glass hover:shadow-glow-md transition-all duration-300 font-medium"
            >
              {tool ? 'Update' : 'Create'} Tool
            </button>
          </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default AddEditToolForm;