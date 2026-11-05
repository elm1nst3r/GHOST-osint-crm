// File: frontend/src/components/settings/security/Dialog.jsx
// Small modal shell for the security screens (issue #90).
import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { useTranslation } from 'react-i18next';

const Dialog = ({ title, icon: Icon, onClose, children, footer, wide = false }) => {
  const { t } = useTranslation();

  useEffect(() => {
    if (!onClose) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return createPortal(
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div role="dialog" aria-modal="true" aria-label={title}
        className={`bg-white dark:bg-gray-800 rounded-lg shadow-2xl border border-gray-200 dark:border-gray-700 w-full ${wide ? 'max-w-xl' : 'max-w-md'} max-h-[90vh] overflow-hidden flex flex-col`}>
        <div className="p-5 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center gap-3">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
            {Icon && <Icon className="w-5 h-5 text-blue-600 dark:text-blue-400" />}
            {title}
          </h2>
          {onClose && (
            <button onClick={onClose} aria-label={t('common.close')} className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700">
              <X className="w-5 h-5" />
            </button>
          )}
        </div>
        <div className="p-5 overflow-y-auto space-y-4">{children}</div>
        {footer && <div className="p-5 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-2">{footer}</div>}
      </div>
    </div>,
    document.body
  );
};

export const buttonClass = {
  primary: 'px-4 py-2 text-sm rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5',
  danger: 'px-4 py-2 text-sm rounded-lg bg-red-600 text-white hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5',
  secondary: 'px-4 py-2 text-sm rounded-lg text-gray-700 dark:text-gray-200 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-50 flex items-center gap-1.5',
  small: 'px-3 py-1.5 text-sm rounded-md border border-gray-300 dark:border-slate-600 text-gray-700 dark:text-slate-200 hover:bg-gray-50 dark:hover:bg-slate-700 disabled:opacity-50 flex items-center gap-1.5',
  smallDanger: 'px-3 py-1.5 text-sm rounded-md border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-50 flex items-center gap-1.5',
};

export const inputClass = 'w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-blue-500';

export const ErrorNote = ({ children }) => (children ? (
  <div role="alert" className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3 text-sm text-red-800 dark:text-red-200">
    {children}
  </div>
) : null);

export default Dialog;
