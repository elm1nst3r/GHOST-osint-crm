import React, { createContext, useContext, useState, useCallback, useRef } from 'react';
import { peopleAPI, businessAPI, toolsAPI, todosAPI, customFieldsAPI, propertiesAPI, assetsAPI, transactionsAPI } from '../utils/api';
import { DEFAULT_APP_SETTINGS } from '../utils/constants';
import { useProject } from './ProjectContext';

const DataContext = createContext(null);

const PAGE_SIZE = 100;

export const DataProvider = ({ children }) => {
  const { activeProjectId } = useProject();
  const [people, setPeople] = useState([]);
  const [peopleMeta, setPeopleMeta] = useState({ total: 0, hasMore: false });
  const peopleLoadedRef = useRef(0); // tracks how many people are currently in state

  const [businesses, setBusinesses] = useState([]);
  const [tools, setTools] = useState([]);
  const [todos, setTodos] = useState([]);
  const [customFields, setCustomFields] = useState([]);

  // Transaction tracking slices (issue #43)
  const [properties, setProperties] = useState([]);
  const [propertiesMeta, setPropertiesMeta] = useState({ total: 0, hasMore: false });
  const propertiesLoadedRef = useRef(0);
  const [assets, setAssets] = useState([]);
  const [assetsMeta, setAssetsMeta] = useState({ total: 0, hasMore: false });
  const assetsLoadedRef = useRef(0);
  const [transactions, setTransactions] = useState([]);
  const [transactionsMeta, setTransactionsMeta] = useState({ total: 0, hasMore: false });
  const transactionsLoadedRef = useRef(0);

  const [appSettings, setAppSettings] = useState(() => {
    try {
      const saved = localStorage.getItem('appSettings');
      return saved ? JSON.parse(saved) : DEFAULT_APP_SETTINGS;
    } catch {
      return DEFAULT_APP_SETTINGS;
    }
  });

  // Fetch people from a given offset. offset=0 replaces the list; offset>0 appends.
  const fetchPeople = useCallback(async (offset = 0) => {
    try {
      const { data, meta } = await peopleAPI.getAll({ limit: PAGE_SIZE, offset, project_id: activeProjectId });
      if (offset === 0) {
        setPeople(data);
        peopleLoadedRef.current = data.length;
      } else {
        setPeople(prev => [...prev, ...data]);
        peopleLoadedRef.current += data.length;
      }
      setPeopleMeta({ total: meta.total, hasMore: meta.hasMore });
    } catch (err) {
      console.error('Error fetching people:', err);
    }
  }, [activeProjectId]);

  const loadMorePeople = useCallback(async () => {
    await fetchPeople(peopleLoadedRef.current);
  }, [fetchPeople]);

  const fetchBusinesses = useCallback(async () => {
    try {
      const data = await businessAPI.getAll({ project_id: activeProjectId });
      setBusinesses(data);
    } catch (err) {
      console.error('Error fetching businesses:', err);
    }
  }, [activeProjectId]);

  const fetchTools = useCallback(async () => {
    try {
      const data = await toolsAPI.getAll();
      setTools(data);
    } catch (err) {
      console.error('Error fetching tools:', err);
    }
  }, []);

  const fetchTodos = useCallback(async () => {
    try {
      const data = await todosAPI.getAll({ project_id: activeProjectId });
      setTodos(data);
    } catch (err) {
      console.error('Error fetching todos:', err);
    }
  }, [activeProjectId]);

  const fetchCustomFields = useCallback(async () => {
    try {
      const data = await customFieldsAPI.getAll();
      setCustomFields(data);
    } catch (err) {
      console.error('Error fetching custom fields:', err);
    }
  }, []);

  const fetchProperties = useCallback(async (offset = 0) => {
    try {
      const { data, meta } = await propertiesAPI.getAll({ limit: PAGE_SIZE, offset, project_id: activeProjectId });
      if (offset === 0) { setProperties(data); propertiesLoadedRef.current = data.length; }
      else { setProperties(prev => [...prev, ...data]); propertiesLoadedRef.current += data.length; }
      setPropertiesMeta({ total: meta.total, hasMore: meta.hasMore });
    } catch (err) {
      console.error('Error fetching properties:', err);
    }
  }, [activeProjectId]);
  const loadMoreProperties = useCallback(async () => { await fetchProperties(propertiesLoadedRef.current); }, [fetchProperties]);

  const fetchAssets = useCallback(async (offset = 0) => {
    try {
      const { data, meta } = await assetsAPI.getAll({ limit: PAGE_SIZE, offset, project_id: activeProjectId });
      if (offset === 0) { setAssets(data); assetsLoadedRef.current = data.length; }
      else { setAssets(prev => [...prev, ...data]); assetsLoadedRef.current += data.length; }
      setAssetsMeta({ total: meta.total, hasMore: meta.hasMore });
    } catch (err) {
      console.error('Error fetching assets:', err);
    }
  }, [activeProjectId]);
  const loadMoreAssets = useCallback(async () => { await fetchAssets(assetsLoadedRef.current); }, [fetchAssets]);

  const fetchTransactions = useCallback(async (offset = 0) => {
    try {
      const { data, meta } = await transactionsAPI.getAll({ limit: PAGE_SIZE, offset, project_id: activeProjectId });
      if (offset === 0) { setTransactions(data); transactionsLoadedRef.current = data.length; }
      else { setTransactions(prev => [...prev, ...data]); transactionsLoadedRef.current += data.length; }
      setTransactionsMeta({ total: meta.total, hasMore: meta.hasMore });
    } catch (err) {
      console.error('Error fetching transactions:', err);
    }
  }, [activeProjectId]);
  const loadMoreTransactions = useCallback(async () => { await fetchTransactions(transactionsLoadedRef.current); }, [fetchTransactions]);

  const refreshAll = useCallback(async () => {
    await Promise.all([
      fetchPeople(0),
      fetchBusinesses(),
      fetchTools(),
      fetchTodos(),
      fetchCustomFields(),
      fetchProperties(0),
      fetchAssets(0),
      fetchTransactions(0),
    ]);
  }, [fetchPeople, fetchBusinesses, fetchTools, fetchTodos, fetchCustomFields, fetchProperties, fetchAssets, fetchTransactions]);

  const handleAppNameChange = useCallback((newName) => {
    setAppSettings(prev => {
      const updated = { ...prev, appName: newName };
      localStorage.setItem('appSettings', JSON.stringify(updated));
      return updated;
    });
  }, []);

  const persistAppSettings = useCallback((updated) => {
    setAppSettings(updated);
    localStorage.setItem('appSettings', JSON.stringify(updated));
  }, []);

  return (
    <DataContext.Provider value={{
      people, setPeople, fetchPeople, peopleMeta, loadMorePeople,
      businesses, setBusinesses, fetchBusinesses,
      tools, setTools, fetchTools,
      todos, setTodos, fetchTodos,
      customFields, setCustomFields, fetchCustomFields,
      properties, setProperties, fetchProperties, propertiesMeta, loadMoreProperties,
      assets, setAssets, fetchAssets, assetsMeta, loadMoreAssets,
      transactions, setTransactions, fetchTransactions, transactionsMeta, loadMoreTransactions,
      appSettings, setAppSettings: persistAppSettings, handleAppNameChange,
      refreshAll,
    }}>
      {children}
    </DataContext.Provider>
  );
};

export const useData = () => {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error('useData must be used within DataProvider');
  return ctx;
};
