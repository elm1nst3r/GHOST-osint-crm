// File: frontend/src/components/settings/security/TwoFactorSection.jsx
//
// Two-step sign-in for the signed-in user (issue #90): authenticator app,
// passkeys and recovery codes. Used in Settings → Security and on the setup
// screen shown when an admin requires two-factor.
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Smartphone, KeyRound, LifeBuoy, Plus, Trash2, Loader2, Copy, Check, ShieldCheck } from 'lucide-react';
import { accountAPI } from '../../../utils/authAPI';
import { createPasskey, passkeysUsableHere, passkeysSupportedByBrowser, securityErrorMessage } from '../../../utils/passkeys';
import Dialog, { buttonClass, inputClass, ErrorNote } from './Dialog';
import PasswordPrompt from './PasswordPrompt';
import RecoveryCodesDialog from './RecoveryCodesDialog';
import { formatDate } from '../../../utils/format';

const Card = ({ icon: Icon, title, status, children, action }) => (
  <div className="border border-gray-200 dark:border-slate-700 rounded-lg p-4">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="flex items-start gap-3 min-w-0">
        <Icon className="w-5 h-5 mt-0.5 text-gray-500 dark:text-slate-400 shrink-0" />
        <div className="min-w-0">
          <h5 className="font-medium text-gray-900 dark:text-slate-100">{title}</h5>
          {status && <p className="text-sm text-gray-600 dark:text-slate-400">{status}</p>}
        </div>
      </div>
      {action}
    </div>
    {children && <div className="mt-3 ms-8">{children}</div>}
  </div>
);

// Groups of four, easier to type into an app by hand.
const groupSecret = (secret) => secret.replace(/(.{4})(?=.)/g, '$1 ');

const TotpSetupDialog = ({ onClose, onEnabled }) => {
  const { t } = useTranslation();
  const [setup, setSetup] = useState(null);
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  React.useEffect(() => {
    accountAPI.startTotpSetup().then(setSetup).catch((err) => setError(securityErrorMessage(t, err)));
  }, [t]);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const result = await accountAPI.enableTotp(code);
      onEnabled(result.recovery_codes);
    } catch (err) {
      setError(securityErrorMessage(t, err));
      setBusy(false);
    }
  };

  const copySecret = async () => {
    try {
      await navigator.clipboard.writeText(setup.secret);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* still shown on screen */ }
  };

  return (
    <Dialog title={t('security.totp.setupTitle')} icon={Smartphone} onClose={busy ? undefined : onClose} wide>
      {!setup && !error && (
        <div className="flex justify-center py-8 text-gray-500"><Loader2 className="w-5 h-5 animate-spin" /></div>
      )}
      {setup && (
        <form onSubmit={submit} className="space-y-4">
          <ol className="list-decimal ms-5 space-y-1 text-sm text-gray-700 dark:text-gray-300">
            <li>{t('security.totp.step1')}</li>
            <li>{t('security.totp.step2')}</li>
            <li>{t('security.totp.step3')}</li>
          </ol>
          <div className="flex flex-col sm:flex-row gap-4 items-center">
            <img
              src={`data:image/svg+xml;utf8,${encodeURIComponent(setup.qr_svg)}`}
              alt={t('security.totp.qrAlt')}
              className="w-44 h-44 bg-white p-2 rounded-lg border border-gray-200 shrink-0"
            />
            <div className="min-w-0 w-full">
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">{t('security.totp.manualEntry')}</p>
              <code dir="ltr" className="block font-mono text-sm break-all bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-md p-2 text-gray-900 dark:text-gray-100 select-all">
                {groupSecret(setup.secret)}
              </code>
              <button type="button" onClick={copySecret} className={`${buttonClass.small} mt-2`}>
                {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                {copied ? t('security.copied') : t('security.totp.copySecret')}
              </button>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">{t('security.totp.manualDetails')}</p>
            </div>
          </div>
          <div>
            <label htmlFor="totp-code" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {t('security.totp.codeLabel')}
            </label>
            <input id="totp-code" type="text" inputMode="numeric" autoComplete="one-time-code" maxLength={9} dir="ltr"
              value={code} onChange={(e) => setCode(e.target.value)} placeholder="123 456"
              className={`${inputClass} max-w-48 font-mono tracking-widest`} />
          </div>
          <ErrorNote>{error}</ErrorNote>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={onClose} disabled={busy} className={buttonClass.secondary}>{t('common.cancel')}</button>
            <button type="submit" disabled={busy || code.replace(/\D/g, '').length !== 6} className={buttonClass.primary}>
              {busy && <Loader2 className="w-4 h-4 animate-spin" />}{t('security.totp.turnOn')}
            </button>
          </div>
        </form>
      )}
      {!setup && <ErrorNote>{error}</ErrorNote>}
    </Dialog>
  );
};

