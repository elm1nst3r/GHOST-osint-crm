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
//
// Phase 3 (analysis): find (`/`), shortest path, focus with a breadcrumb,
// size by connections / PageRank / betweenness, folded leaves, cases as
// boxes or colour by connected group, saved layouts per user, statistics,
// the graph as of a date, and GraphML / JSON export. The pipeline: loaded →
// as of the date → filters → focus → (path, find, sizes) → folding → drawn.
import { lazy, Suspense, useDeferredValue, useEffect, useEffectEvent, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router';
import {
  Network, Filter, RefreshCw, Maximize2, Minimize2, ZoomIn, ZoomOut, Scan, Link2, Download,
  Loader2, AlertCircle, ArrowLeft, Shuffle, SlidersHorizontal, Undo2, Eye, Settings2, CalendarClock, ChartColumn,
  PanelRightClose, PanelRightOpen, Keyboard, SquareArrowOutUpRight,
} from 'lucide-react';
import GraphCanvas from './GraphCanvas';
import {
  Legend, FilterPanel, ConnectDialog, TypeSwitches, LayerSwitches,
  FindBox, Popover, ViewOptions, ExportOptions, AsOfBar, FocusTrail, ShortcutsDialog,
} from './GraphPanels';
import { Inspector, ContextMenu, SelectionBar, PathPanel, StatsPanel, PanelEmpty } from './GraphActions';
import { useShowInGraph, FOCUS_RE } from '../../utils/useShowInGraph';
import { useWide } from '../../utils/useWide';
import { useGraphEdits } from './useGraphEdits';
import { graphAPI, casesAPI, toolsAPI, peopleAPI } from '../../utils/api';
import { runnableTools } from '../../utils/integrations';
import { useModules } from '../../contexts/ModulesContext';
import { useProject } from '../../contexts/ProjectContext';
import { useTheme } from '../../contexts/ThemeContext';
import { useAuth } from '../../contexts/AuthContext';
import { readGraphPrefs, writeGraphPrefs, DEFAULT_PREFS } from '../../utils/graphPrefs';
import { ui } from './graphUi';
import { formatPersonName } from '../../utils/personName';
import { useModelOptions } from '../../utils/useModelOptions';
import { optionLabel } from '../../utils/optionLabels';
import { formatDate } from '../../utils/format';
import {
  NODE_TYPES, includeFor, filterGraph, toElements,
  filterOptions, activeFilterCount, countByType, mergeGraphs, LARGE_GRAPH,
} from '../../utils/graphElements';
import { buildStylesheet, readGraphTheme, FALLBACK_THEME } from '../../utils/graphStyle';
import {
  findMatches, shortestPath, neighbourhoodOf, pageRank, betweenness, sizeWeights, groupColors,
  collapseLeaves, atDate, dateSpan, graphStats, toGraphML, toGraphJSON,
} from '../../utils/graphAnalysis';
import { useOpenEntity, useEntityForms } from './useOpenEntity';

const ToolRunModal = lazy(() => import('../tools/ToolRunModal'));

// A labelled row of chips: the chips wrap beside the label, not under it.
const switchRow = 'flex items-start gap-x-3 px-4 py-2 border-b border-slate-200 dark:border-slate-700';
const ALL_TYPES = Object.fromEntries(NODE_TYPES.map((type) => [type, true]));
const LINKABLE = ['person', 'business', 'crypto_wallet'];

// Saves a text file the browser downloads.
function download(text, name, type) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}


