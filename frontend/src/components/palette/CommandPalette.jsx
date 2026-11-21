// Command palette (search-and-command-palette plan): Ctrl/⌘+K anywhere.
// Type to search every record in the project (or all your projects), jump to
// a section, or run an action. Keyboard first: ↑/↓ move, Enter opens,
// Escape closes. A combobox with a listbox (aria-activedescendant), so focus
// stays in the box.
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import {
  Search, Loader2, X, Clock, CornerDownLeft, User, Building2, Wallet, Landmark, Package, Folder,
  CheckSquare, Paperclip, Wifi, Plus, SlidersHorizontal, NotebookPen, FolderOpen, Home, Users, Receipt,
  Wrench, Network, Map as MapIcon, Settings,
} from 'lucide-react';
import { searchAPI, filesAPI } from '../../utils/api';
import { useUI } from '../../contexts/UIContext';
import { useProject } from '../../contexts/ProjectContext';
import { useAuth } from '../../contexts/AuthContext';
import { useModules } from '../../contexts/ModulesContext';
import { useScratchpad } from '../../contexts/ScratchpadContext';
import { useOpenEntity } from '../graph/useOpenEntity';
import { visibleNavGroups } from '../../utils/modules';
import { phonePattern } from '../../utils/recordMatch';
import {
  readRecent, pushRecent, filterItems, resultTarget, TYPE_MODULE,
} from '../../utils/palette';

const TYPE_ICON = {
  person: User, business: Building2, crypto_wallet: Wallet, property: Landmark, asset: Package,
  case: Folder, todo: CheckSquare, file: Paperclip, wireless_network: Wifi,
};
// Other words people type for a section (the menu says "Locations", they
// type "map"). English on purpose: the section's id is English too.
const SECTION_KEYWORDS = {
  map: 'map locations places', relationships: 'graph network links connections', wireless: 'wifi wi-fi ssid',
  'crypto-wallets': 'bitcoin ethereum crypto', tools: 'osint integrations', files: 'documents photos uploads',
  transactions: 'money payments', dashboard: 'home start', settings: 'preferences admin users',
};
const SECTION_ICON = {
  dashboard: Home, cases: Folder, people: Users, businesses: Building2, properties: Landmark, assets: Package,
  'crypto-wallets': Wallet, transactions: Receipt, files: Paperclip, tools: Wrench, relationships: Network,
  map: MapIcon, wireless: Wifi, settings: Settings,
};

// Marks every typed word (and a phone number written any way) in `text`.
const escapeRegExp = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
function Marked({ text, query }) {
  const words = String(query || '').trim().split(/\s+/).filter((w) => w.length > 0).map(escapeRegExp);
  const phone = phonePattern(query);
  if (phone) words.unshift(phone);
  if (!words.length || !text) return <>{text}</>;
  const re = new RegExp(`(${words.join('|')})`, 'gi');
  const parts = String(text).split(re);
  return (
    <>
      {parts.map((part, i) => (i % 2 === 1
        ? <mark key={i} className="bg-yellow-200/80 dark:bg-yellow-500/30 text-inherit rounded-xs">{part}</mark>
        : <span key={i}>{part}</span>))}
    </>
  );
}

