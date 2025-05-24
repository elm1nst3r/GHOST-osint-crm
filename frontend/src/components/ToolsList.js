// File: frontend/src/components/ToolsList.js
import React, { useState } from 'react';
import { Globe, Search, Plus, Edit2, Trash2 } from 'lucide-react';
import { toolsAPI } from '../utils/api';
import { TOOL_STATUSES } from '../utils/constants';

const ToolsList = ({ tools, fetchTools, setShowAddToolForm, setEditingTool }) => {
  const [toolSearchTerm, setToolSearchTerm] = useState('');

  const filteredTools = tools.filter(tool => {
    const matchesSearch = toolSearchTerm === '' || 
      tool.name.toLowerCase().includes(toolSearchTerm.toLowerCase()) ||
      (tool.category && tool.category.toLowerCase().includes(toolSearchTerm.toLowerCase())) ||
      (tool.tags && tool.tags.some(tag => tag.toLowerCase().includes(toolSearchTerm.toLowerCase())));
    
    return matchesSearch;
  });

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
      green: 'bg-green-100 text-green-800',
      yellow: 'bg-yellow-100 text-yellow-800',
      red: 'bg-red-100 text-red-800',
      gray: 'bg-gray-100 text-gray-800'
    };
    return colorMap[statusConfig?.color] || 'bg-gray-100 text-gray-800';
  };

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900">OSINT Tools Directory</h1>
        <button
          onClick={() => setShowAddToolForm(true)}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 flex items-center"
        >
          <Plus className="w-4 h-4 mr-2" />
          Add Tool
        </button>
      </div>

      {/* Search Bar */}
      <div className="mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
          <input
            type="text"
            placeholder="Search tools by name, category, or tag..."
            value={toolSearchTerm}
            onChange={(e) => setToolSearchTerm(e.target.value)}
            className="w-full pl-10 pr-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* Tools Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredTools.map(tool => (
          <div key={tool.id} className="bg-white rounded-lg shadow-sm p-6 border hover:shadow-md transition-shadow">
            <div className="flex justify-between items-start mb-4">
              <h3 className="text-lg font-semibold text-gray-900">{tool.name}</h3>
              <div className="flex space-x-1">
                <button
                  onClick={() => setEditingTool(tool)}
                  className="text-gray-600 hover:text-gray-700"
                  title="Edit"
                >
                  <Edit2 className="w-4 h-4" />
                </button>
                <button
                  onClick={() => handleDelete(tool.id)}
                  className="text-red-600 hover:text-red-700"
                  title="Delete"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
            
            {tool.description && (
              <p className="text-gray-600 text-sm mb-3">{tool.description}</p>
            )}
            
            {tool.category && (
              <div className="mb-2">
                <span className="inline-block px-2 py-1 text-xs bg-gray-100 text-gray-700 rounded">
                  {tool.category}
                </span>
              </div>
            )}
            
            {tool.tags && tool.tags.length > 0 && (
              <div className="mb-3 flex flex-wrap gap-1">
                {tool.tags.map((tag, index) => (
                  <span key={index} className="inline-block px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded">
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
                className="inline-flex items-center text-blue-600 hover:text-blue-700 text-sm"
              >
                Visit Tool
                <Globe className="w-3 h-3 ml-1" />
              </a>
            )}
            
            {tool.status && (
              <div className="mt-3">
                <span className={`inline-block px-2 py-1 text-xs rounded ${getStatusColor(tool.status)}`}>
                  {tool.status}
                </span>
              </div>
            )}
          </div>
        ))}
      </div>

      {filteredTools.length === 0 && (
        <div className="text-center py-12">
          <p className="text-gray-500">No tools found matching your search criteria.</p>
        </div>
      )}
    </div>
  );
};

export default ToolsList;