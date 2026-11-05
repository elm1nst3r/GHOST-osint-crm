import { createContext, useContext, useState, useEffect, useCallback, useEffectEvent } from 'react';
import { authAPI } from '../utils/authAPI';

const AuthContext = createContext(null);

// The session check answers { authenticated: false } when nobody is signed
// in, so a failed request (a 429 from the rate limiter, the server
// restarting, a network drop) only means "couldn't tell". Ask again instead
// of showing the sign-in screen to someone who is signed in; give up after
// a few tries. Waits the server's Retry-After, else 1, 2, 4, 8 seconds.
const SESSION_TRIES = 5;
async function fetchSession() {
  for (let attempt = 1; ; attempt++) {
    const result = await authAPI.getSession().then((session) => ({ session }), (error) => ({ error }));
    if (!result.error) return result.session;
    if (attempt >= SESSION_TRIES) return null;
    const seconds = result.error.retryAfter ?? 2 ** (attempt - 1);
    await new Promise((resolve) => setTimeout(resolve, Math.min(seconds, 15) * 1000));
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

  const signedIn = useCallback((user, setupRequired) => {
    setCurrentUser(user);
    setMfaSetupRequired(Boolean(setupRequired));
    setAuthenticated(!setupRequired);
  }, []);

  const signedOut = useCallback(() => {
    setAuthenticated(false);
    setCurrentUser(null);
    setMfaSetupRequired(false);
  }, []);

  const checkAuth = async () => {
    const session = await fetchSession();
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
    await authAPI.logout().catch(() => {});
    signedOut();
  };

  const onMount = useEffectEvent(() => {
    checkAuth();
  });
  useEffect(() => onMount(), []);

  return (
    <AuthContext.Provider value={{
      authenticated,
      currentUser,
      authLoading,
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
