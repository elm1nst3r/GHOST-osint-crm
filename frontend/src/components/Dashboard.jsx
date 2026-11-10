// File: frontend/src/components/Dashboard.jsx
import { useState, useEffect, useRef } from 'react';
import { connectionCount } from '../utils/connectionView';
import ReactDOM from 'react-dom';
import { useTranslation } from 'react-i18next';
import { Network, Trash2, Check, ChevronDown, FileText, Pencil } from 'lucide-react';
import RelationshipManager from './visualization/RelationshipManager';
import ReportGenerator from './ReportGenerator';
import { todosAPI } from '../utils/api';
import { useData } from '../contexts/DataContext';
import { useProject } from '../contexts/ProjectContext';
import { useUI } from '../contexts/UIContext';
import { useModules } from '../contexts/ModulesContext';
import { formatDate } from '../utils/format';

const Dashboard = () => {
  const { t } = useTranslation();
  const { isOn: moduleOn } = useModules();
  const { people, todos, setTodos } = useData();
  const { setSelectedPersonForDetail, setActiveSection } = useUI();
  const { activeProjectId } = useProject();
  // Show most recently updated people (up to 5)
  const activePeople = [...people]
    .sort((a, b) => {
      const dateA = new Date(a.updated_at || a.created_at || 0);
      const dateB = new Date(b.updated_at || b.created_at || 0);
      return dateB - dateA; // Most recent first
    })
    .slice(0, 5);

  const [newTodo, setNewTodo] = useState('');
  const [editingTodoId, setEditingTodoId] = useState(null);
  // To-do whose text is being changed in place (#109): { id, text }.
  const [editingText, setEditingText] = useState(null);
  const [dropdownPosition, setDropdownPosition] = useState(null);
  const [showReportGenerator, setShowReportGenerator] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setEditingTodoId(null);
        setDropdownPosition(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const getFullName = (person) => {
    return `${person.first_name || ''} ${person.last_name || ''}`.trim();
  };

  const getRelationshipCount = (personId) => {
    const person = people.find(p => p.id === personId);
    if (!person) return 0;
    
    // Connected people in either direction (#112).
    return connectionCount(person);
  };

  const handleAddTodo = async () => {
    if (!newTodo.trim()) return;
    if (!activeProjectId) { alert(t('dashboard.errorNoActiveProject')); return; }

    try {
      const todo = await todosAPI.create({ text: newTodo, status: 'open', project_id: activeProjectId });
      setTodos([todo, ...todos]);
      setNewTodo('');
    } catch (error) {
      console.error('Error adding todo:', error);
      alert(t('dashboard.errorAddTodo'));
    }
  };

  const handleUpdateTodo = async (id, updates) => {
    try {
      const updatedTodo = await todosAPI.update(id, updates);
      setTodos(todos.map(todo => todo.id === id ? updatedTodo : todo));
    } catch (error) {
      console.error('Error updating todo:', error);
      alert(t('dashboard.errorUpdateTodo'));
    }
  };

  const saveTodoText = async () => {
    const { id, text } = editingText;
    setEditingText(null);
    const todo = todos.find(td => td.id === id);
    if (!text.trim() || !todo || text.trim() === todo.text) return;
    await handleUpdateTodo(id, { text: text.trim() });
  };

  const handleDeleteTodo = async (id) => {
    try {
      await todosAPI.delete(id);
      setTodos(todos.filter(todo => todo.id !== id));
    } catch (error) {
      console.error('Error deleting todo:', error);
      alert(t('dashboard.errorDeleteTodo'));
    }
  };

  const getStatusStyle = (status) => {
    const styles = {
      'open': 'bg-gray-100 text-gray-700 dark:bg-slate-700 dark:text-gray-300',
      'in_progress': 'bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-400',
      'on_hold': 'bg-orange-50 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
      'attention': 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-400',
      'done': 'bg-green-700 text-white dark:bg-green-800',
      'cancelled': 'bg-gray-700 text-white dark:bg-slate-600'
    };
    return styles[status] || styles['open'];
  };

  const statusOptions = [
    { value: 'open', label: t('dashboard.todoStatus.open') },
    { value: 'in_progress', label: t('dashboard.todoStatus.inProgress') },
    { value: 'on_hold', label: t('dashboard.todoStatus.onHold') },
    { value: 'attention', label: t('dashboard.todoStatus.attention') },
    { value: 'done', label: t('dashboard.todoStatus.done') },
    { value: 'cancelled', label: t('dashboard.todoStatus.cancelled') }
  ];

  return (
    <div className="p-8 pb-32 space-y-6">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
        <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100">{t('dashboard.title')}</h1>
        <button
          onClick={() => setShowReportGenerator(true)}
          className="btn btn-primary"
        >
          <FileText className="w-4 h-4" />
          {t('dashboard.generateReport')}
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Active People */}
        <div className="glass-card p-5">
          <h3 className="text-xl font-semibold text-slate-900 dark:text-slate-100 mb-4">{t('dashboard.recentlyUpdatedPeople')}</h3>
          <div className="space-y-3">
            {activePeople.length === 0 ? (
              <div className="text-center py-8 text-slate-500 dark:text-slate-400">
                <p className="text-sm">{t('dashboard.noPeopleYet')}</p>
                <button
                  onClick={() => setActiveSection('people')}
                  className="btn btn-ghost mt-3"
                >
                  {t('dashboard.addFirstPerson')}
                </button>
              </div>
            ) : (
              activePeople.map(person => (
                <div key={person.id} className="flex items-center justify-between p-3 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors duration-150 group">
                  <div className="flex-1 min-w-0 me-4">
                    <p className="font-semibold text-slate-900 dark:text-slate-100">{getFullName(person)}</p>
                    <p className="text-sm text-slate-600 dark:text-slate-400">{person.case_name || t('dashboard.noCaseAssigned')}</p>
                    <div className="flex items-center mt-2 gap-x-3 text-xs text-slate-500 dark:text-slate-400">
                      <div className="flex items-center">
                        <Network className="w-3 h-3 me-1 text-blue-600 dark:text-blue-400" />
                        {t('dashboard.connectionsCount', { count: getRelationshipCount(person.id) })}
                      </div>
                      {person.updated_at && (
                        <div className="flex items-center">
                          <span>{t('dashboard.updatedOn', { date: formatDate(person.updated_at) })}</span>
                        </div>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => setSelectedPersonForDetail(person)}
                    className="btn btn-ghost shrink-0"
                  >
                    {t('dashboard.viewDetails')}
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        {/* To-Do List */}
        <div className="glass-card p-5">
          <h3 className="text-xl font-semibold text-slate-900 dark:text-slate-100 mb-4">{t('dashboard.todoList')}</h3>
          <div className="mb-4 flex gap-x-3">
            <input
              type="text"
              value={newTodo}
              onChange={(e) => setNewTodo(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleAddTodo()}
              placeholder={t('dashboard.todoPlaceholder')}
              className="input-base flex-1"
            />
            <button
              onClick={handleAddTodo}
              className="btn btn-primary"
            >
              {t('common.add')}
            </button>
          </div>
          <div className="space-y-2 max-h-96 overflow-y-auto pe-2">
            {todos.length === 0 ? (
              <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                <p className="text-sm">{t('dashboard.noTasksYet')}</p>
              </div>
            ) : (
              todos.map(todo => (
                <div key={todo.id} className="flex items-center gap-x-3 p-3 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors duration-150 group">
                  <div
                    onClick={() => handleUpdateTodo(todo.id, { status: todo.status === 'done' ? 'open' : 'done' })}
                    className={`w-5 h-5 rounded flex items-center justify-center shrink-0 cursor-pointer hover:opacity-80 transition-opacity ${
                      todo.status === 'done' || todo.status === 'cancelled' ? getStatusStyle(todo.status) : 'border-2 border-slate-300 dark:border-slate-600'
                    }`}
                  >
                    {(todo.status === 'done' || todo.status === 'cancelled') && (
                      <Check className="w-3 h-3" />
                    )}
                  </div>
                  {editingText?.id === todo.id ? (
                    <input
                      autoFocus
                      value={editingText.text}
                      onChange={e => setEditingText({ ...editingText, text: e.target.value })}
                      onKeyDown={e => {
                        // Leaving the field saves (onBlur), so Enter just leaves it.
                        if (e.key === 'Enter') { e.preventDefault(); e.currentTarget.blur(); }
                        if (e.key === 'Escape') setEditingText(null);
                      }}
                      onBlur={saveTodoText}
                      aria-label={t('dashboard.editTask')}
                      className="flex-1 min-w-0 px-2 py-1 -my-1 border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                    />
                  ) : (
                    <span
                      onDoubleClick={() => setEditingText({ id: todo.id, text: todo.text })}
                      className={`flex-1 min-w-0 wrap-break-word ${
                        (todo.status === 'done' || todo.status === 'cancelled') ? 'line-through text-slate-500 dark:text-slate-400' : 'text-slate-900 dark:text-slate-100'
                      }`}
                    >
                      {todo.text}
                    </span>
                  )}

                  {/* Status Dropdown */}
                  <div className="relative shrink-0">
                    <button
                      onClick={(e) => {
                        const newId = editingTodoId === todo.id ? null : todo.id;
                        if (newId) {
                          const rect = e.currentTarget.getBoundingClientRect();
                          const rtl = document.documentElement.dir === 'rtl';
                          setDropdownPosition({
                            top: rect.bottom + window.scrollY,
                            // Align the menu with the button's end edge
                            left: (rtl ? rect.left : rect.right - 192) + window.scrollX,
                            width: 192
                          });
                        } else {
                          setDropdownPosition(null);
                        }
                        setEditingTodoId(newId);
                      }}
                      className={`px-3 py-1.5 rounded-md text-xs font-medium flex items-center gap-x-1 transition-opacity duration-150 ${getStatusStyle(todo.status)} hover:opacity-80`}
                      title={t('dashboard.changeStatus')}
                    >
                      <span className="hidden sm:inline">{statusOptions.find(s => s.value === todo.status)?.label || t('dashboard.todoStatus.open')}</span>
                      <span className="sm:hidden">{statusOptions.find(s => s.value === todo.status)?.label.substring(0, 3) || t('dashboard.todoStatus.openShort')}</span>
                      <ChevronDown className="w-3 h-3" />
                    </button>

                    {editingTodoId === todo.id && dropdownPosition && ReactDOM.createPortal(
                      <div
                        ref={dropdownRef}
                        style={{ position: 'absolute', top: dropdownPosition.top, left: dropdownPosition.left, width: dropdownPosition.width }}
                        className="mt-1 bg-white dark:bg-slate-800 rounded-lg shadow-xl z-50 border border-gray-200 dark:border-gray-600 overflow-hidden"
                      >
                        {statusOptions.map(option => (
                          <button
                            key={option.value}
                            onClick={() => {
                              handleUpdateTodo(todo.id, { status: option.value });
                              setEditingTodoId(null);
                              setDropdownPosition(null);
                            }}
                            className={`w-full text-start px-4 py-2.5 text-sm hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center dark:text-slate-200 transition-colors duration-100 ${
                              todo.status === option.value ? 'font-medium bg-slate-50 dark:bg-slate-700' : ''
                            }`}
                          >
                            <div className={`inline-block w-3 h-3 rounded-sm me-2 shrink-0 ${getStatusStyle(option.value)}`} />
                            {option.label}
                          </button>
                        ))}
                      </div>,
                      document.body
                    )}
                  </div>

                  <button
                    onClick={() => setEditingText({ id: todo.id, text: todo.text })}
                    className="text-slate-500 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 reveal-on-hover transition-opacity duration-150 shrink-0"
                    title={t('dashboard.editTask')}
                    aria-label={t('dashboard.editTask')}
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDeleteTodo(todo.id)}
                    className="text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 reveal-on-hover transition-opacity duration-150 shrink-0"
                    title={t('dashboard.deleteTask')}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Global Relationship Overview (part of the Entity Network module) */}
      {moduleOn('relationships') && (
      <div className="glass-card overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-700">
          <h3 className="text-xl font-semibold text-slate-900 dark:text-slate-100">{t('dashboard.globalRelationshipOverview')}</h3>
          <button
            onClick={() => setActiveSection('relationships')}
            className="btn btn-ghost"
          >
            {t('dashboard.viewFullNetwork')}
          </button>
        </div>
        <div className="h-96" style={{ minHeight: '384px' }}>
          {/* Embedded in the dashboard, not a modal — showInModal={true} hid the
              fullscreen button and instead showed a Close button wired to a
              no-op handler, so the only visible control did nothing (#79). */}
          <RelationshipManager showInModal={false} />
        </div>
      </div>
      )}

      {/* Report Generator Modal */}
      {showReportGenerator && (
        <ReportGenerator 
          onClose={() => setShowReportGenerator(false)}
        />
      )}
    </div>
  );
};

export default Dashboard;