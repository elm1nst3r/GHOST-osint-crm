// File: frontend/src/components/TransactionsList.js
import React, { useState, useEffect, useCallback, memo } from 'react';
import { useTranslation } from 'react-i18next';
import { FixedSizeList } from 'react-window';
import { Receipt, Search, Plus, Edit2, Trash2, Eye, ArrowRight } from 'lucide-react';
import { transactionsAPI, modelOptionsAPI } from '../utils/api';
import { useData } from '../contexts/DataContext';
import { useUI } from '../contexts/UIContext';
import { formatDate, formatMoney, partyText, subjectText, prettyType, typeBadgeClass } from '../utils/transactionFormat';
import { optionLabel } from '../utils/optionLabels';

const VIRTUAL_THRESHOLD = 150;
const ROW_HEIGHT = 64;

const TransactionsList = () => {
  // Aliased to `translate`, not `t` — this file already uses `t` as the transaction variable name throughout
  const { t: translate } = useTranslation();
  const { transactions, fetchTransactions, transactionsMeta, loadMoreTransactions } = useData();
  const { setShowAddTransactionForm, setEditingTransaction, setSelectedTransactionForDetail } = useUI();
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('');
  const [typeOptions, setTypeOptions] = useState([]);
  const [loadingMore, setLoadingMore] = useState(false);

  useEffect(() => {
    modelOptionsAPI.getAll().then(d => setTypeOptions(d.filter(o => o.model_type === 'transaction_type' && o.is_active))).catch(() => {});
  }, []);

  const handleDelete = async (id, e) => {
    e.stopPropagation();
    if (!window.confirm(translate('transactionsList.confirmDeleteTransaction'))) return;
    try { await transactionsAPI.remove(id); fetchTransactions(0); }
    catch (err) { alert(translate('transactionsList.errorDeleteTransaction', { message: err.message })); }
  };

  const filtered = transactions.filter(t => {
    const matchesType = filterType === '' || t.transaction_type === filterType;
    const hay = [t.item_label, partyText(t.resolved_from), partyText(t.resolved_to), subjectText(t.resolved_subject)].join(' ').toLowerCase();
    const matchesSearch = searchTerm === '' || hay.includes(searchTerm.toLowerCase());
    return matchesType && matchesSearch;
  });

  const Row = ({ t }) => (
    <div onClick={() => setSelectedTransactionForDetail(t)}
      className="flex items-center gap-3 px-4 py-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg hover:shadow-md transition cursor-pointer group">
      <span className="text-xs text-gray-500 dark:text-gray-400 w-24 flex-shrink-0">{formatDate(t.occurred_on)}</span>
      <span className={`text-xs px-2 py-0.5 rounded capitalize flex-shrink-0 ${typeBadgeClass(t.transaction_type)}`}>{prettyType(t.transaction_type)}</span>
      <span className="flex items-center text-sm text-gray-800 dark:text-gray-200 min-w-0 flex-1">
        <span className="truncate">{partyText(t.resolved_from)}</span>
        <ArrowRight className="w-3 h-3 mx-1 text-gray-400 flex-shrink-0" />
        <span className="truncate font-medium">{partyText(t.resolved_to)}</span>
      </span>
      <span className="text-sm text-gray-600 dark:text-gray-400 truncate hidden md:block w-40">{subjectText(t.resolved_subject)}</span>
      <span className="text-sm text-gray-800 dark:text-gray-200 w-28 text-right flex-shrink-0">{formatMoney(t.value, t.currency)}</span>
      <span className="flex space-x-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
        <button onClick={(e) => { e.stopPropagation(); setSelectedTransactionForDetail(t); }} className="p-1.5 rounded border border-gray-200 dark:border-gray-600 text-blue-600 dark:text-blue-400 hover:bg-blue-600 hover:text-white"><Eye className="w-4 h-4" /></button>
        <button onClick={(e) => { e.stopPropagation(); setEditingTransaction(t); }} className="p-1.5 rounded border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-600 hover:text-white"><Edit2 className="w-4 h-4" /></button>
        <button onClick={(e) => handleDelete(t.id, e)} className="p-1.5 rounded border border-gray-200 dark:border-gray-600 text-red-600 dark:text-red-400 hover:bg-red-600 hover:text-white"><Trash2 className="w-4 h-4" /></button>
      </span>
    </div>
  );

  const renderVirtual = useCallback(({ index, style }) => (
    <div style={{ ...style, paddingBottom: 8 }}><Row t={filtered[index]} /></div>
  // eslint-disable-next-line react-hooks/exhaustive-deps
  ), [filtered]);

  return (
    <div className="p-6">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">{translate('transactionsList.title')}</h1>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-2 flex items-center">
            <Receipt className="w-5 h-5 mr-2 text-blue-600 dark:text-blue-400" />
            <span className="font-medium">
              {transactionsMeta.total > transactions.length
                ? translate('transactionsList.countTotal', { count: transactions.length, total: transactionsMeta.total })
                : translate('transactionsList.countSimple', { count: transactions.length })}
            </span>
          </p>
        </div>
        <button onClick={() => setShowAddTransactionForm(true)} className="px-6 py-3 bg-accent-primary text-white rounded-lg hover:bg-accent-primary-hover transition flex items-center active:scale-[0.97]">
          <Plus className="w-5 h-5 mr-2" />{translate('transactionsList.addTransaction')}
        </button>
      </div>

      <div className="mb-6 flex flex-wrap gap-4">
        <div className="flex-1 max-w-md relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-blue-600 dark:text-blue-400 w-5 h-5" />
          <input type="text" placeholder={translate('transactionsList.searchPlaceholder')} value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:border-blue-500 dark:bg-gray-800 dark:text-white dark:placeholder-gray-500" />
        </div>
        <select value={filterType} onChange={e => setFilterType(e.target.value)} className="px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-800 dark:text-white">
          <option value="">{translate('transactionsList.allTypes')}</option>
          {typeOptions.map(o => <option key={o.id} value={o.option_value}>{optionLabel(translate, 'transaction_type', o.option_value, o.option_label)}</option>)}
        </select>
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-12 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg">
          <Receipt className="w-12 h-12 text-gray-400 mx-auto mb-3" />
          <p className="text-gray-600 dark:text-gray-400">{translate('transactionsList.noResultsFound')}</p>
        </div>
      ) : filtered.length >= VIRTUAL_THRESHOLD ? (
        <FixedSizeList height={700} itemCount={filtered.length} itemSize={ROW_HEIGHT} width="100%" overscanCount={5}>
          {renderVirtual}
        </FixedSizeList>
      ) : (
        <div className="space-y-2">{filtered.map(t => <Row key={t.id} t={t} />)}</div>
      )}

      {transactionsMeta.hasMore && filtered.length === transactions.length && (
        <div className="flex flex-col items-center py-6 space-y-2">
          <p className="text-sm text-gray-500 dark:text-gray-400">{translate('transactionsList.showingOfTotal', { count: transactions.length, total: transactionsMeta.total })}</p>
          <button onClick={async () => { setLoadingMore(true); await loadMoreTransactions(); setLoadingMore(false); }} disabled={loadingMore}
            className="px-5 py-2.5 bg-blue-600 dark:bg-blue-500 text-white rounded-lg text-sm font-medium disabled:opacity-60">
            {loadingMore ? translate('common.loadingEllipsis') : translate('common.loadMoreRemaining', { count: transactionsMeta.total - transactions.length })}
          </button>
        </div>
      )}
    </div>
  );
};

export default memo(TransactionsList);
