// File: frontend/src/components/EntityLedger.js
import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowDownLeft, ArrowUpRight, Minus, Package } from 'lucide-react';
import { ledgerAPI } from '../utils/api';
import { formatDate, formatMoney, partyText, subjectText, prettyType, typeBadgeClass, directionClass } from '../utils/transactionFormat';

// entityType: 'people' | 'businesses' | 'properties'
const EntityLedger = ({ entityType, entityId }) => {
  const { t } = useTranslation();
  const [ledger, setLedger] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await ledgerAPI.get(entityType, entityId, { date_from: dateFrom, date_to: dateTo });
      setLedger(data);
    } catch (err) {
      setError(err.message || t('entityLedger.errorLoadingLedger'));
    } finally {
      setLoading(false);
    }
  }, [entityType, entityId, dateFrom, dateTo, t]);

  useEffect(() => { load(); }, [load]);

  if (loading) return <div className="py-8 text-center text-gray-500 dark:text-gray-400">{t('entityLedger.loadingLedger')}</div>;
  if (error) return <div className="py-8 text-center text-red-600 dark:text-red-400">{error}</div>;
  if (!ledger) return null;

  const { summary, entries } = ledger;

  return (
    <div className="space-y-5">
      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-end">
        <div>
          <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">{t('entityLedger.fromLabel')}</label>
          <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">{t('entityLedger.toLabel')}</label>
          <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white" />
        </div>
        {(dateFrom || dateTo) && (
          <button onClick={() => { setDateFrom(''); setDateTo(''); }} className="px-3 py-1.5 text-sm rounded-lg bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200">{t('common.clear')}</button>
        )}
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="p-3 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800">
          <div className="text-xs text-green-700 dark:text-green-400 flex items-center"><ArrowDownLeft className="w-3 h-3 mr-1" />{t('entityLedger.valueInLabel')}</div>
          <div className="text-lg font-bold text-green-700 dark:text-green-300">{summary.value_in != null ? formatMoney(summary.value_in) : '—'}</div>
        </div>
        <div className="p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
          <div className="text-xs text-red-700 dark:text-red-400 flex items-center"><ArrowUpRight className="w-3 h-3 mr-1" />{t('entityLedger.valueOutLabel')}</div>
          <div className="text-lg font-bold text-red-700 dark:text-red-300">{summary.value_out != null ? formatMoney(summary.value_out) : '—'}</div>
        </div>
        <div className="p-3 rounded-lg bg-gray-50 dark:bg-gray-700/40 border border-gray-200 dark:border-gray-700">
          <div className="text-xs text-gray-500 dark:text-gray-400">{t('ledgerReportPanel.netLabel')}</div>
          <div className="text-lg font-bold text-gray-900 dark:text-white">{summary.net != null ? formatMoney(summary.net) : t('ledgerReportPanel.mixed')}</div>
        </div>
        <div className="p-3 rounded-lg bg-gray-50 dark:bg-gray-700/40 border border-gray-200 dark:border-gray-700">
          <div className="text-xs text-gray-500 dark:text-gray-400">{t('entityLedger.counterpartiesLabel')}</div>
          <div className="text-lg font-bold text-gray-900 dark:text-white">{summary.distinct_counterparties}</div>
        </div>
      </div>

      {summary.by_currency && summary.by_currency.length > 1 && (
        <div className="text-xs text-gray-600 dark:text-gray-400">
          {t('entityLedger.perCurrencyLabel')} {summary.by_currency.map(c => t('entityLedger.perCurrencyEntry', { currency: c.currency || t('entityLedger.unspecifiedCurrency'), in: formatMoney(c.value_in), out: formatMoney(c.value_out) })).join(' · ')}
        </div>
      )}

      {summary.assets_currently_held && summary.assets_currently_held.length > 0 && (
        <div className="p-3 rounded-lg bg-gray-50 dark:bg-gray-700/40 border border-gray-200 dark:border-gray-700">
          <div className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2 flex items-center"><Package className="w-3 h-3 mr-1" />{t('entityLedger.currentlyHeldAssets')}</div>
          <div className="flex flex-wrap gap-2">
            {summary.assets_currently_held.map(a => (
              <span key={a.id} className="text-xs px-2 py-1 rounded bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 text-gray-800 dark:text-gray-200">
                {a.name}{a.since ? ` · ${t('entityLedger.sinceDate', { date: formatDate(a.since) })}` : ''}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Ledger table */}
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="text-left text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
              <th className="py-2 pr-3 font-medium">{t('transactionTable.columnDate')}</th>
              <th className="py-2 pr-3 font-medium">{t('transactionTable.columnType')}</th>
              <th className="py-2 pr-3 font-medium">{t('transactionTable.columnRole')}</th>
              <th className="py-2 pr-3 font-medium">{t('ledgerReportPanel.columnCounterparty')}</th>
              <th className="py-2 pr-3 font-medium">{t('transactionTable.columnSubject')}</th>
              <th className="py-2 pr-3 font-medium text-right">{t('transactionTable.columnValue')}</th>
            </tr>
          </thead>
          <tbody>
            {entries.length === 0 ? (
              <tr><td colSpan={6} className="py-6 text-center text-gray-500 dark:text-gray-400">{t('entityLedger.noEntries')}</td></tr>
            ) : entries.map((e, i) => (
              <tr key={`${e.transaction_id}-${e.role}-${i}`} className="border-b border-gray-100 dark:border-gray-700/50">
                <td className="py-2 pr-3 text-gray-700 dark:text-gray-300 whitespace-nowrap">{formatDate(e.occurred_on)}</td>
                <td className="py-2 pr-3"><span className={`text-xs px-2 py-0.5 rounded capitalize ${typeBadgeClass(e.transaction_type)}`}>{prettyType(e.transaction_type)}</span></td>
                <td className="py-2 pr-3 text-gray-600 dark:text-gray-400 capitalize">{prettyType(e.role)}</td>
                <td className="py-2 pr-3 text-gray-800 dark:text-gray-200">{partyText(e.counterparty)}</td>
                <td className="py-2 pr-3 text-gray-700 dark:text-gray-300">{subjectText(e.subject)}</td>
                <td className={`py-2 pr-3 text-right whitespace-nowrap font-medium ${directionClass(e.value_direction)}`}>
                  {e.value != null ? (
                    <span className="inline-flex items-center justify-end">
                      {e.value_direction === 'in' && <ArrowDownLeft className="w-3 h-3 mr-1" />}
                      {e.value_direction === 'out' && <ArrowUpRight className="w-3 h-3 mr-1" />}
                      {e.value_direction === 'neutral' && <Minus className="w-3 h-3 mr-1" />}
                      {formatMoney(e.value, e.currency)}
                    </span>
                  ) : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default EntityLedger;
