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
    <div className="p-3 glass rounded-glass">
      <div 
        className="text-xs text-gray-500 dark:text-gray-400 cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        {/* Basic Status */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-1">
            {getStatusIcon(health.status)}
            <span className={`font-medium ${getStatusColor(health.status)}`}>
              {health.status === 'healthy' ? 'System Online' :
               health.status === 'degraded' ? 'System Degraded' :
               'System Offline'}
            </span>
          </div>
          <div className="flex items-center space-x-1">
            <HardDrive className="w-3 h-3" />
            <span>{health.memory?.used || 0}MB</span>
          </div>
        </div>

        {/* Expanded Details */}
        {expanded && (
          <div className="mt-3 space-y-2 border-t border-white/20 pt-2">
            {/* Memory & Performance */}
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="flex items-center space-x-1">
                <Server className="w-3 h-3 text-blue-500" />
                <span>Uptime: {formatUptime(health.uptime)}</span>
              </div>
              <div className="flex items-center space-x-1">
                <HardDrive className="w-3 h-3 text-purple-500" />
                <span>RAM: {health.memory?.used}/{health.memory?.total}MB</span>
              </div>
            </div>

            {/* Database Status */}
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-1">
                <Database className={`w-3 h-3 ${health.database?.status === 'connected' ? 'text-green-500' : 'text-red-500'}`} />
                <span>DB: {health.database?.status || 'unknown'}</span>
              </div>
              <span>{health.database?.connections || 0} conn</span>
            </div>

            {/* Data Counts */}
            <div className="grid grid-cols-2 gap-1 text-xs">
              <div className="flex items-center space-x-1">
                <Users className="w-3 h-3 text-blue-500" />
                <span>{health.counts?.people || 0} people</span>
              </div>
              <div className="flex items-center space-x-1">
                <Building2 className="w-3 h-3 text-green-500" />
                <span>{health.counts?.businesses || 0} biz</span>
              </div>
              <div className="flex items-center space-x-1">
                <Wrench className="w-3 h-3 text-orange-500" />
                <span>{health.counts?.tools || 0} tools</span>
              </div>
              <div className="flex items-center space-x-1">
                <CheckSquare className="w-3 h-3 text-purple-500" />
                <span>{health.counts?.activeTodos || 0} todos</span>
              </div>
            </div>

            {/* Activity */}
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center space-x-1">
                <Activity className="w-3 h-3 text-accent-primary" />
                <span>Activity 24h</span>
              </div>
              <span className="font-medium">{health.counts?.recentActivity || 0}</span>
            </div>

            {/* Last Updated */}
            <div className="flex items-center justify-center space-x-1 text-xs text-gray-400">
              <Clock className="w-3 h-3" />
              <span>Updated {new Date(health.timestamp).toLocaleTimeString()}</span>
            </div>

            {/* Refresh Button */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                fetchHealth();
              }}
              className="w-full mt-2 px-2 py-1 text-xs bg-accent-primary text-white rounded hover:bg-accent-primary/80 transition-colors"
            >
              Refresh
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default SystemHealth;