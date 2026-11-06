import { useState, useTransition, lazy, Suspense } from 'react';
import { useTranslation } from 'react-i18next';
import { LogIn, AlertCircle, ShieldCheck, KeyRound, ArrowLeft } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { authAPI } from '../utils/authAPI';
import { useTheme } from '../contexts/ThemeContext';

// Only the Matrix theme loads the rain.
const MatrixRain = lazy(() => import('./effects/MatrixRain'));
import { signInWithPasskey, securityErrorMessage, passkeysSupportedByBrowser } from '../utils/passkeys';

const inputClass = 'appearance-none relative block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 placeholder-gray-500 dark:placeholder-gray-400 text-gray-900 dark:text-white dark:bg-gray-800 rounded-md focus:outline-hidden focus:ring-blue-500 focus:border-blue-500 sm:text-sm';
const primaryButton = 'w-full flex justify-center items-center gap-2 py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-hidden focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed';
const linkButton = 'text-sm text-blue-600 dark:text-blue-400 hover:underline';

const signInError = (t, err) => (err.status === 429 ? t('security.errors.tooManyAttempts') : (err.message || t('login.genericError')));

const ErrorBox = ({ message }) => (
  <div className="rounded-md bg-red-50 dark:bg-red-900/20 p-4" role="alert">
    <div className="flex">
      <div className="shrink-0">
        <AlertCircle className="h-5 w-5 text-red-400" />
      </div>
      <div className="ms-3">
        <p className="text-sm font-medium text-red-800 dark:text-red-200">{message}</p>
      </div>
    </div>
  </div>
);

// Second sign-in step (issue #90): a code from the authenticator app, a
// passkey, or a recovery code.
const SecondStep = ({ methods, onDone, onRestart }) => {
  const { t } = useTranslation();
  const [mode, setMode] = useState(methods.totp ? 'code' : (methods.passkey ? 'passkey' : 'recovery'));
  const [value, setValue] = useState('');
  const [error, setError] = useState('');
  // An Action: `busy` stays true until the async function has finished.
  const [busy, startVerify] = useTransition();
  const passkeyAvailable = methods.passkey && passkeysSupportedByBrowser();

  const handle = (fn) => {
    setError('');
    startVerify(async () => {
      let result;
      try {
        result = await fn();
      } catch (err) {
        const message = securityErrorMessage(t, err);
        if (err.code === 'mfa_expired') onRestart(message);
        else setError(message);
        return;
      }
      onDone(result);
    });
  };

  const submit = (e) => {
    e.preventDefault();
    handle(() => (mode === 'code' ? authAPI.mfaVerifyCode(value) : authAPI.mfaVerifyRecoveryCode(value)));
  };

  const passkey = () => handle(async () => {
    const options = await authAPI.mfaPasskeyOptions();
    return authAPI.mfaPasskeyVerify(await signInWithPasskey(options));
  });

  const switchTo = (next) => { setMode(next); setValue(''); setError(''); };

  return (
    <div className="mt-8 space-y-6">
      <div className="text-center">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center justify-center gap-2">
          <ShieldCheck className="h-5 w-5 text-blue-600 dark:text-blue-400" />
          {t('login.mfa.title')}
        </h3>
        <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
          {mode === 'code' && t('login.mfa.codeHint')}
          {mode === 'recovery' && t('login.mfa.recoveryHint')}
          {mode === 'passkey' && t('login.mfa.passkeyHint')}
        </p>
      </div>

      {error && <ErrorBox message={error} />}

      {mode === 'passkey' ? (
        <button type="button" onClick={passkey} disabled={busy || !passkeyAvailable} className={primaryButton}>
          <KeyRound className="h-5 w-5" />
          {busy ? t('login.mfa.verifying') : t('login.mfa.usePasskey')}
        </button>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          <label htmlFor="mfa-value" className="sr-only">
            {mode === 'code' ? t('login.mfa.codeLabel') : t('login.mfa.recoveryLabel')}
          </label>
          <input
            id="mfa-value"
            type="text"
            autoFocus
            required
            value={value}
            onChange={(e) => setValue(e.target.value)}
            className={`${inputClass} text-center tracking-widest font-mono`}
            dir="ltr"
            {...(mode === 'code'
              ? { inputMode: 'numeric', autoComplete: 'one-time-code', maxLength: 9, placeholder: '123 456' }
              : { autoComplete: 'off', autoCapitalize: 'none', spellCheck: false, maxLength: 40, placeholder: 'abcde-fghjk' })}
          />
          <button type="submit" disabled={busy || !value.trim()} className={primaryButton}>
            {busy ? t('login.mfa.verifying') : t('login.mfa.verify')}
          </button>
        </form>
      )}

      {methods.passkey && !passkeysSupportedByBrowser() && mode === 'passkey' && (
        <p className="text-xs text-gray-500 dark:text-gray-400 text-center">{t('login.mfa.passkeyUnsupported')}</p>
      )}
      {!methods.totp && !methods.passkey && (
        <p className="text-xs text-gray-500 dark:text-gray-400 text-center">{t('login.mfa.passkeyElsewhere')}</p>
      )}

      <div className="flex flex-col items-center gap-2">
        {methods.totp && mode !== 'code' && (
          <button type="button" className={linkButton} onClick={() => switchTo('code')}>{t('login.mfa.useCode')}</button>
        )}
        {methods.passkey && mode !== 'passkey' && (
          <button type="button" className={linkButton} onClick={() => switchTo('passkey')}>{t('login.mfa.usePasskeyInstead')}</button>
        )}
        {mode !== 'recovery' && (
          <button type="button" className={linkButton} onClick={() => switchTo('recovery')}>{t('login.mfa.useRecovery')}</button>
        )}
        <button type="button" className={`${linkButton} flex items-center gap-1 mt-2`} onClick={() => onRestart('')}>
          <ArrowLeft className="h-4 w-4 rtl:rotate-180" />{t('login.mfa.back')}
        </button>
      </div>
    </div>
  );
};

