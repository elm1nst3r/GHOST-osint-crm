// File: frontend/src/components/AssetRiskDetails.js
import React, { useState, useEffect } from 'react';
import { 
  X, Shield, AlertTriangle, Activity, Clock, 
  CheckCircle, AlertCircle, Info, Scan, History 
} from 'lucide-react';
import { attackSurfaceAPI } from '../utils/api';

const AssetRiskDetails = ({ asset, onClose, onRefresh }) => {
  const [riskHistory, setRiskHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchRiskHistory();
  }, [asset.id]);

  const fetchRiskHistory = async () => {
    try {
      setLoading(true);
      const history = await attackSurfaceAPI.getRiskAssessments(asset.id);
      setRiskHistory(history);
    } catch (error) {
      console.error('Error fetching risk history:', error);
    } finally {
      setLoading(false);
    }
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

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="p-6 border-b flex justify-between items-center">
          <div className="flex items-center space-x-3">
            <Shield className="w-6 h-6 text-blue-600" />
            <h2 className="text-xl font-bold text-gray-900">{asset.asset_name}</h2>
            <span className={`px-3 py-1 rounded-full text-sm font-medium ${getRiskLevelColor(asset.risk_score)}`}>
              {asset.risk_score}/100 - {getRiskLevelText(asset.risk_score)}
            </span>
          </div>
          <button onClick={onClose} className="text-gray-600 hover:text-gray-700">
            <X className="w-5 h-5" />
          </button>
        </div>
        
        {/* Content */}
        <div className="p-6 overflow-y-auto" style={{ maxHeight: 'calc(90vh - 180px)' }}>
          <div className="grid grid-cols-2 gap-6">
            {/* Asset Information */}
            <div>
              <h3 className="text-lg font-semibold mb-4 flex items-center">
                <Info className="w-5 h-5 mr-2" />
                Asset Information
              </h3>
              <div className="space-y-3 bg-gray-50 rounded-lg p-4">
                <div>
                  <label className="text-sm font-medium text-gray-600">Type</label>
                  <p className="text-gray-900">{asset.type_name}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-600">Owner</label>
                  <p className="text-gray-900">{asset.first_name} {asset.last_name}</p>
                </div>
                {asset.case_name && (
                  <div>
                    <label className="text-sm font-medium text-gray-600">Case</label>
                    <p className="text-gray-900">{asset.case_name}</p>
                  </div>
                )}
                {asset.location && (
                  <div>
                    <label className="text-sm font-medium text-gray-600">Location</label>
                    <p className="text-gray-900">{asset.location}</p>
                  </div>
                )}
                <div>
                  <label className="text-sm font-medium text-gray-600">Status</label>
                  <p className={`inline-block px-2 py-1 rounded text-sm ${
                    asset.status === 'active' ? 'bg-green-100 text-green-800' :
                    asset.status === 'inactive' ? 'bg-gray-100 text-gray-800' :
                    'bg-red-100 text-red-800'
                  }`}>
                    {asset.status}
                  </p>
                </div>
              </div>
            </div>
            
            {/* Risk Factors */}
            <div>
              <h3 className="text-lg font-semibold mb-4 flex items-center">
                <AlertTriangle className="w-5 h-5 mr-2" />
                Risk Analysis
              </h3>
              <div className="space-y-3">
                {asset.unpatched_cves > 0 && (
                  <div className="flex items-center justify-between p-3 bg-red-50 rounded-lg">
                    <div className="flex items-center space-x-2">
                      <AlertCircle className="w-5 h-5 text-red-600" />
                      <span className="text-sm font-medium text-red-900">Unpatched Vulnerabilities</span>
                    </div>
                    <span className="text-sm font-bold text-red-600">{asset.unpatched_cves} CVEs</span>
                  </div>
                )}
                
                {asset.scan_results && Object.keys(asset.scan_results).length > 0 && (
                  <div className="bg-gray-50 rounded-lg p-4">
                    <h4 className="font-medium mb-2">Latest Scan Results</h4>
                    <pre className="text-xs bg-white p-2 rounded overflow-auto">
                      {JSON.stringify(asset.scan_results, null, 2)}
                    </pre>
                  </div>
                )}
                
                {!asset.last_scan_date && (
                  <div className="flex items-center p-3 bg-yellow-50 rounded-lg">
                    <Info className="w-5 h-5 text-yellow-600 mr-2" />
                    <span className="text-sm text-yellow-900">No scans performed yet</span>
                  </div>
                )}
              </div>
            </div>
          </div>
          
          {/* Risk Assessment History */}
          <div className="mt-6">
            <h3 className="text-lg font-semibold mb-4 flex items-center">
              <History className="w-5 h-5 mr-2" />
              Risk Assessment History
            </h3>
            {loading ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
              </div>
            ) : riskHistory.length > 0 ? (
              <div className="space-y-3">
                {riskHistory.map((assessment) => (
                  <div key={assessment.id} className="border rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center space-x-3">
                        <span className={`px-3 py-1 rounded-full text-sm font-medium ${getRiskLevelColor(assessment.risk_score)}`}>
                          {assessment.risk_score}/100
                        </span>
                        <span className="text-sm text-gray-600">
                          {new Date(assessment.assessment_date).toLocaleString()}
                        </span>
                      </div>
                      <span className="text-sm text-gray-500">by {assessment.assessed_by || 'System'}</span>
                    </div>
                    
                    {assessment.risk_factors && assessment.risk_factors.length > 0 && (
                      <div className="mt-2">
                        <p className="text-sm font-medium text-gray-700 mb-1">Risk Factors:</p>
                        <ul className="list-disc list-inside text-sm text-gray-600">
                          {assessment.risk_factors.map((factor, idx) => (
                            <li key={idx}>
                              {factor.factor} - 
                              <span className={`ml-1 font-medium ${
                                factor.severity === 'critical' ? 'text-red-600' :
                                factor.severity === 'high' ? 'text-orange-600' :
                                factor.severity === 'medium' ? 'text-yellow-600' :
                                'text-green-600'
                              }`}>
                                {factor.severity}
                              </span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    
                    {assessment.recommendations && (
                      <div className="mt-2">
                        <p className="text-sm font-medium text-gray-700">Recommendations:</p>
                        <p className="text-sm text-gray-600">{assessment.recommendations}</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-center text-gray-500 py-8">No risk assessments recorded yet</p>
            )}
          </div>
        </div>
        
        {/* Footer */}
        <div className="p-6 border-t flex justify-end space-x-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
          >
            Close
          </button>
          <button
            onClick={() => {
              onRefresh();
              onClose();
            }}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 flex items-center"
          >
            <Scan className="w-4 h-4 mr-2" />
            Rescan Asset
          </button>
        </div>
      </div>
    </div>
  );
};

export default AssetRiskDetails;