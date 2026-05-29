// File: frontend/src/components/BusinessList.js
import React, { useState } from 'react';
import { Building2, Search, Plus, Edit2, Trash2, Users, MapPin, Phone, Mail, Globe, User } from 'lucide-react';
import { businessAPI } from '../utils/api';
import { useData } from '../contexts/DataContext';
import { useUI } from '../contexts/UIContext';

const BusinessList = () => {
  const { businesses, fetchBusinesses } = useData();
  const { setShowAddBusinessForm, setEditingBusiness } = useUI();
  const [searchTerm, setSearchTerm] = useState('');
  const [filterIndustry, setFilterIndustry] = useState('');
  const [filterStatus, setFilterStatus] = useState('');

  const filteredBusinesses = businesses.filter(business => {
    const matchesSearch = searchTerm === '' || 
      business.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (business.owner_first_name && business.owner_last_name && 
        `${business.owner_first_name} ${business.owner_last_name}`.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (business.city && business.city.toLowerCase().includes(searchTerm.toLowerCase()));
    
    const matchesIndustry = filterIndustry === '' || business.industry === filterIndustry;
    const matchesStatus = filterStatus === '' || business.status === filterStatus;
    
    return matchesSearch && matchesIndustry && matchesStatus;
  });

  const handleDelete = async (id) => {
    if (window.confirm('Are you sure you want to delete this business?')) {
      try {
        await businessAPI.delete(id);
        fetchBusinesses();
      } catch (error) {
        console.error('Error deleting business:', error);
        alert('Failed to delete business');
      }
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'active': return 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-400';
      case 'inactive': return 'bg-gray-100 dark:bg-slate-700 text-gray-800 dark:text-slate-200';
      case 'dissolved': return 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-400';
      default: return 'bg-gray-100 dark:bg-slate-700 text-gray-800 dark:text-slate-200';
    }
  };

  const uniqueIndustries = [...new Set(businesses.map(b => b.industry).filter(Boolean))];

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-slate-100">Business Management</h1>
          <p className="text-sm text-gray-600 dark:text-slate-400 mt-1 flex items-center">
            <Building2 className="w-4 h-4 mr-1" />
            {filteredBusinesses.length === businesses.length ? (
              <span>{businesses.length} businesses</span>
            ) : (
              <span>{filteredBusinesses.length} of {businesses.length} businesses</span>
            )}
          </p>
        </div>
        <button
          onClick={() => setShowAddBusinessForm(true)}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 flex items-center"
        >
          <Plus className="w-4 h-4 mr-2" />
          Add Business
        </button>
      </div>

      {/* Search and Filters */}
      <div className="mb-6 space-y-4">
        <div className="flex space-x-4">
          <div className="flex-1 max-w-md">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 dark:text-slate-500 w-5 h-5" />
              <input
                type="text"
                placeholder="Search by name, owner, or city..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
          <select
            value={filterIndustry}
            onChange={(e) => setFilterIndustry(e.target.value)}
            className="px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All Industries</option>
            {uniqueIndustries.map(industry => (
              <option key={industry} value={industry}>{industry}</option>
            ))}
          </select>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All Statuses</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
            <option value="dissolved">Dissolved</option>
          </select>
        </div>
      </div>

      {/* Business Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredBusinesses.map(business => (
          <div key={business.id} className="bg-white dark:bg-slate-800 rounded-lg shadow-sm p-6 border hover:shadow-md transition-shadow">
            <div className="flex justify-between items-start mb-4">
              <div className="flex items-center space-x-3">
                <div className="w-12 h-12 rounded-lg bg-green-100 flex items-center justify-center">
                  <Building2 className="w-6 h-6 text-green-600" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-slate-100">{business.name}</h3>
                  {business.type && (
                    <p className="text-sm text-gray-500 dark:text-gray-400">{business.type}</p>
                  )}
                </div>
              </div>
              <div className="flex space-x-1">
                <button
                  onClick={() => setEditingBusiness(business)}
                  className="text-gray-600 dark:text-slate-400 hover:text-gray-700"
                  title="Edit"
                >
                  <Edit2 className="w-4 h-4" />
                </button>
                <button
                  onClick={() => handleDelete(business.id)}
                  className="text-red-600 hover:text-red-700"
                  title="Delete"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
            
            <div className="space-y-2">
              {business.industry && (
                <div className="flex items-center text-sm">
                  <Building2 className="w-4 h-4 mr-2 text-gray-400 dark:text-slate-500" />
                  <span className="text-gray-600 dark:text-gray-400">{business.industry}</span>
                </div>
              )}
              
              {(business.owner_first_name || business.owner_last_name) && (
                <div className="flex items-center text-sm">
                  <User className="w-4 h-4 mr-2 text-gray-400 dark:text-slate-500" />
                  <span className="text-gray-600 dark:text-gray-400">
                    Owner: {business.owner_first_name} {business.owner_last_name}
                  </span>
                </div>
              )}
              
              {business.city && (
                <div className="flex items-center text-sm">
                  <MapPin className="w-4 h-4 mr-2 text-gray-400 dark:text-slate-500" />
                  <span className="text-gray-600 dark:text-gray-400">
                    {[business.city, business.state, business.country]
                      .filter(Boolean)
                      .join(', ')}
                  </span>
                </div>
              )}
              
              {business.employee_count > 0 && (
                <div className="flex items-center text-sm">
                  <Users className="w-4 h-4 mr-2 text-gray-400 dark:text-slate-500" />
                  <span className="text-gray-600 dark:text-gray-400">{business.employee_count} employees</span>
                </div>
              )}
              
              <div className="flex items-center space-x-3 text-sm">
                {business.phone && (
                  <a href={`tel:${business.phone}`} className="text-blue-600 hover:text-blue-700">
                    <Phone className="w-4 h-4" />
                  </a>
                )}
                {business.email && (
                  <a href={`mailto:${business.email}`} className="text-blue-600 hover:text-blue-700">
                    <Mail className="w-4 h-4" />
                  </a>
                )}
                {business.website && (
                  <a href={business.website} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-700">
                    <Globe className="w-4 h-4" />
                  </a>
                )}
              </div>
            </div>
            
            {business.status && (
              <div className="mt-4">
                <span className={`inline-block px-2 py-1 text-xs rounded-full ${getStatusColor(business.status)}`}>
                  {business.status.charAt(0).toUpperCase() + business.status.slice(1)}
                </span>
              </div>
            )}
          </div>
        ))}
      </div>

      {filteredBusinesses.length === 0 && (
        <div className="text-center py-12">
          <p className="text-gray-500 dark:text-gray-400">No businesses found matching your search criteria.</p>
        </div>
      )}
    </div>
  );
};

export default BusinessList;