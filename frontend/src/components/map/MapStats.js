import React from 'react';
import { useTranslation } from 'react-i18next';
import { Users, MapPin, CheckCircle, Clock, AlertCircle } from 'lucide-react';

const MapStats = ({ peopleCount, markersCount, geocodingStats, missingCoordinates, loading, hasMore, totalPages, currentPage, onLoadMore }) => {
  const { t } = useTranslation();
  return (
    <div className="absolute top-4 left-4 bg-white dark:bg-slate-800 border border-gray-300 dark:border-gray-600 shadow-lg rounded px-4 py-3 z-10">
      <div className="space-y-2">
        <div className="flex items-center space-x-2 text-sm text-gray-700 dark:text-gray-300">
          <Users className="w-4 h-4 text-blue-600" />
          <span className="font-medium">{t('mapStats.peopleCount', { count: peopleCount })}</span>
          <span className="text-gray-400 dark:text-gray-500">|</span>
          <MapPin className="w-4 h-4 text-blue-600" />
          <span className="font-medium">{t('mapStats.locationsCount', { count: markersCount })}</span>
        </div>

        {geocodingStats && (
          <div className="flex items-center space-x-2 text-xs text-gray-600 dark:text-gray-400">
            <CheckCircle className="w-3 h-3 text-green-500" />
            <span>{t('mapStats.cachedCount', { count: geocodingStats.total_cached })}</span>
            <span className="text-gray-400 dark:text-gray-500">|</span>
            <Clock className="w-3 h-3 text-blue-500" />
            <span>{t('mapStats.todayCount', { count: geocodingStats.cached_today })}</span>
            {geocodingStats.avg_confidence && (
              <>
                <span className="text-gray-400 dark:text-gray-500">|</span>
                <span>{t('mapStats.avgConfidence', { pct: Math.round(geocodingStats.avg_confidence) })}</span>
              </>
            )}
          </div>
        )}

        {missingCoordinates > 0 && (
          <div className="flex items-center space-x-2 text-xs">
            <AlertCircle className="w-3 h-3 text-amber-500" />
            <span className="text-yellow-600 font-medium">{t('mapStats.needGeocodingCount', { count: missingCoordinates })}</span>
          </div>
        )}

        {hasMore && (
          <button
            onClick={onLoadMore}
            disabled={loading}
            className="w-full px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 transition-all"
          >
            {loading ? t('common.loading') : t('mapStats.loadMorePagesLeft', { count: totalPages - currentPage - 1 })}
          </button>
        )}
      </div>
    </div>
  );
};

export default MapStats;
