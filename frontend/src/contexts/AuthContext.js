import React, { createContext, useContext, useState, useEffect } from 'react';
import { authAPI } from '../utils/authAPI';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [authenticated, setAuthenticated] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);

  const checkAuth = async () => {
    try {
      const session = await authAPI.getSession();
      if (session.authenticated) {
        setAuthenticated(true);
        setCurrentUser(session.user);
      } else {
        setAuthenticated(false);
        setCurrentUser(null);
      }
    } catch {
      setAuthenticated(false);
      setCurrentUser(null);
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogin = async (username, password) => {
    const result = await authAPI.login(username, password);
    setAuthenticated(true);
    setCurrentUser(result.user);
  };

  const handleLogout = async () => {
    try {
      await authAPI.logout();
    } finally {
      setAuthenticated(false);
      setCurrentUser(null);
    }
  };

  useEffect(() => {
    checkAuth();
  }, []);

  return (
    <AuthContext.Provider value={{
      authenticated,
      currentUser,
      authLoading,
      handleLogin,
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
