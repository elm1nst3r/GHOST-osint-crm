// File: frontend/src/components/Dashboard.js
import React, { useState, useEffect, useRef } from 'react';
import { Network, Trash2, Check, ChevronDown, FileText } from 'lucide-react';
import RelationshipManager from './visualization/RelationshipManager';
import ReportGenerator from './ReportGenerator';
import { todosAPI } from '../utils/api';

const Dashboard = ({ people, tools, todos, setTodos, setSelectedPersonForDetail, setActiveSection }) => {
  const activePeople = people.filter(p => p.status === 'Open' || p.status === 'Being Investigated').slice(0, 5);
  const [newTodo, setNewTodo] = useState('');
  const [editingTodoId, setEditingTodoId] = useState(null);
  const [showReportGenerator, setShowReportGenerator] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setEditingTodoId(null);
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
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold bg-gradient-to-r from-gray-900 to-gray-600 dark:from-gray-100 dark:to-gray-300 bg-clip-text text-transparent">Dashboard</h1>
        <button
          onClick={() => setShowReportGenerator(true)}
          className="px-6 py-3 bg-gradient-primary text-white rounded-glass hover:shadow-glow-md transition-all duration-300 flex items-center group"
        >
          <FileText className="w-5 h-5 mr-2 group-hover:animate-pulse" />
          Generate Report
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Active People */}
        <div className="glass-card backdrop-blur-xl border border-white/30 shadow-glass-lg rounded-glass-lg p-6 hover:shadow-glass-xl transition-all duration-300">
          <h3 className="text-xl font-semibold bg-gradient-to-r from-gray-900 to-gray-600 dark:from-gray-100 dark:to-gray-300 bg-clip-text text-transparent mb-4">Recent Active People/Cases</h3>
          <div className="space-y-3">
            {activePeople.map(person => (
              <div key={person.id} className="flex items-center justify-between p-4 glass rounded-glass-lg hover:glass-heavy transition-all duration-300 group">
                <div>
                  <p className="font-semibold text-gray-900 dark:text-gray-100">{getFullName(person)}</p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">{person.case_name || 'No case assigned'}</p>
                  <div className="flex items-center mt-2 text-xs text-gray-500 dark:text-gray-400">
                    <Network className="w-4 h-4 mr-1 text-accent-primary" />
                    {getRelationshipCount(person.id)} connections
                  </div>
                </div>
                <button 
                  onClick={() => setSelectedPersonForDetail(person)} 
                  className="px-3 py-2 text-accent-primary dark:text-blue-400 hover:bg-gradient-primary hover:text-white dark:hover:bg-blue-400 dark:hover:text-white rounded-glass transition-all duration-300 text-sm font-medium group-hover:shadow-glow-sm"
                >
                  View Details
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* To-Do List */}
        <div className="glass-card backdrop-blur-xl border border-white/30 shadow-glass-lg rounded-glass-lg p-6 hover:shadow-glass-xl transition-all duration-300">
          <h3 className="text-xl font-semibold bg-gradient-to-r from-gray-900 to-gray-600 dark:from-gray-100 dark:to-gray-300 bg-clip-text text-transparent mb-4">To-Do List</h3>
          <div className="mb-4 flex space-x-3">
            <input
              type="text"
              value={newTodo}
              onChange={(e) => setNewTodo(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleAddTodo()}
              placeholder="Add a new task..."
              className="flex-1 px-4 py-3 glass border border-white/30 rounded-glass focus:outline-none focus:border-accent-primary focus:shadow-glow-sm transition-all duration-300 dark:text-gray-100 dark:bg-slate-800 dark:placeholder-gray-600"
            />
            <button 
              onClick={handleAddTodo} 
              className="px-6 py-3 bg-gradient-primary text-white rounded-glass hover:shadow-glow-md transition-all duration-300 font-medium"
            >
              Add
            </button>
          </div>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {todos.map(todo => (
              <div key={todo.id} className="flex items-center space-x-3 p-3 glass rounded-glass hover:glass-heavy transition-all duration-300 group">
                <div className={`w-5 h-5 rounded flex items-center justify-center flex-shrink-0 ${
                  todo.status === 'done' || todo.status === 'cancelled' ? getStatusStyle(todo.status) : 'border-2 border-gray-300'
                }`}>
                  {(todo.status === 'done' || todo.status === 'cancelled') && (
                    <Check className="w-3 h-3" />
                  )}
                </div>
                <span className={`flex-1 min-w-0 ${
                  (todo.status === 'done' || todo.status === 'cancelled') ? 'line-through text-gray-500 dark:text-gray-400' : 'text-gray-900 dark:text-gray-100'
                }`}>
                  {todo.text}
                </span>
                
                {/* Status Dropdown */}
                <div className="relative flex-shrink-0" ref={editingTodoId === todo.id ? dropdownRef : null}>
                  <button
                    onClick={() => setEditingTodoId(editingTodoId === todo.id ? null : todo.id)}
                    className={`px-2 py-1 rounded-md text-xs font-medium flex items-center space-x-1 ${getStatusStyle(todo.status)}`}
                  >
                    <span className="hidden sm:inline">{statusOptions.find(s => s.value === todo.status)?.label || 'Open'}</span>
                    <span className="sm:hidden">{statusOptions.find(s => s.value === todo.status)?.label.substring(0, 3) || 'Opn'}</span>
                    <ChevronDown className="w-3 h-3" />
                  </button>
                  
                  {editingTodoId === todo.id && (
                    <div className="absolute right-0 mt-1 w-48 bg-white dark:bg-slate-800 rounded-md shadow-lg z-50 border dark:border-white/30">
                      {statusOptions.map(option => (
                        <button
                          key={option.value}
                          onClick={() => {
                            handleUpdateTodo(todo.id, { status: option.value });
                            setEditingTodoId(null);
                          }}
                          className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-slate-700 flex items-center dark:text-gray-200 ${
                            todo.status === option.value ? 'font-medium bg-gray-50 dark:bg-slate-700' : ''
                          }`}
                        >
                          <div className={`inline-block w-3 h-3 rounded mr-2 flex-shrink-0 ${getStatusStyle(option.value)}`} />
                          {option.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                
                <button 
                  onClick={() => handleDeleteTodo(todo.id)} 
                  className="text-red-600 hover:text-red-700 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Global Relationship Overview */}
      <div className="glass-card backdrop-blur-xl border border-white/30 shadow-glass-lg rounded-glass-lg p-6 hover:shadow-glass-xl transition-all duration-300">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-semibold bg-gradient-to-r from-gray-900 to-gray-600 dark:from-gray-100 dark:to-gray-300 bg-clip-text text-transparent">Global Relationship Overview</h3>
          <button
            onClick={() => setActiveSection('relationships')}
            className="px-4 py-2 text-accent-primary hover:bg-gradient-primary hover:text-white rounded-glass transition-all duration-300 font-medium hover:shadow-glow-sm"
          >
            View Full Network →
          </button>
        </div>
        <div className="h-96 bg-white dark:bg-slate-800 rounded-lg overflow-hidden border border-gray-200 dark:border-white/30 shadow-lg" style={{ minHeight: '384px' }}>
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