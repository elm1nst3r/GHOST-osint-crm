// File: frontend/src/components/ToolsList.js
import React, { useState, useMemo } from 'react';
import { Globe, Search, Plus, Edit2, Trash2, Filter, SortAsc, SortDesc, BarChart3, ExternalLink, Tag } from 'lucide-react';
import { toolsAPI } from '../utils/api';
import { TOOL_STATUSES, TOOL_CATEGORIES } from '../utils/constants';
import { useData } from '../contexts/DataContext';
import { useUI } from '../contexts/UIContext';

const ToolsList = () => {
  const { tools, fetchTools } = useData();
  const { setShowAddToolForm, setEditingTool } = useUI();
  const [toolSearchTerm, setToolSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [sortBy, setSortBy] = useState('name');
  const [sortOrder, setSortOrder] = useState('asc');
  const [showFilters, setShowFilters] = useState(false);

  const filteredAndSortedTools = useMemo(() => {
    let filtered = tools.filter(tool => {
      const matchesSearch = toolSearchTerm === '' || 
        tool.name.toLowerCase().includes(toolSearchTerm.toLowerCase()) ||
        (tool.category && tool.category.toLowerCase().includes(toolSearchTerm.toLowerCase())) ||
        (tool.tags && tool.tags.some(tag => tag.toLowerCase().includes(toolSearchTerm.toLowerCase()))) ||
        (tool.description && tool.description.toLowerCase().includes(toolSearchTerm.toLowerCase()));
      
      const matchesCategory = filterCategory === '' || tool.category === filterCategory;
      const matchesStatus = filterStatus === '' || tool.status === filterStatus;
      
      return matchesSearch && matchesCategory && matchesStatus;
    });

    // Apply sorting
    filtered.sort((a, b) => {
      let compareValue = 0;
      
      switch (sortBy) {
        case 'name':
          compareValue = a.name.localeCompare(b.name);
          break;
        case 'category':
          compareValue = (a.category || '').localeCompare(b.category || '');
          break;
        case 'status':
          compareValue = (a.status || '').localeCompare(b.status || '');
          break;
        case 'created':
          compareValue = new Date(a.created_at || 0) - new Date(b.created_at || 0);
          break;
        default:
          compareValue = 0;
      }
      
      return sortOrder === 'asc' ? compareValue : -compareValue;
    });

    return filtered;
  }, [tools, toolSearchTerm, filterCategory, filterStatus, sortBy, sortOrder]);

  // Statistics
  const stats = useMemo(() => {
    const total = tools.length;
    const byCategory = {};
    const byStatus = {};
    
    tools.forEach(tool => {
      const category = tool.category || 'Uncategorized';
      const status = tool.status || 'Unknown';
      
      byCategory[category] = (byCategory[category] || 0) + 1;
      byStatus[status] = (byStatus[status] || 0) + 1;
    });
    
    return { total, byCategory, byStatus };
  }, [tools]);

  const handleDelete = async (id) => {
    if (window.confirm('Are you sure you want to delete this tool?')) {
      try {
        await toolsAPI.delete(id);
        fetchTools();
      } catch (error) {
        console.error('Error deleting tool:', error);
        alert('Failed to delete tool');
      }
    }
  };

  const getStatusColor = (status) => {
    const statusConfig = TOOL_STATUSES.find(s => s.value === status);
    const colorMap = {
      green: 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-400',
      yellow: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-400',
      red: 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-400',
      gray: 'bg-gray-100 dark:bg-slate-700 text-gray-800 dark:text-slate-200'
    };
    return colorMap[statusConfig?.color] || 'bg-gray-100 dark:bg-slate-700 text-gray-800 dark:text-slate-200';
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header with Stats */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-gray-900 to-gray-600 dark:from-gray-100 dark:to-gray-300 bg-clip-text text-transparent">
            OSINT Tools Directory
          </h1>
          <div className="flex items-center space-x-4 mt-2">
            <div className="flex items-center text-sm text-gray-600 dark:text-gray-400">
              <BarChart3 className="w-4 h-4 mr-1 text-blue-600 dark:text-blue-400" />
              <span className="font-medium">{stats.total} tools</span>
            </div>
            <div className="text-sm text-gray-500 dark:text-gray-500 dark:text-gray-400">
              {filteredAndSortedTools.length !== stats.total && (
                <span>{filteredAndSortedTools.length} filtered</span>
              )}
            </div>
          </div>
        </div>
        <button
          onClick={() => setShowAddToolForm(true)}
          className="px-6 py-3 bg-blue-600 text-white dark:bg-blue-500 rounded-lg hover:shadow-glow-md transition-all duration-300 flex items-center group"
        >
          <Plus className="w-5 h-5 mr-2 group-hover:animate-pulse" />
          Add Tool
        </button>
      </div>

      {/* Search and Filters */}
      <div className="bg-white dark:bg-gray-800 backdrop-blur-xl border border-gray-300 dark:border-gray-600 shadow-glass-lg rounded-lg-lg p-6">
        <div className="flex flex-col space-y-4">
          {/* Search Bar */}
          <div className="flex space-x-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-blue-600 dark:text-blue-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Search tools by name, category, description, or tag..."
                value={toolSearchTerm}
                onChange={(e) => setToolSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-3 glass border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:border-accent-primary focus:shadow-md transition-all duration-300"
              />
            </div>
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 transition-all duration-300 flex items-center ${
                showFilters ? 'bg-blue-600 text-white dark:bg-blue-500' : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100'
              }`}
            >
              <Filter className="w-5 h-5 mr-2" />
              Filters
            </button>
          </div>

          {/* Advanced Filters */}
          {showFilters && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 border-t border-gray-200 dark:border-gray-700 dark:border-gray-600">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Category</label>
                <select
                  value={filterCategory}
                  onChange={(e) => setFilterCategory(e.target.value)}
                  className="w-full px-3 py-2 glass border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:border-accent-primary transition-all duration-300 dark:text-gray-100 dark:bg-slate-800"
                >
                  <option value="">All Categories</option>
                  {TOOL_CATEGORIES.map(cat => (
                    <option key={cat.value} value={cat.value}>{cat.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Status</label>
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className="w-full px-3 py-2 glass border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:border-accent-primary transition-all duration-300 dark:text-gray-100 dark:bg-slate-800"
                >
                  <option value="">All Statuses</option>
                  {TOOL_STATUSES.map(status => (
                    <option key={status.value} value={status.value}>{status.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Sort By</label>
                <div className="flex space-x-2">
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value)}
                    className="flex-1 px-3 py-2 glass border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:border-accent-primary transition-all duration-300 dark:text-gray-100 dark:bg-slate-800"
                  >
                    <option value="name">Name</option>
                    <option value="category">Category</option>
                    <option value="status">Status</option>
                    <option value="created">Date Added</option>
                  </select>
                  <button
                    onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                    className="px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:text-blue-600 dark:text-blue-400 dark:hover:text-blue-600 dark:text-blue-400 transition-all duration-300"
                    title={`Sort ${sortOrder === 'asc' ? 'Descending' : 'Ascending'}`}
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
        {filteredAndSortedTools.map(tool => (
          <div key={tool.id} className="bg-white dark:bg-gray-800 backdrop-blur-xl border border-gray-300 dark:border-gray-600 shadow-glass-lg rounded-lg-lg p-6 hover:shadow-glass-xl transition-all duration-300 group">
            <div className="flex justify-between items-start mb-4">
              <h3 className="text-lg font-semibold bg-gradient-to-r from-gray-900 to-gray-600 dark:from-gray-100 dark:to-gray-300 bg-clip-text text-transparent group-hover:from-accent-primary group-hover:to-accent-secondary transition-all duration-300">
                {tool.name}
              </h3>
              <div className="flex space-x-1">
                <button
                  onClick={() => setEditingTool(tool)}
                  className="p-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-blue-700 dark:hover:bg-blue-600 hover:text-white transition-all duration-300"
                  title="Edit"
                >
                  <Edit2 className="w-4 h-4" />
                </button>
                <button
                  onClick={() => handleDelete(tool.id)}
                  className="p-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-red-600 dark:bg-red-500 hover:text-white transition-all duration-300"
                  title="Delete"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>

            {tool.description && (
              <p className="text-gray-600 dark:text-gray-400 text-sm mb-3 leading-relaxed">{tool.description}</p>
            )}
            
            {tool.category && (
              <div className="mb-3">
                <span className="inline-flex items-center px-3 py-1 text-xs glass rounded-lg bg-gradient-to-r from-accent-primary/20 to-accent-secondary/20 text-blue-600 dark:text-blue-400 font-medium">
                  <Tag className="w-3 h-3 mr-1" />
                  {tool.category}
                </span>
              </div>
            )}
            
            {tool.tags && tool.tags.length > 0 && (
              <div className="mb-3 flex flex-wrap gap-1">
                {tool.tags.map((tag, index) => (
                  <span key={index} className="inline-block px-2 py-1 text-xs glass rounded-lg bg-gradient-to-r from-blue-500/20 to-purple-500/20 text-blue-700 dark:text-blue-400 font-medium">
                    {tag}
                  </span>
                ))}
              </div>
            )}
            
            {tool.link && (
              <a
                href={tool.link}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-blue-600 dark:text-blue-400 hover:bg-blue-700 dark:hover:bg-blue-600 hover:text-white transition-all duration-300 text-sm font-medium mb-3"
              >
                <ExternalLink className="w-4 h-4 mr-2" />
                Visit Tool
              </a>
            )}
            
            {tool.status && (
              <div className="mt-3">
                <span className={`inline-block px-3 py-1 text-xs rounded-lg font-medium ${getStatusColor(tool.status)}`}>
                  {tool.status}
                </span>
              </div>
            )}
          </div>
        ))}
      </div>

      {filteredAndSortedTools.length === 0 && (
        <div className="text-center py-12">
          <div className="bg-white dark:bg-gray-800 backdrop-blur-xl border border-gray-300 dark:border-gray-600 shadow-glass-lg rounded-lg-lg p-8 max-w-md mx-auto">
            <div className="text-gray-400 dark:text-gray-500 mb-4">
              <Search className="w-12 h-12 mx-auto opacity-50" />
            </div>
            <p className="text-gray-600 dark:text-gray-400 font-medium">No tools found matching your search criteria.</p>
            <p className="text-gray-500 dark:text-gray-500 text-sm mt-2">Try adjusting your filters or search terms.</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default ToolsList;