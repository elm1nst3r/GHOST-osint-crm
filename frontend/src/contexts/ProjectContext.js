// File: frontend/src/contexts/ProjectContext.js
// The active project (issue #83) -- the hard investigation boundary. Load-on-
// init + persist-on-change, same shape as ThemeContext.js's settings state,
// minus the "apply to document" synchronous-paint step theme needs and this
// doesn't.
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { projectsAPI } from '../utils/api';

const STORAGE_KEY = 'ghost-active-project';

const loadStoredId = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
};

const ProjectContext = createContext(null);

export const ProjectProvider = ({ children }) => {
  const [projects, setProjects] = useState([]);
  const [activeProjectId, setActiveProjectIdState] = useState(loadStoredId);
  const [loaded, setLoaded] = useState(false);

  const refetchProjects = useCallback(() => {
    return projectsAPI.getAll()
      .then((data) => {
        setProjects(data);
        setLoaded(true);
        return data;
      })
      .catch((error) => {
        console.error('Error fetching projects:', error);
        setLoaded(true);
      });
  }, []);

  // Fetched from AppShell once authenticated (same gating DataContext's
  // refreshAll uses) -- not on mount here, since that would fire the request
  // before login completes.

  // Stale localStorage guard: the stored id may point at a project that was
  // since deleted (unlike theme settings, which can't become invalid).
  useEffect(() => {
    if (!loaded || activeProjectId == null) return;
    if (!projects.some((p) => p.id === activeProjectId)) {
      setActiveProjectIdState(null);
    }
  }, [loaded, projects, activeProjectId]);

  const setActiveProjectId = useCallback((id) => {
    setActiveProjectIdState(id);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(id));
    } catch (e) { /* storage unavailable — selection just won't persist */ }
  }, []);

  const activeProject = projects.find((p) => p.id === activeProjectId) || null;

  return (
    <ProjectContext.Provider value={{
      projects, activeProjectId, activeProject, setActiveProjectId, refetchProjects,
    }}>
      {children}
    </ProjectContext.Provider>
  );
};

export const useProject = () => {
  const ctx = useContext(ProjectContext);
  if (!ctx) throw new Error('useProject must be used within ProjectProvider');
  return ctx;
};
