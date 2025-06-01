// File: frontend/src/components/AttackSurfaceAssetForm.js
import React, { useState, useEffect } from 'react';
import { X, Save, Shield, MapPin, Info } from 'lucide-react';
import { attackSurfaceAPI, peopleAPI } from '../utils/api';

const AttackSurfaceAssetForm = ({ asset, assetTypes, onSave, onCancel }) => {
  const [people, setPeople] = useState([]);
  const [formData, setFormData] = useState({
    person_id: '',
    asset_type_id: '',
    asset_name: '',
    asset_identifier: '',
    asset_details: {},
    location: '',
    status: 'active',
    notes: ''
  });

  useEffect(() => {
    fetchPeople();
    if (asset) {
      setFormData({
        person_id: asset.person_id,
        asset_type_id: asset.asset_type_id,
        asset_name: asset.asset_name,
        asset_identifier: asset.asset_identifier || '',
        asset_details: asset.asset_details || {},
        location: asset.location || '',
        status: asset.status || 'active',
        notes: asset.notes || ''
      });
    }
  }, [asset]);

  const fetchPeople = async () => {
    try {
      const data = await peopleAPI.getAll();
      setPeople(data);
    } catch (error) {
      console.error('Error fetching people:', error);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    try {
      if (asset) {
        await attackSurfaceAPI.updateAsset(asset.id, formData);
      } else {
        await attackSurfaceAPI.createAsset(formData);
      }
      onSave();
    } catch (error) {
      console.error('Error saving asset:', error);
      alert('Failed to save asset');
    }
  };

  const selectedAssetType = assetTypes.find(t => t.id === parseInt(formData.asset_type_id));

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b flex justify-between items-center">
          <h2 className="text-xl font-bold text-gray-900 flex items-center">
            <Shield className="w-5 h-5 mr-2" />
            {asset ? 'Edit Asset' : 'Add New Asset'}
          </h2>
          <button onClick={onCancel} className="text-gray-600 hover:text-gray-700">
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Owner *</label>
              <select
                value={formData.person_id}
                onChange={(e) => setFormData({ ...formData, person_id: e.target.value })}
                className="w-full px-3 py-2 border rounded-md"
                required
              >
                <option value="">Select Person</option>
                {people.map(person => (
                  <option key={person.id} value={person.id}>
                    {person.first_name} {person.last_name}
                    {person.case_name && ` - ${person.case_name}`}
                  </option>
                ))}
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Asset Type *</label>
              <select
                value={formData.asset_type_id}
                onChange={(e) => setFormData({ ...formData, asset_type_id: e.target.value })}
                className="w-full px-3 py-2 border rounded-md"
                required
              >
                <option value="">Select Type</option>
                {Object.entries(
                  assetTypes.reduce((acc, type) => {
                    if (!acc[type.type_category]) acc[type.type_category] = [];
                    acc[type.type_category].push(type);
                    return acc;
                  }, {})
                ).map(([category, types]) => (
                  <optgroup key={category} label={category.charAt(0).toUpperCase() + category.slice(1)}>
                    {types.map(type => (
                      <option key={type.id} value={type.id}>
                        {type.type_name}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Asset Name *</label>
            <input
              type="text"
              value={formData.asset_name}
              onChange={(e) => setFormData({ ...formData, asset_name: e.target.value })}
              className="w-full px-3 py-2 border rounded-md"
              placeholder="e.g., Personal MacBook Pro, Gmail Account"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Identifier
              <span className="text-xs text-gray-500 ml-2">
                (IP address, URL, email, serial number, etc.)
              </span>
            </label>
            <input
              type="text"
              value={formData.asset_identifier}
              onChange={(e) => setFormData({ ...formData, asset_identifier: e.target.value })}
              className="w-full px-3 py-2 border rounded-md"
              placeholder={
                selectedAssetType?.type_category === 'device' ? 'e.g., 192.168.1.100, AA:BB:CC:DD:EE:FF' :
                selectedAssetType?.type_category === 'account' ? 'e.g., user@example.com' :
                selectedAssetType?.type_category === 'service' ? 'e.g., https://example.com' :
                'Enter identifier'
              }
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center">
              <MapPin className="w-4 h-4 mr-1" />
              Location
            </label>
            <input
              type="text"
              value={formData.location}
              onChange={(e) => setFormData({ ...formData, location: e.target.value })}
              className="w-full px-3 py-2 border rounded-md"
              placeholder="e.g., Home Office, Company HQ, Cloud"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
              <select
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                className="w-full px-3 py-2 border rounded-md"
              >
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
                <option value="compromised">Compromised</option>
              </select>
            </div>
            
            {selectedAssetType && (
              <div className="flex items-center space-x-2 text-sm text-gray-600 pt-6">
                <Info className="w-4 h-4" />
                <span>
                  {selectedAssetType.scan_available ? 'Scanning available' : 'Manual assessment only'}
                </span>
              </div>
            )}
          </div>

          {/* Additional Details Based on Asset Type */}
          {selectedAssetType && (
            <div className="border-t pt-4">
              <h4 className="font-medium text-gray-900 mb-3">Additional Details</h4>
              
              {selectedAssetType.type_category === 'device' && (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Manufacturer</label>
                      <input
                        type="text"
                        value={formData.asset_details.manufacturer || ''}
                        onChange={(e) => setFormData({
                          ...formData,
                          asset_details: { ...formData.asset_details, manufacturer: e.target.value }
                        })}
                        className="w-full px-3 py-2 border rounded-md text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Model</label>
                      <input
                        type="text"
                        value={formData.asset_details.model || ''}
                        onChange={(e) => setFormData({
                          ...formData,
                          asset_details: { ...formData.asset_details, model: e.target.value }
                        })}
                        className="w-full px-3 py-2 border rounded-md text-sm"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">OS/Firmware</label>
                      <input
                        type="text"
                        value={formData.asset_details.os_version || ''}
                        onChange={(e) => setFormData({
                          ...formData,
                          asset_details: { ...formData.asset_details, os_version: e.target.value }
                        })}
                        className="w-full px-3 py-2 border rounded-md text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Last Update</label>
                      <input
                        type="date"
                        value={formData.asset_details.last_update || ''}
                        onChange={(e) => setFormData({
                          ...formData,
                          asset_details: { ...formData.asset_details, last_update: e.target.value }
                        })}
                        className="w-full px-3 py-2 border rounded-md text-sm"
                      />
                    </div>
                  </div>
                </div>
              )}

              {selectedAssetType.type_category === 'account' && (
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Account Provider</label>
                    <input
                      type="text"
                      value={formData.asset_details.provider || ''}
                      onChange={(e) => setFormData({
                        ...formData,
                        asset_details: { ...formData.asset_details, provider: e.target.value }
                      })}
                      className="w-full px-3 py-2 border rounded-md text-sm"
                      placeholder="e.g., Google, Microsoft, Facebook"
                    />
                  </div>
                  <div className="flex items-center space-x-4">
                    <label className="flex items-center">
                      <input
                        type="checkbox"
                        checked={formData.asset_details.two_factor || false}
                        onChange={(e) => setFormData({
                          ...formData,
                          asset_details: { ...formData.asset_details, two_factor: e.target.checked }
                        })}
                        className="h-4 w-4 text-blue-600 rounded"
                      />
                      <span className="ml-2 text-sm">Two-Factor Authentication</span>
                    </label>
                    <label className="flex items-center">
                      <input
                        type="checkbox"
                        checked={formData.asset_details.public_profile || false}
                        onChange={(e) => setFormData({
                          ...formData,
                          asset_details: { ...formData.asset_details, public_profile: e.target.checked }
                        })}
                        className="h-4 w-4 text-blue-600 rounded"
                      />
                      <span className="ml-2 text-sm">Public Profile</span>
                    </label>
                  </div>
                </div>
              )}

              {selectedAssetType.type_category === 'network' && (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">SSID</label>
                      <input
                        type="text"
                        value={formData.asset_details.ssid || ''}
                        onChange={(e) => setFormData({
                          ...formData,
                          asset_details: { ...formData.asset_details, ssid: e.target.value }
                        })}
                        className="w-full px-3 py-2 border rounded-md text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Encryption</label>
                      <select
                        value={formData.asset_details.encryption || ''}
                        onChange={(e) => setFormData({
                          ...formData,
                          asset_details: { ...formData.asset_details, encryption: e.target.value }
                        })}
                        className="w-full px-3 py-2 border rounded-md text-sm"
                      >
                        <option value="">Select</option>
                        <option value="WPA3">WPA3</option>
                        <option value="WPA2">WPA2</option>
                        <option value="WEP">WEP</option>
                        <option value="Open">Open</option>
                      </select>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              className="w-full px-3 py-2 border rounded-md"
              rows="3"
              placeholder="Additional security notes or observations..."
            />
          </div>

          <div className="flex justify-end space-x-3 pt-4 border-t">
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 flex items-center"
            >
              <Save className="w-4 h-4 mr-2" />
              {asset ? 'Update' : 'Create'} Asset
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AttackSurfaceAssetForm;