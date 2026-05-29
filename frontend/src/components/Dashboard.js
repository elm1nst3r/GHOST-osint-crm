// File: frontend/src/components/Dashboard.js
import React, { useState, useEffect, useRef } from 'react';
import ReactDOM from 'react-dom';
import { Network, Trash2, Check, ChevronDown, FileText } from 'lucide-react';
import RelationshipManager from './visualization/RelationshipManager';
import ReportGenerator from './ReportGenerator';
import { todosAPI } from '../utils/api';
import { useData } from '../contexts/DataContext';
import { useUI } from '../contexts/UIContext';

const Dashboard = () => {
  const { people, tools, todos, setTodos } = useData();
  const { setSelectedPersonForDetail, setActiveSection } = useUI();
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
    
    const directConnections = person.connections?.length || 0;
    const reverseConnections = people.filter(p => 
      p.connections?.some(c => c.person_id === personId)
    ).length;
    
    return Math.max(directConnections, reverseConnections);
  };

  const handleAddTodo = async () => {
    if (!newTodo.trim()) return;

    try {
      const todo = await todosAPI.create({ text: newTodo, status: 'open' });
      setTodos([todo, ...todos]);
      setNewTodo('');
    } catch (error) {
      console.error('Error adding todo:', error);
      alert('Failed to add todo');
    }
  };

  const handleUpdateTodo = async (id, updates) => {
    try {
      const updatedTodo = await todosAPI.update(id, updates);
      setTodos(todos.map(todo => todo.id === id ? updatedTodo : todo));
    } catch (error) {
      console.error('Error updating todo:', error);
      alert('Failed to update todo');
    }
  };

  const handleDeleteTodo = async (id) => {
    try {
      await todosAPI.delete(id);
      setTodos(todos.filter(todo => todo.id !== id));
    } catch (error) {
      console.error('Error deleting todo:', error);
      alert('Failed to delete todo');
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
    { value: 'open', label: 'Open' },
    { value: 'in_progress', label: 'In Progress' },
    { value: 'on_hold', label: 'On Hold' },
    { value: 'attention', label: 'Attention / Issue' },
    { value: 'done', label: 'Done' },
    { value: 'cancelled', label: 'Cancelled' }
  ];

  return (
    <div className="p-8 pb-32 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100">Dashboard</h1>
        <button
          onClick={() => setShowReportGenerator(true)}
          className="px-6 py-3 bg-blue-600 text-white dark:bg-blue-500 rounded-lg hover:shadow-glow-md transition-[box-shadow] duration-150 flex items-center group active:scale-[0.97]"
        >
          <FileText className="w-5 h-5 mr-2 group-hover:animate-pulse" />
          Generate Report
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Active People */}
        <div className="bg-white dark:bg-slate-800 backdrop-blur-xl border border-slate-200 dark:border-slate-700 shadow-sm rounded-lg p-5 hover:shadow-md transition-shadow duration-150">
          <h3 className="text-xl font-semibold text-slate-900 dark:text-slate-100 mb-4">Recently Updated People</h3>
          <div className="space-y-3">
            {activePeople.length === 0 ? (
              <div className="text-center py-8 text-slate-500 dark:text-slate-400">
                <p className="text-sm">No people added yet.</p>
                <button
                  onClick={() => setActiveSection('people')}
                  className="mt-3 px-4 py-2 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-slate-700 rounded-lg transition-colors duration-150 text-sm font-medium"
                >
                  Add Your First Person →
                </button>
              </div>
            ) : (
              activePeople.map(person => (
                <div key={person.id} className="flex items-center justify-between p-3 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors duration-150 group">
                  <div className="flex-1 min-w-0 mr-4">
                    <p className="font-semibold text-slate-900 dark:text-slate-100">{getFullName(person)}</p>
                    <p className="text-sm text-slate-600 dark:text-slate-400">{person.case_name || 'No case assigned'}</p>
                    <div className="flex items-center mt-2 space-x-3 text-xs text-slate-500 dark:text-slate-400">
                      <div className="flex items-center">
                        <Network className="w-3 h-3 mr-1 text-blue-600 dark:text-blue-400" />
                        {getRelationshipCount(person.id)} connections
                      </div>
                      {person.updated_at && (
                        <div className="flex items-center">
                          <span>Updated {new Date(person.updated_at).toLocaleDateString()}</span>
                        </div>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => setSelectedPersonForDetail(person)}
                    className="px-3 py-2 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-slate-600 rounded-lg transition-colors duration-150 text-sm font-medium flex-shrink-0 active:scale-[0.97]"
                  >
                    View Details
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        {/* To-Do List */}
        <div className="bg-white dark:bg-slate-800 backdrop-blur-xl border border-slate-200 dark:border-slate-700 shadow-sm rounded-lg p-5 hover:shadow-md transition-shadow duration-150">
          <h3 className="text-xl font-semibold text-slate-900 dark:text-slate-100 mb-4">To-Do List</h3>
          <div className="mb-4 flex space-x-3">
            <input
              type="text"
              value={newTodo}
              onChange={(e) => setNewTodo(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleAddTodo()}
              placeholder="Add a new task..."
              className="flex-1 px-4 py-3 glass border border-slate-300 dark:border-slate-600 rounded-lg focus:outline-none focus:border-accent-primary focus:shadow-md dark:text-slate-100 dark:bg-slate-700 dark:placeholder-slate-500"
            />
            <button
              onClick={handleAddTodo}
              className="px-6 py-3 bg-blue-600 text-white dark:bg-blue-500 rounded-lg hover:shadow-glow-md transition-[box-shadow] duration-150 font-medium active:scale-[0.97]"
            >
              Add
            </button>
          </div>
          <div className="space-y-2 max-h-96 overflow-y-auto pr-2">
            {todos.length === 0 ? (
              <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                <p className="text-sm">No tasks yet. Add one above to get started!</p>
              </div>
            ) : (
              todos.map(todo => (
                <div key={todo.id} className="flex items-center space-x-3 p-3 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors duration-150 group">
                  <div
                    onClick={() => handleUpdateTodo(todo.id, { status: todo.status === 'done' ? 'open' : 'done' })}
                    className={`w-5 h-5 rounded flex items-center justify-center flex-shrink-0 cursor-pointer hover:opacity-80 transition-opacity ${
                      todo.status === 'done' || todo.status === 'cancelled' ? getStatusStyle(todo.status) : 'border-2 border-slate-300 dark:border-slate-600'
                    }`}
                  >
                    {(todo.status === 'done' || todo.status === 'cancelled') && (
                      <Check className="w-3 h-3" />
                    )}
                  </div>
                  <span className={`flex-1 min-w-0 break-words ${
                    (todo.status === 'done' || todo.status === 'cancelled') ? 'line-through text-slate-500 dark:text-slate-400' : 'text-slate-900 dark:text-slate-100'
                  }`}>
                    {todo.text}
                  </span>

                  {/* Status Dropdown */}
                  <div className="relative flex-shrink-0">
                    <button
                      onClick={(e) => {
                        const newId = editingTodoId === todo.id ? null : todo.id;
                        if (newId) {
                          const rect = e.currentTarget.getBoundingClientRect();
                          setDropdownPosition({
                            top: rect.bottom + window.scrollY,
                            left: rect.right + window.scrollX - 192,
                            width: 192
                          });
                        } else {
                          setDropdownPosition(null);
                        }
                        setEditingTodoId(newId);
                      }}
                      className={`px-3 py-1.5 rounded-md text-xs font-medium flex items-center space-x-1 transition-opacity duration-150 ${getStatusStyle(todo.status)} hover:opacity-80`}
                      title="Change status"
                    >
                      <span className="hidden sm:inline">{statusOptions.find(s => s.value === todo.status)?.label || 'Open'}</span>
                      <span className="sm:hidden">{statusOptions.find(s => s.value === todo.status)?.label.substring(0, 3) || 'Opn'}</span>
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
                            className={`w-full text-left px-4 py-2.5 text-sm hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center dark:text-slate-200 transition-colors duration-100 ${
                              todo.status === option.value ? 'font-medium bg-slate-50 dark:bg-slate-700' : ''
                            }`}
                          >
                            <div className={`inline-block w-3 h-3 rounded mr-2 flex-shrink-0 ${getStatusStyle(option.value)}`} />
                            {option.label}
                          </button>
                        ))}
                      </div>,
                      document.body
                    )}
                  </div>

                  <button
                    onClick={() => handleDeleteTodo(todo.id)}
                    className="text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 opacity-0 group-hover:opacity-100 transition-opacity duration-150 flex-shrink-0"
                    title="Delete task"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Global Relationship Overview */}
      <div className="bg-white dark:bg-slate-800 backdrop-blur-xl border border-slate-200 dark:border-slate-700 shadow-glass-lg rounded-lg overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-700">
          <h3 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Global Relationship Overview</h3>
          <button
            onClick={() => setActiveSection('relationships')}
            className="px-4 py-2 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-slate-700 rounded-lg transition-colors duration-150 font-medium active:scale-[0.97]"
          >
            View Full Network →
          </button>
        </div>
        <div className="h-96" style={{ minHeight: '384px' }}>
          <RelationshipManager
            showInModal={true}
            onClose={() => {}}
          />
        </div>
      </div>

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