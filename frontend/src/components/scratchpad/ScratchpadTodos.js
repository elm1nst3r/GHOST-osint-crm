// File: frontend/src/components/scratchpad/ScratchpadTodos.js
// The active project's open dashboard to-dos, collapsible, so they can be
// ticked off without going back to the dashboard. Can be turned off in the
// scratchpad's own settings.

import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronDown, ChevronRight, ListTodo, ArrowUpRight } from 'lucide-react';
import { useData } from '../../contexts/DataContext';
import { useProject } from '../../contexts/ProjectContext';
import { useUI } from '../../contexts/UIContext';
import { todosAPI } from '../../utils/api';

const COLLAPSED_KEY = 'ghost_scratchpad_todos_collapsed';
const MAX_SHOWN = 8;
const CLOSED = ['done', 'cancelled'];

const ScratchpadTodos = ({ fontClass }) => {
  const { t } = useTranslation();
  const { todos, setTodos } = useData();
  const { activeProject } = useProject();
  const { setActiveSection } = useUI();
  const [collapsed, setCollapsed] = useState(() => {
    try { return localStorage.getItem(COLLAPSED_KEY) === 'true'; } catch { return false; }
  });

  if (!activeProject) return null;

  const open = todos.filter((todo) => !CLOSED.includes(todo.status));
  const shown = open.slice(0, MAX_SHOWN);

  const toggleCollapsed = () => {
    const next = !collapsed;
    setCollapsed(next);
    try { localStorage.setItem(COLLAPSED_KEY, String(next)); } catch { /* ignore */ }
  };

  const markDone = async (todo) => {
    setTodos((cur) => cur.map((x) => (x.id === todo.id ? { ...x, status: 'done' } : x)));
    try {
      // last_update_comment is always written by the API, so send it back
      // unchanged or it would be wiped.
      const saved = await todosAPI.update(todo.id, { status: 'done', last_update_comment: todo.last_update_comment ?? null });
      setTodos((cur) => cur.map((x) => (x.id === todo.id ? saved : x)));
    } catch (err) {
      console.error('Error updating todo:', err);
      setTodos((cur) => cur.map((x) => (x.id === todo.id ? todo : x)));
    }
  };

  const goToDashboard = () => setActiveSection('dashboard');

  return (
    <div className="mb-2">
      <button
        type="button"
        onClick={toggleCollapsed}
        className="w-full flex items-center gap-1.5 py-1 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
        aria-expanded={!collapsed}
      >
        {collapsed ? <ChevronRight className="rtl:-scale-x-100 w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        <ListTodo className="w-3.5 h-3.5" />
        <span className="truncate">{t('scratchpad.todos.title', { project: activeProject.name })}</span>
        <span className="ms-auto rounded-full px-1.5 bg-black/5 dark:bg-white/10 normal-case tracking-normal">{open.length}</span>
      </button>

      {!collapsed && (
        <div className="mt-1 space-y-0.5">
          {open.length === 0 && (
            <p className="text-xs text-slate-500 dark:text-slate-400 py-1 ps-5">{t('scratchpad.todos.none')}</p>
          )}
          {shown.map((todo) => (
            <div key={todo.id} className="flex items-start gap-2 ps-1 py-0.5">
              <input
                type="checkbox"
                checked={false}
                onChange={() => markDone(todo)}
                className="mt-1 flex-shrink-0 accent-[rgb(var(--accent))] cursor-pointer"
                title={t('scratchpad.todos.markDone')}
                aria-label={t('scratchpad.todos.markDone')}
              />
              <button
                type="button"
                onClick={goToDashboard}
                className={`text-start min-w-0 flex-1 break-words hover:underline ${fontClass}`}
                title={t('scratchpad.todos.openDashboard')}
              >
                {todo.text}
                {todo.status !== 'open' && (
                  <span className="ms-1.5 text-[10px] uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    {t(`scratchpad.todos.status.${todo.status}`, { defaultValue: todo.status })}
                  </span>
                )}
              </button>
            </div>
          ))}
          {open.length > MAX_SHOWN && (
            <button type="button" onClick={goToDashboard} className="ps-6 text-xs text-accent-primary hover:underline inline-flex items-center gap-1">
              {t('scratchpad.todos.more', { count: open.length - MAX_SHOWN })}
              <ArrowUpRight className="w-3 h-3" />
            </button>
          )}
        </div>
      )}
      <div className="border-b border-black/5 dark:border-white/10 mt-2" />
    </div>
  );
};

export default ScratchpadTodos;
