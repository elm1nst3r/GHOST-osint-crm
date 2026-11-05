// File: frontend/src/contexts/ScratchpadContext.jsx
//
// State for the scratchpad: the current user's private notes and settings,
// both stored server-side so they follow the user to any browser. Content
// is never cached in localStorage (shared machines); only per-device window
// state (open/closed, position, size) lives there.
//
// Deleting a note or clearing the pad is undoable for a few seconds: the
// note disappears at once, and the server delete only goes out when the undo
// window ends (or right away if the page is being closed).

import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { scratchpadAPI } from '../utils/api';
import { useAuth } from './AuthContext';

export const SCRATCHPAD_DEFAULTS = {
  enabled: true,
  showTodos: true,
  selectionButton: true,
  corner: 'bottom-right',
  color: 'default',
  opacity: 100,
  fontSize: 'md',
};

export const UNDO_MS = 6000;

const OPEN_KEY = 'ghost_scratchpad_open';

const readOpen = () => {
  try { return localStorage.getItem(OPEN_KEY) === 'true'; } catch { return false; }
};

const ScratchpadContext = createContext(null);

export const ScratchpadProvider = ({ children }) => {
  const { authenticated, currentUser } = useAuth();
  const userId = authenticated ? currentUser?.id : null;

  const [entries, setEntries] = useState([]);
  const [settings, setSettings] = useState(SCRATCHPAD_DEFAULTS);
  const [loaded, setLoaded] = useState(false);
  const [open, setOpenState] = useState(readOpen);
  const [error, setError] = useState(null);
  // { kind: 'entry' | 'clear', ids, restore: [{ entry, index }] }
  const [pendingDelete, setPendingDelete] = useState(null);
  // Bumped whenever a note is added while the panel is closed, so the
  // launcher can flash.
  const [addedPulse, setAddedPulse] = useState(0);

  const pendingRef = useRef(null);
  const timerRef = useRef(null);
  // Latest values for the callbacks below, which stay stable across renders.
  const openRef = useRef(open);
  const entriesRef = useRef(entries);
  useLayoutEffect(() => {
    openRef.current = open;
    entriesRef.current = entries;
  });

  const setOpen = useCallback((value) => {
    setOpenState((prev) => {
      const next = typeof value === 'function' ? value(prev) : value;
      try { localStorage.setItem(OPEN_KEY, String(next)); } catch { /* ignore */ }
      return next;
    });
  }, []);

  // Load (and reset on logout / user switch).
  useEffect(() => {
    setEntries([]);
    setSettings(SCRATCHPAD_DEFAULTS);
    setLoaded(false);
    if (!userId) return undefined;
    let cancelled = false;
    scratchpadAPI.get()
      .then((data) => {
        if (cancelled) return;
        setEntries(data.entries || []);
        setSettings({ ...SCRATCHPAD_DEFAULTS, ...(data.settings || {}) });
        setLoaded(true);
      })
      .catch((err) => {
        if (cancelled) return;
        console.error('Error loading scratchpad:', err);
        setLoaded(true);
      });
    return () => { cancelled = true; };
  }, [userId]);

  const flashError = useCallback((message) => {
    setError(message);
    setTimeout(() => setError((cur) => (cur === message ? null : cur)), 5000);
  }, []);

  // ── pending deletes ───────────────────────────────────────────────────────

  const commitPending = useCallback((keepalive = false) => {
    const pending = pendingRef.current;
    if (!pending) return;
    pendingRef.current = null;
    clearTimeout(timerRef.current);
    setPendingDelete(null);
    const request = pending.kind === 'clear'
      ? scratchpadAPI.clear(Math.max(...pending.ids), keepalive)
      : Promise.all(pending.ids.map((id) => scratchpadAPI.deleteEntry(id, keepalive)));
    request.catch((err) => {
      console.error('Error deleting scratchpad notes:', err);
      // Put the notes back so the screen matches the server.
      setEntries((cur) => restoreEntries(cur, pending.restore));
    });
  }, []);

  const startPending = useCallback((pending) => {
    commitPending();
    pendingRef.current = pending;
    setPendingDelete(pending);
    timerRef.current = setTimeout(() => commitPending(), UNDO_MS);
  }, [commitPending]);

  const undoDelete = useCallback(() => {
    const pending = pendingRef.current;
    if (!pending) return;
    pendingRef.current = null;
    clearTimeout(timerRef.current);
    setPendingDelete(null);
    setEntries((cur) => restoreEntries(cur, pending.restore));
  }, []);

  // Don't lose a delete because the tab closed during the undo window.
  useEffect(() => {
    const onPageHide = () => commitPending(true);
    window.addEventListener('pagehide', onPageHide);
    return () => window.removeEventListener('pagehide', onPageHide);
  }, [commitPending]);

  // Logging out / switching user: send any pending delete for the old user.
  useEffect(() => () => commitPending(true), [userId, commitPending]);

  // ── notes ─────────────────────────────────────────────────────────────────

  const addEntry = useCallback(async (content, sourceLabel = null) => {
    const text = String(content || '').trim();
    if (!text) return null;
    const label = sourceLabel ? sourceLabel.slice(0, 255) : null;
    try {
      const entry = await scratchpadAPI.addEntry(text, label);
      setEntries((cur) => [...cur, entry]);
      if (!openRef.current) setAddedPulse((n) => n + 1);
      return entry;
    } catch (err) {
      flashError(err.message || 'Failed to save note');
      return null;
    }
  }, [flashError]);

  const updateEntry = useCallback(async (id, content) => {
    const text = String(content || '').trim();
    if (!text) return false;
    const previous = entriesRef.current.find((e) => e.id === id);
    if (!previous) return false;
    setEntries((cur) => cur.map((e) => (e.id === id ? { ...e, content: text } : e)));
    try {
      const saved = await scratchpadAPI.updateEntry(id, text);
      setEntries((cur) => cur.map((e) => (e.id === id ? saved : e)));
      return true;
    } catch (err) {
      setEntries((cur) => cur.map((e) => (e.id === id ? previous : e)));
      flashError(err.message || 'Failed to update note');
      return false;
    }
  }, [flashError]);

  // Side effects stay out of state updaters (StrictMode runs those twice), so
  // read the current list from a ref.
  const deleteEntry = useCallback((id) => {
    const cur = entriesRef.current;
    const index = cur.findIndex((e) => e.id === id);
    if (index === -1) return;
    startPending({ kind: 'entry', ids: [id], restore: [{ entry: cur[index], index }] });
    setEntries((list) => list.filter((e) => e.id !== id));
  }, [startPending]);

  const clearAll = useCallback(() => {
    const cur = entriesRef.current;
    if (!cur.length) return;
    startPending({ kind: 'clear', ids: cur.map((e) => e.id), restore: cur.map((entry, index) => ({ entry, index })) });
    setEntries([]);
  }, [startPending]);

  // ── settings ──────────────────────────────────────────────────────────────

  const updateSettings = useCallback((partial) => {
    setSettings((cur) => ({ ...cur, ...partial }));
    scratchpadAPI.updateSettings(partial).catch((err) => {
      console.error('Error saving scratchpad settings:', err);
      flashError(err.message || 'Failed to save scratchpad settings');
    });
  }, [flashError]);

  return (
    <ScratchpadContext.Provider value={{
      entries, settings, loaded, error,
      open, setOpen,
      addEntry, updateEntry, deleteEntry, clearAll,
      pendingDelete, undoDelete,
      updateSettings,
      addedPulse,
    }}>
      {children}
    </ScratchpadContext.Provider>
  );
};

// Re-insert removed notes at their old positions (clamped, in order).
function restoreEntries(current, restore) {
  const next = [...current];
  [...restore].sort((a, b) => a.index - b.index).forEach(({ entry, index }) => {
    if (next.some((e) => e.id === entry.id)) return;
    next.splice(Math.min(index, next.length), 0, entry);
  });
  return next;
}

export const useScratchpad = () => {
  const ctx = useContext(ScratchpadContext);
  if (!ctx) throw new Error('useScratchpad must be used within ScratchpadProvider');
  return ctx;
};
