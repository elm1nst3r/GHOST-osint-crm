// File: frontend/src/components/Dashboard.js
import React, { useState } from 'react';
import { Wrench, Users, Activity, Network, Trash2 } from 'lucide-react';
import RelationshipManager from './visualization/RelationshipManager';
import { todosAPI } from '../utils/api';

const Dashboard = ({ people, tools, todos, setTodos, setSelectedPersonForDetail, setActiveSection }) => {
  const activePeople = people.filter(p => p.status === 'Open' || p.status === 'Being Investigated').slice(0, 5);
  const [newTodo, setNewTodo] = useState('');

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

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
      
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-lg shadow-sm p-6 border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">OSINT Tools</p>
              <p className="text-3xl font-bold text-gray-900">{tools.length}</p>
            </div>
            <Wrench className="w-8 h-8 text-blue-500" />
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow-sm p-6 border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Active Investigations</p>
              <p className="text-3xl font-bold text-gray-900">
                {people.filter(p => p.status === 'Open' || p.status === 'Being Investigated').length}
              </p>
            </div>
            <Users className="w-8 h-8 text-green-500" />
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow-sm p-6 border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Open To-Dos</p>
              <p className="text-3xl font-bold text-gray-900">
                {todos.filter(t => t.status === 'open').length}
              </p>
            </div>
            <Activity className="w-8 h-8 text-yellow-500" />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Active People */}
        <div className="bg-white rounded-lg shadow-sm p-6 border">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Active People/Cases</h3>
          <div className="space-y-3">
            {activePeople.map(person => (
              <div key={person.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div>
                  <p className="font-medium text-gray-900">{person.name}</p>
                  <p className="text-sm text-gray-600">{person.case_name || 'No case assigned'}</p>
                  <div className="flex items-center mt-1 text-xs text-gray-500">
                    <Network className="w-3 h-3 mr-1" />
                    {getRelationshipCount(person.id)} connections
                  </div>
                </div>
                <button 
                  onClick={() => setSelectedPersonForDetail(person)} 
                  className="text-blue-600 hover:text-blue-700 text-sm"
                >
                  View Details
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* To-Do List */}
        <div className="bg-white rounded-lg shadow-sm p-6 border">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">To-Do List</h3>
          <div className="mb-4 flex space-x-2">
            <input
              type="text"
              value={newTodo}
              onChange={(e) => setNewTodo(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleAddTodo()}
              placeholder="Add a new task..."
              className="flex-1 px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button 
              onClick={handleAddTodo} 
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
            >
              Add
            </button>
          </div>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {todos.map(todo => (
              <div key={todo.id} className="flex items-center space-x-2 p-2 hover:bg-gray-50 rounded">
                <input
                  type="checkbox"
                  checked={todo.status === 'done'}
                  onChange={(e) => handleUpdateTodo(todo.id, { status: e.target.checked ? 'done' : 'open' })}
                  className="h-4 w-4 text-blue-600 rounded"
                />
                <span className={`flex-1 ${todo.status === 'done' ? 'line-through text-gray-500' : 'text-gray-900'}`}>
                  {todo.text}
                </span>
                <button 
                  onClick={() => handleDeleteTodo(todo.id)} 
                  className="text-red-600 hover:text-red-700"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Global Relationship Overview */}
      <div className="bg-white rounded-lg shadow-sm p-6 border">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Global Relationship Overview</h3>
          <button
            onClick={() => setActiveSection('relationships')}
            className="text-sm text-blue-600 hover:text-blue-700"
          >
            View Full Network →
          </button>
        </div>
        <div className="h-64 bg-gray-50 rounded-lg overflow-hidden">
          <RelationshipManager 
            showInModal={true}
            onClose={() => {}}
          />
        </div>
      </div>
    </div>
  );
};

export default Dashboard;