// File: frontend/src/components/AttackSurface.js
import React, { useState, useEffect } from 'react';
import { 
  Shield, AlertTriangle, Activity, Wifi, Monitor, Smartphone, 
  Globe, Mail, Cloud, Camera, Speaker, Router, HardDrive,
  Plus, Search, Filter, Scan, AlertCircle, CheckCircle,
  TrendingUp, Users, Briefcase, X, Edit2, Trash2, Eye
} from 'lucide-react';
import { attackSurfaceAPI } from '../utils/api';
import AttackSurfaceAssetForm from './AttackSurfaceAssetForm';
import AssetRiskDetails from './AssetRiskDetails';
import CVEManager from './CVEManager';

const AttackSurface = () => {
  const [assets, setAssets] = useState([]);
  const [assetTypes, setAssetTypes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeView, setActiveView] = useState('registry'); // registry, cves, analytics
  const [showAddAsset, setShowAddAsset] = useState(false);
  const [editingAsset, setEditingAsset] = useState(null);
  const [selectedAsset, setSelectedAsset] = useState(null);
  const [scanning, setScanning] = useState({});
  
  // Filters
  const [filters, setFilters] = useState({
    search: '',
    personId: '',
    caseName: '',
    riskLevel: '',
    assetType: ''
  });

  useEffect(() => {
    fetchData();
  }, [filters]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [assetsData, typesData] = await Promise.all([
        attackSurfaceAPI.getAssets(filters),
        attackSurfaceAPI.getAssetTypes()
      ]);
      setAssets(assetsData);
      setAssetTypes(typesData);
    } catch (error) {
      console.error('Error fetching attack surface data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleScan = async (assetId, scanType = 'basic') => {
    try {
      setScanning({ ...scanning, [assetId]: true });
      await attackSurfaceAPI.scanAsset(assetId, scanType);
      
      // Poll for scan completion
      setTimeout(() => {
        fetchData();
        setScanning({ ...scanning, [assetId]: false });
      }, 6000);
    } catch (error) {
      console.error('Error scanning asset:', error);
      setScanning({ ...scanning, [assetId]: false });
    }
  };

  const handleDeleteAsset = async (assetId) => {
    if (window.confirm('Are you sure you want to delete this asset?')) {
      try {
        await attackSurfaceAPI.deleteAsset(assetId);
        fetchData();
      } catch (error) {
        console.error('Error deleting asset:', error);
      }
    }
  };

  const getIconForAssetType = (iconName) => {
    const icons = {
      Laptop: Monitor,     // Use Monitor for Laptop
      Monitor: Monitor,
      Smartphone: Smartphone,
      Tablet: Monitor,     // Use Monitor for Tablet
      Camera: Camera,
      Speaker: Speaker,
      Router: Router,
      HardDrive: HardDrive,
      Wifi: Wifi,
      Shield: Shield,
      Globe: Globe,
      Mail: Mail,
      Cloud: Cloud
    };
    const Icon = icons[iconName] || Shield;
    return <Icon className="w-5 h-5" />;
  };

  const getRiskLevelColor = (score) => {
    if (score >= 70) return 'text-red-600 bg-red-100';
    if (score >= 40) return 'text-yellow-600 bg-yellow-100';
    return 'text-green-600 bg-green-100';
  };

  const getRiskLevelText = (score) => {
    if (score >= 70) return 'High Risk';
    if (score >= 40) return 'Medium Risk';
    return 'Low Risk';
  };

  // Group assets by category
  const groupedAssets = assets.reduce((acc, asset) => {
    const category = asset.type_category;
    if (!acc[category]) acc[category] = [];
    acc[category].push(asset);
    return acc;
  }, {});

  // Calculate statistics
  const stats = {
    total: assets.length,
    highRisk: assets.filter(a => a.risk_score >= 70).length,
    withCVEs: assets.filter(a => a.unpatched_cves > 0).length,
    categories: Object.keys(groupedAssets).length
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Attack Surface Management</h1>
          <p className="text-sm text-gray-600 mt-1">Monitor and assess security risks across all assets</p>
        </div>
        <button
          onClick={() => setShowAddAsset(true)}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 flex items-center"
        >
          <Plus className="w-4 h-4 mr-2" />
          Add Asset
        </button>
      </div>

      {/* Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-lg shadow-sm p-4 border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Assets</p>
              <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
            </div>
            <Shield className="w-8 h-8 text-blue-500" />
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow-sm p-4 border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">High Risk Assets</p>
              <p className="text-2xl font-bold text-red-600">{stats.highRisk}</p>
            </div>
            <AlertTriangle className="w-8 h-8 text-red-500" />
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow-sm p-4 border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">With Vulnerabilities</p>
              <p className="text-2xl font-bold text-yellow-600">{stats.withCVEs}</p>
            </div>
            <AlertCircle className="w-8 h-8 text-yellow-500" />
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow-sm p-4 border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Asset Categories</p>
              <p className="text-2xl font-bold text-gray-900">{stats.categories}</p>
            </div>
            <Activity className="w-8 h-8 text-green-500" />
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="bg-white rounded-lg shadow-sm border mb-6">
        <nav className="flex space-x-8 px-6" aria-label="Tabs">
          {[
            { id: 'registry', label: 'Asset Registry' },
            { id: 'cves', label: 'CVE Database' },
            { id: 'analytics', label: 'Risk Analytics' }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveView(tab.id)}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeView === tab.id
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow-sm p-4 mb-6 border">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input
              type="text"
              placeholder="Search assets..."
              value={filters.search}
              onChange={(e) => setFilters({ ...filters, search: e.target.value })}
              className="w-full pl-10 pr-3 py-2 border rounded-md text-sm"
            />
          </div>
          
          <select
            value={filters.riskLevel}
            onChange={(e) => setFilters({ ...filters, riskLevel: e.target.value })}
            className="px-3 py-2 border rounded-md text-sm"
          >
            <option value="">All Risk Levels</option>
            <option value="high">High Risk</option>
            <option value="medium">Medium Risk</option>
            <option value="low">Low Risk</option>
          </select>
          
          <select
            value={filters.assetType}
            onChange={(e) => setFilters({ ...filters, assetType: e.target.value })}
            className="px-3 py-2 border rounded-md text-sm"
          >
            <option value="">All Types</option>
            <option value="device">Devices</option>
            <option value="account">Accounts</option>
            <option value="network">Networks</option>
            <option value="service">Services</option>
          </select>
          
          <input
            type="text"
            placeholder="Filter by case..."
            value={filters.caseName}
            onChange={(e) => setFilters({ ...filters, caseName: e.target.value })}
            className="px-3 py-2 border rounded-md text-sm"
          />
          
          <button
            onClick={() => setFilters({ search: '', personId: '', caseName: '', riskLevel: '', assetType: '' })}
            className="px-3 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 text-sm"
          >
            Clear Filters
          </button>
        </div>
      </div>

      {/* Content based on active view */}
      {activeView === 'registry' && (
        <div className="space-y-6">
          {Object.entries(groupedAssets).map(([category, categoryAssets]) => (
            <div key={category} className="bg-white rounded-lg shadow-sm border">
              <div className="px-6 py-4 border-b bg-gray-50">
                <h3 className="text-lg font-semibold capitalize flex items-center">
                  {category === 'device' && <Monitor className="w-5 h-5 mr-2" />}
                  {category === 'account' && <Users className="w-5 h-5 mr-2" />}
                  {category === 'network' && <Wifi className="w-5 h-5 mr-2" />}
                  {category === 'service' && <Globe className="w-5 h-5 mr-2" />}
                  {category} Assets ({categoryAssets.length})
                </h3>
              </div>
              
              <div className="divide-y divide-gray-200">
                {categoryAssets.map(asset => (
                  <div key={asset.id} className="p-4 hover:bg-gray-50">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-4">
                        <div className={`p-2 rounded-lg ${getRiskLevelColor(asset.risk_score).split(' ')[1]}`}>
                          {getIconForAssetType(asset.icon_name)}
                        </div>
                        
                        <div>
                          <h4 className="font-semibold text-gray-900">{asset.asset_name}</h4>
                          <p className="text-sm text-gray-600">{asset.type_name}</p>
                          <div className="flex items-center space-x-4 mt-1">
                            <span className="text-xs text-gray-500">
                              Owner: {asset.first_name} {asset.last_name}
                            </span>
                            {asset.case_name && (
                              <span className="text-xs text-blue-600">
                                <Briefcase className="w-3 h-3 inline mr-1" />
                                {asset.case_name}
                              </span>
                            )}
                            {asset.location && (
                              <span className="text-xs text-gray-500">
                                📍 {asset.location}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex items-center space-x-4">
                        <div className="text-right">
                          <div className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${getRiskLevelColor(asset.risk_score)}`}>
                            <Activity className="w-4 h-4 mr-1" />
                            {asset.risk_score}/100
                          </div>
                          <p className="text-xs text-gray-500 mt-1">{getRiskLevelText(asset.risk_score)}</p>
                        </div>
                        
                        {asset.unpatched_cves > 0 && (
                          <div className="flex items-center text-red-600">
                            <AlertCircle className="w-5 h-5" />
                            <span className="text-sm ml-1">{asset.unpatched_cves} CVEs</span>
                          </div>
                        )}
                        
                        <div className="flex items-center space-x-2">
                          {asset.scan_available && (
                            <button
                              onClick={() => handleScan(asset.id, 'port_scan')}
                              disabled={scanning[asset.id]}
                              className="p-2 text-blue-600 hover:bg-blue-50 rounded-md disabled:opacity-50"
                              title="Scan Asset"
                            >
                              {scanning[asset.id] ? (
                                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                              ) : (
                                <Scan className="w-4 h-4" />
                              )}
                            </button>
                          )}
                          
                          <button
                            onClick={() => setSelectedAsset(asset)}
                            className="p-2 text-gray-600 hover:bg-gray-100 rounded-md"
                            title="View Details"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          
                          <button
                            onClick={() => setEditingAsset(asset)}
                            className="p-2 text-gray-600 hover:bg-gray-100 rounded-md"
                            title="Edit"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          
                          <button
                            onClick={() => handleDeleteAsset(asset.id)}
                            className="p-2 text-red-600 hover:bg-red-50 rounded-md"
                            title="Delete"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
      
      {activeView === 'cves' && (
        <CVEManager assets={assets} />
      )}
      
      {activeView === 'analytics' && (
        <div className="bg-white rounded-lg shadow-sm p-6 border">
          <h3 className="text-lg font-semibold mb-4">Risk Analytics Dashboard</h3>
          <p className="text-gray-600">Coming soon: Advanced analytics and reporting features</p>
        </div>
      )}

      {/* Add/Edit Asset Modal */}
      {(showAddAsset || editingAsset) && (
        <AttackSurfaceAssetForm
          asset={editingAsset}
          assetTypes={assetTypes}
          onSave={() => {
            setShowAddAsset(false);
            setEditingAsset(null);
            fetchData();
          }}
          onCancel={() => {
            setShowAddAsset(false);
            setEditingAsset(null);
          }}
        />
      )}

      {/* Asset Details Modal */}
      {selectedAsset && (
        <AssetRiskDetails
          asset={selectedAsset}
          onClose={() => setSelectedAsset(null)}
          onRefresh={fetchData}
        />
      )}
    </div>
  );
};

export default AttackSurface;