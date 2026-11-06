// Which sections are switched on (Settings → General → Modules). Loaded after
// sign-in; remembered in the browser so the menu doesn't briefly show
// switched-off sections on the next load.
import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { useAuth } from './AuthContext';
import { modulesAPI } from '../utils/api';
import { isModuleOn } from '../utils/modules';

const ModulesContext = createContext({ disabled: [], isOn: () => true, setDisabled: () => {} });
const CACHE_KEY = 'ghost-disabled-modules';

const readCache = () => {
  try { const v = JSON.parse(localStorage.getItem(CACHE_KEY) || '[]'); return Array.isArray(v) ? v : []; } catch { return []; }
};
const writeCache = (list) => { try { localStorage.setItem(CACHE_KEY, JSON.stringify(list)); } catch { /* private mode */ } };

export const ModulesProvider = ({ children }) => {
  const { authenticated } = useAuth();
  const [disabled, setDisabledState] = useState(readCache);

  useEffect(() => {
    if (!authenticated) return undefined;
    let cancelled = false;
    modulesAPI.get()
      .then((res) => { if (!cancelled && Array.isArray(res?.disabled)) { setDisabledState(res.disabled); writeCache(res.disabled); } })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [authenticated]);

  const value = useMemo(() => ({
    disabled,
    isOn: (id) => isModuleOn(disabled, id),
    // After an admin saves: what the server stored.
    setDisabled: (list) => { setDisabledState(list); writeCache(list); },
  }), [disabled]);

  return <ModulesContext.Provider value={value}>{children}</ModulesContext.Provider>;
};

export const useModules = () => useContext(ModulesContext);
