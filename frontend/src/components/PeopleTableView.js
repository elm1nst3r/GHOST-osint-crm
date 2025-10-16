// File: frontend/src/components/PeopleTableView.js
// Table view for people with inline editing, quick-add, and bulk operations

import React, { useState, useRef } from 'react';
import {
  Save, X, Edit2, Trash2, Eye, Plus, Upload, Download,
  UserPlus, Link as LinkIcon, Check, AlertCircle
} from 'lucide-react';
import { peopleAPI } from '../utils/api';
import { PERSON_CATEGORIES, PERSON_STATUSES } from '../utils/constants';
import BulkRelationshipTool from './BulkRelationshipTool';

const PeopleTableView = ({
  people,
  fetchPeople,
  setEditingPerson,
  setSelectedPersonForDetail
}) => {
  const [editingRow, setEditingRow] = useState(null);
  const [editData, setEditData] = useState({});
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [quickAddData, setQuickAddData] = useState({
    firstName: '',
    lastName: '',
    category: 'Person of Interest',
    status: 'Open',
    caseName: ''
  });
  const [bulkImportMode, setBulkImportMode] = useState(false);
  const [bulkData, setBulkData] = useState('');
  const [selectedRows, setSelectedRows] = useState(new Set());
  const [showBulkRelationships, setShowBulkRelationships] = useState(false);
  const fileInputRef = useRef(null);

  const getFullName = (person) => {
    return `${person.first_name || ''} ${person.last_name || ''}`.trim();
  };

  const getRelationshipCount = (personId) => {
    const person = people.find(p => p.id === personId);
    if (!person) return 0;

    const directConnections = person.connections?.length || 0;
    const reverseConnections = people.filter(p =>
      p.connections?.some(c => c.person_id === personId)
    ).length;

    return Math.max(directConnections, reverseConnections);
  };

  // Start editing a row
  const handleEdit = (person) => {
    setEditingRow(person.id);
    setEditData({
      firstName: person.first_name || '',
      lastName: person.last_name || '',
      category: person.category || '',
      status: person.status || '',
      caseName: person.case_name || '',
      notes: person.notes || ''
    });
  };

  // Save edited row
  const handleSave = async (personId) => {
    try {
      const person = people.find(p => p.id === personId);

      await peopleAPI.update(personId, {
        firstName: editData.firstName,
        lastName: editData.lastName,
        category: editData.category,
        status: editData.status,
        caseName: editData.caseName,
        notes: editData.notes,
        // Preserve existing data
        aliases: person.aliases || [],
        dateOfBirth: person.date_of_birth,
        crmStatus: person.crm_status,
        profilePictureUrl: person.profile_picture_url,
        osintData: person.osint_data || [],
        attachments: person.attachments || [],
        connections: person.connections || [],
        locations: person.locations || [],
        custom_fields: person.custom_fields || {}
      });

      setEditingRow(null);
      setEditData({});
      fetchPeople();
    } catch (error) {
      console.error('Error updating person:', error);
      alert('Failed to update person');
    }
  };

  // Cancel editing
  const handleCancel = () => {
    setEditingRow(null);
    setEditData({});
  };

  // Quick add new person
  const handleQuickAdd = async () => {
    if (!quickAddData.firstName.trim()) {
      alert('First name is required');
      return;
    }

    try {
      await peopleAPI.create({
        firstName: quickAddData.firstName,
        lastName: quickAddData.lastName,
        category: quickAddData.category,
        status: quickAddData.status,
        caseName: quickAddData.caseName,
        aliases: [],
        osintData: [],
        attachments: [],
        connections: [],
        locations: [],
        custom_fields: {}
      });

      setQuickAddData({
        firstName: '',
        lastName: '',
        category: 'Person of Interest',
        status: 'Open',
        caseName: ''
      });
      setShowQuickAdd(false);
      fetchPeople();
    } catch (error) {
      console.error('Error creating person:', error);
      alert('Failed to create person');
    }
  };

  // Delete person
  const handleDelete = async (id) => {
    if (window.confirm('Are you sure you want to delete this person?')) {
      try {
        await peopleAPI.delete(id);
        fetchPeople();
      } catch (error) {
        console.error('Error deleting person:', error);
        alert('Failed to delete person');
      }
    }
  };

  // Toggle row selection
  const toggleRowSelection = (personId) => {
    const newSelection = new Set(selectedRows);
    if (newSelection.has(personId)) {
      newSelection.delete(personId);
    } else {
      newSelection.add(personId);
    }
    setSelectedRows(newSelection);
  };

  // Select all rows
  const selectAll = () => {
    if (selectedRows.size === people.length) {
      setSelectedRows(new Set());
    } else {
      setSelectedRows(new Set(people.map(p => p.id)));
    }
  };

  // Handle CSV import
  const handleCSVImport = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      setBulkData(e.target.result);
      setBulkImportMode(true);
    };
    reader.readAsText(file);
  };

  // Process bulk CSV data
  const processBulkImport = async () => {
    const lines = bulkData.trim().split('\n');
    if (lines.length < 2) {
      alert('CSV must have a header row and at least one data row');
      return;
    }

    const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
    const data = lines.slice(1);

    const created = [];
    const errors = [];

    for (let i = 0; i < data.length; i++) {
      const values = data[i].split(',').map(v => v.trim());
      const row = {};

      headers.forEach((header, index) => {
        row[header] = values[index] || '';
      });

      // Map CSV columns to API fields
      const personData = {
        firstName: row['first name'] || row['firstname'] || '',
        lastName: row['last name'] || row['lastname'] || '',
        category: row['category'] || 'Person of Interest',
        status: row['status'] || 'Open',
        caseName: row['case'] || row['case name'] || row['casename'] || '',
        notes: row['notes'] || '',
        aliases: row['aliases'] ? row['aliases'].split(';') : [],
        osintData: [],
        attachments: [],
        connections: [],
        locations: [],
        custom_fields: {}
      };

      if (!personData.firstName) {
        errors.push(`Row ${i + 2}: Missing first name`);
        continue;
      }

      try {
        await peopleAPI.create(personData);
        created.push(personData.firstName + ' ' + personData.lastName);
      } catch (error) {
        errors.push(`Row ${i + 2}: ${error.message}`);
      }
    }

    alert(`Import complete!\nCreated: ${created.length}\nErrors: ${errors.length}\n${errors.length > 0 ? '\n' + errors.join('\n') : ''}`);

    setBulkImportMode(false);
    setBulkData('');
    fetchPeople();
  };

  // Export to CSV
  const handleExportCSV = () => {
    const headers = ['First Name', 'Last Name', 'Category', 'Status', 'Case', 'Notes', 'Connections'];
    const rows = people.map(person => [
      person.first_name || '',
      person.last_name || '',
      person.category || '',
      person.status || '',
      person.case_name || '',
      (person.notes || '').replace(/,/g, ';'),
      getRelationshipCount(person.id)
    ]);

    const csv = [
      headers.join(','),
      ...rows.map(row => row.join(','))
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `people-export-${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  const getStatusColor = (status) => {
    const statusConfig = PERSON_STATUSES.find(s => s.value === status);
    const colorMap = {
      green: 'bg-green-100 text-green-800',
      yellow: 'bg-yellow-100 text-yellow-800',
      gray: 'bg-gray-100 text-gray-800',
      blue: 'bg-blue-100 text-blue-800'
    };
    return colorMap[statusConfig?.color] || 'bg-gray-100 text-gray-800';
  };

  const getCategoryColor = (category) => {
    const colors = {
      'Person of Interest': 'bg-red-100 text-red-800',
      'Client': 'bg-green-100 text-green-800',
      'Witness': 'bg-yellow-100 text-yellow-800',
      'Victim': 'bg-purple-100 text-purple-800',
      'Suspect': 'bg-orange-100 text-orange-800'
    };
    return colors[category] || 'bg-blue-100 text-blue-800';
  };

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="glass-card backdrop-blur-xl border border-white/30 shadow-glass-lg rounded-glass-lg p-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setShowQuickAdd(!showQuickAdd)}
              className="px-4 py-2 bg-gradient-primary text-white rounded-glass hover:shadow-glow-md transition-all flex items-center space-x-2"
            >
              <Plus className="w-4 h-4" />
              <span>Quick Add</span>
            </button>
            <button
              onClick={() => setShowBulkRelationships(true)}
              className="px-4 py-2 bg-gradient-secondary text-white rounded-glass hover:shadow-glow-md transition-all flex items-center space-x-2"
            >
              <LinkIcon className="w-4 h-4" />
              <span>Bulk Relationships</span>
            </button>

            <button
              onClick={() => fileInputRef.current?.click()}
              className="px-4 py-2 glass-button text-gray-700 rounded-glass hover:shadow-glow-sm transition-all flex items-center space-x-2"
            >
              <Upload className="w-4 h-4" />
              <span>Import CSV</span>
            </button>

            <button
              onClick={handleExportCSV}
              className="px-4 py-2 glass-button text-gray-700 rounded-glass hover:shadow-glow-sm transition-all flex items-center space-x-2"
            >
              <Download className="w-4 h-4" />
              <span>Export CSV</span>
            </button>

            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              onChange={handleCSVImport}
              className="hidden"
            />
          </div>

          {selectedRows.size > 0 && (
            <div className="flex items-center space-x-2 bg-blue-50 px-4 py-2 rounded-lg">
              <Check className="w-4 h-4 text-blue-600" />
              <span className="text-sm font-medium text-blue-800">
                {selectedRows.size} selected
              </span>
              <button
                onClick={() => setSelectedRows(new Set())}
                className="text-blue-600 hover:text-blue-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Quick Add Row */}
      {showQuickAdd && (
        <div className="glass-card backdrop-blur-xl border border-blue-300 shadow-glass-lg rounded-glass-lg p-4 bg-blue-50/50">
          <div className="flex items-center space-x-3">
            <input
              type="text"
              placeholder="First Name *"
              value={quickAddData.firstName}
              onChange={(e) => setQuickAddData({ ...quickAddData, firstName: e.target.value })}
              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <input
              type="text"
              placeholder="Last Name"
              value={quickAddData.lastName}
              onChange={(e) => setQuickAddData({ ...quickAddData, lastName: e.target.value })}
              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <select
              value={quickAddData.category}
              onChange={(e) => setQuickAddData({ ...quickAddData, category: e.target.value })}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              {PERSON_CATEGORIES.map(cat => (
                <option key={cat.value} value={cat.value}>{cat.label}</option>
              ))}
            </select>
            <select
              value={quickAddData.status}
              onChange={(e) => setQuickAddData({ ...quickAddData, status: e.target.value })}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              {PERSON_STATUSES.map(stat => (
                <option key={stat.value} value={stat.value}>{stat.label}</option>
              ))}
            </select>
            <input
              type="text"
              placeholder="Case Name"
              value={quickAddData.caseName}
              onChange={(e) => setQuickAddData({ ...quickAddData, caseName: e.target.value })}
              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <button
              onClick={handleQuickAdd}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-all flex items-center space-x-2"
            >
              <UserPlus className="w-4 h-4" />
              <span>Add</span>
            </button>
            <button
              onClick={() => setShowQuickAdd(false)}
              className="p-2 text-gray-600 hover:text-gray-800 transition-all"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}

      {/* Bulk Import Modal */}
      {bulkImportMode && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="glass-card backdrop-blur-xl border border-white/30 shadow-glass-lg rounded-glass-lg p-6 max-w-4xl w-full max-h-[80vh] overflow-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-gray-900">Bulk Import Preview</h3>
              <button
                onClick={() => setBulkImportMode(false)}
                className="text-gray-600 hover:text-gray-800"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
              <div className="flex items-start space-x-2">
                <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-blue-800">
                  <p className="font-medium mb-1">CSV Format:</p>
                  <p>First Name, Last Name, Category, Status, Case, Notes, Aliases</p>
                  <p className="text-xs mt-1 text-blue-600">Aliases should be separated by semicolons (;)</p>
                </div>
              </div>
            </div>

            <textarea
              value={bulkData}
              onChange={(e) => setBulkData(e.target.value)}
              className="w-full h-64 px-4 py-3 border border-gray-300 rounded-lg font-mono text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Paste CSV data here..."
            />

            <div className="flex items-center justify-end space-x-3 mt-4">
              <button
                onClick={() => setBulkImportMode(false)}
                className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-all"
              >
                Cancel
              </button>
              <button
                onClick={processBulkImport}
                className="px-6 py-2 bg-gradient-primary text-white rounded-glass hover:shadow-glow-md transition-all flex items-center space-x-2"
              >
                <Upload className="w-4 h-4" />
                <span>Import {bulkData.split('\n').length - 1} People</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="glass-card backdrop-blur-xl border border-white/30 shadow-glass-lg rounded-glass-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gradient-to-r from-gray-50 to-gray-100 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left">
                  <input
                    type="checkbox"
                    checked={selectedRows.size === people.length && people.length > 0}
                    onChange={selectAll}
                    className="rounded border-gray-300"
                  />
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Name</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Category</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Status</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Case</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Connections</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {people.map((person, index) => (
                <tr
                  key={person.id}
                  className={`hover:bg-blue-50/30 transition-colors ${
                    selectedRows.has(person.id) ? 'bg-blue-50/50' : ''
                  } ${index % 2 === 0 ? 'bg-white/50' : 'bg-gray-50/30'}`}
                >
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      checked={selectedRows.has(person.id)}
                      onChange={() => toggleRowSelection(person.id)}
                      className="rounded border-gray-300"
                    />
                  </td>

                  {/* Name */}
                  <td className="px-4 py-3">
                    {editingRow === person.id ? (
                      <div className="flex space-x-2">
                        <input
                          type="text"
                          value={editData.firstName}
                          onChange={(e) => setEditData({ ...editData, firstName: e.target.value })}
                          className="px-2 py-1 border border-gray-300 rounded w-24 text-sm"
                          placeholder="First"
                        />
                        <input
                          type="text"
                          value={editData.lastName}
                          onChange={(e) => setEditData({ ...editData, lastName: e.target.value })}
                          className="px-2 py-1 border border-gray-300 rounded w-24 text-sm"
                          placeholder="Last"
                        />
                      </div>
                    ) : (
                      <div className="font-medium text-gray-900">{getFullName(person)}</div>
                    )}
                  </td>

                  {/* Category */}
                  <td className="px-4 py-3">
                    {editingRow === person.id ? (
                      <select
                        value={editData.category}
                        onChange={(e) => setEditData({ ...editData, category: e.target.value })}
                        className="px-2 py-1 border border-gray-300 rounded text-sm"
                      >
                        {PERSON_CATEGORIES.map(cat => (
                          <option key={cat.value} value={cat.value}>{cat.label}</option>
                        ))}
                      </select>
                    ) : (
                      <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${getCategoryColor(person.category)}`}>
                        {person.category}
                      </span>
                    )}
                  </td>

                  {/* Status */}
                  <td className="px-4 py-3">
                    {editingRow === person.id ? (
                      <select
                        value={editData.status}
                        onChange={(e) => setEditData({ ...editData, status: e.target.value })}
                        className="px-2 py-1 border border-gray-300 rounded text-sm"
                      >
                        {PERSON_STATUSES.map(stat => (
                          <option key={stat.value} value={stat.value}>{stat.label}</option>
                        ))}
                      </select>
                    ) : (
                      <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(person.status)}`}>
                        {person.status}
                      </span>
                    )}
                  </td>

                  {/* Case */}
                  <td className="px-4 py-3">
                    {editingRow === person.id ? (
                      <input
                        type="text"
                        value={editData.caseName}
                        onChange={(e) => setEditData({ ...editData, caseName: e.target.value })}
                        className="px-2 py-1 border border-gray-300 rounded w-full text-sm"
                        placeholder="Case name"
                      />
                    ) : (
                      <span className="text-sm text-gray-600">{person.case_name || '-'}</span>
                    )}
                  </td>

                  {/* Connections */}
                  <td className="px-4 py-3">
                    <div className="flex items-center space-x-1">
                      <LinkIcon className="w-4 h-4 text-gray-400" />
                      <span className="text-sm text-gray-900 font-medium">
                        {getRelationshipCount(person.id)}
                      </span>
                    </div>
                  </td>

                  {/* Actions */}
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end space-x-2">
                      {editingRow === person.id ? (
                        <>
                          <button
                            onClick={() => handleSave(person.id)}
                            className="p-1.5 text-green-600 hover:bg-green-50 rounded transition-all"
                            title="Save"
                          >
                            <Save className="w-4 h-4" />
                          </button>
                          <button
                            onClick={handleCancel}
                            className="p-1.5 text-gray-600 hover:bg-gray-50 rounded transition-all"
                            title="Cancel"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            onClick={() => setSelectedPersonForDetail(person)}
                            className="p-1.5 text-blue-600 hover:bg-blue-50 rounded transition-all"
                            title="View Details"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleEdit(person)}
                            className="p-1.5 text-gray-600 hover:bg-gray-50 rounded transition-all"
                            title="Quick Edit"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setEditingPerson(person)}
                            className="p-1.5 text-purple-600 hover:bg-purple-50 rounded transition-all"
                            title="Full Edit"
                          >
                            <Edit2 className="w-4 h-4" fill="currentColor" />
                          </button>
                          <button
                            onClick={() => handleDelete(person.id)}
                            className="p-1.5 text-red-600 hover:bg-red-50 rounded transition-all"
                            title="Delete"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {people.length === 0 && (
            <div className="text-center py-12 text-gray-500">
              <UserPlus className="w-12 h-12 mx-auto mb-3 text-gray-400" />
              <p>No people added yet. Click "Quick Add" to get started!</p>
            </div>
          )}
        </div>
      </div>

      {/* Bulk Relationship Tool Modal */}
      {showBulkRelationships && (
        <BulkRelationshipTool
          onClose={() => setShowBulkRelationships(false)}
          people={people}
          onComplete={fetchPeople}
        />
      )}
    </div>
  );
};

export default PeopleTableView;