const CommandPalette = ({ onClose, onOpenFile }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const ui = useUI();
  const { activeProjectId, activeProject, projects, setActiveProjectId } = useProject();
  const { currentUser } = useAuth();
  const { disabled, isOn } = useModules();
  const scratchpad = useScratchpad();
  const openEntity = useOpenEntity();
  const inputRef = useRef(null);

  const [query, setQuery] = useState('');
  const [allProjects, setAllProjects] = useState(!activeProjectId);
  const [result, setResult] = useState(null); // { key, groups, error }
  const [active, setActive] = useState(0);
  const [recent] = useState(() => readRecent(currentUser?.id));

  const q = query.trim();
  const searchKey = `${q}|${allProjects ? 'all' : activeProjectId}`;

  // Debounced search; results are kept with what they were searched for.
  useEffect(() => {
    if (q.length < 2) return undefined;
    const handle = setTimeout(() => {
      searchAPI.search({ q, project_id: allProjects ? undefined : activeProjectId, limit: 6 })
        .then((res) => setResult({ key: searchKey, groups: res.groups || [] }))
        .catch((err) => setResult({ key: searchKey, groups: [], error: err.message }));
    }, 150);
    return () => clearTimeout(handle);
  }, [q, allProjects, activeProjectId, searchKey]);

  const current = q.length >= 2 && result?.key === searchKey ? result : null;
  const searching = q.length >= 2 && !current;

  const remember = (record) => pushRecent(currentUser?.id, record);
  const finish = (fn) => { onClose(); fn(); };
  // Going somewhere else closes the detail dialog that was open (as "Show in
  // graph" does), so it isn't left on top of the new place.
  const closeDetails = () => {
    ui.setSelectedPersonForDetail(null);
    ui.setSelectedBusinessForDetail(null);
    ui.setSelectedCryptoWalletForDetail(null);
    ui.setSelectedAssetForDetail(null);
    ui.setSelectedPropertyForDetail(null);
    ui.setSelectedTransactionForDetail(null);
  };

  const openRecord = (r) => finish(() => {
    remember(r);
    closeDetails();
    const target = resultTarget(r.type, r.id);
    if (!target) return;
    if (target.kind === 'entity') openEntity(r.type, r.id);
    else if (target.kind === 'file') filesAPI.getById(r.id).then(onOpenFile).catch(() => {});
    else navigate(target.path);
  });

  // ── Items ──────────────────────────────────────────────────────────────────
  const sections = visibleNavGroups(disabled).flatMap((g) => g.items).concat('settings');
  const goTo = sections.map((id) => ({
    key: `go:${id}`, icon: SECTION_ICON[id] || Folder, label: t(`app.nav.${id}`), hint: t('palette.goTo'),
    keywords: `${id} ${SECTION_KEYWORDS[id] || ''}`,
    run: () => finish(() => { closeDetails(); navigate(`/${id}`); }),
  }));

  const actions = [
    { key: 'new:person', icon: Plus, label: t('palette.newPerson'), keywords: 'add create', run: () => finish(() => ui.setShowAddPersonForm(true)) },
    { key: 'new:business', icon: Plus, label: t('palette.newBusiness'), keywords: 'add create company', run: () => finish(() => ui.setShowAddBusinessForm(true)) },
    isOn('crypto-wallets') && { key: 'new:wallet', icon: Plus, label: t('palette.newWallet'), keywords: 'add create crypto', run: () => finish(() => ui.setShowAddCryptoWalletForm(true)) },
    isOn('properties') && { key: 'new:property', icon: Plus, label: t('palette.newProperty'), keywords: 'add create', run: () => finish(() => ui.setShowAddPropertyForm(true)) },
    isOn('assets') && { key: 'new:asset', icon: Plus, label: t('palette.newAsset'), keywords: 'add create', run: () => finish(() => ui.setShowAddAssetForm(true)) },
    isOn('transactions') && { key: 'new:transaction', icon: Plus, label: t('palette.newTransaction'), keywords: 'add create payment', run: () => finish(() => ui.setShowAddTransactionForm(true)) },
    { key: 'advanced', icon: SlidersHorizontal, label: t('searchFilters.advancedSearch'), keywords: 'filter saved records', run: () => finish(() => ui.setShowAdvancedSearch(true)) },
    scratchpad?.settings?.enabled !== false && { key: 'scratchpad', icon: NotebookPen, label: t('palette.openScratchpad'), keywords: 'notes', run: () => finish(() => scratchpad.setOpen(true)) },
    ...projects.filter((p) => p.id !== activeProjectId && !p.archived_at).map((p) => ({
      key: `project:${p.id}`, icon: FolderOpen, label: t('palette.switchProject', { name: p.name }), keywords: 'project',
      run: () => finish(() => setActiveProjectId(p.id)),
    })),
  ].filter(Boolean);

  const recordItem = (r, hint) => ({
    key: `rec:${r.type}:${r.id}`, icon: TYPE_ICON[r.type] || Search, label: r.title, sublabel: r.subtitle,
    snippet: r.snippet, project: allProjects && r.project_id !== activeProjectId ? r.project_name : null,
    hint, marked: true, run: () => openRecord(r),
  });

  const groups = [];
  if (!q) {
    const recentShown = recent.filter((r) => !TYPE_MODULE[r.type] || isOn(TYPE_MODULE[r.type]));
    if (recentShown.length) groups.push({ id: 'recent', title: t('palette.recent'), items: recentShown.map((r) => ({ ...recordItem(r), icon: TYPE_ICON[r.type] || Clock })) });
    groups.push({ id: 'goto', title: t('palette.sectionGoTo'), items: goTo });
    groups.push({ id: 'actions', title: t('palette.sectionActions'), items: actions });
  } else {
    const goMatches = filterItems(goTo, q).slice(0, 4);
    if (goMatches.length) groups.push({ id: 'goto', title: t('palette.sectionGoTo'), items: goMatches });
    for (const g of current?.groups || []) {
      if (TYPE_MODULE[g.type] && !isOn(TYPE_MODULE[g.type])) continue;
      groups.push({
        id: `type:${g.type}`,
        title: t(`palette.types.${g.type}`),
        count: g.total > g.items.length ? t('palette.someOf', { shown: g.items.length, total: g.total }) : String(g.total),
        items: g.items.map((r) => recordItem(r)),
      });
    }
    const actionMatches = filterItems(actions, q);
    if (actionMatches.length) groups.push({ id: 'actions', title: t('palette.sectionActions'), items: actionMatches });
  }
  const flat = groups.flatMap((g) => g.items);
  // Where each group starts in `flat` (the options are numbered across groups).
  const starts = groups.map((g, gi) => groups.slice(0, gi).reduce((n, x) => n + x.items.length, 0));
  const activeIndex = flat.length ? Math.min(active, flat.length - 1) : -1;
  const optionId = (i) => `palette-option-${i}`;

  useEffect(() => {
    if (activeIndex < 0) return;
    document.getElementById(optionId(activeIndex))?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex]);

  const onKeyDown = (e) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      if (!flat.length) return;
      const step = e.key === 'ArrowDown' ? 1 : -1;
      setActive((activeIndex + step + flat.length) % flat.length);
    } else if (e.key === 'PageDown' || e.key === 'PageUp') {
      e.preventDefault();
      if (flat.length) setActive(Math.max(0, Math.min(flat.length - 1, activeIndex + (e.key === 'PageDown' ? 5 : -5))));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      flat[activeIndex]?.run();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      onClose();
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-70 flex items-start justify-center bg-black/40 px-4 pt-16 md:pt-[12vh]" onMouseDown={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={t('palette.title')}
        className="w-full max-w-xl rounded-xl bg-white dark:bg-slate-800 shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden flex flex-col max-h-[75vh]"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-x-2 px-4 border-b border-slate-200 dark:border-slate-700">
          {searching ? <Loader2 className="w-4 h-4 shrink-0 text-slate-400 animate-spin" /> : <Search className="w-4 h-4 shrink-0 text-slate-400" />}
          <input
            ref={inputRef}
            autoFocus
            value={query}
            onChange={(e) => { setQuery(e.target.value); setActive(0); }}
            onKeyDown={onKeyDown}
            placeholder={t('palette.placeholder')}
            role="combobox"
            aria-expanded={flat.length > 0}
            aria-controls="palette-list"
            aria-activedescendant={activeIndex >= 0 ? optionId(activeIndex) : undefined}
            aria-autocomplete="list"
            aria-label={t('palette.placeholder')}
            spellCheck={false}
            autoComplete="off"
            className="flex-1 min-w-0 py-3.5 bg-transparent text-base text-slate-900 dark:text-slate-100 placeholder:text-slate-400 outline-none border-0 focus:ring-0"
          />
          {activeProjectId && (
            <label className="hidden sm:inline-flex items-center gap-x-1.5 text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap cursor-pointer select-none">
              <input type="checkbox" checked={allProjects} onChange={(e) => { setAllProjects(e.target.checked); setActive(0); inputRef.current?.focus(); }} className="h-3.5 w-3.5 rounded-sm" />
              {t('palette.allProjects')}
            </label>
          )}
          <button type="button" onClick={onClose} aria-label={t('common.close')} className="p-1 -me-1 rounded-sm text-slate-400 hover:text-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 dark:hover:text-slate-200">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div id="palette-list" role="listbox" aria-label={t('palette.results')} className="flex-1 min-h-0 overflow-y-auto py-2">
          {groups.map((g, gi) => (
            <div key={g.id} role="group" aria-labelledby={`palette-group-${g.id}`} className="pb-1">
              <div id={`palette-group-${g.id}`} className="flex items-center justify-between px-4 pt-2 pb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                <span>{g.title}</span>
                {g.count && <span className="font-normal normal-case tracking-normal">{g.count}</span>}
              </div>
              {g.items.map((item, ii) => {
                const i = starts[gi] + ii;
                const Icon = item.icon;
                const selected = i === activeIndex;
                return (
                  <div
                    key={item.key}
                    id={optionId(i)}
                    role="option"
                    aria-selected={selected}
                    onMouseMove={() => { if (!selected) setActive(i); }}
                    onClick={() => item.run()}
                    className={`mx-2 px-2 py-2 rounded-lg flex items-start gap-x-3 cursor-pointer ${selected ? 'bg-slate-100 dark:bg-slate-700' : ''}`}
                  >
                    <Icon className="w-4 h-4 mt-0.5 shrink-0 text-slate-500 dark:text-slate-400" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline gap-x-2 min-w-0">
                        <bdi dir="auto" className="truncate text-sm text-slate-900 dark:text-slate-100">
                          {item.marked ? <Marked text={item.label} query={q} /> : item.label}
                        </bdi>
                        {item.sublabel && <bdi dir="auto" className="truncate text-xs text-slate-500 dark:text-slate-400">{item.sublabel}</bdi>}
                      </div>
                      {item.snippet && (
                        <p dir="auto" className="text-xs text-slate-600 dark:text-slate-400 line-clamp-2 wrap-break-word"><Marked text={item.snippet} query={q} /></p>
                      )}
                      {item.project && <p className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-x-1"><FolderOpen className="w-3 h-3" /><bdi>{item.project}</bdi></p>}
                    </div>
                    {selected && <CornerDownLeft className="w-3.5 h-3.5 mt-1 shrink-0 text-slate-400 rtl:-scale-x-100" aria-hidden="true" />}
                  </div>
                );
              })}
            </div>
          ))}
          {q.length >= 2 && current && !current.error && flat.length === 0 && (
            <p className="px-4 py-8 text-center text-sm text-slate-500 dark:text-slate-400">{t('palette.noMatches', { query: q })}</p>
          )}
          {q.length === 1 && flat.length === 0 && (
            <p className="px-4 py-8 text-center text-sm text-slate-500 dark:text-slate-400">{t('palette.keepTyping')}</p>
          )}
          {current?.error && <p className="px-4 py-3 text-sm text-red-600 dark:text-red-400">{current.error}</p>}
        </div>

        <div className="hidden md:flex items-center gap-x-4 px-4 py-2 border-t border-slate-200 dark:border-slate-700 text-[11px] text-slate-500 dark:text-slate-400">
          <span><kbd className="font-sans">↑</kbd> <kbd className="font-sans">↓</kbd> {t('palette.hintMove')}</span>
          <span><kbd className="font-sans">↵</kbd> {t('palette.hintOpen')}</span>
          <span><kbd className="font-sans">Esc</kbd> {t('palette.hintClose')}</span>
          <span className="ms-auto truncate">
            {allProjects || !activeProject ? t('palette.scopeAll') : t('palette.scopeProject', { name: activeProject.name })}
          </span>
        </div>
      </div>
    </div>,
    document.body,
  );
};

export default CommandPalette;
