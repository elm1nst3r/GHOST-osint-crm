// File: frontend/src/components/settings/security/PasswordPrompt.js
// Asks for the current password before removing a sign-in method, replacing
// recovery codes and similar (issue #90). onConfirm(password) may throw; its
// message is shown and the dialog stays open.
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Lock, Loader2 } from 'lucide-react';
import Dialog, { buttonClass, inputClass, ErrorNote } from './Dialog';
import { securityErrorMessage } from '../../../utils/passkeys';

const PasswordPrompt = ({ title, description, confirmLabel, danger = false, onConfirm, onClose }) => {
  const { t } = useTranslation();
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await onConfirm(password);
    } catch (err) {
      setError(securityErrorMessage(t, err));
      setBusy(false);
    }
  };

  return (
    <Dialog title={title} icon={Lock} onClose={busy ? undefined : onClose}>
      <form onSubmit={submit} className="space-y-4">
        {description && <p className="text-sm text-gray-700 dark:text-gray-300">{description}</p>}
        <div>
          <label htmlFor="confirm-password" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            {t('security.currentPassword')}
          </label>
          <input id="confirm-password" type="password" autoComplete="current-password" autoFocus required
            value={password} onChange={(e) => setPassword(e.target.value)} className={inputClass} />
        </div>
        <ErrorNote>{error}</ErrorNote>
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} disabled={busy} className={buttonClass.secondary}>{t('common.cancel')}</button>
          <button type="submit" disabled={busy || !password} className={danger ? buttonClass.danger : buttonClass.primary}>
            {busy && <Loader2 className="w-4 h-4 animate-spin" />}
            {confirmLabel}
          </button>
        </div>
      </form>
    </Dialog>
  );
};

export default PasswordPrompt;
