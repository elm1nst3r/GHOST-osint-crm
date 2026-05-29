import React, { createContext, useContext, useState } from 'react';

const UIContext = createContext(null);

export const UIProvider = ({ children }) => {
  const [activeSection, setActiveSection] = useState('dashboard');

  // Person modals
  const [selectedPersonForDetail, setSelectedPersonForDetail] = useState(null);
  const [editingPerson, setEditingPerson] = useState(null);
  const [showAddPersonForm, setShowAddPersonForm] = useState(false);

  // Tool modals
  const [editingTool, setEditingTool] = useState(null);
  const [showAddToolForm, setShowAddToolForm] = useState(false);

  // Business modals
  const [editingBusiness, setEditingBusiness] = useState(null);
  const [showAddBusinessForm, setShowAddBusinessForm] = useState(false);

  // Other modals
  const [showAdvancedSearch, setShowAdvancedSearch] = useState(false);

  return (
    <UIContext.Provider value={{
      activeSection, setActiveSection,
      selectedPersonForDetail, setSelectedPersonForDetail,
      editingPerson, setEditingPerson,
      showAddPersonForm, setShowAddPersonForm,
      editingTool, setEditingTool,
      showAddToolForm, setShowAddToolForm,
      editingBusiness, setEditingBusiness,
      showAddBusinessForm, setShowAddBusinessForm,
      showAdvancedSearch, setShowAdvancedSearch,
    }}>
      {children}
    </UIContext.Provider>
  );
};

export const useUI = () => {
  const ctx = useContext(UIContext);
  if (!ctx) throw new Error('useUI must be used within UIProvider');
  return ctx;
};
