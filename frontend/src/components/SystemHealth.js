// File: frontend/src/components/SystemHealth.js
import React, { useState, useEffect } from 'react';
import { 
  Activity, 
  Database, 
  HardDrive, 
  Clock, 
  Users, 
  Building2, 
  Wrench, 
  CheckSquare,
  AlertTriangle,
  Server,
  Wifi,
  WifiOff
} from 'lucide-react';
import { systemAPI } from '../utils/api';

const SystemHealth = () => {
  const [health, setHealth] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    fetchHealth();
    
    // Refresh health data every 30 seconds
    const interval = setInterval(fetchHealth, 30000);
    return () => clearInterval(interval);
  }, []);

  const fetchHealth = async () => {
    try {
      const data = await systemAPI.getHealth();
      setHealth(data);
      setError(null);
    } catch (err) {
      console.error('Error fetching system health:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const formatUptime = (seconds) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'healthy':
        return 'text-green-500';
      case 'degraded':
        return 'text-yellow-500';
      case 'unhealthy':
        return 'text-red-500';
      default:
        return 'text-gray-500';
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'healthy':
        return <Wifi className="w-3 h-3 text-green-500" />;
      case 'degraded':
        return <AlertTriangle className="w-3 h-3 text-yellow-500" />;
      case 'unhealthy':
        return <WifiOff className="w-3 h-3 text-red-500" />;
      default:
        return <Activity className="w-3 h-3 text-gray-500" />;
    }
  };

  if (loading) {
    return (
      <div className="p-3 glass rounded-glass">
        <div className="text-xs text-gray-500 dark:text-gray-400 text-center">
          <div className="flex items-center justify-center space-x-1">
            <Activity className="w-3 h-3 animate-pulse" />
            <span>Loading...</span>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-3 glass rounded-glass">
        <div className="text-xs text-red-500 text-center">
          <div className="flex items-center justify-center space-x-1">
            <WifiOff className="w-3 h-3" />
            <span>System Offline</span>
          </div>
        </div>
      </div>
    );
  }

  if (!health) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50">
      <div className={`glass rounded-glass shadow-lg transition-all duration-300 ${expanded ? 'w-72' : 'w-auto'}`}>
        <div
          className="p-3 text-xs text-gray-700 dark:text-gray-300 cursor-pointer"
          onClick={() => setExpanded(!expanded)}
        >
          {/* Basic Status - Always Visible */}
          <div className="flex items-center justify-between space-x-3">
            <div className="flex items-center space-x-2">
              {getStatusIcon(health.status)}
              <span className={`font-medium ${getStatusColor(health.status)}`}>
                {health.status === 'healthy' ? 'System Online' :
                 health.status === 'degraded' ? 'System Degraded' :
                 'System Offline'}
              </span>
            </div>
            {!expanded && (
              <div className="flex items-center space-x-1 text-gray-500 dark:text-gray-400">
                <HardDrive className="w-3 h-3" />
                <span>{health.memory?.used || 0}MB</span>
              </div>
            )}
          </div>

          {/* Expanded Details */}
          {expanded && (
            <div className="mt-3 space-y-3 border-t border-white/20 dark:border-gray-700 pt-3">
              {/* System Info */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Server className="w-4 h-4 text-blue-500" />
                    <span className="font-medium">Backend</span>
                  </div>
                  <span className="text-green-500 font-medium">
                    {health.status === 'healthy' ? 'Online' : 'Offline'}
                  </span>
                </div>

                <div className="pl-6 text-xs text-gray-600 dark:text-gray-400">
                  Uptime: {formatUptime(health.uptime || 0)}
                </div>
              </div>

              {/* Database Status */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Database className={`w-4 h-4 ${health.database?.status === 'connected' ? 'text-green-500' : 'text-red-500'}`} />
                    <span className="font-medium">Database</span>
                  </div>
                  <span className={health.database?.status === 'connected' ? 'text-green-500' : 'text-red-500'}>
                    {health.database?.status === 'connected' ? 'Connected' : 'Disconnected'}
                  </span>
                </div>

                {health.database?.status === 'connected' && (
                  <div className="pl-6 text-xs text-gray-600 dark:text-gray-400">
                    {health.database?.connections || 0} active connections
                  </div>
                )}
              </div>

              {/* Memory Usage */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <HardDrive className="w-4 h-4 text-purple-500" />
                    <span className="font-medium">Memory</span>
                  </div>
                  <span>{health.memory?.used || 0} / {health.memory?.total || 0} MB</span>
                </div>

                {health.memory?.used && health.memory?.total && (
                  <div className="pl-6">
                    <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                      <div
                        className="bg-purple-500 h-2 rounded-full transition-all duration-300"
                        style={{ width: `${(health.memory.used / health.memory.total) * 100}%` }}
                      ></div>
                    </div>
                  </div>
                )}
              </div>

              {/* Data Counts */}
              <div className="space-y-2">
                <div className="font-medium">Data Summary</div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="flex items-center justify-between px-2 py-1 bg-blue-50 dark:bg-blue-900/20 rounded">
                    <div className="flex items-center space-x-1">
                      <Users className="w-3 h-3 text-blue-500" />
                      <span>People</span>
                    </div>
                    <span className="font-medium">{health.counts?.people || 0}</span>
                  </div>
                  <div className="flex items-center justify-between px-2 py-1 bg-green-50 dark:bg-green-900/20 rounded">
                    <div className="flex items-center space-x-1">
                      <Building2 className="w-3 h-3 text-green-500" />
                      <span>Business</span>
                    </div>
                    <span className="font-medium">{health.counts?.businesses || 0}</span>
                  </div>
                  <div className="flex items-center justify-between px-2 py-1 bg-orange-50 dark:bg-orange-900/20 rounded">
                    <div className="flex items-center space-x-1">
                      <Wrench className="w-3 h-3 text-orange-500" />
                      <span>Tools</span>
                    </div>
                    <span className="font-medium">{health.counts?.tools || 0}</span>
                  </div>
                  <div className="flex items-center justify-between px-2 py-1 bg-purple-50 dark:bg-purple-900/20 rounded">
                    <div className="flex items-center space-x-1">
                      <CheckSquare className="w-3 h-3 text-purple-500" />
                      <span>Todos</span>
                    </div>
                    <span className="font-medium">{health.counts?.activeTodos || 0}</span>
                  </div>
                </div>
              </div>

              {/* Activity */}
              <div className="flex items-center justify-between p-2 bg-accent-primary/10 rounded">
                <div className="flex items-center space-x-2">
                  <Activity className="w-4 h-4 text-accent-primary" />
                  <span className="font-medium">Activity (24h)</span>
                </div>
                <span className="font-bold text-accent-primary">{health.counts?.recentActivity || 0}</span>
              </div>

              {/* Last Updated */}
              <div className="flex items-center justify-center space-x-1 text-xs text-gray-500 dark:text-gray-400 pt-2 border-t border-white/20 dark:border-gray-700">
                <Clock className="w-3 h-3" />
                <span>Updated {new Date(health.timestamp).toLocaleTimeString()}</span>
              </div>

              {/* Refresh Button */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  fetchHealth();
                }}
                className="w-full px-3 py-2 text-xs bg-accent-primary text-white rounded-lg hover:bg-accent-primary/80 transition-colors font-medium"
              >
                Refresh Status
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SystemHealth;