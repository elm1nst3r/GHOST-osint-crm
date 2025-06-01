// File: frontend/src/components/CVEManager.js
import React, { useState, useEffect } from 'react';
import { 
  Shield, Search, Plus, AlertTriangle, AlertCircle, 
  Info, ExternalLink, Calendar, Tag, X 
} from 'lucide-react';
import { attackSurfaceAPI } from '../utils/api';

const CVEManager = ({ assets }) => {
  const [cves, setCves] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [severityFilter, setSeverityFilter] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [selectedAsset, setSelectedAsset] = useState(null);
  const [linkingCVE, setLinkingCVE] = useState(null);
  const [formData, setFormData] = useState({
    cve_id: '',
    description: '',
    severity: '',
    cvss_score: '',
    affected_products: [],
    published_date: '',
    references: []
  });

  useEffect(() => {
    fetchCVEs();
  }, [severityFilter, searchTerm]);

  const fetchCVEs = async () => {
    try {
      setLoading(true);
      const data = await attackSurfaceAPI.getCVEs({ severity: severityFilter, search: searchTerm });
      setCves(data);
    } catch (error) {
      console.error('Error fetching CVEs:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddCVE = async (e) => {
    e.preventDefault();
    try {
      await attackSurfaceAPI.addCVE(formData);
      setShowAddForm(false);
      resetForm();
      fetchCVEs();
    } catch (error) {
      console.error('Error adding CVE:', error);
      alert('Failed to add CVE');
    }
  };

  const handleLinkCVE = async (assetId, cveId) => {
    try {
      await attackSurfaceAPI.linkCVEToAsset(assetId, { cve_id: cveId, status: 'unpatched' });
      alert('CVE linked to asset successfully');
      setLinkingCVE(null);
      setSelectedAsset(null);
    } catch (error) {
      console.error('Error linking CVE:', error);
      alert('Failed to link CVE to asset');
    }
  };

  const resetForm = () => {
    setFormData({
      cve_id: '',
      description: '',
      severity: '',
      cvss_score: '',
      affected_products: [],
      published_date: '',
      references: []
    });
  };

  const getSeverityColor = (severity) => {
    switch (severity?.toUpperCase()) {
      case 'CRITICAL': return 'bg-red-100 text-red-800 border-red-200';
      case 'HIGH': return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'MEDIUM': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'LOW': return 'bg-green-100 text-green-800 border-green-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getCVSSColor = (score) => {
    const numScore = parseFloat(score);
    if (numScore >= 9.0) return 'text-red-600';
    if (numScore >= 7.0) return 'text-orange-600';
    if (numScore >= 4.0) return 'text-yellow-600';
    return 'text-green-600';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-lg shadow-sm p-6 border">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold flex items-center">
            <Shield className="w-5 h-5 mr-2 text-red-600" />
            CVE Database
          </h3>
          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 flex items-center text-sm"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add CVE
          </button>
        </div>

        {/* Filters */}
        <div className="flex space-x-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input
              type="text"
              placeholder="Search CVE ID or description..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-3 py-2 border rounded-md text-sm"
            />
          </div>
          <select
            value={severityFilter}
            onChange={(e) => setSeverityFilter(e.target.value)}
            className="px-3 py-2 border rounded-md text-sm"
          >
            <option value="">All Severities</option>
            <option value="CRITICAL">Critical</option>
            <option value="HIGH">High</option>
            <option value="MEDIUM">Medium</option>
            <option value="LOW">Low</option>
          </select>
        </div>
      </div>

      {/* Add CVE Form */}
      {showAddForm && (
        <div className="bg-white rounded-lg shadow-sm p-6 border">
          <h4 className="text-lg font-semibold mb-4">Add New CVE</h4>
          <form onSubmit={handleAddCVE} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">CVE ID *</label>
                <input
                  type="text"
                  value={formData.cve_id}
                  onChange={(e) => setFormData({ ...formData, cve_id: e.target.value })}
                  className="w-full px-3 py-2 border rounded-md"
                  placeholder="CVE-2024-12345"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Severity *</label>
                <select
                  value={formData.severity}
                  onChange={(e) => setFormData({ ...formData, severity: e.target.value })}
                  className="w-full px-3 py-2 border rounded-md"
                  required
                >
                  <option value="">Select Severity</option>
                  <option value="CRITICAL">Critical</option>
                  <option value="HIGH">High</option>
                  <option value="MEDIUM">Medium</option>
                  <option value="LOW">Low</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">CVSS Score</label>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  max="10"
                  value={formData.cvss_score}
                  onChange={(e) => setFormData({ ...formData, cvss_score: e.target.value })}
                  className="w-full px-3 py-2 border rounded-md"
                  placeholder="7.5"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Published Date</label>
                <input
                  type="date"
                  value={formData.published_date}
                  onChange={(e) => setFormData({ ...formData, published_date: e.target.value })}
                  className="w-full px-3 py-2 border rounded-md"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Description *</label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="w-full px-3 py-2 border rounded-md"
                rows="3"
                required
              />
            </div>

            <div className="flex justify-end space-x-2">
              <button
                type="button"
                onClick={() => {
                  setShowAddForm(false);
                  resetForm();
                }}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
              >
                Add CVE
              </button>
            </div>
          </form>
        </div>
      )}

      {/* CVE List */}
      <div className="bg-white rounded-lg shadow-sm border">
        {loading ? (
          <div className="p-8 text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          </div>
        ) : cves.length > 0 ? (
          <div className="divide-y divide-gray-200">
            {cves.map((cve) => (
              <div key={cve.id} className="p-4 hover:bg-gray-50">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-3 mb-2">
                      <h4 className="font-semibold text-gray-900">{cve.cve_id}</h4>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium border ${getSeverityColor(cve.severity)}`}>
                        {cve.severity}
                      </span>
                      {cve.cvss_score && (
                        <span className={`text-sm font-medium ${getCVSSColor(cve.cvss_score)}`}>
                          CVSS: {cve.cvss_score}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-600 mb-2">{cve.description}</p>
                    <div className="flex items-center space-x-4 text-xs text-gray-500">
                      <span className="flex items-center">
                        <Calendar className="w-3 h-3 mr-1" />
                        Published: {cve.published_date ? new Date(cve.published_date).toLocaleDateString() : 'N/A'}
                      </span>
                      {cve.last_modified && (
                        <span>
                          Modified: {new Date(cve.last_modified).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  </div>
                  
                  <div className="ml-4">
                    <button
                      onClick={() => setLinkingCVE(cve)}
                      className="px-3 py-1 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm"
                    >
                      Link to Asset
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-8 text-center text-gray-500">
            <AlertCircle className="w-12 h-12 mx-auto mb-3 text-gray-400" />
            <p>No CVEs found</p>
          </div>
        )}
      </div>

      {/* Link CVE Modal */}
      {linkingCVE && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold mb-4">Link CVE to Asset</h3>
            <p className="text-sm text-gray-600 mb-4">
              Select an asset to link {linkingCVE.cve_id} to:
            </p>
            
            <div className="max-h-64 overflow-y-auto space-y-2 mb-4">
              {assets.map((asset) => (
                <button
                  key={asset.id}
                  onClick={() => setSelectedAsset(asset)}
                  className={`w-full text-left p-3 rounded-lg border ${
                    selectedAsset?.id === asset.id 
                      ? 'border-blue-500 bg-blue-50' 
                      : 'border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  <div className="font-medium">{asset.asset_name}</div>
                  <div className="text-sm text-gray-600">
                    {asset.type_name} - {asset.first_name} {asset.last_name}
                  </div>
                </button>
              ))}
            </div>
            
            <div className="flex justify-end space-x-2">
              <button
                onClick={() => {
                  setLinkingCVE(null);
                  setSelectedAsset(null);
                }}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
              >
                Cancel
              </button>
              <button
                onClick={() => selectedAsset && handleLinkCVE(selectedAsset.id, linkingCVE.cve_id)}
                disabled={!selectedAsset}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
              >
                Link CVE
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CVEManager;