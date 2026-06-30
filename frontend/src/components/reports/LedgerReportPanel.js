// File: frontend/src/components/reports/LedgerReportPanel.js
import React from 'react';
import { formatDate, formatMoney, prettyType } from '../../utils/transactionFormat';

// Printable preview of an entity ledger report (issue #43).
const LedgerReportPanel = ({ ledger }) => {
  if (!ledger) return null;
  const { entity, entries, summary } = ledger;
  return (
    <div className="text-sm text-gray-800 dark:text-gray-200">
      <h3 className="text-lg font-bold mb-1">Entity Ledger</h3>
      <p className="text-gray-600 dark:text-gray-400 mb-3">{entity.label} ({entity.type})</p>

      <div className="grid grid-cols-3 gap-2 mb-4">
        <div className="p-2 rounded bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800">
          <div className="text-xs text-green-700 dark:text-green-400">In</div>
          <div className="font-bold text-green-700 dark:text-green-300">{summary.value_in != null ? formatMoney(summary.value_in) : 'mixed'}</div>
        </div>
        <div className="p-2 rounded bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
          <div className="text-xs text-red-700 dark:text-red-400">Out</div>
          <div className="font-bold text-red-700 dark:text-red-300">{summary.value_out != null ? formatMoney(summary.value_out) : 'mixed'}</div>
        </div>
        <div className="p-2 rounded bg-gray-50 dark:bg-gray-700/40 border border-gray-200 dark:border-gray-700">
          <div className="text-xs text-gray-500 dark:text-gray-400">Net</div>
          <div className="font-bold">{summary.net != null ? formatMoney(summary.net) : 'see per-currency'}</div>
        </div>
      </div>

      <div className="max-h-64 overflow-y-auto border border-gray-200 dark:border-gray-700 rounded">
        <table className="min-w-full text-xs">
          <thead className="bg-gray-50 dark:bg-gray-700/40">
            <tr className="text-left">
              <th className="p-2">Date</th><th className="p-2">Type</th><th className="p-2">Role</th><th className="p-2">Counterparty</th><th className="p-2 text-right">Value</th>
            </tr>
          </thead>
          <tbody>
            {entries.length === 0 ? (
              <tr><td colSpan={5} className="p-3 text-center text-gray-500 dark:text-gray-400">No entries.</td></tr>
            ) : entries.map((e, i) => (
              <tr key={`${e.transaction_id}-${e.role}-${i}`} className="border-t border-gray-100 dark:border-gray-700/50">
                <td className="p-2 whitespace-nowrap">{formatDate(e.occurred_on)}</td>
                <td className="p-2 capitalize">{prettyType(e.transaction_type)}</td>
                <td className="p-2 capitalize">{prettyType(e.role)}</td>
                <td className="p-2">{e.counterparty?.label || '—'}</td>
                <td className="p-2 text-right">{e.value != null ? formatMoney(e.value, e.currency) : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default LedgerReportPanel;
