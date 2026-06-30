// File: frontend/src/components/PropertyDetailModal.js
import React, { useState, useEffect } from 'react';
import { Landmark, X, Edit2, MapPin, User, FileText } from 'lucide-react';
import { propertiesAPI } from '../utils/api';
import { useUI } from '../contexts/UIContext';
import ChainOfCustodyTimeline from './ChainOfCustodyTimeline';
import TransactionTable from './TransactionTable';
import EntityLedger from './EntityLedger';
import ReportGenerator from './ReportGenerator';

const PropertyDetailModal = ({ property: initial, onClose }) => {
  const { setEditingProperty } = useUI();
  const [property, setProperty] = useState(initial);
  const [tab, setTab] = useState('details');
  const [showReport, setShowReport] = useState(false);

  useEffect(() => {
    propertiesAPI.getById(initial.id).then(setProperty).catch(err => console.error('Error loading property:', err));
  }, [initial.id]);

  const tabs = ['details', 'custody', 'activity', 'ledger'];

  return (
    <>
      <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl border border-gray-200 dark:border-gray-700 w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
          <div className="p-5 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
            <div className="flex items-center space-x-3">
              <div className="w-12 h-12 rounded-lg bg-gray-100 dark:bg-gray-700 flex items-center justify-center">
                <Landmark className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">{property.name}</h2>
                {property.property_type && <p className="text-sm text-gray-500 dark:text-gray-400 capitalize">{property.property_type.replace(/_/g, ' ')}</p>}
              </div>
            </div>
            <div className="flex space-x-2">
              <button onClick={() => setShowReport(true)} className="p-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-green-600 dark:text-green-400 hover:bg-green-600 hover:text-white" title="Ledger report"><FileText className="w-5 h-5" /></button>
              <button onClick={() => { onClose(); setEditingProperty(property); }} className="p-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-blue-600 dark:text-blue-400 hover:bg-blue-600 hover:text-white"><Edit2 className="w-5 h-5" /></button>
              <button onClick={onClose} className="p-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-red-600 hover:text-white"><X className="w-5 h-5" /></button>
            </div>
          </div>

          <div className="border-b border-gray-200 dark:border-gray-700 flex">
            {tabs.map(t => (
              <button key={t} onClick={() => setTab(t)} className={`px-5 py-3 text-sm font-medium capitalize border-b-2 ${tab === t ? 'border-blue-500 text-blue-600 dark:text-blue-400' : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}>{t}</button>
            ))}
          </div>

          <div className="overflow-y-auto p-5" style={{ maxHeight: 'calc(90vh - 170px)' }}>
            {tab === 'details' && (
              <div className="space-y-4 text-sm">
                {(property.address || property.city) && (
                  <div className="flex items-start text-gray-700 dark:text-gray-300"><MapPin className="w-4 h-4 mr-2 mt-0.5 text-gray-400" /><span>{[property.address, property.city, property.state, property.country, property.postal_code].filter(Boolean).join(', ')}</span></div>
                )}
                {property.owner_name && property.owner_name.trim() && (
                  <div className="flex items-center text-gray-700 dark:text-gray-300"><User className="w-4 h-4 mr-2 text-gray-400" />Quick owner: {property.owner_name}</div>
                )}
                {property.derived_current_owner && (
                  <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 text-blue-800 dark:text-blue-300">
                    Derived current owner: <strong>{property.derived_current_owner.label}</strong>{property.derived_owner_since ? ` (since ${new Date(property.derived_owner_since).toLocaleDateString()})` : ''}
                  </div>
                )}
                {property.description && <div><h4 className="font-semibold text-gray-900 dark:text-white mb-1">Description</h4><p className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{property.description}</p></div>}
                {property.notes && <div><h4 className="font-semibold text-gray-900 dark:text-white mb-1">Notes</h4><p className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{property.notes}</p></div>}
              </div>
            )}
            {tab === 'custody' && <ChainOfCustodyTimeline chain={property.chain_of_custody || []} emptyText="No ownership history yet." />}
            {tab === 'activity' && <TransactionTable transactions={property.venue_transactions || []} emptyText="No events recorded at this property." />}
            {tab === 'ledger' && <EntityLedger entityType="properties" entityId={property.id} />}
          </div>
        </div>
      </div>
      {showReport && <ReportGenerator ledgerEntity={{ type: 'properties', id: property.id, label: property.name }} onClose={() => setShowReport(false)} />}
    </>
  );
};

export default PropertyDetailModal;
