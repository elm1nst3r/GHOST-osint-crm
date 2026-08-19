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

  // Property modals (issue #43)
  const [selectedPropertyForDetail, setSelectedPropertyForDetail] = useState(null);
  const [editingProperty, setEditingProperty] = useState(null);
  const [showAddPropertyForm, setShowAddPropertyForm] = useState(false);

  // Asset modals
  const [selectedAssetForDetail, setSelectedAssetForDetail] = useState(null);
  const [editingAsset, setEditingAsset] = useState(null);
  const [showAddAssetForm, setShowAddAssetForm] = useState(false);

  // Crypto wallet modals (issue #82)
  const [selectedCryptoWalletForDetail, setSelectedCryptoWalletForDetail] = useState(null);
  const [editingCryptoWallet, setEditingCryptoWallet] = useState(null);
  const [showAddCryptoWalletForm, setShowAddCryptoWalletForm] = useState(false);

  // Transaction modals
  const [selectedTransactionForDetail, setSelectedTransactionForDetail] = useState(null);
  const [editingTransaction, setEditingTransaction] = useState(null);
  const [showAddTransactionForm, setShowAddTransactionForm] = useState(false);

  // Business detail modal (issue #43 — venue activity / ledger surface)
  const [selectedBusinessForDetail, setSelectedBusinessForDetail] = useState(null);

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
      selectedPropertyForDetail, setSelectedPropertyForDetail,
      editingProperty, setEditingProperty,
      showAddPropertyForm, setShowAddPropertyForm,
      selectedAssetForDetail, setSelectedAssetForDetail,
      editingAsset, setEditingAsset,
      showAddAssetForm, setShowAddAssetForm,
      selectedCryptoWalletForDetail, setSelectedCryptoWalletForDetail,
      editingCryptoWallet, setEditingCryptoWallet,
      showAddCryptoWalletForm, setShowAddCryptoWalletForm,
      selectedTransactionForDetail, setSelectedTransactionForDetail,
      editingTransaction, setEditingTransaction,
      showAddTransactionForm, setShowAddTransactionForm,
      selectedBusinessForDetail, setSelectedBusinessForDetail,
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
