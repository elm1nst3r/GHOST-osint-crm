// File: frontend/src/App.jsx
import { Activity, Suspense, lazy, useEffect, useLayoutEffect, useRef, useMemo, useState, useEffectEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { BrowserRouter, useNavigate, useLocation } from 'react-router';
import { Home, Users, Wrench, Network, Settings, Shield, Map, Folder, Search, Building2, Wifi, LogOut, Landmark, Package, Receipt, Menu, X, Wallet, Paperclip } from 'lucide-react';

import { peopleAPI, businessAPI } from './utils/api';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { DataProvider, useData } from './contexts/DataContext';
import { UIProvider, useUI } from './contexts/UIContext';
import { ThemeProvider, useTheme } from './contexts/ThemeContext';
import { ProjectProvider, useProject } from './contexts/ProjectContext';
import { ScratchpadProvider } from './contexts/ScratchpadContext';
import { ModulesProvider, useModules } from './contexts/ModulesContext';
import { visibleNavGroups } from './utils/modules';
import { changeLanguage } from './i18n';

import UpdateBanner from './components/UpdateBanner';
import DarkModeToggle from './components/DarkModeToggle';
import ProjectSelector from './components/ProjectSelector';
import ProjectGate from './components/ProjectGate';
import SystemHealth from './components/SystemHealth';
import ErrorBoundary from './components/ErrorBoundary';
import Scratchpad from './components/scratchpad/Scratchpad';
import Login from './components/Login';
import TwoFactorSetupGate from './components/TwoFactorSetupGate';

// Sections and dialogs load on first use, so the first screen downloads
// only what it needs; the map (Leaflet), the graphs (D3, React Flow) and
// the report export (docx) arrive when someone opens them.
const Dashboard = lazy(() => import('./components/Dashboard'));
const CaseManagement = lazy(() => import('./components/CaseManagement'));
const PeopleList = lazy(() => import('./components/PeopleList'));
const PersonDetailModal = lazy(() => import('./components/PersonDetailModal'));
const AddEditPersonForm = lazy(() => import('./components/AddEditPersonForm'));
const ToolsList = lazy(() => import('./components/ToolsList'));
const AddEditToolForm = lazy(() => import('./components/AddEditToolForm'));
const SettingsPage = lazy(() => import('./components/SettingsPage'));
const RelationshipManager = lazy(() => import('./components/visualization/RelationshipManager'));
const GlobalMap = lazy(() => import('./components/GlobalMap'));
const AdvancedSearch = lazy(() => import('./components/AdvancedSearch'));
const BusinessList = lazy(() => import('./components/BusinessList'));
const AddEditBusinessForm = lazy(() => import('./components/AddEditBusinessForm'));
const WirelessNetworks = lazy(() => import('./components/WirelessNetworks'));
const PropertyList = lazy(() => import('./components/PropertyList'));
const AddEditPropertyForm = lazy(() => import('./components/AddEditPropertyForm'));
const PropertyDetailModal = lazy(() => import('./components/PropertyDetailModal'));
const AssetsList = lazy(() => import('./components/AssetsList'));
const AddEditAssetForm = lazy(() => import('./components/AddEditAssetForm'));
const AssetDetailModal = lazy(() => import('./components/AssetDetailModal'));
const CryptoWalletsList = lazy(() => import('./components/CryptoWalletsList'));
const AddEditCryptoWalletForm = lazy(() => import('./components/AddEditCryptoWalletForm'));
const CryptoWalletDetailModal = lazy(() => import('./components/CryptoWalletDetailModal'));
const FilesPage = lazy(() => import('./components/files/FilesPage'));
const TransactionsList = lazy(() => import('./components/TransactionsList'));
const AddEditTransactionForm = lazy(() => import('./components/AddEditTransactionForm'));
const TransactionDetailModal = lazy(() => import('./components/TransactionDetailModal'));
const BusinessDetailModal = lazy(() => import('./components/BusinessDetailModal'));

const navigationItemIds = [
  { id: 'dashboard',     icon: Home },
  { id: 'cases',         icon: Folder },
  { id: 'people',        icon: Users },
  { id: 'businesses',    icon: Building2 },
  { id: 'properties',    icon: Landmark },
  { id: 'assets',        icon: Package },
  { id: 'crypto-wallets', icon: Wallet },
  { id: 'transactions',  icon: Receipt },
  { id: 'files',         icon: Paperclip },
  { id: 'tools',         icon: Wrench },
  { id: 'relationships', icon: Network },
  { id: 'map',           icon: Map },
  { id: 'wireless',      icon: Wifi },
  { id: 'settings',      icon: Settings },
];

const NavItem = ({ item, active, onSelect }) => {
  const Icon = item.icon;
  return (
    <button
      onClick={() => onSelect(item.id)}
      aria-current={active ? 'page' : undefined}
      className={`nav-item ${
        active
          ? 'bg-accent-primary/10 text-accent-primary'
          : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-100'
      }`}
    >
      <Icon className={`shrink-0 transition-colors duration-150 ${active ? 'text-accent-primary' : 'text-slate-500 dark:text-slate-400'}`} style={{ width: 18, height: 18 }} />
      <span>{item.label}</span>
    </button>
  );
};

const EntityNetworkSection = () => {
  const { t } = useTranslation();
  return (
    <div className="h-full flex flex-col overflow-hidden">
      <div className="border-b border-slate-200 dark:border-slate-700 px-6 py-4 shrink-0">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">{t('app.entityNetworkTitle')}</h1>
        <p className="text-slate-600 dark:text-slate-400 mt-1">{t('app.entityNetworkSubtitle')}</p>
      </div>
      <div className="flex-1 min-h-0 relative">
        <div className="absolute inset-0 overflow-hidden">
          <RelationshipManager showInModal={false} onClose={() => {}} />
        </div>
      </div>
    </div>
  );
};

const MapSection = () => <div className="h-full"><GlobalMap /></div>;
const WirelessSection = () => <div className="h-full"><WirelessNetworks /></div>;

const SectionLoading = () => {
  const { t } = useTranslation();
  return <div className="p-6 text-sm text-slate-500 dark:text-slate-400">{t('common.loading')}</div>;
};

// keepAlive: once opened, a section stays mounted but hidden (<Activity>)
// when you go elsewhere, so its filters, search text and open tabs are still
// there when you come back. Its effects stop while hidden and run again when
// it is shown, so data is fetched fresh as before. Sections that drive a
// Leaflet map or a D3 / React Flow graph imperatively are unmounted instead.
const SECTIONS = {
  dashboard:        { Component: Dashboard, keepAlive: false }, // embeds the D3 graph
  cases:            { Component: CaseManagement, keepAlive: true },
  people:           { Component: PeopleList, keepAlive: true },
  businesses:       { Component: BusinessList, keepAlive: true },
  properties:       { Component: PropertyList, keepAlive: true },
  assets:           { Component: AssetsList, keepAlive: true },
  'crypto-wallets': { Component: CryptoWalletsList, keepAlive: true },
  transactions:     { Component: TransactionsList, keepAlive: true },
  files:            { Component: FilesPage, keepAlive: true },
  tools:            { Component: ToolsList, keepAlive: true },
  relationships:    { Component: EntityNetworkSection, keepAlive: false },
  map:              { Component: MapSection, keepAlive: false },
  wireless:         { Component: WirelessSection, keepAlive: false },
  settings:         { Component: SettingsPage, keepAlive: true },
};

// ── Inner component (has access to all context hooks) ───────────────────────

const AppShell = () => {
  const { t, i18n } = useTranslation();
  const { authenticated, currentUser, authLoading, mfaSetupRequired, handleLogin, handleLogout } = useAuth();
  const { refreshAll, appSettings, fetchBusinesses, fetchTools } = useData();
  const { refetchProjects, activeProjectId } = useProject();
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
    selectedCryptoWalletForDetail, setSelectedCryptoWalletForDetail,
    editingCryptoWallet, setEditingCryptoWallet,
    showAddCryptoWalletForm, setShowAddCryptoWalletForm,
    selectedTransactionForDetail, setSelectedTransactionForDetail,
    editingTransaction, setEditingTransaction,
    showAddTransactionForm, setShowAddTransactionForm,
    selectedBusinessForDetail, setSelectedBusinessForDetail,
    showAdvancedSearch, setShowAdvancedSearch,
  } = useUI();

  // ── Global-default / per-user-override reconciliation (issue #91) ─────────
  // localStorage (read synchronously by i18n.js / ThemeContext on first
  // paint, to avoid a flash) is only a cache. The source of truth is: this
  // user's own override (currentUser.language / .theme_mode, set in
  // General/Appearance) if they have one, else the admin's global default
  // (appSettings.defaultLanguage / .defaultThemeMode), else the hardcoded
  // fallback. Reconcile once both pieces are known, so a second device (no
  // local cache yet) or an admin's changed default picks up the right value
  // without the user having to touch anything.
  const { setThemeMode } = useTheme();
  const applyUserPreferences = useEffectEvent(() => {
    if (!currentUser) return;
    const effectiveLanguage = currentUser.language || appSettings.defaultLanguage;
    if (effectiveLanguage && effectiveLanguage !== i18n.language) {
      changeLanguage(effectiveLanguage);
    }
    const effectiveThemeMode = currentUser.theme_mode || appSettings.defaultThemeMode;
    if (effectiveThemeMode) {
      setThemeMode(effectiveThemeMode);
    }
  });
  useEffect(() => applyUserPreferences(), [currentUser, appSettings.defaultLanguage, appSettings.defaultThemeMode]);

  const navigationItems = useMemo(() => navigationItemIds.map(item => ({
    ...item,
    label: t(`app.nav.${item.id}`),
  })), [t]);
  // Menu groups without the sections an admin switched off.
  const { disabled: disabledModules, isOn: moduleOn } = useModules();
  const navGroups = useMemo(() => {
    const byId = Object.fromEntries(navigationItems.map((item) => [item.id, item]));
    return visibleNavGroups(disabledModules).map((g) => ({ ...g, items: g.items.map((id) => byId[id]) }));
  }, [navigationItems, disabledModules]);
  const settingsItem = navigationItems.find((item) => item.id === 'settings');

  // ── URL ↔ section sync (issue #52) ────────────────────────────────────────
  // The URL is the source of truth for which section is shown, so browser
  // back/forward and deep links work. activeSection stays in UIContext because
  // many components read/set it; the two effects below keep them consistent.
  // Mobile nav drawer. Desktop (md+) ignores this entirely: the sidebar is
  // statically positioned there, so this only governs the off-canvas panel.
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const selectSection = (id) => { setActiveSection(id); setMobileNavOpen(false); };

  // Sections opened since sign-in (see SECTIONS). Cleared on sign-out, so
  // nothing one user had open survives into the next session.
  const [visitedSections, setVisitedSections] = useState([]);
  if (!authenticated && visitedSections.length) setVisitedSections([]);
  if (authenticated && !visitedSections.includes(activeSection)) {
    setVisitedSections((v) => (v.includes(activeSection) ? v : [...v, activeSection]));
  }

  // One scroll area holds every section; each kept-alive section gets its own
  // scroll position back when you return to it.
  const scrollRoot = useRef(null);
  const scrollPositions = useRef({});
  useLayoutEffect(() => {
    if (!scrollRoot.current) return;
    scrollRoot.current.scrollTop = SECTIONS[activeSection]?.keepAlive ? (scrollPositions.current[activeSection] ?? 0) : 0;
  }, [activeSection]);

  const navigate = useNavigate();
  const location = useLocation();
  const lastDeepLink = useRef(null);
  const urlSection = useRef(null); // last section applied FROM the URL
  const urlSynced = useRef(false); // state has caught up with the initial URL

  // URL → state (also handles back/forward and initial deep links)
  const syncFromUrl = useEffectEvent(() => {
    const [, seg, id] = location.pathname.split('/');
    // A switched-off module's address opens the dashboard instead, and the
    // address bar says so.
    const known = navigationItemIds.some(item => item.id === seg);
    if (known && !moduleOn(seg)) {
      navigate('/dashboard', { replace: true });
      return;
    }
    const section = known ? seg : 'dashboard';
    urlSection.current = section;
    setActiveSection(section);
    setMobileNavOpen(false);

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
  });
  useEffect(() => syncFromUrl(), [location.pathname, authenticated, disabledModules]);

  // state → URL (covers setActiveSection calls from any component). Must not
  // fire before state has absorbed the initial URL, or a deep link like
  // /people/5 would be clobbered back to /dashboard on mount.
  const syncToUrl = useEffectEvent(() => {
    if (!urlSynced.current) {
      if (activeSection === urlSection.current) urlSynced.current = true;
      return;
    }
    if (activeSection !== urlSection.current) {
      urlSection.current = activeSection;
      navigate(`/${activeSection}`);
    }
  });
  useEffect(() => syncToUrl(), [activeSection]);

  // Projects once signed in; the shared lists once a project is chosen
  // (and again when it changes: refreshAll depends on activeProjectId).
  useEffect(() => {
    if (authenticated) refetchProjects();
  }, [authenticated, refetchProjects]);
  useEffect(() => {
    if (authenticated && activeProjectId != null) refreshAll();
  }, [authenticated, activeProjectId, refreshAll]);

  // Escape closes the mobile drawer
  useEffect(() => {
    if (!mobileNavOpen) return undefined;
    const onKeyDown = (e) => { if (e.key === 'Escape') setMobileNavOpen(false); };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [mobileNavOpen]);

  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-dvh bg-slate-50 dark:bg-slate-900">
        <div className="text-slate-600 dark:text-slate-400">{t('common.loading')}</div>
      </div>
    );
  }

  if (!authenticated) {
    return mfaSetupRequired ? <TwoFactorSetupGate /> : <Login onLogin={handleLogin} />;
  }

  return (
    <ProjectGate>
    {/* h-dvh, not min-h-dvh: the shell is exactly the window, so the sidebar
        and the content panel ([data-scroll-root]) each scroll on their own. With
        min-h-dvh the whole page grew and scrolled, the sidebar footer ended up
        below a long list, and per-section scroll memory had nothing to restore. */}
    <div className="flex h-dvh bg-slate-100 dark:bg-slate-950 relative overflow-hidden transition-colors duration-150">

      {/* Mobile top bar — the only chrome visible below md, since the sidebar
          is off-canvas there. */}
      <div className="md:hidden fixed top-0 inset-x-0 z-30 h-14 flex items-center gap-3 px-4 glass-card rounded-none border-x-0 border-t-0">
        <button
          onClick={() => setMobileNavOpen(true)}
          className="p-2 -ms-2 rounded-(--radius-control) text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
          aria-label={t('app.openNavigation')}
          aria-expanded={mobileNavOpen}
        >
          <Menu style={{ width: 22, height: 22 }} />
        </button>
        <span className="font-semibold text-slate-900 dark:text-slate-100 truncate">
          {appSettings.appName}
        </span>
        <div className="ms-auto">
          <ProjectSelector compact />
        </div>
      </div>

      {/* Scrim — closes the drawer on tap. Below md only. */}
      {mobileNavOpen && (
        <div
          className="md:hidden fixed inset-0 z-40 bg-slate-900/50"
          onClick={() => setMobileNavOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Sidebar. Below md it's an off-canvas drawer; at md+ it's the static
          column it has always been. The widths used to be written
          desktop-first (`w-72 lg:w-72 md:w-64 sm:w-56`), which in Tailwind's
          mobile-first system meant the sidebar was at its WIDEST on the
          narrowest screen — 288px of nav on a 375px phone (issue #64). */}
      <div
        className={`fixed inset-y-0 inset-s-0 z-50 w-72 max-w-[85vw] rounded-none border-y-0 border-s-0
          flex flex-col glass-card shrink-0
          transform transition-transform duration-200 ease-out
          ${mobileNavOpen ? 'translate-x-0' : '-translate-x-full rtl:translate-x-full'}
          md:static md:translate-x-0 md:rtl:translate-x-0 md:max-w-none md:m-4 md:w-64 lg:w-72
          md:rounded-(--radius-card) md:border`}
      >
        <div className="p-5 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-x-3 min-w-0">
              {appSettings.appLogo ? (
                <img src={appSettings.appLogo} alt={t('app.logoAlt')} className="h-10 w-10 object-contain rounded-lg" />
              ) : (
                <div className="p-2 rounded-lg bg-accent-primary">
                  <Shield className="w-6 h-6 text-white" />
                </div>
              )}
              <div>
                <h2 className="text-base md:text-lg font-bold text-slate-900 dark:text-slate-100 leading-tight md:leading-7 wrap-break-word">{appSettings.appName}</h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">{t('app.suiteSubtitle')}</p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <DarkModeToggle />
              <button
                onClick={() => setMobileNavOpen(false)}
                className="md:hidden p-2 rounded-(--radius-control) text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                aria-label={t('app.closeNavigation')}
              >
                <X style={{ width: 18, height: 18 }} />
              </button>
            </div>
          </div>
          <div className="mt-3">
            <ProjectSelector />
          </div>
          <button
            onClick={() => { setShowAdvancedSearch(true); setMobileNavOpen(false); }}
            className="mt-2 w-full flex items-center gap-2 px-3 py-2 rounded-(--radius-control) border border-slate-200 dark:border-slate-700 text-sm text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
          >
            <Search className="w-4 h-4 shrink-0 text-accent-primary" />
            <span>{t('searchFilters.advancedSearch')}</span>
          </button>
        </div>

        <nav className="p-3 flex-1 overflow-y-auto" aria-label={t('app.navigation')}>
          {navGroups.map((group) => (
            <div key={group.heading || 'top'} className={group.heading ? 'pt-3' : ''}>
              {group.heading && (
                <p className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-500">
                  {t(`app.navGroup.${group.heading}`)}
                </p>
              )}
              <div className="space-y-0.5">
                {group.items.map((item) => <NavItem key={item.id} item={item} active={activeSection === item.id} onSelect={selectSection} />)}
              </div>
            </div>
          ))}

        </nav>

        {/* Pinned under the menu, so they stay visible when the list scrolls. */}
        <div className="p-3 border-t border-slate-200 dark:border-slate-800 flex items-center gap-1">
          <div className="flex-1 min-w-0">
            <NavItem item={settingsItem} active={activeSection === 'settings'} onSelect={selectSection} />
          </div>
          <button
            onClick={handleLogout}
            title={t('app.logoutAs', { name: currentUser?.username || '' })}
            aria-label={t('app.logoutAs', { name: currentUser?.username || '' })}
            className="shrink-0 flex items-center gap-2 px-3 py-2 rounded-(--radius-control) text-sm text-slate-500 dark:text-slate-400 hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-600 dark:hover:text-red-400 transition-colors"
          >
            <span className="text-xs max-w-24 truncate">{currentUser?.username}</span>
            <LogOut className="shrink-0 rtl:-scale-x-100" style={{ width: 18, height: 18 }} />
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 min-w-0 relative flex flex-col m-4 mt-18 md:mt-4 md:ms-0">
        <div className="flex-1 glass-card overflow-hidden flex flex-col">
          <UpdateBanner />
          {/* flex-1 min-h-0 rather than h-full: the banner shares this column,
              so a fixed full height would push the content past the card. */}
          <div
            ref={scrollRoot}
            data-scroll-root
            onScroll={(e) => { scrollPositions.current[activeSection] = e.currentTarget.scrollTop; }}
            className="flex-1 min-h-0 p-4 md:p-6 overflow-auto"
          >
            <div className="max-w-full mx-auto h-full">
              {visitedSections.map((id) => {
                const section = SECTIONS[id];
                const shown = id === activeSection;
                if (!shown && !section.keepAlive) return null;
                return (
                  <Activity key={`${id}:${activeProjectId}`} mode={shown ? 'visible' : 'hidden'}>
                    <ErrorBoundary resetKey={activeSection}>
                      <Suspense fallback={<SectionLoading />}>
                        <section.Component />
                      </Suspense>
                    </ErrorBoundary>
                  </Activity>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Modals (loaded on first open) */}
      <Suspense fallback={null}>
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

      {showAddCryptoWalletForm && <AddEditCryptoWalletForm wallet={null} onClose={() => setShowAddCryptoWalletForm(false)} />}
      {editingCryptoWallet     && <AddEditCryptoWalletForm wallet={editingCryptoWallet} onClose={() => setEditingCryptoWallet(null)} />}
      {selectedCryptoWalletForDetail && <CryptoWalletDetailModal wallet={selectedCryptoWalletForDetail} onClose={() => setSelectedCryptoWalletForDetail(null)} />}

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
      </Suspense>

      {/* Admin-only ops widget — the health endpoint is requireAdmin, and
          rendering it for regular users produced a false "System Offline"
          from the resulting 403s (issue #58). The component also hides
          itself on 403 in case the role is stale. */}
      {currentUser?.role === 'admin' && <SystemHealth />}

      {/* Private floating notepad. Rendered after the modals and above them
          (z-60) so text can be copied out of an open record into it. */}
      <Scratchpad />
    </div>
    </ProjectGate>
  );
};

// ── Root: wrap providers around the shell ────────────────────────────────────

const App = () => (
  <ThemeProvider>
    <BrowserRouter>
      <AuthProvider>
        <ProjectProvider>
          <DataProvider>
            <ModulesProvider>
            <UIProvider>
              <ScratchpadProvider>
                <AppShell />
              </ScratchpadProvider>
            </UIProvider>
            </ModulesProvider>
          </DataProvider>
        </ProjectProvider>
      </AuthProvider>
    </BrowserRouter>
  </ThemeProvider>
);

export default App;
