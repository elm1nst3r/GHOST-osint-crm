import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { authAPI } from '../utils/authAPI';

const AuthContext = createContext(null);

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
    try {
      const session = await authAPI.getSession();
      if (session.authenticated) signedIn(session.user, session.mfa_setup_required);
      else signedOut();
    } catch {
      signedOut();
    } finally {
      setAuthLoading(false);
    }
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

  const handleLogout = async () => {
    try {
      await authAPI.logout();
    } finally {
      signedOut();
    }
  };

  useEffect(() => {
    checkAuth();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