const AddPasskeyDialog = ({ onClose, onAdded }) => {
  const { t } = useTranslation();
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const options = await accountAPI.passkeyOptions();
      const response = await createPasskey(options);
      const result = await accountAPI.addPasskey(response, name.trim());
      onAdded(result.recovery_codes);
    } catch (err) {
      setError(securityErrorMessage(t, err));
      setBusy(false);
    }
  };

  return (
    <Dialog title={t('security.passkeys.addTitle')} icon={KeyRound} onClose={busy ? undefined : onClose}>
      <form onSubmit={submit} className="space-y-4">
        <p className="text-sm text-gray-700 dark:text-gray-300">{t('security.passkeys.addIntro')}</p>
        <div>
          <label htmlFor="passkey-name" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            {t('security.passkeys.nameLabel')}
          </label>
          <input id="passkey-name" type="text" maxLength={100} autoFocus required value={name}
            onChange={(e) => setName(e.target.value)} placeholder={t('security.passkeys.namePlaceholder')} className={inputClass} />
        </div>
        <ErrorNote>{error}</ErrorNote>
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} disabled={busy} className={buttonClass.secondary}>{t('common.cancel')}</button>
          <button type="submit" disabled={busy || !name.trim()} className={buttonClass.primary}>
            {busy && <Loader2 className="w-4 h-4 animate-spin" />}{t('security.passkeys.continue')}
          </button>
        </div>
      </form>
    </Dialog>
  );
};

