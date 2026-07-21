// File: frontend/src/components/BusinessDetailModal.js
import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Building2, X, Edit2, Users, Calendar, FileText, MapPin } from 'lucide-react';
import { transactionsAPI, ledgerAPI } from '../utils/api';
import { useUI } from '../contexts/UIContext';
import TransactionTable from './TransactionTable';
import EntityLedger from './EntityLedger';
import ReportGenerator from './ReportGenerator';
import { formatDate } from '../utils/transactionFormat';

const BusinessDetailModal = ({ business, onClose }) => {
  const { t } = useTranslation();
  const { setEditingBusiness, setSelectedPersonForDetail } = useUI();
  const [tab, setTab] = useState('venue');
  const [txns, setTxns] = useState([]);
  const [venue, setVenue] = useState(null);
  const [showReport, setShowReport] = useState(false);

  useEffect(() => {
    transactionsAPI.getByBusiness(business.id).then(r => setTxns(r.data || [])).catch(err => console.error(err));
    ledgerAPI.venueStats(business.id).then(setVenue).catch(err => console.error(err));
  }, [business.id]);

  const tabs = ['venue', 'transactions', 'ledger'];

  return (
    <>
      <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl border border-gray-200 dark:border-gray-700 w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
          <div className="p-5 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
            <div className="flex items-center space-x-3">
              <div className="w-12 h-12 rounded-lg bg-gray-100 dark:bg-gray-700 flex items-center justify-center"><Building2 className="w-6 h-6 text-indigo-600 dark:text-indigo-400" /></div>
              <div>
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">{business.name}</h2>
                {business.industry && <p className="text-sm text-gray-500 dark:text-gray-400">{business.industry}</p>}
              </div>
            </div>
            <div className="flex space-x-2">
              <button onClick={() => setShowReport(true)} className="p-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-green-600 dark:text-green-400 hover:bg-green-600 hover:text-white" title={t('businessDetailModal.ledgerReportTitle')}><FileText className="w-5 h-5" /></button>
              <button onClick={() => { onClose(); setEditingBusiness(business); }} className="p-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-blue-600 dark:text-blue-400 hover:bg-blue-600 hover:text-white"><Edit2 className="w-5 h-5" /></button>
              <button onClick={onClose} className="p-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-red-600 hover:text-white"><X className="w-5 h-5" /></button>
            </div>
          </div>

          <div className="border-b border-gray-200 dark:border-gray-700 flex">
            {tabs.map(tabId => (
              <button key={tabId} onClick={() => setTab(tabId)} className={`px-5 py-3 text-sm font-medium capitalize border-b-2 ${tab === tabId ? 'border-blue-500 text-blue-600 dark:text-blue-400' : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}>{tabId === 'venue' ? t('businessDetailModal.venueActivityTab') : t(`businessDetailModal.tab_${tabId}`)}</button>
            ))}
          </div>

          <div className="overflow-y-auto p-5" style={{ maxHeight: 'calc(90vh - 170px)' }}>
            {tab === 'venue' && (
              venue ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div className="p-3 rounded-lg bg-cyan-50 dark:bg-cyan-900/20 border border-cyan-200 dark:border-cyan-800">
                      <div className="text-xs text-cyan-700 dark:text-cyan-400 flex items-center"><Users className="w-3 h-3 mr-1" />{t('businessDetailModal.distinctPeople')}</div>
                      <div className="text-2xl font-bold text-cyan-700 dark:text-cyan-300">{venue.distinct_people}</div>
                    </div>
                    <div className="p-3 rounded-lg bg-gray-50 dark:bg-gray-700/40 border border-gray-200 dark:border-gray-700">
                      <div className="text-xs text-gray-500 dark:text-gray-400">{t('businessDetailModal.events')}</div>
                      <div className="text-2xl font-bold text-gray-900 dark:text-white">{venue.event_count}</div>
                    </div>
                    <div className="p-3 rounded-lg bg-gray-50 dark:bg-gray-700/40 border border-gray-200 dark:border-gray-700">
                      <div className="text-xs text-gray-500 dark:text-gray-400 flex items-center"><Calendar className="w-3 h-3 mr-1" />{t('businessDetailModal.first')}</div>
                      <div className="text-sm font-bold text-gray-900 dark:text-white">{formatDate(venue.first_event)}</div>
                    </div>
                    <div className="p-3 rounded-lg bg-gray-50 dark:bg-gray-700/40 border border-gray-200 dark:border-gray-700">
                      <div className="text-xs text-gray-500 dark:text-gray-400 flex items-center"><Calendar className="w-3 h-3 mr-1" />{t('businessDetailModal.last')}</div>
                      <div className="text-sm font-bold text-gray-900 dark:text-white">{formatDate(venue.last_event)}</div>
                    </div>
                  </div>
                  <div>
                    <h4 className="font-semibold text-gray-900 dark:text-white mb-2 flex items-center"><MapPin className="w-4 h-4 mr-1 text-gray-400" />{t('businessDetailModal.associatedPeopleRanked')}</h4>
                    {venue.people && venue.people.length ? (
                      <div className="space-y-2">
                        {venue.people.map(p => (
                          <button key={p.id} onClick={() => { onClose(); setSelectedPersonForDetail({ id: p.id }); }}
                            className="w-full flex justify-between items-center p-3 rounded-lg bg-gray-50 dark:bg-gray-700/40 border border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700 text-left">
                            <span className="text-gray-800 dark:text-gray-200">{p.label}</span>
                            <span className="text-xs text-gray-500 dark:text-gray-400">{t('businessDetailModal.eventCount', { count: p.event_count })}</span>
                          </button>
                        ))}
                      </div>
                    ) : <p className="text-sm text-gray-500 dark:text-gray-400">{t('businessDetailModal.noVenueActivity')}</p>}
                  </div>
                </div>
              ) : <p className="text-sm text-gray-500 dark:text-gray-400 py-6 text-center">{t('businessDetailModal.loadingVenueActivity')}</p>
            )}
            {tab === 'transactions' && <TransactionTable transactions={txns} showRole emptyText={t('businessDetailModal.noTransactions')} />}
            {tab === 'ledger' && <EntityLedger entityType="businesses" entityId={business.id} />}
          </div>
        </div>
      </div>
      {showReport && <ReportGenerator ledgerEntity={{ type: 'businesses', id: business.id, label: business.name }} onClose={() => setShowReport(false)} />}
    </>
  );
};

export default BusinessDetailModal;
