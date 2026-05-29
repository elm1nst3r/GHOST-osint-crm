import React, { createContext, useContext, useState, useCallback, useRef } from 'react';
import { peopleAPI, businessAPI, toolsAPI, todosAPI, customFieldsAPI } from '../utils/api';
import { DEFAULT_APP_SETTINGS } from '../utils/constants';

const DataContext = createContext(null);

const PAGE_SIZE = 100;

export const DataProvider = ({ children }) => {
  const [people, setPeople] = useState([]);
  const [peopleMeta, setPeopleMeta] = useState({ total: 0, hasMore: false });
  const peopleLoadedRef = useRef(0); // tracks how many people are currently in state

  const [businesses, setBusinesses] = useState([]);
  const [tools, setTools] = useState([]);
  const [todos, setTodos] = useState([]);
  const [customFields, setCustomFields] = useState([]);
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
      const { data, meta } = await peopleAPI.getAll({ limit: PAGE_SIZE, offset });
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
  }, []);

  const loadMorePeople = useCallback(async () => {
    await fetchPeople(peopleLoadedRef.current);
  }, [fetchPeople]);

  const fetchBusinesses = useCallback(async () => {
    try {
      const data = await businessAPI.getAll();
      setBusinesses(data);
    } catch (err) {
      console.error('Error fetching businesses:', err);
    }
  }, []);

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
      const data = await todosAPI.getAll();
      setTodos(data);
    } catch (err) {
      console.error('Error fetching todos:', err);
    }
  }, []);

  const fetchCustomFields = useCallback(async () => {
    try {
      const data = await customFieldsAPI.getAll();
      setCustomFields(data);
    } catch (err) {
      console.error('Error fetching custom fields:', err);
    }
  }, []);

  const refreshAll = useCallback(async () => {
    await Promise.all([
      fetchPeople(0),
      fetchBusinesses(),
      fetchTools(),
      fetchTodos(),
      fetchCustomFields(),
    ]);
  }, [fetchPeople, fetchBusinesses, fetchTools, fetchTodos, fetchCustomFields]);

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
