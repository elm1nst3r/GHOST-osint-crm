// File: frontend/src/components/graph/GraphView.jsx
//
// The graph (graph plan, phase 1), replacing ObsidianGraph and the React
// Flow diagram. One component, three places:
//   variant "full"      the Relationships section: filters, layers, types,
//                       layouts, connect mode, export, fullscreen;
//   variant "embedded"  the person and business dialogs: the graph around
//                       that entity (`focus`), with depth;
//   variant "compact"   the Dashboard: a small interactive graph.
// In the full view, "Centre here" turns it into the graph around one entity,
// with a way back to the whole project.
//
// Phase 2 (working from the graph): an inspector for what's selected (beside
// the full graph, as a card elsewhere), a right-click / long-press menu,
// multiple selection, neighbours brought in on request, hide and pin with
// undo, editing and deleting links, new entities created where you click,
// tool searches on a person.
import { lazy, Suspense, useEffect, useEffectEvent, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Network, Filter, RefreshCw, Maximize2, Minimize2, ZoomIn, ZoomOut, Scan, Link2, Download,
  Loader2, AlertCircle, ArrowLeft, Shuffle, SlidersHorizontal, Undo2, Eye,
} from 'lucide-react';
import GraphCanvas from './GraphCanvas';
import { Legend, FilterPanel, ConnectDialog, TypeSwitches, LayerSwitches } from './GraphPanels';
import { Inspector, ContextMenu, SelectionBar } from './GraphActions';
import { useGraphEdits } from './useGraphEdits';
import { graphAPI, casesAPI, toolsAPI, peopleAPI } from '../../utils/api';
import { runnableTools } from '../../utils/integrations';
import { useModules } from '../../contexts/ModulesContext';
import { useProject } from '../../contexts/ProjectContext';
import { useTheme } from '../../contexts/ThemeContext';
import { DEFAULT_EDGE_LAYERS } from '../../utils/edgeLayers';
import { formatPersonName } from '../../utils/personName';
import { useModelOptions } from '../../utils/useModelOptions';
import { optionLabel } from '../../utils/optionLabels';
import {
  NODE_TYPES, DEFAULT_NODE_TYPES, EMPTY_FILTERS, includeFor, filterGraph, toElements,
  filterOptions, activeFilterCount, countByType, mergeGraphs,
} from '../../utils/graphElements';
import { buildStylesheet, readGraphTheme, FALLBACK_THEME } from '../../utils/graphStyle';
import { useOpenEntity, useEntityForms } from './useOpenEntity';

const ToolRunModal = lazy(() => import('../tools/ToolRunModal'));

const ALL_TYPES = Object.fromEntries(NODE_TYPES.map((type) => [type, true]));
const LINKABLE = ['person', 'business', 'crypto_wallet'];

const toolButton = 'p-1.5 rounded-md text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-40';
const pressed = 'bg-accent-primary text-white hover:bg-accent-primary';

