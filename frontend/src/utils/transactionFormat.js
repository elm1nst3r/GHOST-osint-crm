// File: frontend/src/utils/transactionFormat.js
// Shared formatting helpers for the transaction-tracking feature (issue #43).

export const formatMoney = (value, currency) => {
  if (value === null || value === undefined || value === '') return '—';
  const num = Number(value);
  if (isNaN(num)) return '—';
  const formatted = num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return currency ? `${formatted} ${currency}` : formatted;
};

export const formatDate = (d) => {
  if (!d) return '—';
  try { return new Date(d).toLocaleDateString(); } catch { return String(d); }
};

export const partyText = (party) => (party && party.label) ? party.label : '—';

export const subjectText = (subject) => {
  if (!subject) return '—';
  if (subject.label) return subject.label;
  return subject.type === 'item' ? '(unspecified item)' : '—';
};

export const prettyType = (t) => (t || '').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

// Tailwind classes for a transaction-type badge.
export const typeBadgeClass = (type) => {
  const map = {
    gift: 'bg-pink-100 text-pink-800 dark:bg-pink-900/30 dark:text-pink-300',
    donation: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
    benefit: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
    sale: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
    purchase: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
    transfer: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300',
    assignment: 'bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-300',
    visit: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-300',
  };
  return map[type] || 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300';
};

// Colour for a value direction (in / out / neutral).
export const directionClass = (dir) => {
  if (dir === 'in') return 'text-green-600 dark:text-green-400';
  if (dir === 'out') return 'text-red-600 dark:text-red-400';
  return 'text-gray-500 dark:text-gray-400';
};
