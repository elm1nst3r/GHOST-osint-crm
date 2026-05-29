import React from 'react';
import { locationColors } from './mapUtils';

const MapLegend = () => (
  <div className="absolute bottom-4 right-4 bg-white dark:bg-slate-800 border border-gray-300 dark:border-gray-600 shadow-lg rounded p-4 z-10 max-w-xs">
    <h4 className="text-sm font-semibold mb-2 text-gray-900 dark:text-gray-100">Location Types</h4>
    <div className="space-y-1 mb-3">
      {Object.entries(locationColors).map(([type, color]) => (
        <div key={type} className="flex items-center space-x-2">
          <div className="w-4 h-4 rounded-full border-2 border-white shadow-sm" style={{ backgroundColor: color }} />
          <span className="text-xs text-gray-700 dark:text-gray-300 font-medium">
            {type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
          </span>
        </div>
      ))}
    </div>

    <h4 className="text-sm font-semibold mb-2 text-gray-900 dark:text-gray-100 border-t dark:border-gray-600 pt-2">Accuracy</h4>
    <div className="space-y-1">
      <div className="flex items-center space-x-2">
        <div className="w-4 h-4 rounded-full border-2 border-white shadow-sm bg-blue-500" />
        <span className="text-xs text-gray-700 dark:text-gray-300">High accuracy (solid)</span>
      </div>
      <div className="flex items-center space-x-2">
        <div className="w-3 h-3 rounded-full border-2 border-white shadow-sm bg-blue-500 opacity-70" style={{ borderStyle: 'dashed' }} />
        <span className="text-xs text-gray-700 dark:text-gray-300">Approximate (dashed)</span>
      </div>
    </div>
  </div>
);

export default MapLegend;
