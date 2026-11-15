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
import { useEffect, useEffectEvent, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Network, Filter, RefreshCw, Maximize2, Minimize2, ZoomIn, ZoomOut, Scan, Link2, Download,
  Loader2, AlertCircle, ArrowLeft, Shuffle, SlidersHorizontal,
} from 'lucide-react';
import GraphCanvas from './GraphCanvas';
import { SelectionCard, Legend, FilterPanel, ConnectDialog, TypeSwitches, LayerSwitches } from './GraphPanels';
import { graphAPI, casesAPI } from '../../utils/api';
import { useProject } from '../../contexts/ProjectContext';
import { useTheme } from '../../contexts/ThemeContext';
import { DEFAULT_EDGE_LAYERS } from '../../utils/edgeLayers';
import { formatPersonName } from '../../utils/personName';
import { useModelOptions } from '../../utils/useModelOptions';
import { optionLabel } from '../../utils/optionLabels';
import {
  NODE_TYPES, DEFAULT_NODE_TYPES, EMPTY_FILTERS, includeFor, filterGraph, toElements,
  filterOptions, activeFilterCount, countByType,
} from '../../utils/graphElements';
import { buildStylesheet, readGraphTheme, FALLBACK_THEME } from '../../utils/graphStyle';
import { useOpenEntity } from './useOpenEntity';

const ALL_TYPES = Object.fromEntries(NODE_TYPES.map((type) => [type, true]));
const LINKABLE = ['person', 'business', 'crypto_wallet'];

const toolButton = 'p-1.5 rounded-md text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-40';
const pressed = 'bg-accent-primary text-white hover:bg-accent-primary';

export default function GraphView({ focus = null, variant = 'full' }) {
  const { t } = useTranslation();
  const { activeProjectId } = useProject();
  const { theme, darkMode, darkFlavour } = useTheme();
  const openEntity = useOpenEntity();
  const connectionTypes = useModelOptions('connection_type');
  const canvasRef = useRef(null);
  const rootRef = useRef(null);
  const full = variant === 'full';
  const compact = variant === 'compact';

  // The full view can be re-centred on an entity; dialogs always are.
  const [centre, setCentre] = useState(null);
  const focusId = focus || centre;
  const [depth, setDepth] = useState(1);

  const [graph, setGraph] = useState({ nodes: [], edges: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);
  // Which centre and depth the loaded graph is for; a new one is laid out afresh.
  const [loadedFor, setLoadedFor] = useState(null);

  const [types, setTypes] = useState(focus ? ALL_TYPES : DEFAULT_NODE_TYPES);
  const [identifierMode, setIdentifierMode] = useState('shared');
  const [layers, setLayers] = useState(DEFAULT_EDGE_LAYERS);
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
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err.message);
        setLoading(false);
      });
    return () => { cancelled = true; };
  });
  useEffect(() => load(), [focusId, depth, activeProjectId, include, identifierMode, reloadKey]);

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
  const visible = filterGraph(graph, { types, filters, layers, solo, focusId, formatName });
  const elements = toElements(visible, { formatName, focusId, edgeLabel });
  const counts = countByType(visible.nodes);
  const options = filterOptions(graph);

  // ── Actions ──
  const centreOn = (nodeId) => { setSelection(null); setCentre(nodeId); };
  const backToProject = () => { setSelection(null); setCentre(null); };
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
              <ArrowLeft className="w-4 h-4 rtl:rotate-180" />{t('graph.wholeProject')}
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

      {/* Canvas */}
      <div className="relative flex-1 min-h-0" style={{ background: graphTheme.bg }}>
        <GraphCanvas
          ref={canvasRef}
          elements={elements}
          stylesheet={stylesheet}
          layout={layout}
          connectMode={connectMode}
          focusId={focusId}
          resetKey={loadedFor}
          canConnect={canConnect}
          onSelect={setSelection}
          onOpen={(node) => openEntity(node.type, node.entity_id)}
          onConnect={(a, b) => setConnecting({ source: a, target: b })}
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

        {selection && (
          <SelectionCard
            selection={selection}
            graph={graph}
            edgeLabel={edgeLabel}
            formatName={formatName}
            colors={graphTheme}
            onOpen={(node) => openEntity(node.type, node.entity_id)}
            onCentre={full || focus ? (node) => centreOn(node.id) : null}
            onClose={() => setSelection(null)}
          />
        )}

        {!compact && <Legend counts={counts} colors={graphTheme} layers={layers} solo={solo} />}
      </div>

      {connecting && (
        <ConnectDialog
          source={connecting.source}
          target={connecting.target}
          formatName={formatName}
          connectionTypes={connectionTypes}
          onClose={() => setConnecting(null)}
          onSaved={() => { setConnecting(null); setReloadKey((k) => k + 1); }}
        />
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