// `title`: the full view's heading (the Entity Network section has no
// other header: the graph is the page).
export default function GraphView({ focus = null, variant = 'full', title = null }) {
  const { t } = useTranslation();
  const { activeProjectId } = useProject();
  const { theme, darkMode, darkFlavour } = useTheme();
  const openEntity = useOpenEntity();
  const forms = useEntityForms();
  const { isOn: moduleOn } = useModules();
  const { currentUser } = useAuth();
  const connectionTypes = useModelOptions('connection_type');
  const canvasRef = useRef(null);
  const rootRef = useRef(null);
  const full = variant === 'full';
  const compact = variant === 'compact';

  // Re-centred on an entity ("Centre here"); dialogs start centred on theirs.
  // In the Entity Network section the centre is in the address
  // (/relationships?focus=person:12): "Show in graph" links there, and Back
  // and Forward step through centres.
  const [searchParams, setSearchParams] = useSearchParams();
  const urlFocus = searchParams.get('focus');
  const [localCentre, setLocalCentre] = useState(null);
  const centre = full ? (FOCUS_RE.test(urlFocus || '') ? urlFocus : null) : localCentre;
  const setCentre = (id) => {
    if (full) setSearchParams(id ? { focus: id } : {});
    else setLocalCentre(id);
  };
  const wide = useWide();
  const showInGraph = useShowInGraph();
  const focusId = centre || focus;
  const [depth, setDepth] = useState(1);

  const [graph, setGraph] = useState({ nodes: [], edges: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);
  // Which centre and depth the loaded graph is for; a new one is laid out afresh.
  const [loadedFor, setLoadedFor] = useState(null);

  // Everything on to start with; the Relationships section remembers what
  // the user switched off or filtered (per user, this browser), the
  // dashboard follows its types and links, a dialog always shows it all.
  const [prefs] = useState(() => (focus ? DEFAULT_PREFS : readGraphPrefs(currentUser?.id)));
  const remembered = full ? prefs : DEFAULT_PREFS;
  const [types, setTypes] = useState(prefs.types);
  const [identifierMode, setIdentifierMode] = useState(remembered.identifierMode);
  const [layers, setLayers] = useState(prefs.layers);
  const [solo, setSolo] = useState(remembered.solo);
  const [filters, setFilters] = useState(remembered.filters);
  const [showFilters, setShowFilters] = useState(remembered.showFilters);
  const [layout, setLayout] = useState(remembered.layout);
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
  // Phase 3
  const findRef = useRef(null);
  const [findTerm, setFindTerm] = useState('');
  const [findIndex, setFindIndex] = useState(-1);
  const [pathEnds, setPathEnds] = useState(null); // { from, to } (to null while picking)
  const [trail, setTrail] = useState([]); // focus steps: [{ id, hops }]
  const [sizeBy, setSizeBy] = useState(remembered.sizeBy);
  const [groupBy, setGroupBy] = useState(remembered.groupBy);
  const [collapse, setCollapse] = useState(remembered.collapse);
  const [showPanel, setShowPanel] = useState(remembered.showPanel);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [unfolded, setUnfolded] = useState([]);
  const [asOf, setAsOf] = useState(null);
  const [showAsOf, setShowAsOf] = useState(false);
  const [showStats, setShowStats] = useState(false);
  const [graphProject, setGraphProject] = useState(null);
  const [savedLayout, setSavedLayout] = useState({ saved: false, positions: null });
  const [layoutState, setLayoutState] = useState({ busy: false, error: null });
  const viewKey = focusId ? `focus:${focusId}` : 'project';

  const saveScope = full ? currentUser?.id : undefined;
  useEffect(() => {
    if (saveScope === undefined) return;
    writeGraphPrefs(saveScope, { types, layers, solo, identifierMode, layout, sizeBy, groupBy, collapse, filters, showFilters, showPanel });
  }, [saveScope, types, layers, solo, identifierMode, layout, sizeBy, groupBy, collapse, filters, showFilters, showPanel]);

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
      // The caller's saved layout of this view comes with it.
      .then((data) => {
        const projectId = data.meta?.project_id ?? activeProjectId;
        return graphAPI.getLayout(projectId, viewKey).catch(() => null).then((saved) => ({ data, projectId, saved }));
      })
      .then(({ data, projectId, saved }) => {
        if (cancelled) return;
        setGraph({ nodes: data.nodes || [], edges: data.edges || [] });
        setGraphProject(projectId);
        setSavedLayout(saved?.saved ? saved : { saved: false, positions: null });
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


  // Cases: for the filters (full view) and to draw them as boxes.
  const casesProject = graphProject || activeProjectId;
  const loadCases = useEffectEvent(() => {
    if (!(full || groupBy === 'case') || !casesProject) return;
    casesAPI.getAll({ project_id: casesProject }).then((rows) => setCases(Array.isArray(rows) ? rows : [])).catch(() => {});
  });
  const casesAsBoxes = groupBy === 'case';
  const settledBoxes = useRef(false); // boxes were drawn: settle again when they go
  useEffect(() => loadCases(), [casesProject, casesAsBoxes]);

  // ── Theme → stylesheet ──
  const themeKey = `${theme?.id}|${darkMode}|${darkFlavour}`;
  const readTheme = useEffectEvent(() => {
    if (rootRef.current) setGraphTheme(readGraphTheme(rootRef.current, { matrix: theme?.id === 'matrix' }));
  });
  useEffect(() => readTheme(), [themeKey]);


  // ── What's drawn ──
  const edgeLabel = (type) => {
    const option = connectionTypes.find((o) => o.value === type);
    if (option) return optionLabel(t, 'connection_type', type, option.label);
    return t(`graph.edgeType.${type}`, { defaultValue: type });
  };
  const formatName = (node) => formatPersonName(node, node.label);
  // Memoised by the React Compiler: recomputed only when what they read changes.
  const combined = mergeGraphs(graph, extra);
  const dated = atDate(combined, asOf);
  const visible = filterGraph(dated, { types, filters, layers, solo, focusId, formatName, keep: edits.keep, hidden: edits.hidden });
  const focusStep = trail[trail.length - 1];
  const shown = focusStep && visible.nodes.some((n) => n.id === focusStep.id)
    ? neighbourhoodOf(visible, focusStep.id, focusStep.hops) : visible;
  const path = pathEnds?.to ? shortestPath(shown, pathEnds.from, pathEnds.to) : null;
  // Typing stays quick on big graphs: matching follows a moment later.
  const findDeferred = useDeferredValue(findTerm);
  const matches = findMatches(shown.nodes, findDeferred, formatName);
  const needBetween = sizeBy === 'betweenness' || showStats;
  // The costly ones only when asked for (the compiler keeps them until `shown` changes).
  const between = needBetween ? betweenness(shown) : null;
  const pagerank = sizeBy === 'pagerank' ? pageRank(shown) : null;
  const weights = sizeWeights(shown, sizeBy, { pagerank, between: between?.scores });
  // Folding leaves never hides what's found, on the path, selected or kept.
  // (Only worked out while folding: otherwise a selection would redraw.)
  const folding = collapse ? collapseLeaves(shown, {
    keep: new Set([
      ...matches, ...(path?.nodes || []), ...multi, ...edits.keep,
      ...(selection?.kind === 'node' ? [selection.data.id] : []), ...(focusId ? [focusId] : []),
    ]),
    unfolded: new Set(unfolded),
  }) : null;
  const drawn = folding ? folding.graph : shown;
  const folded = folding ? folding.folded : null;
  // A big graph doesn't fade the rest: that restyles thousands of elements.
  const marks = {
    match: new Set(matches),
    path: new Set([...(path?.nodes || []), ...(path?.edges || [])]),
    active: (matches.length > 0 || Boolean(path)) && drawn.nodes.length <= LARGE_GRAPH,
  };
  const elements = toElements(drawn, {
    formatName, focusId, edgeLabel, weights, marks, folded,
    groupColor: groupBy === 'component' ? groupColors(drawn) : null,
    cases: groupBy === 'case' ? cases : null,
  });
  const counts = countByType(drawn.nodes);
  const stylesheet = buildStylesheet(graphTheme, { transitions: drawn.nodes.length <= LARGE_GRAPH });
  const options = filterOptions(graph);
  const stats = showStats ? graphStats(shown, { between: between?.scores }) : null;
  const span = showAsOf ? dateSpan(combined) : null;

  // Found or a path: bring it into view.
  const matchKey = matches.join('|');
  const pathKey = path ? path.nodes.join('|') : '';
  const trailKey = trail.map((s) => `${s.id}/${s.hops}`).join('|');
  const showFound = useEffectEvent(() => { if (matches.length) canvasRef.current?.fitTo(matches); });
  useEffect(() => showFound(), [matchKey]);
  const showPath = useEffectEvent(() => { if (path) canvasRef.current?.fitTo(path.nodes); });
  useEffect(() => showPath(), [pathKey]);
  const settle = useEffectEvent(() => { canvasRef.current?.settle(); });
  // Boxes appear or go: the layout settles around them.
  const boxCount = elements.filter((el) => el.classes === 'grp').length;
  useEffect(() => { if (boxCount || settledBoxes.current) settle(); settledBoxes.current = boxCount > 0; }, [boxCount]);
  const showFocus = useEffectEvent(() => { canvasRef.current?.fit(); });
  useEffect(() => { if (trailKey) showFocus(); }, [trailKey]);

  // ── Actions ──
  // A new centre: hand edits and brought-in neighbours start over. (A new
  // project or dialog entity mounts a new GraphView: the section and the
  // dialogs key it.)
  const startOver = () => {
    edits.reset(); setExtra({ nodes: [], edges: [] }); setSelection(null); setMulti([]); setMenu(null);
    setTrail([]); setPathEnds(null); setUnfolded([]);
  };
  const centreOn = (nodeId) => { startOver(); setCentre(nodeId); };
  // The address changed the centre (Show in graph, Back, Forward): start
  // over, as "Centre here" does (state adjusted while rendering, not in an
  // effect).
  const [seenCentre, setSeenCentre] = useState(centre);
  if (centre !== seenCentre) {
    setSeenCentre(centre);
    if (full) startOver();
  }
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
  const allIds = drawn.nodes.map((n) => n.id);
  const changeFind = (term) => { setFindTerm(term); setFindIndex(-1); };
  const stepFind = (dir) => {
    if (!matches.length) return;
    const i = findIndex < 0 ? (dir > 0 ? 0 : matches.length - 1) : (findIndex + dir + matches.length) % matches.length;
    setFindIndex(i);
    selectNode(matches[i]);
    canvasRef.current?.centreOn(matches[i]);
  };
  const pickSelection = (sel) => {
    // Picking the other end of a path.
    if (pathEnds && !pathEnds.to && sel?.kind === 'node' && sel.data.id !== pathEnds.from) {
      setPathEnds({ from: pathEnds.from, to: sel.data.id });
    }
    setSelection(sel);
    setListMulti(false);
  };
  const saveLayout = () => {
    setLayoutState({ busy: true, error: null });
    const positions = canvasRef.current?.allPositions() || {};
    graphAPI.saveLayout(graphProject, viewKey, positions)
      .then((r) => { setSavedLayout({ saved: true, positions, updated_at: r.updated_at }); setLayoutState({ busy: false, error: null }); })
      .catch((err) => setLayoutState({ busy: false, error: err.message }));
  };
  const forgetLayout = () => {
    setLayoutState({ busy: true, error: null });
    graphAPI.deleteLayout(graphProject, viewKey)
      .then(() => { setSavedLayout({ saved: false, positions: null }); setLayoutState({ busy: false, error: null }); canvasRef.current?.relayout(); })
      .catch((err) => setLayoutState({ busy: false, error: err.message }));
  };
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
    // Phase 3
    focus: (n, hops) => setTrail((tr) => [...tr.filter((s) => s.id !== n.id), { id: n.id, hops }]),
    pathFrom: (n) => setPathEnds({ from: n.id, to: null }),
    pathBetween: (a, b) => setPathEnds({ from: a, to: b }),
    pathStart: pathEnds && !pathEnds.to ? pathEnds.from : null,
    foldedCount: (id) => folded?.get(id)?.length || 0,
    unfold: (id) => setUnfolded((u) => [...u, id]),
  };
  const exportAs = (format) => {
    const stamp = new Date().toISOString().slice(0, 10);
    if (format === 'png') {
      const uri = canvasRef.current?.png();
      if (!uri) return;
      const a = document.createElement('a');
      a.href = uri;
      a.download = `ghost-graph-${stamp}.png`;
      a.click();
      return;
    }
    const positions = canvasRef.current?.allPositions() || {};
    if (format === 'graphml') download(toGraphML(shown, { formatName, edgeLabel, positions }), `ghost-graph-${stamp}.graphml`, 'application/xml');
    else download(toGraphJSON(shown, { formatName, positions, meta: { project_id: graphProject, view: viewKey, as_of: asOf } }), `ghost-graph-${stamp}.json`, 'application/json');
  };
  // Keyboard shortcuts (`?` lists them). In the Entity Network section
  // they work anywhere on the page unless a dialog is open over it; in a
  // dialog's or the dashboard's graph only with the pointer over it.
  const overlayOpen = () => [...document.querySelectorAll('.fixed.inset-0')]
    .some((el) => !rootRef.current?.contains(el));
  const onKey = useEffectEvent((e) => {
    const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(e.target?.tagName) || e.target?.isContentEditable;
    if (typing || compact || showShortcuts) return;
    if (!(pointerInside.current || (full && !overlayOpen()))) return;
    if ((e.ctrlKey || e.metaKey) && !e.altKey && e.key.toLowerCase() === 'z' && !e.shiftKey) { e.preventDefault(); edits.undo(); return; }
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const picked = multi.length ? multi : (selection?.kind === 'node' ? [selection.data.id] : []);
    const keys = {
      '/': () => findRef.current?.focus(),
      '?': () => setShowShortcuts(true),
      Escape: () => { setMenu(null); setSelection(null); setMulti([]); canvasRef.current?.unselectAll(); },
      0: () => canvasRef.current?.fit(),
      '+': () => canvasRef.current?.zoomBy(1.3),
      '=': () => canvasRef.current?.zoomBy(1.3),
      '-': () => canvasRef.current?.zoomBy(1 / 1.3),
      l: () => canvasRef.current?.relayout(),
      f: () => full && setShowFilters((v) => !v),
      d: () => full && setShowPanel((v) => !v),
      s: () => setShowStats((v) => !v),
      t: () => { if (showAsOf) setAsOf(null); setShowAsOf(!showAsOf); },
      c: () => setConnectMode((v) => !v),
      h: () => { const ids = picked.filter((id) => id !== focusId); if (ids.length) actions.hide(ids); },
      p: () => { if (picked.length) actions.togglePin(picked); },
    };
    const run = keys[e.key.length === 1 ? e.key.toLowerCase() : e.key] || keys[e.key];
    if (!run) return;
    e.preventDefault();
    run();
  });
  useEffect(() => {
    const handler = (e) => onKey(e);
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const nameOf = (id) => { const n = combined.nodes.find((x) => x.id === id); return n ? formatName(n) || n.label : id; };
  const panels = (
    <div className="space-y-5">
      {pathEnds && (
        <PathPanel from={pathEnds.from} to={pathEnds.to} path={path} graph={combined} edgeLabel={edgeLabel} formatName={formatName}
          colors={graphTheme} actions={actions} onClose={() => setPathEnds(null)} />
      )}
      {(selection || listMulti) && (
        <Inspector selection={selection} graph={combined} multi={listMulti ? multi : []} edgeLabel={edgeLabel} formatName={formatName}
          colors={graphTheme} actions={actions} onClose={() => { setSelection(null); setListMulti(false); }} />
      )}
      {stats && (
        <StatsPanel stats={stats} approximate={between?.approximate} formatName={formatName} graph={combined}
          colors={graphTheme} actions={actions} onClose={() => setShowStats(false)} />
      )}
    </div>
  );
  const hasPanels = Boolean(selection || listMulti || pathEnds || stats);
  const sideFilters = full && showFilters && wide;
  const zoomIn = () => canvasRef.current?.zoomBy(1.3);
  const zoomOut = () => canvasRef.current?.zoomBy(1 / 1.3);
  const fit = () => canvasRef.current?.fit();
  const canConnect = (a, b) => LINKABLE.includes(a.type) && LINKABLE.includes(b.type);

  const containerClass = fullScreen
    ? 'fixed inset-0 z-50 flex flex-col bg-white dark:bg-slate-900'
    : 'h-full w-full flex flex-col';

  return (
    <div ref={rootRef} className={containerClass}>
      {/* Toolbar: what's shown on the left; then find, layout, view, edit
          and output, each group set apart by a divider. */}
      {!compact && (
        <div className="flex flex-wrap items-center gap-x-2 gap-y-2 px-4 py-2 border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shrink-0">
          {centre && (
            <button type="button" onClick={backToProject} className={ui.button}>
              <ArrowLeft className="w-4 h-4 rtl:rotate-180" />{focus ? t('graph.back') : t('graph.wholeProject')}
            </button>
          )}
          {/* The title (Entity Network) with the counts under it; without
              a title, the counts on their own. */}
          <div className="flex items-center gap-x-2 me-auto min-w-0">
            <Network className="w-4 h-4 text-accent-ink shrink-0" />
            <div className={`min-w-0 ${title ? 'leading-tight' : ''}`}>
              {title && <h1 className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">{title}</h1>}
              <span className={`block tabular-nums text-slate-600 dark:text-slate-300 ${title ? 'text-xs text-slate-500 dark:text-slate-400' : 'text-sm'}`} data-volatile>
                {t('graph.summary', { nodes: drawn.nodes.length, edges: drawn.edges.length })}
                {asOf && <span className="text-sky-700 dark:text-sky-300"> · {t('graph.asOfShort', { date: formatDate(asOf) })}</span>}
              </span>
            </div>
          </div>

          <FindBox inputRef={findRef} term={findTerm} onTerm={changeFind} count={matches.length} index={findIndex} onStep={stepFind} />
          <span className={ui.divider} aria-hidden="true" />

          <div className="flex items-center gap-1">
            {focusId && (
              <select value={depth} onChange={(e) => setDepth(Number(e.target.value))} className={ui.select} aria-label={t('graph.depth')} title={t('graph.depth')}>
                {[1, 2, 3].map((d) => <option key={d} value={d}>{t('graph.depthHops', { count: d })}</option>)}
              </select>
            )}
            <select value={layout} onChange={(e) => setLayout(e.target.value)} className={ui.select} aria-label={t('graph.layout')} title={t('graph.layout')}>
              {['force', 'hierarchical', 'concentric', 'circle', 'grid'].map((l) => <option key={l} value={l}>{t(`graph.layouts.${l}`)}</option>)}
            </select>
            <button type="button" className={ui.icon} onClick={() => canvasRef.current?.relayout()} title={t('graph.relayout')} aria-label={t('graph.relayout')}><Shuffle className="w-4 h-4" /></button>
          </div>
          <span className={ui.divider} aria-hidden="true" />

          <div className="flex items-center gap-1">
            <button
              type="button"
              className={`${ui.icon} md:hidden ${showSwitches ? ui.pressed : ''}`}
              onClick={() => setShowSwitches(!showSwitches)}
              aria-pressed={showSwitches}
              aria-label={t('graph.entityTypes')}
              title={t('graph.entityTypes')}
            >
              <SlidersHorizontal className="w-4 h-4" />
            </button>
            {full && (
              <button type="button" onClick={() => setShowFilters(!showFilters)} aria-pressed={showFilters}
                className={`${ui.button} ${showFilters ? ui.pressed : ''}`}>
                <Filter className="w-4 h-4" />
                <span className="hidden sm:inline">{t('graph.filters')}</span>
                {activeFilterCount(filters) > 0 && (
                  <span className="inline-flex items-center justify-center min-w-5 h-5 px-1 rounded-full text-[11px] font-semibold bg-accent-primary text-white tabular-nums">{activeFilterCount(filters)}</span>
                )}
              </button>
            )}
            <Popover icon={Settings2} label={t('graph.viewOptions')} active={sizeBy !== 'connections' || groupBy !== 'none' || collapse}>
              <ViewOptions
                sizeBy={sizeBy} onSizeBy={setSizeBy}
                groupBy={groupBy} onGroupBy={setGroupBy} canGroupByCase
                collapse={collapse} onCollapse={(on) => { setCollapse(on); setUnfolded([]); }}
                layout={graphProject ? { ...savedLayout, ...layoutState } : null}
                onSaveLayout={saveLayout} onForgetLayout={forgetLayout}
              />
            </Popover>
            <button type="button" className={`${ui.icon} ${showAsOf ? ui.pressed : ''}`} aria-pressed={showAsOf}
              onClick={() => { if (showAsOf) setAsOf(null); setShowAsOf(!showAsOf); }} title={t('graph.asOfTitle')} aria-label={t('graph.asOf')}>
              <CalendarClock className="w-4 h-4" />
            </button>
            <button type="button" className={`${ui.icon} ${showStats ? ui.pressed : ''}`} aria-pressed={showStats}
              onClick={() => setShowStats(!showStats)} title={t('graph.stats')} aria-label={t('graph.stats')}>
              <ChartColumn className="w-4 h-4" />
            </button>
            {full && (
              <button type="button" className={`${ui.icon} hidden md:inline-flex ${showPanel ? ui.pressed : ''}`} aria-pressed={showPanel}
                onClick={() => setShowPanel(!showPanel)} title={showPanel ? t('graph.hideDetails') : t('graph.showDetails')} aria-label={t('graph.detailsPanel')}>
                {showPanel ? <PanelRightClose className="w-4 h-4 rtl:-scale-x-100" /> : <PanelRightOpen className="w-4 h-4 rtl:-scale-x-100" />}
              </button>
            )}
          </div>
          <span className={ui.divider} aria-hidden="true" />

          <div className="flex items-center gap-1">
            <button
              type="button"
              className={`${ui.icon} ${connectMode ? ui.pressed : ''}`}
              onClick={() => setConnectMode(!connectMode)}
              aria-pressed={connectMode}
              title={t('graph.connectModeTitle')}
              aria-label={t('graph.connectMode')}
            >
              <Link2 className="w-4 h-4" />
            </button>
            {edits.hidden.length > 0 && (
              <button type="button" onClick={edits.unhideAll} className={ui.button}>
                <Eye className="w-4 h-4" />{t('graph.showHidden', { count: edits.hidden.length })}
              </button>
            )}
            <button type="button" className={ui.icon} onClick={edits.undo} disabled={!edits.canUndo} title={t('graph.undoTitle')} aria-label={t('graph.undo')}><Undo2 className="w-4 h-4" /></button>
          </div>
          <span className={ui.divider} aria-hidden="true" />

          <div className="flex items-center gap-1">
            {!full && focusId && showInGraph && (
              <button type="button" className={ui.icon} onClick={() => showInGraph(...focusId.split(':'))}
                title={t('graph.openInNetwork')} aria-label={t('graph.openInNetwork')}>
                <SquareArrowOutUpRight className="w-4 h-4 rtl:-scale-x-100" />
              </button>
            )}
            <Popover icon={Download} label={t('graph.export')}>
              {(close) => <ExportOptions onExport={exportAs} close={close} />}
            </Popover>
            <button type="button" className={ui.icon} onClick={() => setReloadKey((k) => k + 1)} title={t('graph.refresh')} aria-label={t('graph.refresh')}><RefreshCw className="w-4 h-4" /></button>
            <button
              type="button"
              className={ui.icon}
              onClick={() => setFullScreen(!fullScreen)}
              title={fullScreen ? t('graph.exitFullscreen') : t('graph.fullscreen')}
              aria-label={fullScreen ? t('graph.exitFullscreen') : t('graph.fullscreen')}
            >
              {fullScreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>
            <button type="button" className={`${ui.icon} hidden md:inline-flex`} onClick={() => setShowShortcuts(true)}
              title={t('graph.shortcuts.open')} aria-label={t('graph.shortcuts.open')}>
              <Keyboard className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* What to show and which links: two labelled rows (on phones behind
          the switches button). */}
      {!compact && (
        <div className={`${showSwitches ? 'block' : 'hidden'} md:block bg-slate-50 dark:bg-slate-900/60 shrink-0`}>
          <div className={switchRow}>
            <span className={`${ui.rowLabel} w-12 h-7 flex items-center`}>{t('graph.showRow')}</span>
            <div className="flex-1 min-w-0"><TypeSwitches
              types={types}
              onChange={setTypes}
              counts={counts}
              colors={graphTheme.node}
              identifierMode={focusId ? null : identifierMode}
              onIdentifierMode={setIdentifierMode}
            /></div>
          </div>
          <div className={switchRow}>
            <span className={`${ui.rowLabel} w-12 h-7 flex items-center`}>{t('graph.linksRow')}</span>
            <div className="flex-1 min-w-0"><LayerSwitches layers={layers} onChange={setLayers} solo={solo} onSolo={setSolo} colors={graphTheme.edge} /></div>
          </div>
        </div>
      )}

      {full && showFilters && !wide && (
        <FilterPanel filters={filters} onChange={setFilters} cases={cases} options={options} edgeLabel={edgeLabel} />
      )}

      {showAsOf && !compact && <AsOfBar span={span} date={asOf} onDate={setAsOf} onClose={() => { setAsOf(null); setShowAsOf(false); }} />}

      {trail.length > 0 && !compact && (
        <FocusTrail trail={trail} nameOf={nameOf} onGo={(i) => setTrail(trail.slice(0, i + 1))} onClear={() => setTrail([])} />
      )}

      {connectMode && (
        <div className="px-4 py-2 text-xs bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-200 border-b border-amber-200 dark:border-amber-900 shrink-0">
          {t('graph.connectHint')}
        </div>
      )}

      {/* The workspace: filters on the left, the canvas, details on the
          right (wide screens; on phones filters are a strip above and
          details a sheet over the canvas). */}
      <div className="relative flex-1 min-h-0 flex">
      {sideFilters && (
        <aside className="w-72 shrink-0 border-e border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/60" aria-label={t('graph.filters')}>
          <FilterPanel side filters={filters} onChange={setFilters} cases={cases} options={options} edgeLabel={edgeLabel} onClose={() => setShowFilters(false)} />
        </aside>
      )}
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
          onSelect={pickSelection}
          savedPositions={savedLayout.positions}
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
        {!loading && !error && drawn.nodes.length === 0 && (
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
            onPath={() => actions.pathBetween(multi[0], multi[1])}
          />
        )}

        {/* Dialogs and the dashboard: the inspector as a card on the canvas */}
        {!full && hasPanels && (
          <div className="absolute top-3 start-3 z-20 w-80 max-w-[calc(100%-4.5rem)] max-h-[calc(100%-1.5rem)] overflow-y-auto rounded-xl bg-white/95 dark:bg-slate-800/95 backdrop-blur shadow-xl border border-slate-200 dark:border-slate-700 p-4">
            {panels}
          </div>
        )}

        {menu && (
          <ContextMenu menu={menu} graph={combined} multi={multi} formatName={formatName} actions={actions} onClose={() => setMenu(null)} />
        )}

        {!compact && <Legend counts={counts} colors={graphTheme} layers={layers} solo={solo} />}
      </div>

      {/* The full view: the inspector beside the canvas (a sheet over it on phones) */}
      {full && (wide ? showPanel : hasPanels) && (
        <aside className="absolute md:static inset-x-0 bottom-0 z-20 max-h-[55%] md:max-h-none md:w-80 shrink-0 overflow-y-auto p-4 bg-white dark:bg-slate-800 border-t md:border-t-0 md:border-s border-slate-200 dark:border-slate-700 shadow-xl md:shadow-none"
          aria-label={t('graph.inspector')}>
          {hasPanels ? panels : <PanelEmpty onShortcuts={() => setShowShortcuts(true)} />}
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

      {showShortcuts && <ShortcutsDialog full={full} onClose={() => setShowShortcuts(false)} />}

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