// security: GET /account/security. reload(): fetch it again.
// onFirstMethod: called once the recovery codes for a first method were seen.
const TwoFactorSection = ({ security, reload, username, onFirstMethod }) => {
  const { t } = useTranslation();
  const [dialog, setDialog] = useState(null);
  const [recoveryCodes, setRecoveryCodes] = useState(null);
  const [firstMethodPending, setFirstMethodPending] = useState(false);

  const date = (value) => formatDate(value);
  const close = () => setDialog(null);
  const multipleOrigins = new Set(security.passkeys.map((p) => p.rp_id)).size > 1;
  const passkeysHere = passkeysUsableHere(security.passkey_origins);

  // A method was added; codes are set when it was the first one.
  const methodAdded = (codes) => {
    setDialog(null);
    if (codes) {
      setRecoveryCodes(codes);
      setFirstMethodPending(true);
    }
    reload();
  };

  const codesSeen = () => {
    setRecoveryCodes(null);
    if (firstMethodPending) {
      setFirstMethodPending(false);
      if (onFirstMethod) onFirstMethod();
    }
  };

  const confirmThen = (action) => async (password) => {
    const result = await action(password);
    setDialog(null);
    if (result?.recovery_codes) setRecoveryCodes(result.recovery_codes);
    reload();
  };

  const passkeyNote = !passkeysSupportedByBrowser()
    ? t('security.passkeys.unsupportedBrowser')
    : !passkeysHere
      ? (security.passkey_origins.length
        ? t('security.passkeys.otherAddress', { origins: security.passkey_origins.join(', ') })
        : t('security.passkeys.notConfigured'))
      : null;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-sm">
        <ShieldCheck className={`w-4 h-4 ${security.enabled ? 'text-green-600 dark:text-green-400' : 'text-gray-400'}`} />
        <span className={security.enabled ? 'text-green-700 dark:text-green-400 font-medium' : 'text-gray-600 dark:text-slate-400'}>
          {security.enabled ? t('security.statusOn') : t('security.statusOff')}
        </span>
      </div>

      <Card
        icon={Smartphone}
        title={t('security.totp.title')}
        status={security.totp.enabled
          ? t('security.totp.onSince', { date: date(security.totp.enabled_at) })
          : t('security.totp.description')}
        action={security.totp.enabled ? (
          <button onClick={() => setDialog('removeTotp')} className={buttonClass.smallDanger}>
            <Trash2 className="w-4 h-4" />{t('security.remove')}
          </button>
        ) : (
          <button onClick={() => setDialog('totp')} className={buttonClass.small}>
            <Plus className="w-4 h-4" />{t('security.totp.setUp')}
          </button>
        )}
      />

      <Card
        icon={KeyRound}
        title={t('security.passkeys.title')}
        status={t('security.passkeys.description')}
        action={passkeysHere ? (
          <button onClick={() => setDialog('passkey')} className={buttonClass.small}>
            <Plus className="w-4 h-4" />{t('security.passkeys.add')}
          </button>
        ) : null}
      >
        {security.passkeys.length > 0 && (
          <ul className="divide-y divide-gray-100 dark:divide-slate-700 border border-gray-100 dark:border-slate-700 rounded-md mb-2">
            {security.passkeys.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
                <div className="min-w-0">
                  <div className="text-sm font-medium text-gray-900 dark:text-slate-100 truncate"><bdi>{p.name}</bdi></div>
                  <div className="text-xs text-gray-500 dark:text-slate-400">
                    {t('security.passkeys.added', { date: date(p.created_at) })}
                    {' · '}
                    {p.last_used_at ? t('security.passkeys.lastUsed', { date: date(p.last_used_at) }) : t('security.passkeys.neverUsed')}
                    {multipleOrigins && <> · <bdi dir="ltr">{p.rp_id}</bdi></>}
                  </div>
                </div>
                <button onClick={() => setDialog({ removePasskey: p })} className={buttonClass.smallDanger}>
                  <Trash2 className="w-4 h-4" />{t('security.remove')}
                </button>
              </li>
            ))}
          </ul>
        )}
        {passkeyNote && <p className="text-xs text-gray-500 dark:text-slate-400">{passkeyNote}</p>}
      </Card>

      {security.enabled && (
        <Card
          icon={LifeBuoy}
          title={t('security.recovery.title')}
          status={t('security.recovery.remaining', { count: security.recovery_codes_remaining })}
          action={
            <button onClick={() => setDialog('recovery')} className={buttonClass.small}>
              {t('security.recovery.replace')}
            </button>
          }
        >
          <p className="text-xs text-gray-500 dark:text-slate-400">{t('security.recovery.description')}</p>
        </Card>
      )}

      {dialog === 'totp' && <TotpSetupDialog onClose={close} onEnabled={methodAdded} />}
      {dialog === 'passkey' && <AddPasskeyDialog onClose={close} onAdded={methodAdded} />}
      {dialog === 'removeTotp' && (
        <PasswordPrompt
          title={t('security.totp.removeTitle')}
          description={security.passkeys.length ? t('security.totp.removeKeepsPasskeys') : t('security.removeLastWarning')}
          confirmLabel={t('security.remove')}
          danger
          onConfirm={confirmThen((password) => accountAPI.disableTotp(password))}
          onClose={close}
        />
      )}
      {dialog?.removePasskey && (
        <PasswordPrompt
          title={t('security.passkeys.removeTitle', { name: dialog.removePasskey.name })}
          description={security.totp.enabled || security.passkeys.length > 1 ? null : t('security.removeLastWarning')}
          confirmLabel={t('security.remove')}
          danger
          onConfirm={confirmThen((password) => accountAPI.removePasskey(dialog.removePasskey.id, password))}
          onClose={close}
        />
      )}
      {dialog === 'recovery' && (
        <PasswordPrompt
          title={t('security.recovery.replaceTitle')}
          description={t('security.recovery.replaceDescription')}
          confirmLabel={t('security.recovery.replace')}
          onConfirm={confirmThen((password) => accountAPI.replaceRecoveryCodes(password))}
          onClose={close}
        />
      )}
      {recoveryCodes && <RecoveryCodesDialog codes={recoveryCodes} username={username} onDone={codesSeen} />}
    </div>
  );
};

export default TwoFactorSection;
