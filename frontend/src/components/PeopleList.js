// File: frontend/src/components/PeopleList.js
import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { FixedSizeList } from 'react-window';
import { User, Search, Plus, Edit2, Trash2, Eye, Tag, Briefcase, Network, Clock, Users, Grid3x3, Table } from 'lucide-react';
import { peopleAPI, casesAPI } from '../utils/api';
import { PERSON_CATEGORIES, PERSON_STATUSES } from '../utils/constants';
import { optionLabel, translateOptions } from '../utils/optionLabels';
import PeopleTableView from './PeopleTableView';
import { useData } from '../contexts/DataContext';
import { useUI } from '../contexts/UIContext';
import { formatPersonName } from '../utils/personName';

// Threshold above which the card list switches to react-window virtualization
const VIRTUAL_THRESHOLD = 150;
const CARD_ITEM_HEIGHT = 230; // px — card height + gap

const PeopleList = () => {
  const { t } = useTranslation();
  const personCategories = translateOptions(t, 'person_category', PERSON_CATEGORIES);
  const personStatuses = translateOptions(t, 'person_status', PERSON_STATUSES);
  const { people, fetchPeople, peopleMeta, loadMorePeople } = useData();
  const { setShowAddPersonForm, setEditingPerson, setSelectedPersonForDetail } = useUI();
  const [loadingMore, setLoadingMore] = React.useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterLastModified, setFilterLastModified] = useState('');
  const [filterCase, setFilterCase] = useState('');
  const [cases, setCases] = useState([]);
  const [viewMode, setViewMode] = useState('cards'); // 'cards' or 'table'

  useEffect(() => {
    fetchCases();
  }, []);

  const fetchCases = async () => {
    try {
      const casesData = await casesAPI.getAll();
      setCases(casesData);
    } catch (error) {
      console.error('Error fetching cases:', error);
    }
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

  const getFullName = (person) => {
    return formatPersonName(person);
  };

  const getAge = (dateOfBirth) => {
    if (!dateOfBirth) return null;
    const today = new Date();
    const birthDate = new Date(dateOfBirth);
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age;
  };

  const getTimeAgo = (date) => {
    const now = new Date();
    const diff = now - date;
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (days === 0) return t('peopleList.timeAgo.today');
    if (days === 1) return t('peopleList.timeAgo.yesterday');
    if (days < 7) return t('peopleList.timeAgo.daysAgo', { count: days });
    if (days < 30) return t('peopleList.timeAgo.weeksAgo', { count: Math.floor(days / 7) });
    if (days < 365) return t('peopleList.timeAgo.monthsAgo', { count: Math.floor(days / 30) });
    return t('peopleList.timeAgo.yearsAgo', { count: Math.floor(days / 365) });
  };

  const isWithinTimeFilter = (person, filter) => {
    if (!filter) return true;
    
    const lastModified = new Date(person.updated_at || person.created_at);
    const now = new Date();
    const daysDiff = Math.floor((now - lastModified) / (1000 * 60 * 60 * 24));
    
    switch (filter) {
      case 'week': return daysDiff <= 7;
      case '2weeks': return daysDiff <= 14;
      case 'month': return daysDiff <= 30;
      case 'quarter': return daysDiff <= 90;
      case 'halfyear': return daysDiff <= 180;
      case 'year': return daysDiff <= 365;
      case 'prevyear': return daysDiff > 365 && daysDiff <= 730;
      case 'older': return daysDiff > 730;
      default: return true;
    }
  };

  const filteredPeople = people.filter(person => {
    const fullName = getFullName(person);
    const matchesSearch = searchTerm === '' || 
      fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (person.aliases && person.aliases.some(alias => alias.toLowerCase().includes(searchTerm.toLowerCase()))) ||
      (person.case_name && person.case_name.toLowerCase().includes(searchTerm.toLowerCase()));
    
    const matchesCategory = filterCategory === '' || person.category === filterCategory;
    const matchesStatus = filterStatus === '' || person.status === filterStatus;
    const matchesCase = filterCase === '' || person.case_name === filterCase;
    const matchesTimeFilter = isWithinTimeFilter(person, filterLastModified);
    
    return matchesSearch && matchesCategory && matchesStatus && matchesCase && matchesTimeFilter;
  });

  const handleDelete = async (id) => {
    if (window.confirm(t('peopleList.confirmDeletePerson'))) {
      try {
        await peopleAPI.delete(id);
        fetchPeople();
      } catch (error) {
        console.error('Error deleting person:', error);
        alert(t('peopleList.errorDeletePerson'));
      }
    }
  };

  const getStatusColor = (status) => {
    const statusConfig = PERSON_STATUSES.find(s => s.value === status);
    const colorMap = {
      green: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
      yellow: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
      gray: 'bg-gray-100 text-gray-800 dark:bg-slate-700 dark:text-gray-300',
      blue: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400'
    };
    return colorMap[statusConfig?.color] || 'bg-gray-100 text-gray-800 dark:bg-slate-700 dark:text-gray-300';
  };

  // react-window row renderer — used when filteredPeople exceeds VIRTUAL_THRESHOLD
  const renderVirtualCard = useCallback(({ index, style }) => {
    const person = filteredPeople[index];
    const connectionCount = getRelationshipCount(person.id);
    return (
      <div style={{ ...style, paddingBottom: '16px' }}>
        <div className="glass-card p-5 hover:shadow-glass-lg transition-shadow duration-150 group h-full">
          <div className="flex justify-between items-start mb-4">
            <div className="flex items-center space-x-3">
              {person.profile_picture_url ? (
                <img src={person.profile_picture_url} alt={getFullName(person)} className="w-12 h-12 rounded-full object-cover" />
              ) : (
                <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 flex items-center justify-center">
                  <User className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                </div>
              )}
              <div>
                <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                  {getFullName(person)}
                  {person.date_of_birth && <span className="text-slate-500 dark:text-slate-400 font-normal ml-2">({getAge(person.date_of_birth)})</span>}
                </h3>
                {person.aliases?.length > 0 && <p className="text-sm text-slate-500 dark:text-slate-400">{t('peopleList.akaLabel', { aliases: person.aliases.join(', ') })}</p>}
              </div>
            </div>
            <div className="flex space-x-2 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
              <button onClick={() => setSelectedPersonForDetail(person)} className="p-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 text-blue-600 dark:text-blue-400 hover:bg-blue-600 hover:text-white transition-colors duration-150" title={t('peopleList.viewDetails')}><Eye className="w-4 h-4" /></button>
              <button onClick={() => setEditingPerson(person)} className="p-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-600 hover:text-white transition-colors duration-150" title={t('common.edit')}><Edit2 className="w-4 h-4" /></button>
              <button onClick={() => handleDelete(person.id)} className="p-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 text-red-600 dark:text-red-400 hover:bg-red-600 hover:text-white transition-colors duration-150" title={t('common.delete')}><Trash2 className="w-4 h-4" /></button>
            </div>
          </div>
          <div className="space-y-2 mt-3">
            {person.category && <div className="flex items-center text-sm"><Tag className="w-4 h-4 mr-2 text-accent-secondary" /><span className="text-gray-700 dark:text-gray-300 font-medium">{optionLabel(t, 'person_category', person.category)}</span></div>}
            {person.case_name && <div className="flex items-center text-sm"><Briefcase className="w-4 h-4 mr-2 text-accent-tertiary" /><span className="text-gray-700 dark:text-gray-300 font-medium">{person.case_name}</span></div>}
            <div className="flex items-center text-sm"><Network className="w-4 h-4 mr-2 text-blue-600 dark:text-blue-400" /><span className="text-gray-700 dark:text-gray-300 font-medium">{t('peopleList.connectionsCount', { count: connectionCount })}</span></div>
            <div className="flex items-center text-sm"><Clock className="w-4 h-4 mr-2 text-gray-500 dark:text-gray-500" /><span className="text-gray-600 dark:text-gray-400">{t('peopleList.modifiedTimeAgo', { time: getTimeAgo(new Date(person.updated_at || person.created_at)) })}</span></div>
          </div>
          {person.status && <div className="mt-3"><span className={`inline-block px-3 py-1 text-xs font-medium rounded-lg ${getStatusColor(person.status)}`}>{optionLabel(t, 'person_status', person.status)}</span></div>}
        </div>
      </div>
    );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filteredPeople, people]);

  return (
    <div className="p-6">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 mb-6">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100">{t('peopleList.title')}</h1>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-2 flex items-center">
            <Users className="w-5 h-5 mr-2 text-accent-primary" />
            {filteredPeople.length === people.length ? (
              <span className="font-medium">
                {peopleMeta.total > people.length
                  ? t('peopleList.peopleCountTotal', { count: people.length, total: peopleMeta.total })
                  : t('peopleList.peopleCountSimple', { count: people.length })}
              </span>
            ) : (
              <span className="font-medium">{t('peopleList.peopleCountLoaded', { count: filteredPeople.length, total: people.length })}</span>
            )}
          </p>
        </div>
        <div className="flex items-center space-x-3">
          {/* View Mode Toggle */}
          <div className="flex items-center space-x-1 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-[var(--radius-control)] p-1">
            <button
              onClick={() => setViewMode('cards')}
              className={`px-3 py-1.5 rounded-md flex items-center space-x-2 transition-[background-color,color,box-shadow] duration-150 active:scale-[0.97] ${
                viewMode === 'cards' ? 'bg-white dark:bg-slate-600 shadow-sm text-accent-primary dark:text-slate-100' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
              }`}
              title={t('peopleList.cardView')}
            >
              <Grid3x3 className="w-4 h-4" />
              <span className="text-sm font-medium hidden md:inline">{t('peopleList.cards')}</span>
            </button>
            <button
              onClick={() => setViewMode('table')}
              className={`px-3 py-1.5 rounded-md flex items-center space-x-2 transition-[background-color,color,box-shadow] duration-150 active:scale-[0.97] ${
                viewMode === 'table' ? 'bg-white dark:bg-slate-600 shadow-sm text-accent-primary dark:text-slate-100' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
              }`}
              title={t('peopleList.tableView')}
            >
              <Table className="w-4 h-4" />
              <span className="text-sm font-medium hidden md:inline">{t('peopleList.table')}</span>
            </button>
          </div>

          <button
            onClick={() => setShowAddPersonForm(true)}
            className="btn btn-primary"
          >
            <Plus className="w-4 h-4" />
            {t('peopleList.addPerson')}
          </button>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="mb-6 space-y-4">
        <div className="flex flex-wrap gap-4">
          <div className="flex-1 max-w-md">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 dark:text-slate-500 w-4 h-4" />
              <input
                type="text"
                placeholder={t('peopleList.searchPlaceholder')}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="input-base pl-9"
              />
            </div>
          </div>
          <select
            value={filterCase}
            onChange={(e) => setFilterCase(e.target.value)}
            className="input-base w-auto"
          >
            <option value="">{t('peopleList.allCases')}</option>
            {cases.map(caseItem => (
              <option key={caseItem.id} value={caseItem.case_name}>{caseItem.case_name}</option>
            ))}
          </select>
          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            className="input-base w-auto"
          >
            <option value="">{t('peopleList.allCategories')}</option>
            {personCategories.map(cat => (
              <option key={cat.value} value={cat.value}>{cat.label}</option>
            ))}
          </select>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="input-base w-auto"
          >
            <option value="">{t('peopleList.allStatuses')}</option>
            {personStatuses.map(status => (
              <option key={status.value} value={status.value}>{status.label}</option>
            ))}
          </select>
          <select
            value={filterLastModified}
            onChange={(e) => setFilterLastModified(e.target.value)}
            className="input-base w-auto"
          >
            <option value="">{t('peopleList.allTime')}</option>
            <option value="week">{t('peopleList.lastWeek')}</option>
            <option value="2weeks">{t('peopleList.last2Weeks')}</option>
            <option value="month">{t('peopleList.lastMonth')}</option>
            <option value="quarter">{t('peopleList.lastQuarter')}</option>
            <option value="halfyear">{t('peopleList.last6Months')}</option>
            <option value="year">{t('peopleList.lastYear')}</option>
            <option value="prevyear">{t('peopleList.previousYear')}</option>
            <option value="older">{t('peopleList.older')}</option>
          </select>
        </div>
      </div>

      {/* View Content */}
      {viewMode === 'table' ? (
        <PeopleTableView
          people={filteredPeople}
          fetchPeople={fetchPeople}
          setEditingPerson={setEditingPerson}
          setSelectedPersonForDetail={setSelectedPersonForDetail}
        />
      ) : filteredPeople.length >= VIRTUAL_THRESHOLD ? (
        /* Virtualized list — used when large number of people */
        <div>
          {filteredPeople.length === 0 ? null : (
            <FixedSizeList
              height={Math.min(filteredPeople.length * CARD_ITEM_HEIGHT, 700)}
              itemCount={filteredPeople.length}
              itemSize={CARD_ITEM_HEIGHT}
              width="100%"
              overscanCount={3}
            >
              {renderVirtualCard}
            </FixedSizeList>
          )}
        </div>
      ) : (
        /* CSS grid — used for smaller datasets */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredPeople.map(person => (
          <div key={person.id} className="glass-card p-5 hover:shadow-glass-lg transition-shadow duration-150 group">
            <div className="flex justify-between items-start mb-4">
              <div className="flex items-center space-x-3">
                {person.profile_picture_url ? (
                  <img
                    src={person.profile_picture_url}
                    alt={getFullName(person)}
                    className="w-12 h-12 rounded-full object-cover"
                  />
                ) : (
                  <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 flex items-center justify-center">
                    <User className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                  </div>
                )}
                <div>
                  <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                    {getFullName(person)}
                    {person.date_of_birth && (
                      <span className="text-slate-500 dark:text-slate-400 font-normal ml-2">
                        ({getAge(person.date_of_birth)})
                      </span>
                    )}
                  </h3>
                  {person.aliases && person.aliases.length > 0 && (
                    <p className="text-sm text-slate-500 dark:text-slate-400">{t('peopleList.akaLabel', { aliases: person.aliases.join(', ') })}</p>
                  )}
                </div>
              </div>
              <div className="flex space-x-2 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
                <button
                  onClick={() => setSelectedPersonForDetail(person)}
                  className="p-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 text-blue-600 dark:text-blue-400 hover:bg-blue-600 hover:text-white transition-colors duration-150 active:scale-[0.97]"
                  title={t('peopleList.viewDetails')}
                >
                  <Eye className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setEditingPerson(person)}
                  className="p-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-600 hover:text-white transition-colors duration-150 active:scale-[0.97]"
                  title={t('common.edit')}
                >
                  <Edit2 className="w-4 h-4" />
                </button>
                <button
                  onClick={() => handleDelete(person.id)}
                  className="p-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 text-red-600 dark:text-red-400 hover:bg-red-600 hover:text-white transition-colors duration-150 active:scale-[0.97]"
                  title={t('common.delete')}
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="space-y-3 mt-4">
              {person.category && (
                <div className="flex items-center text-sm">
                  <Tag className="w-4 h-4 mr-2 text-accent-secondary" />
                  <span className="text-gray-700 dark:text-gray-300 font-medium">{optionLabel(t, 'person_category', person.category)}</span>
                </div>
              )}
              {person.case_name && (
                <div className="flex items-center text-sm">
                  <Briefcase className="w-4 h-4 mr-2 text-accent-tertiary" />
                  <span className="text-gray-700 dark:text-gray-300 font-medium">{person.case_name}</span>
                </div>
              )}
              <div className="flex items-center text-sm">
                <Network className="w-4 h-4 mr-2 text-blue-600 dark:text-blue-400" />
                <span className="text-gray-700 dark:text-gray-300 font-medium">{t('peopleList.connectionsCount', { count: getRelationshipCount(person.id) })}</span>
              </div>
              <div className="flex items-center text-sm">
                <Clock className="w-4 h-4 mr-2 text-gray-500 dark:text-gray-500" />
                <span className="text-gray-600 dark:text-gray-400">
                  {t('peopleList.modifiedTimeAgo', { time: getTimeAgo(new Date(person.updated_at || person.created_at)) })}
                </span>
              </div>
            </div>
            
            {person.status && (
              <div className="mt-4">
                <span className={`inline-block px-3 py-1 text-xs font-medium rounded-lg ${getStatusColor(person.status)}`}>
                  {optionLabel(t, 'person_status', person.status)}
                </span>
              </div>
            )}
          </div>
        ))}

          {filteredPeople.length === 0 && (
            <div className="col-span-full text-center py-12">
              <div className="glass-card p-8 max-w-md mx-auto">
                <Users className="w-12 h-12 text-gray-400 dark:text-slate-500 mx-auto mb-4" />
                <p className="text-gray-600 dark:text-slate-400 font-medium">{t('peopleList.noResultsFound')}</p>
                <p className="text-gray-500 dark:text-slate-500 text-sm mt-2">{t('peopleList.adjustFilters')}</p>
              </div>
            </div>
          )}

          {/* Load More — only shown when no active filter (so count matches server total) */}
          {peopleMeta.hasMore && filteredPeople.length === people.length && (
            <div className="col-span-full flex flex-col items-center py-6 space-y-2">
              <p className="text-sm text-slate-500 dark:text-slate-400">
                {t('peopleList.showingOfTotal', { count: people.length, total: peopleMeta.total })}
              </p>
              <button
                onClick={async () => {
                  setLoadingMore(true);
                  await loadMorePeople();
                  setLoadingMore(false);
                }}
                disabled={loadingMore}
                className="btn btn-primary"
              >
                {loadingMore ? t('common.loadingEllipsis') : t('common.loadMoreRemaining', { count: peopleMeta.total - people.length })}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default PeopleList;