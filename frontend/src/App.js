// File: frontend/src/App.js
import React, { useEffect, useRef, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { BrowserRouter, useNavigate, useLocation } from 'react-router-dom';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'reactflow/dist/style.css';
import { Home, Users, Wrench, Network, Settings, Shield, Map, Folder, Search, Building2, Wifi, LogOut, Landmark, Package, Receipt } from 'lucide-react';

import { peopleAPI, businessAPI } from './utils/api';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { DataProvider, useData } from './contexts/DataContext';
import { UIProvider, useUI } from './contexts/UIContext';
import { ThemeProvider } from './contexts/ThemeContext';

import Dashboard from './components/Dashboard';
import CaseManagement from './components/CaseManagement';
import PeopleList from './components/PeopleList';
import PersonDetailModal from './components/PersonDetailModal';
import AddEditPersonForm from './components/AddEditPersonForm';
import ToolsList from './components/ToolsList';
import AddEditToolForm from './components/AddEditToolForm';
import SettingsPage from './components/SettingsPage';
import RelationshipManager from './components/visualization/RelationshipManager';
import GlobalMap from './components/GlobalMap';
import AdvancedSearch from './components/AdvancedSearch';
import BusinessList from './components/BusinessList';
import AddEditBusinessForm from './components/AddEditBusinessForm';
import DarkModeToggle from './components/DarkModeToggle';
import SystemHealth from './components/SystemHealth';
import WirelessNetworks from './components/WirelessNetworks';
import PropertyList from './components/PropertyList';
import AddEditPropertyForm from './components/AddEditPropertyForm';
import PropertyDetailModal from './components/PropertyDetailModal';
import AssetsList from './components/AssetsList';
import AddEditAssetForm from './components/AddEditAssetForm';
import AssetDetailModal from './components/AssetDetailModal';
import TransactionsList from './components/TransactionsList';
import AddEditTransactionForm from './components/AddEditTransactionForm';
import TransactionDetailModal from './components/TransactionDetailModal';
import BusinessDetailModal from './components/BusinessDetailModal';
import ErrorBoundary from './components/ErrorBoundary';
import Login from './components/Login';

// Fix default Leaflet marker icons
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

const navigationItemIds = [
  { id: 'dashboard',     icon: Home },
  { id: 'cases',         icon: Folder },
  { id: 'people',        icon: Users },
  { id: 'businesses',    icon: Building2 },
  { id: 'properties',    icon: Landmark },
  { id: 'assets',        icon: Package },
  { id: 'transactions',  icon: Receipt },
  { id: 'tools',         icon: Wrench },
  { id: 'relationships', icon: Network },
  { id: 'map',           icon: Map },
  { id: 'wireless',      icon: Wifi },
  { id: 'settings',      icon: Settings },
];

// ── Inner component (has access to all context hooks) ───────────────────────

const AppShell = () => {
  const { t } = useTranslation();
  const { authenticated, currentUser, authLoading, handleLogin, handleLogout } = useAuth();
  const { refreshAll, appSettings, fetchBusinesses, fetchTools } = useData();
  const {
    activeSection, setActiveSection,
    selectedPersonForDetail, setSelectedPersonForDetail,
    editingPerson,
    showAddPersonForm,
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
    selectedTransactionForDetail, setSelectedTransactionForDetail,
    editingTransaction, setEditingTransaction,
    showAddTransactionForm, setShowAddTransactionForm,
    selectedBusinessForDetail, setSelectedBusinessForDetail,
    showAdvancedSearch, setShowAdvancedSearch,
  } = useUI();

  const navigationItems = useMemo(() => navigationItemIds.map(item => ({
    ...item,
    label: t(`app.nav.${item.id}`),
  })), [t]);

  // ── URL ↔ section sync (issue #52) ────────────────────────────────────────
  // The URL is the source of truth for which section is shown, so browser
  // back/forward and deep links work. activeSection stays in UIContext because
  // many components read/set it; the two effects below keep them consistent.
  const navigate = useNavigate();
  const location = useLocation();
  const lastDeepLink = useRef(null);
  const urlSection = useRef(null); // last section applied FROM the URL
  const urlSynced = useRef(false); // state has caught up with the initial URL

  // URL → state (also handles back/forward and initial deep links)
  useEffect(() => {
    const [, seg, id] = location.pathname.split('/');
    const section = navigationItemIds.some(item => item.id === seg) ? seg : 'dashboard';
    urlSection.current = section;
    setActiveSection(section);

    // Deep links: /people/:id and /businesses/:id open the detail modal
    const deepLink = id && /^\d+$/.test(id) ? `${seg}/${id}` : null;
    if (deepLink && deepLink !== lastDeepLink.current && authenticated) {
      lastDeepLink.current = deepLink;
      if (seg === 'people') {
        peopleAPI.getById(Number(id)).then(setSelectedPersonForDetail).catch(() => {});
      } else if (seg === 'businesses') {
        businessAPI.getById(Number(id)).then(setSelectedBusinessForDetail).catch(() => {});
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname, authenticated]);

  // state → URL (covers setActiveSection calls from any component). Must not
  // fire before state has absorbed the initial URL, or a deep link like
  // /people/5 would be clobbered back to /dashboard on mount.
  useEffect(() => {
    if (!urlSynced.current) {
      if (activeSection === urlSection.current) urlSynced.current = true;
      return;
    }
    if (activeSection !== urlSection.current) {
      urlSection.current = activeSection;
      navigate(`/${activeSection}`);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSection]);

  // Fetch all data once authenticated
  useEffect(() => {
    if (authenticated) refreshAll();
  }, [authenticated, refreshAll]);

  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-[100dvh] bg-slate-50 dark:bg-slate-900">
        <div className="text-slate-600 dark:text-slate-400">{t('common.loading')}</div>
      </div>
    );
  }

  if (!authenticated) {
    return <Login onLogin={handleLogin} />;
  }

  return (
    <div className="flex min-h-[100dvh] bg-slate-100 dark:bg-slate-950 relative overflow-hidden transition-colors duration-150">
      {/* Sidebar */}
      <div className="relative w-72 lg:w-72 md:w-64 sm:w-56 glass-card m-4 flex-shrink-0 flex flex-col">
        <div className="p-5 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              {appSettings.appLogo ? (
                <img src={appSettings.appLogo} alt={t('app.logoAlt')} className="h-10 w-10 object-contain rounded-lg" />
              ) : (
                <div className="p-2 rounded-lg bg-accent-primary">
                  <Shield className="w-6 h-6 text-white" />
                </div>
              )}
              <div>
                <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 leading-tight">{appSettings.appName}</h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">{t('app.suiteSubtitle')}</p>
              </div>
            </div>
            <DarkModeToggle />
          </div>
        </div>

        <nav className="p-3 space-y-0.5 flex-1 overflow-y-auto">
          <p className="px-3 pt-1 pb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-500">
            {t('app.workspace')}
          </p>
          {navigationItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeSection === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveSection(item.id)}
                className={`nav-item ${
                  isActive
                    ? 'bg-accent-primary/10 text-accent-primary'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-100'
                }`}
              >
                <Icon className={`flex-shrink-0 transition-colors duration-150 ${isActive ? 'text-accent-primary' : 'text-slate-500 dark:text-slate-400'}`} style={{ width: 18, height: 18 }} />
                <span>{item.label}</span>
              </button>
            );
          })}

          <div className="pt-3 mt-3 border-t border-slate-200 dark:border-slate-800">
            <button
              onClick={handleLogout}
              className="nav-item text-slate-600 dark:text-slate-400 hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-600 dark:hover:text-red-400"
            >
              <LogOut className="flex-shrink-0" style={{ width: 18, height: 18 }} />
              <span>{t('app.logout')}</span>
              <span className="text-xs text-slate-400 dark:text-slate-500 ml-auto">{currentUser?.username}</span>
            </button>
          </div>
        </nav>

        <div className="p-3 border-t border-slate-200 dark:border-slate-800">
          <button
            onClick={() => setShowAdvancedSearch(true)}
            className="btn btn-secondary w-full"
          >
            <Search className="w-4 h-4 text-accent-primary" />
            <span>{t('searchFilters.advancedSearch')}</span>
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 relative flex flex-col m-4 ml-0">
        <div className="flex-1 glass-card overflow-hidden">
          <div className="h-full p-6 overflow-auto">
            <div className="max-w-full mx-auto h-full">
              <ErrorBoundary resetKey={activeSection}>

              {activeSection === 'dashboard'     && <Dashboard />}
              {activeSection === 'cases'         && <CaseManagement />}
              {activeSection === 'people'        && <PeopleList />}
              {activeSection === 'tools'         && <ToolsList />}
              {activeSection === 'businesses'    && <BusinessList />}
              {activeSection === 'properties'    && <PropertyList />}
              {activeSection === 'assets'        && <AssetsList />}
              {activeSection === 'transactions'  && <TransactionsList />}
              {activeSection === 'map'           && <div className="h-full"><GlobalMap /></div>}
              {activeSection === 'wireless'      && <div className="h-full"><WirelessNetworks /></div>}
              {activeSection === 'settings'      && <SettingsPage />}

              {activeSection === 'relationships' && (
                <div className="h-full flex flex-col overflow-hidden">
                  <div className="border-b border-slate-200 dark:border-slate-700 px-6 py-4 flex-shrink-0">
                    <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">{t('app.entityNetworkTitle')}</h1>
                    <p className="text-slate-600 dark:text-slate-400 mt-1">{t('app.entityNetworkSubtitle')}</p>
                  </div>
                  <div className="flex-1 min-h-0 relative">
                    <div className="absolute inset-0 overflow-hidden">
                      <RelationshipManager showInModal={false} onClose={() => {}} />
                    </div>
                  </div>
                </div>
              )}

              </ErrorBoundary>
            </div>
          </div>
        </div>
      </div>

      {/* Modals */}
      {showAddPersonForm  && <AddEditPersonForm />}
      {editingPerson      && <AddEditPersonForm />}
      {selectedPersonForDetail && <PersonDetailModal />}
      {showAddToolForm    && <AddEditToolForm tool={null} onSave={() => { setShowAddToolForm(false); fetchTools(); }} onCancel={() => setShowAddToolForm(false)} />}
      {editingTool        && <AddEditToolForm tool={editingTool} onSave={() => { setEditingTool(null); fetchTools(); }} onCancel={() => setEditingTool(null)} />}
      {showAddBusinessForm && <AddEditBusinessForm business={null} onSave={() => { setShowAddBusinessForm(false); fetchBusinesses(); }} onCancel={() => setShowAddBusinessForm(false)} />}
      {editingBusiness    && <AddEditBusinessForm business={editingBusiness} onSave={() => { setEditingBusiness(null); fetchBusinesses(); }} onCancel={() => setEditingBusiness(null)} />}

      {/* Property modals */}
      {showAddPropertyForm && <AddEditPropertyForm property={null} onClose={() => setShowAddPropertyForm(false)} />}
      {editingProperty     && <AddEditPropertyForm property={editingProperty} onClose={() => setEditingProperty(null)} />}
      {selectedPropertyForDetail && <PropertyDetailModal property={selectedPropertyForDetail} onClose={() => setSelectedPropertyForDetail(null)} />}

      {/* Asset modals */}
      {showAddAssetForm && <AddEditAssetForm asset={null} onClose={() => setShowAddAssetForm(false)} />}
      {editingAsset     && <AddEditAssetForm asset={editingAsset} onClose={() => setEditingAsset(null)} />}
      {selectedAssetForDetail && <AssetDetailModal asset={selectedAssetForDetail} onClose={() => setSelectedAssetForDetail(null)} />}

      {/* Transaction modals */}
      {showAddTransactionForm && <AddEditTransactionForm transaction={null} onClose={() => setShowAddTransactionForm(false)} />}
      {editingTransaction     && <AddEditTransactionForm transaction={editingTransaction} onClose={() => setEditingTransaction(null)} />}
      {selectedTransactionForDetail && <TransactionDetailModal transaction={selectedTransactionForDetail} onClose={() => setSelectedTransactionForDetail(null)} />}

      {/* Business detail (venue activity / ledger) */}
      {selectedBusinessForDetail && <BusinessDetailModal business={selectedBusinessForDetail} onClose={() => setSelectedBusinessForDetail(null)} />}
      {showAdvancedSearch && (
        <AdvancedSearch
          onSelectPerson={(person) => { setSelectedPersonForDetail(person); setShowAdvancedSearch(false); }}
          onClose={() => setShowAdvancedSearch(false)}
        />
      )}

      {/* Admin-only ops widget — the health endpoint is requireAdmin, and
          rendering it for regular users produced a false "System Offline"
          from the resulting 403s (issue #58). The component also hides
          itself on 403 in case the role is stale. */}
      {currentUser?.role === 'admin' && <SystemHealth />}
    </div>
  );
};

// ── Root: wrap providers around the shell ────────────────────────────────────

const App = () => (
  <ThemeProvider>
    <BrowserRouter>
      <AuthProvider>
        <DataProvider>
          <UIProvider>
            <AppShell />
          </UIProvider>
        </DataProvider>
      </AuthProvider>
    </BrowserRouter>
  </ThemeProvider>
);

export default App;
