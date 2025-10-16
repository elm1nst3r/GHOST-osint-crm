// File: frontend/src/components/BulkRelationshipTool.js
// Tool for bulk creating relationships between people

import React, { useState } from 'react';
import { X, Link as LinkIcon, Upload, AlertCircle, Check, HelpCircle } from 'lucide-react';
import { peopleAPI } from '../utils/api';

const RELATIONSHIP_TYPES = [
  'family', 'friend', 'enemy', 'associate', 'employer',
  'suspect', 'witness', 'victim', 'other'
];

const BulkRelationshipTool = ({ onClose, people, onComplete }) => {
  const [mode, setMode] = useState('interactive'); // 'interactive' or 'csv'
  const [csvData, setCsvData] = useState('');
  const [relationships, setRelationships] = useState([{
    from: '',
    to: '',
    type: 'associate',
    note: ''
  }]);
  const [showHelp, setShowHelp] = useState(false);

  // Add new relationship row
  const addRelationship = () => {
    setRelationships([...relationships, {
      from: '',
      to: '',
      type: 'associate',
      note: ''
    }]);
  };

  // Remove relationship row
  const removeRelationship = (index) => {
    setRelationships(relationships.filter((_, i) => i !== index));
  };

  // Update relationship field
  const updateRelationship = (index, field, value) => {
    const updated = [...relationships];
    updated[index][field] = value;
    setRelationships(updated);
  };

  // Get person by name (fuzzy match)
  const getPersonByName = (name) => {
    const nameLower = name.trim().toLowerCase();
    return people.find(p => {
      const fullName = `${p.first_name || ''} ${p.last_name || ''}`.toLowerCase().trim();
      return fullName === nameLower ||
             p.first_name?.toLowerCase() === nameLower ||
             `${p.last_name}, ${p.first_name}`.toLowerCase() === nameLower;
    });
  };

  // Submit interactive relationships
  const submitInteractiveRelationships = async () => {
    const valid = relationships.filter(r => r.from && r.to);
    if (valid.length === 0) {
      alert('Please add at least one relationship');
      return;
    }

    let created = 0;
    const errors = [];

    for (const rel of valid) {
      const fromPerson = getPersonByName(rel.from);
      const toPerson = getPersonByName(rel.to);

      if (!fromPerson) {
        errors.push(`Person not found: ${rel.from}`);
        continue;
      }

      if (!toPerson) {
        errors.push(`Person not found: ${rel.to}`);
        continue;
      }

      try {
        // Get full person data
        const person = people.find(p => p.id === fromPerson.id);

        // Add new connection
        const updatedConnections = [...(person.connections || [])];

        // Check if connection already exists
        const existingIndex = updatedConnections.findIndex(
          conn => conn.person_id === toPerson.id
        );

        if (existingIndex >= 0) {
          // Update existing
          updatedConnections[existingIndex] = {
            person_id: toPerson.id,
            type: rel.type,
            note: rel.note || '',
            updated_at: new Date().toISOString()
          };
        } else {
          // Add new
          updatedConnections.push({
            person_id: toPerson.id,
            type: rel.type,
            note: rel.note || '',
            created_at: new Date().toISOString()
          });
        }

        // Update person with new connection
        await peopleAPI.update(fromPerson.id, {
          firstName: person.first_name,
          lastName: person.last_name,
          aliases: person.aliases || [],
          dateOfBirth: person.date_of_birth,
          category: person.category,
          status: person.status,
          crmStatus: person.crm_status,
          caseName: person.case_name,
          profilePictureUrl: person.profile_picture_url,
          notes: person.notes,
          osintData: person.osint_data || [],
          attachments: person.attachments || [],
          connections: updatedConnections,
          locations: person.locations || [],
          custom_fields: person.custom_fields || {}
        });

        created++;
      } catch (error) {
        errors.push(`Failed to create: ${rel.from} → ${rel.to} (${error.message})`);
      }
    }

    alert(`Bulk Relationship Creation Complete!\nCreated: ${created}\nErrors: ${errors.length}\n${errors.length > 0 ? '\n' + errors.join('\n') : ''}`);

    if (created > 0 && onComplete) {
      onComplete();
    }

    if (errors.length === 0) {
      onClose();
    }
  };

  // Parse and submit CSV relationships
  const submitCSVRelationships = async () => {
    const lines = csvData.trim().split('\n');
    if (lines.length < 2) {
      alert('CSV must have a header row and at least one data row');
      return;
    }

    const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
    const data = lines.slice(1);

    let created = 0;
    const errors = [];

    for (let i = 0; i < data.length; i++) {
      const values = data[i].split(',').map(v => v.trim());
      const row = {};

      headers.forEach((header, index) => {
        row[header] = values[index] || '';
      });

      const fromName = row['from'] || row['source'] || row['person 1'];
      const toName = row['to'] || row['target'] || row['person 2'];
      const type = row['type'] || row['relationship type'] || 'associate';
      const note = row['note'] || row['notes'] || '';

      if (!fromName || !toName) {
        errors.push(`Row ${i + 2}: Missing from or to person`);
        continue;
      }

      const fromPerson = getPersonByName(fromName);
      const toPerson = getPersonByName(toName);

      if (!fromPerson) {
        errors.push(`Row ${i + 2}: Person not found: ${fromName}`);
        continue;
      }

      if (!toPerson) {
        errors.push(`Row ${i + 2}: Person not found: ${toName}`);
        continue;
      }

      try {
        const person = people.find(p => p.id === fromPerson.id);
        const updatedConnections = [...(person.connections || [])];

        const existingIndex = updatedConnections.findIndex(
          conn => conn.person_id === toPerson.id
        );

        if (existingIndex >= 0) {
          updatedConnections[existingIndex] = {
            person_id: toPerson.id,
            type: type,
            note: note,
            updated_at: new Date().toISOString()
          };
        } else {
          updatedConnections.push({
            person_id: toPerson.id,
            type: type,
            note: note,
            created_at: new Date().toISOString()
          });
        }

        await peopleAPI.update(fromPerson.id, {
          firstName: person.first_name,
          lastName: person.last_name,
          aliases: person.aliases || [],
          dateOfBirth: person.date_of_birth,
          category: person.category,
          status: person.status,
          crmStatus: person.crm_status,
          caseName: person.case_name,
          profilePictureUrl: person.profile_picture_url,
          notes: person.notes,
          osintData: person.osint_data || [],
          attachments: person.attachments || [],
          connections: updatedConnections,
          locations: person.locations || [],
          custom_fields: person.custom_fields || {}
        });

        created++;
      } catch (error) {
        errors.push(`Row ${i + 2}: ${error.message}`);
      }
    }

    alert(`CSV Import Complete!\nCreated: ${created}\nErrors: ${errors.length}\n${errors.length > 0 ? '\n' + errors.join('\n') : ''}`);

    if (created > 0 && onComplete) {
      onComplete();
    }

    if (errors.length === 0) {
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="glass-card backdrop-blur-xl border border-white/30 shadow-glass-lg rounded-glass-lg p-6 max-w-4xl w-full max-h-[90vh] overflow-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-gradient-primary rounded-lg">
              <LinkIcon className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Bulk Create Relationships</h2>
              <p className="text-sm text-gray-600">Add multiple connections between people at once</p>
            </div>
          </div>
          <button
            onClick={() => setShowHelp(!showHelp)}
            className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-all"
            title="Help"
          >
            <HelpCircle className="w-5 h-5" />
          </button>
        </div>

        {/* Help Panel */}
        {showHelp && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
            <h4 className="font-semibold text-blue-900 mb-2">How to Use:</h4>
            <div className="text-sm text-blue-800 space-y-2">
              <p><strong>Interactive Mode:</strong> Add relationships one by one using dropdowns</p>
              <p><strong>CSV Mode:</strong> Paste or upload CSV data with columns:</p>
              <ul className="list-disc list-inside ml-4 text-xs space-y-1">
                <li>From, To, Type, Note</li>
                <li>Example: John Doe, Jane Smith, family, Siblings</li>
              </ul>
              <p className="text-xs text-blue-600 mt-2">
                ⚠️ Person names must match exactly (case-insensitive). Use "Last, First" or "First Last" format.
              </p>
            </div>
          </div>
        )}

        {/* Mode Toggle */}
        <div className="flex items-center space-x-2 mb-6">
          <button
            onClick={() => setMode('interactive')}
            className={`px-4 py-2 rounded-lg transition-all ${
              mode === 'interactive' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Interactive
          </button>
          <button
            onClick={() => setMode('csv')}
            className={`px-4 py-2 rounded-lg transition-all flex items-center space-x-2 ${
              mode === 'csv' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            <Upload className="w-4 h-4" />
            <span>CSV Import</span>
          </button>
        </div>

        {/* Interactive Mode */}
        {mode === 'interactive' && (
          <div className="space-y-4">
            <div className="grid grid-cols-12 gap-3 text-xs font-semibold text-gray-700 mb-2 px-2">
              <div className="col-span-4">From Person</div>
              <div className="col-span-4">To Person</div>
              <div className="col-span-2">Type</div>
              <div className="col-span-2">Note</div>
            </div>

            <div className="space-y-3 max-h-96 overflow-y-auto">
              {relationships.map((rel, index) => (
                <div key={index} className="grid grid-cols-12 gap-3 items-start">
                  <select
                    value={rel.from}
                    onChange={(e) => updateRelationship(index, 'from', e.target.value)}
                    className="col-span-4 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
                  >
                    <option value="">Select person...</option>
                    {people.map(person => (
                      <option key={person.id} value={`${person.first_name} ${person.last_name}`}>
                        {person.first_name} {person.last_name}
                      </option>
                    ))}
                  </select>

                  <select
                    value={rel.to}
                    onChange={(e) => updateRelationship(index, 'to', e.target.value)}
                    className="col-span-4 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
                  >
                    <option value="">Select person...</option>
                    {people.map(person => (
                      <option key={person.id} value={`${person.first_name} ${person.last_name}`}>
                        {person.first_name} {person.last_name}
                      </option>
                    ))}
                  </select>

                  <select
                    value={rel.type}
                    onChange={(e) => updateRelationship(index, 'type', e.target.value)}
                    className="col-span-2 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm capitalize"
                  >
                    {RELATIONSHIP_TYPES.map(type => (
                      <option key={type} value={type}>{type}</option>
                    ))}
                  </select>

                  <input
                    type="text"
                    value={rel.note}
                    onChange={(e) => updateRelationship(index, 'note', e.target.value)}
                    placeholder="Optional note"
                    className="col-span-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
                  />

                  <button
                    onClick={() => removeRelationship(index)}
                    className="col-span-1 p-2 text-red-600 hover:bg-red-50 rounded-lg transition-all"
                    title="Remove"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>

            <button
              onClick={addRelationship}
              className="w-full px-4 py-2 border-2 border-dashed border-gray-300 rounded-lg text-gray-600 hover:border-blue-400 hover:text-blue-600 transition-all"
            >
              + Add Relationship
            </button>
          </div>
        )}

        {/* CSV Mode */}
        {mode === 'csv' && (
          <div className="space-y-4">
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 text-sm font-mono text-gray-700">
              <div className="font-semibold mb-1">Format:</div>
              <div>From, To, Type, Note</div>
              <div className="text-xs text-gray-500 mt-2">Example:</div>
              <div className="text-xs">John Doe, Jane Smith, family, Siblings</div>
            </div>

            <textarea
              value={csvData}
              onChange={(e) => setCsvData(e.target.value)}
              className="w-full h-64 px-4 py-3 border border-gray-300 rounded-lg font-mono text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Paste CSV data here...&#10;From, To, Type, Note&#10;John Doe, Jane Smith, family, Siblings&#10;Alice Johnson, Bob Williams, associate, Business partners"
            />

            <div className="flex items-center space-x-2 text-sm text-gray-600">
              <AlertCircle className="w-4 h-4" />
              <span>{csvData.split('\n').filter(l => l.trim()).length - 1} relationships to create</span>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center justify-end space-x-3 mt-6 pt-6 border-t border-gray-200">
          <button
            onClick={onClose}
            className="px-6 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-all"
          >
            Cancel
          </button>
          <button
            onClick={mode === 'interactive' ? submitInteractiveRelationships : submitCSVRelationships}
            className="px-6 py-2 bg-gradient-primary text-white rounded-glass hover:shadow-glow-md transition-all flex items-center space-x-2"
          >
            <Check className="w-4 h-4" />
            <span>Create Relationships</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default BulkRelationshipTool;