export default function GraphView({ focus = null, variant = 'full' }) {
  const { t } = useTranslation();
  const { activeProjectId } = useProject();
  const { theme, darkMode, darkFlavour } = useTheme();
  const openEntity = useOpenEntity();
  const forms = useEntityForms();
  const { isOn: moduleOn } = useModules();
  const connectionTypes = useModelOptions('connection_type');
  const canvasRef = useRef(null);
  const rootRef = useRef(null);
  const full = variant === 'full';
  const compact = variant === 'compact';

  // Re-centred on an entity ("Centre here"); dialogs start centred on theirs.
  const [centre, setCentre] = useState(null);
  const focusId = centre || focus;
  const [depth, setDepth] = useState(1);

  const [graph, setGraph] = useState({ nodes: [], edges: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);
  // Which centre and depth the loaded graph is for; a new one is laid out afresh.
  const [loadedFor, setLoadedFor] = useState(null);

  const [types, setTypes] = useState(focus ? ALL_TYPES : DEFAULT_NODE_TYPES);
  const [identifierMode, setIdentifierMode] = useState('shared');
  // Around one entity its money matters: transaction links on from the start.
  const [layers, setLayers] = useState(focus ? { ...DEFAULT_EDGE_LAYERS, financial: true } : DEFAULT_EDGE_LAYERS);
  const [solo, setSolo] = useState(null);
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [showFilters, setShowFilters] = useState(false);
  const [layout, setLayout] = useState('force');
  const [connectMode, setConnectMode] = useState(false);
  const [selection, setSelection] = useState(null);
  const [connecting, setConnecting] = useState(null);
  const [fullScreen, setFullScreen] = useState(false);
  const [showSwitches, setShowSwitches] = useState(false); // phones: types and layers fold away
  const [cases, setCases] = useState([]);
  const [graphTheme, setGraphTheme] = useState(FALLBACK_THEME);
  // Phase 2
  const edits = useGraphEdits(canvasRef);
  const [extra, setExtra] = useState({ nodes: [], edges: [] }); // neighbours brought in
  const [multi, setMulti] = useState([]); // ids of a multiple selection
  const [listMulti, setListMulti] = useState(false);
  const [menu, setMenu] = useState(null);
  const [toolRun, setToolRun] = useState(null);
  const [placeAt, setPlaceAt] = useState(null);
  const pointerInside = useRef(false);

  // ── Data ──
  const include = includeFor(focusId ? ALL_TYPES : types, layers, solo).join(',');
  const load = useEffectEvent(() => {
    if (!focusId && !activeProjectId) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    const params = focusId
      ? { focus: focusId, depth }
      : { project_id: activeProjectId, include, identifiers: identifierMode };
    graphAPI.get(params)
      .then((data) => {
        if (cancelled) return;
        setGraph({ nodes: data.nodes || [], edges: data.edges || [] });
        setLoadedFor(`${focusId}|${depth}`);
        setLoading(false);
        // A "new … here" that was cancelled leaves nothing to place.
        if (placeAt) setTimeout(() => setPlaceAt(null), 2000);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err.message);
        setLoading(false);
      });
    return () => { cancelled = true; };
  });
  useEffect(() => load(), [focusId, depth, activeProjectId, include, identifierMode, reloadKey]);


  // An edit or create form opened from here closed: show the change.
  const formWasOpen = useRef(false);
  const afterForm = useEffectEvent(() => {
    if (formWasOpen.current && !forms.open) setReloadKey((k) => k + 1);
    formWasOpen.current = forms.open;
  });
  useEffect(() => afterForm(), [forms.open]);

  // Ctrl/Cmd+Z undoes graph edits while the pointer is over this graph.
  const onKey = useEffectEvent((e) => {
    if (!pointerInside.current) return;
    if (/^(INPUT|TEXTAREA|SELECT)$/.test(e.target?.tagName)) return;
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !e.shiftKey) { e.preventDefault(); edits.undo(); }
    if (e.key === 'Escape') { setMenu(null); setSelection(null); setMulti([]); canvasRef.current?.unselectAll(); }
  });
  useEffect(() => {
    const handler = (e) => onKey(e);
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const loadCases = useEffectEvent(() => {
    if (!full || !activeProjectId) return;
    casesAPI.getAll({ project_id: activeProjectId }).then((rows) => setCases(Array.isArray(rows) ? rows : [])).catch(() => {});
  });
  useEffect(() => loadCases(), [activeProjectId]);

  // ── Theme → stylesheet ──
  const themeKey = `${theme?.id}|${darkMode}|${darkFlavour}`;
  const readTheme = useEffectEvent(() => {
    if (rootRef.current) setGraphTheme(readGraphTheme(rootRef.current, { matrix: theme?.id === 'matrix' }));
  });
  useEffect(() => readTheme(), [themeKey]);
  const stylesheet = buildStylesheet(graphTheme);

  // ── What's drawn ──
  const edgeLabel = (type) => {
    const option = connectionTypes.find((o) => o.value === type);
    if (option) return optionLabel(t, 'connection_type', type, option.label);
    return t(`graph.edgeType.${type}`, { defaultValue: type });
  };
  const formatName = (node) => formatPersonName(node, node.label);
  // Memoised by the React Compiler: recomputed only when what they read changes.
  const combined = mergeGraphs(graph, extra);
  const visible = filterGraph(combined, { types, filters, layers, solo, focusId, formatName, keep: edits.keep, hidden: edits.hidden });
  const elements = toElements(visible, { formatName, focusId, edgeLabel });
  const counts = countByType(visible.nodes);
  const options = filterOptions(graph);

  // ── Actions ──
  // A new centre: hand edits and brought-in neighbours start over. (A new
  // project or dialog entity mounts a new GraphView: the section and the
  // dialogs key it.)
  const startOver = () => { edits.reset(); setExtra({ nodes: [], edges: [] }); setSelection(null); setMulti([]); setMenu(null); };
  const centreOn = (nodeId) => { startOver(); setCentre(nodeId); };
  const backToProject = () => { startOver(); setCentre(null); };
  const reload = () => setReloadKey((k) => k + 1);
  const selectNode = (id) => {
    const node = combined.nodes.find((n) => n.id === id);
    if (!node) return;
    if (edits.hidden.includes(id)) edits.bringIn([id]);
    setMulti([]);
    setSelection({ kind: 'node', data: node });
    canvasRef.current?.select([id]);
  };
  const expand = (node) => {
    graphAPI.get({ focus: node.id, depth: 1 })
      .then((g) => {
        setExtra((prev) => mergeGraphs(prev, { nodes: g.nodes || [], edges: g.edges || [] }));
        edits.bringIn((g.nodes || []).map((n) => n.id));
      })
      .catch((err) => setError(err.message));
  };
  const search = (node) => {
    Promise.all([peopleAPI.getById(node.entity_id), toolsAPI.getAll({ project_id: node.project_id })])
      .then(([person, tools]) => setToolRun({ person, tools: runnableTools(tools) }))
      .catch((err) => setError(err.message));
  };
  const allIds = visible.nodes.map((n) => n.id);
  const actions = {
    open: (n) => openEntity(n.type, n.entity_id),
    edit: (n) => n && forms.edit(n.type, n.entity_id),
    centre: (n) => centreOn(n.id),
    canCentre: !compact,
    expand,
    hide: (ids) => { edits.hide(ids); setSelection(null); setMulti([]); },
    showOnly: (ids) => { edits.showOnly(ids, allIds); setMulti([]); },
    unhideAll: () => edits.unhideAll(),
    hiddenCount: edits.hidden.length,
    canHide: (n) => n.id !== focusId,
    togglePin: (ids) => edits.togglePin(ids),
    isPinned: (id) => edits.pinned.includes(id),
    layoutSelected: () => canvasRef.current?.layoutSelected(),
    undo: () => edits.undo(),
    canUndo: edits.canUndo,
    fit: () => canvasRef.current?.fit(),
    selectNode,
    selectEdge: (e) => { setMulti([]); setSelection({ kind: 'edge', data: e }); canvasRef.current?.select([e.id]); },
    connectFrom: (n) => { setConnectMode(true); canvasRef.current?.select([n.id]); },
    search,
    canSearch: moduleOn('tools'),
    canCreate: full && !focusId,
    createAt: (type, model) => { setPlaceAt(model); forms.create(type); },
    connectionTypes,
    changed: () => { setSelection(null); reload(); },
  };
  const exportPng = () => {
    const uri = canvasRef.current?.png();
    if (!uri) return;
    const a = document.createElement('a');
    a.href = uri;
    a.download = `ghost-graph-${new Date().toISOString().slice(0, 10)}.png`;
    a.click();
  };
  const zoomIn = () => canvasRef.current?.zoomBy(1.3);
  const zoomOut = () => canvasRef.current?.zoomBy(1 / 1.3);
  const fit = () => canvasRef.current?.fit();
  const canConnect = (a, b) => LINKABLE.includes(a.type) && LINKABLE.includes(b.type);

  const containerClass = fullScreen
    ? 'fixed inset-0 z-50 flex flex-col bg-white dark:bg-slate-900'
    : 'h-full w-full flex flex-col';

  return (
    <div ref={rootRef} className={containerClass}>
      {/* Toolbar */}
      {!compact && (
        <div className="flex flex-wrap items-center gap-2 px-3 py-2 border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shrink-0">
          {centre && (
            <button type="button" onClick={backToProject} className="btn btn-ghost px-2.5 py-1.5 text-sm flex items-center gap-x-1">
              <ArrowLeft className="w-4 h-4 rtl:rotate-180" />{focus ? t('graph.back') : t('graph.wholeProject')}
            </button>
          )}
          <span className="flex items-center gap-x-2 text-sm text-slate-600 dark:text-slate-300 me-auto" data-volatile>
            <Network className="w-4 h-4 text-accent-ink" />
            {t('graph.summary', { nodes: visible.nodes.length, edges: visible.edges.length })}
          </span>

          {focusId && (
            <label className="flex items-center gap-x-1 text-sm text-slate-600 dark:text-slate-300">
              {t('graph.depth')}
              <select value={depth} onChange={(e) => setDepth(Number(e.target.value))} className="py-1 text-sm">
                {[1, 2, 3].map((d) => <option key={d} value={d}>{t('graph.depthHops', { count: d })}</option>)}
              </select>
            </label>
          )}
          <select value={layout} onChange={(e) => setLayout(e.target.value)} className="py-1 text-sm" aria-label={t('graph.layout')}>
            {['force', 'hierarchical', 'concentric', 'circle', 'grid'].map((l) => <option key={l} value={l}>{t(`graph.layouts.${l}`)}</option>)}
          </select>
          <button type="button" className={toolButton} onClick={() => canvasRef.current?.relayout()} title={t('graph.relayout')} aria-label={t('graph.relayout')}><Shuffle className="w-4 h-4" /></button>
          <button
            type="button"
            className={`${toolButton} md:hidden ${showSwitches ? pressed : ''}`}
            onClick={() => setShowSwitches(!showSwitches)}
            aria-pressed={showSwitches}
            aria-label={t('graph.entityTypes')}
            title={t('graph.entityTypes')}
          >
            <SlidersHorizontal className="w-4 h-4" />
          </button>
          {full && (
            <button
              type="button"
              onClick={() => setShowFilters(!showFilters)}
              className={`btn ${showFilters ? 'btn-primary' : 'btn-ghost'} px-2.5 py-1.5 text-sm flex items-center gap-x-1`}
            >
              <Filter className="w-4 h-4" />
              <span className="hidden sm:inline">{t('graph.filters')}</span>
              {activeFilterCount(filters) > 0 && <span className="px-1.5 rounded-full text-xs bg-white/90 text-accent-ink">{activeFilterCount(filters)}</span>}
            </button>
          )}
          <button
            type="button"
            className={`${toolButton} ${connectMode ? pressed : ''}`}
            onClick={() => setConnectMode(!connectMode)}
            aria-pressed={connectMode}
            title={t('graph.connectModeTitle')}
            aria-label={t('graph.connectMode')}
          >
            <Link2 className="w-4 h-4" />
          </button>
          {edits.hidden.length > 0 && (
            <button type="button" onClick={edits.unhideAll} className="btn btn-ghost px-2.5 py-1.5 text-sm flex items-center gap-x-1">
              <Eye className="w-4 h-4" />{t('graph.showHidden', { count: edits.hidden.length })}
            </button>
          )}
          <button type="button" className={toolButton} onClick={edits.undo} disabled={!edits.canUndo} title={t('graph.undoTitle')} aria-label={t('graph.undo')}><Undo2 className="w-4 h-4" /></button>
          <button type="button" className={toolButton} onClick={exportPng} title={t('graph.exportPng')} aria-label={t('graph.exportPng')}><Download className="w-4 h-4" /></button>
          <button type="button" className={toolButton} onClick={() => setReloadKey((k) => k + 1)} title={t('graph.refresh')} aria-label={t('graph.refresh')}><RefreshCw className="w-4 h-4" /></button>
          <button
            type="button"
            className={toolButton}
            onClick={() => setFullScreen(!fullScreen)}
            title={fullScreen ? t('graph.exitFullscreen') : t('graph.fullscreen')}
            aria-label={fullScreen ? t('graph.exitFullscreen') : t('graph.fullscreen')}
          >
            {fullScreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
        </div>
      )}

      {/* Types and layers */}
      {!compact && (
        <div className={`${showSwitches ? 'flex' : 'hidden'} md:flex flex-wrap items-center gap-x-4 gap-y-1 px-3 py-1.5 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-xs shrink-0`}>
          <TypeSwitches
            types={types}
            onChange={setTypes}
            counts={counts}
            colors={graphTheme.node}
            identifierMode={focusId ? null : identifierMode}
            onIdentifierMode={setIdentifierMode}
          />
          <LayerSwitches layers={layers} onChange={setLayers} solo={solo} onSolo={setSolo} colors={graphTheme.edge} />
        </div>
      )}

      {full && showFilters && (
        <FilterPanel filters={filters} onChange={setFilters} cases={cases} options={options} edgeLabel={edgeLabel} />
      )}

      {connectMode && (
        <div className="px-3 py-1.5 text-xs bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-200 border-b border-amber-200 dark:border-amber-900 shrink-0">
          {t('graph.connectHint')}
        </div>
      )}

      {/* Canvas, and beside it the inspector (full view, wide screens) */}
      <div className="relative flex-1 min-h-0 flex">
      <div
        className="relative flex-1 min-w-0"
        style={{ background: graphTheme.bg }}
        onPointerEnter={() => { pointerInside.current = true; }}
        onPointerLeave={() => { pointerInside.current = false; }}
        onContextMenu={(e) => e.preventDefault()}
      >
        <GraphCanvas
          ref={canvasRef}
          elements={elements}
          stylesheet={stylesheet}
          layout={layout}
          connectMode={connectMode}
          focusId={focusId}
          resetKey={loadedFor}
          canConnect={canConnect}
          onSelect={(sel) => { setSelection(sel); setListMulti(false); }}
          onOpen={(node) => openEntity(node.type, node.entity_id)}
          onConnect={(a, b) => setConnecting({ source: a, target: b })}
          pinned={edits.pinned}
          placeHint={placeAt}
          onPlaced={() => setPlaceAt(null)}
          onContextMenu={compact ? null : setMenu}
          onSelectionChange={(ids) => { setMulti(ids); if (ids.length < 2) setListMulti(false); }}
          onMoved={edits.moved}
          minimap={!compact}
          minimapColors={{ node: graphTheme.node, edge: graphTheme.edge.other, view: graphTheme.selected }}
        />

        {loading && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <Loader2 className="w-7 h-7 animate-spin text-white/70" />
          </div>
        )}
        {error && (
          <div className="absolute inset-0 flex items-center justify-center p-6">
            <div className="flex items-center gap-x-2 text-sm text-red-300"><AlertCircle className="w-5 h-5" />{error}</div>
          </div>
        )}
        {!loading && !error && visible.nodes.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center p-6 text-sm text-white/60 text-center pointer-events-none">
            {graph.nodes.length ? t('graph.nothingMatches') : t('graph.empty')}
          </div>
        )}

        {/* Zoom controls */}
        <div className="absolute top-3 end-3 flex flex-col gap-1 z-10">
          <ZoomButton icon={ZoomIn} label={t('graph.zoomIn')} onClick={zoomIn} />
          <ZoomButton icon={ZoomOut} label={t('graph.zoomOut')} onClick={zoomOut} />
          <ZoomButton icon={Scan} label={t('graph.fit')} onClick={fit} />
        </div>

        {multi.length > 1 && !compact && (
          <SelectionBar
            count={multi.length}
            onHide={() => actions.hide(multi)}
            onShowOnly={() => actions.showOnly(multi)}
            onPin={() => actions.togglePin(multi)}
            onLayout={actions.layoutSelected}
            onList={() => { setSelection(null); setListMulti(true); }}
            onClear={() => { canvasRef.current?.unselectAll(); setMulti([]); }}
          />
        )}

        {/* Dialogs and the dashboard: the inspector as a card on the canvas */}
        {!full && (selection || listMulti) && (
          <div className="absolute top-3 start-3 z-20 w-80 max-w-[calc(100%-4.5rem)] max-h-[calc(100%-1.5rem)] overflow-y-auto rounded-xl bg-white/95 dark:bg-slate-800/95 backdrop-blur shadow-xl border border-slate-200 dark:border-slate-700 p-4">
            <Inspector selection={selection} graph={combined} multi={listMulti ? multi : []} edgeLabel={edgeLabel} formatName={formatName}
              colors={graphTheme} actions={actions} onClose={() => { setSelection(null); setListMulti(false); }} />
          </div>
        )}

        {menu && (
          <ContextMenu menu={menu} graph={combined} multi={multi} formatName={formatName} actions={actions} onClose={() => setMenu(null)} />
        )}

        {!compact && <Legend counts={counts} colors={graphTheme} layers={layers} solo={solo} />}
      </div>

      {/* The full view: the inspector beside the canvas (a sheet over it on phones) */}
      {full && (selection || listMulti) && (
        <aside className="absolute md:static inset-x-0 bottom-0 z-20 max-h-[55%] md:max-h-none md:w-80 shrink-0 overflow-y-auto p-4 bg-white dark:bg-slate-800 border-t md:border-t-0 md:border-s border-slate-200 dark:border-slate-700 shadow-xl md:shadow-none"
          aria-label={t('graph.inspector')}>
          <Inspector selection={selection} graph={combined} multi={listMulti ? multi : []} edgeLabel={edgeLabel} formatName={formatName}
            colors={graphTheme} actions={actions} onClose={() => { setSelection(null); setListMulti(false); }} />
        </aside>
      )}
      </div>

      {connecting && (
        <ConnectDialog
          source={connecting.source}
          target={connecting.target}
          formatName={formatName}
          connectionTypes={connectionTypes}
          onClose={() => setConnecting(null)}
          onSaved={() => { setConnecting(null); reload(); }}
        />
      )}

      {toolRun && (
        <Suspense fallback={null}>
          <ToolRunModal tools={toolRun.tools} person={toolRun.person} onClose={() => setToolRun(null)} onAdded={() => reload()} />
        </Suspense>
      )}
    </div>
  );
}

function ZoomButton({ icon: Icon, label, onClick }) {
  return (
    <button type="button" onClick={onClick} title={label} aria-label={label}
      className="p-1.5 rounded-md bg-black/40 text-white/90 hover:bg-black/60 backdrop-blur-sm">
      <Icon className="w-4 h-4" />
    </button>
  );
}
