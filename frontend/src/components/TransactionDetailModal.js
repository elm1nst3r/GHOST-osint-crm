// File: frontend/src/components/TransactionDetailModal.js
import React, { useState, useEffect } from 'react';
import { Receipt, X, Edit2, ArrowRight, MapPin, Calendar, FileText } from 'lucide-react';
import { transactionsAPI } from '../utils/api';
import { useUI } from '../contexts/UIContext';
import { formatDate, formatMoney, partyText, subjectText, prettyType, typeBadgeClass } from '../utils/transactionFormat';

const Field = ({ label, children }) => (
  <div className="flex justify-between gap-4 py-1.5 border-b border-gray-100 dark:border-gray-700/50 last:border-0">
    <span className="text-sm text-gray-500 dark:text-gray-400">{label}</span>
    <span className="text-sm text-gray-900 dark:text-gray-100 text-right">{children}</span>
  </div>
);

const TransactionDetailModal = ({ transaction: initial, onClose }) => {
  const { setEditingTransaction } = useUI();
  const [t, setT] = useState(initial);

  useEffect(() => {
    transactionsAPI.getById(initial.id).then(setT).catch(err => console.error('Error loading transaction:', err));
  }, [initial.id]);

  const loc = t.resolved_location;

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl border border-gray-200 dark:border-gray-700 w-full max-w-xl max-h-[90vh] overflow-hidden flex flex-col">
        <div className="p-5 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
          <div className="flex items-center space-x-3">
            <div className="w-12 h-12 rounded-lg bg-gray-100 dark:bg-gray-700 flex items-center justify-center"><Receipt className="w-6 h-6 text-blue-600 dark:text-blue-400" /></div>
            <div>
              <span className={`text-xs px-2 py-0.5 rounded capitalize ${typeBadgeClass(t.transaction_type)}`}>{prettyType(t.transaction_type)}</span>
              <h2 className="text-lg font-bold text-gray-900 dark:text-white mt-1">{subjectText(t.resolved_subject)}</h2>
            </div>
          </div>
          <div className="flex space-x-2">
            <button onClick={() => { onClose(); setEditingTransaction(t); }} className="p-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-blue-600 dark:text-blue-400 hover:bg-blue-600 hover:text-white"><Edit2 className="w-5 h-5" /></button>
            <button onClick={onClose} className="p-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-red-600 hover:text-white"><X className="w-5 h-5" /></button>
          </div>
        </div>
        <div className="overflow-y-auto p-5 space-y-4">
          <div className="flex items-center justify-center text-base text-gray-900 dark:text-gray-100 py-2">
            <span>{partyText(t.resolved_from)}</span>
            <ArrowRight className="w-4 h-4 mx-3 text-gray-400" />
            <span className="font-semibold">{partyText(t.resolved_to)}</span>
          </div>
          <div>
            <Field label="Date"><span className="inline-flex items-center"><Calendar className="w-3.5 h-3.5 mr-1 text-gray-400" />{formatDate(t.occurred_on)}</span></Field>
            <Field label="Value">{formatMoney(t.value, t.currency)}</Field>
            <Field label="Subject">{subjectText(t.resolved_subject)}{t.resolved_subject?.type && t.resolved_subject.type !== 'item' ? ` (${t.resolved_subject.type})` : ''}</Field>
            {t.item_category && <Field label="Item category">{prettyType(t.item_category)}</Field>}
            <Field label="Location">
              {loc && loc.type !== 'none' ? (
                <span className="inline-flex items-center"><MapPin className="w-3.5 h-3.5 mr-1 text-gray-400" />{loc.label || prettyType(loc.type)}</span>
              ) : '—'}
            </Field>
          </div>
          {t.notes && (
            <div className="p-3 rounded-lg bg-gray-50 dark:bg-gray-900/40 border border-gray-200 dark:border-gray-700">
              <div className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1 flex items-center"><FileText className="w-3 h-3 mr-1" />Notes</div>
              <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{t.notes}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default TransactionDetailModal;
