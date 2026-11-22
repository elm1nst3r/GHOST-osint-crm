import { createContext, useContext, useState, useEffect, useCallback, useEffectEvent } from 'react';
import { authAPI } from '../utils/authAPI';
import { SESSION_ENDED_EVENT } from '../utils/api';
import { sessionRetry } from '../utils/sessionRetry';

const AuthContext = createContext(null);

// Several requests can fail at once when the session ends; leave only once.
let leaving = false;

// The session check answers { authenticated: false } when nobody is signed
// in, so a failed request (a 429 from the rate limiter, the server
// restarting, a network drop) only means "couldn't tell". Ask again, for as
// long as it takes, instead of showing the sign-in screen to someone who is
// signed in (utils/sessionRetry.js has the timing). onWait reports why and
// until when, for the waiting screen; `skip` (Try again now) cuts a wait short.
const wake = { skip: null };
async function fetchSession(onWait) {
  for (let attempt = 1; ; attempt++) {
    const result = await authAPI.getSession().then((session) => ({ session }), (error) => ({ error }));
    if (!result.error) { onWait(null); return result.session; }
    const { reason, seconds } = sessionRetry(result.error, attempt);
    onWait({ reason, until: Date.now() + seconds * 1000 });
    await new Promise((resolve) => {
      const timer = setTimeout(resolve, seconds * 1000);
      wake.skip = () => { clearTimeout(timer); resolve(); };
    });
    wake.skip = null;
  }
}

// `authenticated` means "may use the app". When "require two-factor" is on
// and the account has none yet (issue #90), the user is signed in but held
// at the setup screen: mfaSetupRequired is true and authenticated stays
// false, so nothing that loads data on sign-in runs yet.
export const AuthProvider = ({ children }) => {
  const [authenticated, setAuthenticated] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [mfaSetupRequired, setMfaSetupRequired] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);
  // While the session check waits: { reason: 'rate_limited' | 'unreachable', until }.
  const [sessionWait, setSessionWait] = useState(null);
  const retrySessionNow = useCallback(() => wake.skip?.(), []);

  const signedIn = useCallback((user, setupRequired) => {
    setCurrentUser(user);
    setMfaSetupRequired(Boolean(setupRequired));
    setAuthenticated(!setupRequired);
  }, []);

  // A profile setting saved elsewhere (Settings → General: start page).
  const updateCurrentUser = useCallback((patch) => setCurrentUser((u) => (u ? { ...u, ...patch } : u)), []);

  const signedOut = useCallback(() => {
    setAuthenticated(false);
    setCurrentUser(null);
    setMfaSetupRequired(false);
  }, []);

  const checkAuth = async () => {
    const session = await fetchSession(setSessionWait);
    if (session?.authenticated) signedIn(session.user, session.mfa_setup_required);
    else signedOut();
    setAuthLoading(false);
  };

  // Returns the server's answer. When it is { mfa_required }, the login
  // screen asks for the second step and calls completeLogin with its result.
  const handleLogin = async (username, password) => {
    const result = await authAPI.login(username, password);
    if (!result.mfa_required) signedIn(result.user, result.mfa_setup_required);
    return result;
  };

  const completeLogin = useCallback((result) => {
    signedIn(result.user, result.mfa_setup_required);
  }, [signedIn]);

  // Two-factor setup finished on the setup screen.
  const finishMfaSetup = useCallback(() => {
    setMfaSetupRequired(false);
    setAuthenticated(true);
  }, []);

  // Signed out locally even when the request fails (e.g. server unreachable).
  const handleLogout = async () => {
    const result = await authAPI.logout().catch(() => null);
    signedOut();
    // After single sign-on: also sign out at the identity provider (issue #105).
    if (result?.redirect) window.location.assign(result.redirect);
  };

  const onMount = useEffectEvent(() => {
    checkAuth();
  });
  useEffect(() => onMount(), []);

  // The server ended the session while the app was open. A full reload to
  // the sign-in screen also drops everything the app kept in memory.
  const onSessionEnded = useEffectEvent(() => {
    if (!authenticated || leaving) return;
    leaving = true;
    window.location.replace('/?sso_error=session_ended');
  });
  useEffect(() => {
    const handler = () => onSessionEnded();
    window.addEventListener(SESSION_ENDED_EVENT, handler);
    return () => window.removeEventListener(SESSION_ENDED_EVENT, handler);
  }, []);

  return (
    <AuthContext.Provider value={{
      authenticated,
      currentUser,
      updateCurrentUser,
      authLoading,
      sessionWait,
      retrySessionNow,
      mfaSetupRequired,
      handleLogin,
      completeLogin,
      finishMfaSetup,
      handleLogout,
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};
