// File: frontend/src/components/ChainOfCustodyTimeline.js
import React from 'react';
import { ArrowRight } from 'lucide-react';
import { formatDate, formatMoney, partyText, prettyType, typeBadgeClass } from '../utils/transactionFormat';

// Renders an ordered chain-of-custody / ownership timeline.
// `chain` items: { transaction_id, occurred_on, transaction_type, from, to, value, currency }
const ChainOfCustodyTimeline = ({ chain = [], emptyText = 'No custody history yet.' }) => {
  if (!chain.length) {
    return <p className="text-sm text-gray-500 dark:text-gray-400 py-4 text-center">{emptyText}</p>;
  }
  return (
    <ol className="relative border-l border-gray-200 dark:border-gray-700 ml-3">
      {chain.map((c, i) => (
        <li key={`${c.transaction_id}-${i}`} className="mb-5 ml-5">
          <span className="absolute -left-1.5 w-3 h-3 rounded-full bg-blue-500 border border-white dark:border-gray-800" />
          <div className="flex items-center flex-wrap gap-2">
            <span className={`text-xs px-2 py-0.5 rounded font-medium capitalize ${typeBadgeClass(c.transaction_type)}`}>{prettyType(c.transaction_type)}</span>
            <span className="text-xs text-gray-500 dark:text-gray-400">{formatDate(c.occurred_on)}</span>
            {c.value != null && <span className="text-xs text-gray-700 dark:text-gray-300">· {formatMoney(c.value, c.currency)}</span>}
          </div>
          <div className="flex items-center text-sm text-gray-800 dark:text-gray-200 mt-1">
            <span>{partyText(c.from)}</span>
            <ArrowRight className="w-4 h-4 mx-2 text-gray-400" />
            <span className="font-medium">{partyText(c.to)}</span>
          </div>
        </li>
      ))}
    </ol>
  );
};

export default ChainOfCustodyTimeline;