const Login = ({ onLogin }) => {
  const { theme } = useTheme();
  const { t } = useTranslation();
  const { completeLogin } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, startSignIn] = useTransition();
  const [mfaMethods, setMfaMethods] = useState(null);

  const handleSubmit = (e) => {
    e.preventDefault();
    setError('');
    startSignIn(async () => {
      let result;
      try {
        result = await onLogin(username, password);
      } catch (err) {
        setError(signInError(t, err));
        return;
      }
      if (result?.mfa_required) {
        setMfaMethods(result.methods);
        setPassword('');
      }
    });
  };

  // Back to the password form: after "Back", or when the second step expired.
  const restart = (message) => {
    authAPI.logout().catch(() => {});
    setMfaMethods(null);
    setError(message);
  };

  return (
    <div className="min-h-dvh flex items-center justify-center bg-slate-50 dark:bg-slate-900 py-12 px-4 sm:px-6 lg:px-8">
      {theme.effect === 'matrix' && <Suspense fallback={null}><MatrixRain /></Suspense>}
      <div className="relative max-w-md w-full space-y-8">
        <div>
          <div className="mx-auto h-12 w-12 flex items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900">
            <LogIn className="h-6 w-6 text-blue-600 dark:text-blue-300" />
          </div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900 dark:text-white">
            GHOST OSINT CRM
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600 dark:text-gray-400">
            {t('login.subtitle')}
          </p>
        </div>
        {mfaMethods ? (
          <SecondStep methods={mfaMethods} onDone={completeLogin} onRestart={restart} />
        ) : (
        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          {error && <ErrorBox message={error} />}
          <div className="rounded-md shadow-xs -space-y-px">
            <div>
              <label htmlFor="username" className="sr-only">
                {t('login.username')}
              </label>
              <input
                id="username"
                name="username"
                type="text"
                autoComplete="username"
                required
                className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 placeholder-gray-500 dark:placeholder-gray-400 text-gray-900 dark:text-white dark:bg-gray-800 rounded-t-md focus:outline-hidden focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
                placeholder={t('login.username')}
                value={username}
                onChange={(e) => setUsername(e.target.value)}
              />
            </div>
            <div>
              <label htmlFor="password" className="sr-only">
                {t('login.password')}
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 placeholder-gray-500 dark:placeholder-gray-400 text-gray-900 dark:text-white dark:bg-gray-800 rounded-b-md focus:outline-hidden focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
                placeholder={t('login.password')}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
          </div>

          <div>
            <button
              type="submit"
              disabled={loading}
              className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-hidden focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <span className="absolute inset-s-0 inset-y-0 flex items-center ps-3">
                <LogIn className="h-5 w-5 text-blue-500 group-hover:text-blue-400" />
              </span>
              {loading ? t('login.signingIn') : t('login.signIn')}
            </button>
          </div>
        </form>
        )}
      </div>
    </div>
  );
};

export default Login;
