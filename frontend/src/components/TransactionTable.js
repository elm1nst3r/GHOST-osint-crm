// File: frontend/src/components/TransactionTable.js
import React from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowRight } from 'lucide-react';
import { formatDate, formatMoney, partyText, subjectText, prettyType, typeBadgeClass } from '../utils/transactionFormat';
import { useUI } from '../contexts/UIContext';

// Compact table for an array of decorated transactions (resolved_* fields present).
const TransactionTable = ({ transactions = [], emptyText, showRole = false }) => {
  const { t } = useTranslation();
  const { setSelectedTransactionForDetail } = useUI();
  if (!transactions.length) {
    return <p className="text-sm text-gray-500 dark:text-gray-400 py-4 text-center">{emptyText ?? t('transactionTable.noTransactions')}</p>;
  }
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-sm">
        <thead>
          <tr className="text-left text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
            <th className="py-2 pr-3 font-medium">{t('transactionTable.columnDate')}</th>
            <th className="py-2 pr-3 font-medium">{t('transactionTable.columnType')}</th>
            {showRole && <th className="py-2 pr-3 font-medium">{t('transactionTable.columnRole')}</th>}
            <th className="py-2 pr-3 font-medium">{t('transactionTable.columnFromTo')}</th>
            <th className="py-2 pr-3 font-medium">{t('transactionTable.columnSubject')}</th>
            <th className="py-2 pr-3 font-medium text-right">{t('transactionTable.columnValue')}</th>
          </tr>
        </thead>
        <tbody>
          {transactions.map(t => (
            <tr key={t.id} onClick={() => setSelectedTransactionForDetail(t)}
              className="border-b border-gray-100 dark:border-gray-700/50 hover:bg-gray-50 dark:hover:bg-gray-700/40 cursor-pointer">
              <td className="py-2 pr-3 text-gray-700 dark:text-gray-300 whitespace-nowrap">{formatDate(t.occurred_on)}</td>
              <td className="py-2 pr-3"><span className={`text-xs px-2 py-0.5 rounded capitalize ${typeBadgeClass(t.transaction_type)}`}>{prettyType(t.transaction_type)}</span></td>
              {showRole && <td className="py-2 pr-3 text-gray-600 dark:text-gray-400 capitalize">{prettyType(t.role)}</td>}
              <td className="py-2 pr-3 text-gray-800 dark:text-gray-200">
                <span className="inline-flex items-center">{partyText(t.resolved_from)}<ArrowRight className="w-3 h-3 mx-1 text-gray-400" />{partyText(t.resolved_to)}</span>
              </td>
              <td className="py-2 pr-3 text-gray-700 dark:text-gray-300">{subjectText(t.resolved_subject)}</td>
              <td className="py-2 pr-3 text-right text-gray-800 dark:text-gray-200 whitespace-nowrap">{formatMoney(t.value, t.currency)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default TransactionTable;
