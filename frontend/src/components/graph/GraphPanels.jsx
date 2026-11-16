// File: frontend/src/components/graph/GraphPanels.jsx
//
// The pieces around the graph canvas (graph plan, phase 1): type and layer
// switches, filters, the card for what's selected, the legend, and the
// dialog that saves a new connection. Phase 3: find, the View and Export
// menus, the as-of-date bar and the focus breadcrumbs.
import { useEffect, useRef, useState, useTransition } from 'react';
import { useTranslation } from 'react-i18next';
import { Search, RotateCcw, ChevronUp, ChevronDown, X, ChevronRight } from 'lucide-react';
import { formatDate } from '../../utils/format';
import { ui } from './graphUi';
import { EDGE_LAYERS, typesInLayer } from '../../utils/edgeLayers';
import { NODE_TYPES, EMPTY_FILTERS, nodeLabel } from '../../utils/graphElements';
import { relationshipsAPI } from '../../utils/api';
import { optionLabel } from '../../utils/optionLabels';

const Dot = ({ color, square = false }) => (
  <span className={`inline-block w-2.5 h-2.5 shrink-0 ${square ? 'rounded-sm' : 'rounded-full'}`} style={{ background: color }} />
);

export function TypeSwitches({ types, onChange, counts, colors, identifierMode, onIdentifierMode }) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label={t('graph.entityTypes')}>
      {NODE_TYPES.map((type) => (
        <button
          key={type}
          type="button"
          aria-pressed={types[type] !== false}
          onClick={() => onChange({ ...types, [type]: types[type] === false })}
          className={ui.chip(types[type] !== false)}
        >
          <Dot color={colors[type]} square={type !== 'person'} />
          {t(`graph.types.${type}`)}
          {types[type] !== false && counts[type] > 0 && <span className="tabular-nums opacity-60">{counts[type]}</span>}
        </button>
      ))}
      {identifierMode && types.identifier !== false && (
        <select
          value={identifierMode}
          onChange={(e) => onIdentifierMode(e.target.value)}
          className={ui.selectSmall}
          aria-label={t('graph.identifierModeLabel')}
        >
          <option value="shared">{t('graph.identifiersShared')}</option>
          <option value="all">{t('graph.identifiersAll')}</option>
        </select>
      )}
    </div>
  );
}

// Each kind of link: a chip that switches it on or off, and "only" to show
// just that kind ("all" undoes it).
export function LayerSwitches({ layers, onChange, solo, onSolo, colors }) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label={t('graph.layersLabel')}>
      {EDGE_LAYERS.map((layer) => {
        const soloed = solo === layer;
        const on = solo ? soloed : layers[layer] !== false;
        const sample = colors[typesInLayer(layer)[0]] || colors.other;
        const name = t(`graph.layers.${layer}`);
        return (
          <span key={layer} className={`inline-flex items-stretch h-7 rounded-full border text-xs overflow-hidden transition-colors ${
            on ? 'border-accent-primary/50 bg-accent-primary/10' : 'border-slate-300 dark:border-slate-600'}`}>
            <button
              type="button"
              aria-pressed={on}
              disabled={Boolean(solo)}
              onClick={() => onChange({ ...layers, [layer]: layers[layer] === false })}
              className={`inline-flex items-center gap-x-1.5 ps-2.5 pe-2 focus-visible:outline-hidden focus-visible:bg-accent-primary/15 ${
                on ? 'text-slate-800 dark:text-slate-100' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'} disabled:cursor-default`}
            >
              <span className="inline-block w-3 h-0.5 rounded-full" style={{ background: sample }} />
              {name}
            </button>
            <button
              type="button"
              onClick={() => onSolo(soloed ? null : layer)}
              aria-pressed={soloed}
              title={soloed ? t('graph.soloOffTitle') : t('graph.soloLayerTitle')}
              aria-label={soloed ? t('graph.soloOffTitle') : `${t('graph.soloLayerTitle')}: ${name}`}
              className={`px-2 border-s text-[11px] focus-visible:outline-hidden focus-visible:bg-accent-primary/15 ${
                on ? 'border-accent-primary/30' : 'border-slate-300 dark:border-slate-600'} ${
                soloed ? 'bg-accent-primary text-white' : 'text-slate-400 dark:text-slate-500 hover:text-accent-ink hover:bg-accent-primary/10'}`}
            >
              {soloed ? t('graph.soloOff') : t('graph.soloLayerShort')}
            </button>
          </span>
        );
      })}
    </div>
  );
}

function ChipList({ label, values, selected, onChange, render = (v) => v }) {
  if (!values.length) return null;
  const toggle = (v) => onChange(selected.includes(v) ? selected.filter((x) => x !== v) : [...selected, v]);
  return (
    <div>
      <div className={ui.label}>{label}</div>
      <div className="flex flex-wrap gap-1.5">
        {values.map((v) => (
          <button key={v} type="button" aria-pressed={selected.includes(v)} onClick={() => toggle(v)} className={ui.chip(selected.includes(v))}>
            {render(v)}
          </button>
        ))}
      </div>
    </div>
  );
}

export function FilterPanel({ filters, onChange, cases, options, edgeLabel }) {
  const { t } = useTranslation();
  const set = (patch) => onChange({ ...filters, ...patch });
  return (
    <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/60 max-h-[40%] overflow-y-auto shrink-0">
      {/* Fields on one line, the lists of values in even columns under it. */}
      <div className="flex flex-wrap items-end gap-x-4 gap-y-3">
        <div className="w-full sm:w-64">
          <label className={ui.label} htmlFor="graph-search">{t('graph.search')}</label>
          <div className="relative">
            <Search className="absolute start-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
            <input id="graph-search" type="search" value={filters.searchTerm} onChange={(e) => set({ searchTerm: e.target.value })}
              placeholder={t('graph.searchPlaceholder')} className={`${ui.input} w-full ps-8`} />
          </div>
        </div>
        <div>
          <label className={ui.label} htmlFor="graph-min-links">{t('graph.minConnections')}</label>
          <input id="graph-min-links" type="number" min="0" value={filters.minConnections}
            onChange={(e) => set({ minConnections: Math.max(0, parseInt(e.target.value, 10) || 0) })} className={`${ui.input} w-24`} />
        </div>
        <div>
          <label className={ui.label} htmlFor="graph-updated">{t('graph.updated')}</label>
          <select id="graph-updated" value={filters.dateRange} onChange={(e) => set({ dateRange: e.target.value })} className={ui.select}>
            {['all', 'week', 'month', 'year'].map((r) => <option key={r} value={r}>{t(`graph.dateRange.${r}`)}</option>)}
          </select>
        </div>
        <label className="flex items-center gap-x-2 h-8 text-sm text-slate-700 dark:text-slate-300">
          <input type="checkbox" checked={filters.showIsolated} onChange={(e) => set({ showIsolated: e.target.checked })} />
          {t('graph.showIsolated')}
        </label>
        <button type="button" onClick={() => onChange(EMPTY_FILTERS)} className={`${ui.button} ms-auto`}>
          <RotateCcw className="w-3.5 h-3.5" />{t('graph.resetFilters')}
        </button>
      </div>
      <div className="mt-4 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 items-start gap-4">
        <ChipList label={t('graph.cases')} values={cases.map((c) => c.id)} selected={filters.caseIds}
          onChange={(caseIds) => set({ caseIds })} render={(id) => cases.find((c) => c.id === id)?.case_name || id} />
        <ChipList label={t('graph.categories')} values={options.categories} selected={filters.categories} onChange={(categories) => set({ categories })} />
        <ChipList label={t('graph.statuses')} values={options.statuses} selected={filters.statuses} onChange={(statuses) => set({ statuses })} />
        <ChipList label={t('graph.connectionTypes')} values={options.connectionTypes} selected={filters.connectionTypes}
          onChange={(connectionTypes) => set({ connectionTypes })} render={edgeLabel} />
      </div>
    </div>
  );
}

export function Legend({ counts, colors, layers, solo }) {
  const { t } = useTranslation();
  const shownTypes = NODE_TYPES.filter((type) => counts[type] > 0);
  const shownLayers = EDGE_LAYERS.filter((l) => (solo ? solo === l : layers[l] !== false));
  return (
    <details className="absolute bottom-3 start-3 z-10 max-w-[60%] rounded-lg bg-black/45 backdrop-blur-sm text-white/90 text-xs">
      <summary className="px-3 py-1.5 cursor-pointer select-none">{t('graph.legend')}</summary>
      <div className="px-3 pb-2 space-y-2">
        <div className="flex flex-wrap gap-x-3 gap-y-1">
          {shownTypes.map((type) => (
            <span key={type} className="flex items-center gap-x-1.5"><Dot color={colors.node[type]} square={type !== 'person'} />{t(`graph.types.${type}`)}</span>
          ))}
        </div>
        <div className="flex flex-wrap gap-x-3 gap-y-1">
          {shownLayers.map((layer) => (
            <span key={layer} className="flex items-center gap-x-1.5">
              <span className="inline-block w-5 border-t-2" style={{
                borderColor: colors.edge[typesInLayer(layer)[0]] || colors.edge.other,
                borderStyle: { employment: 'dashed', financial: 'dotted', digital: 'dashed' }[layer] || 'solid',
              }} />
              {t(`graph.layers.${layer}`)}
            </span>
          ))}
          <span className="flex items-center gap-x-1.5 opacity-60"><span className="inline-block w-5 border-t-2 border-dashed border-white/70" />{t('graph.legendMatchedByName')}</span>
        </div>
      </div>
    </details>
  );
}

export function ConnectDialog({ source, target, formatName, connectionTypes, onClose, onSaved }) {
  const { t } = useTranslation();
  const [type, setType] = useState(connectionTypes[0]?.value || 'associate');
  const [note, setNote] = useState('');
  const [error, setError] = useState(null);
  const [saving, startSaving] = useTransition();

  const save = () => startSaving(async () => {
    setError(null);
    const result = await relationshipsAPI.create({
      project_id: source.project_id,
      source_type: source.type, source_id: source.entity_id,
      target_type: target.type, target_id: target.entity_id,
      relationship_type: type,
      note: note.trim() || null,
    }).then(() => null, (err) => err.message);
    if (result) setError(result); else onSaved();
  });

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true" aria-labelledby="graph-connect-title">
      <div className="glass-card w-full max-w-md p-5">
        <h2 id="graph-connect-title" className="text-lg font-semibold text-slate-900 dark:text-slate-100">{t('graph.connectTitle')}</h2>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
          <bdi>{nodeLabel(source, formatName)}</bdi> → <bdi>{nodeLabel(target, formatName)}</bdi>
        </p>
        <label className="block mt-4 text-sm font-medium text-slate-700 dark:text-slate-300" htmlFor="graph-connect-type">{t('graph.connectionType')}</label>
        <select id="graph-connect-type" value={type} onChange={(e) => setType(e.target.value)} className="input-base mt-1">
          {connectionTypes.map((o) => <option key={o.value} value={o.value}>{optionLabel(t, 'connection_type', o.value, o.label)}</option>)}
        </select>
        <label className="block mt-3 text-sm font-medium text-slate-700 dark:text-slate-300" htmlFor="graph-connect-note">{t('graph.note')}</label>
        <input id="graph-connect-note" value={note} onChange={(e) => setNote(e.target.value)} className="input-base mt-1" dir="auto" />
        {error && <p className="mt-3 text-sm text-red-600 dark:text-red-400" role="alert">{error}</p>}
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="btn btn-ghost">{t('common.cancel')}</button>
          <button type="button" onClick={save} disabled={saving} className="btn btn-primary">{t('graph.connectSave')}</button>
        </div>
      </div>
    </div>
  );
}

// ── Phase 3 ──────────────────────────────────────────────────────────────────

// Find: what matches is highlighted and the rest fades (nothing is removed);
// Enter steps through, Shift+Enter back, Escape clears.
export function FindBox({ inputRef, term, onTerm, count, index, onStep }) {
  const { t } = useTranslation();
  const keys = (e) => {
    if (e.key === 'Enter') { e.preventDefault(); onStep(e.shiftKey ? -1 : 1); }
    if (e.key === 'Escape') { e.preventDefault(); onTerm(''); e.currentTarget.blur(); }
  };
  const step = 'inline-flex items-center justify-center h-6 w-6 rounded-sm text-slate-500 hover:text-slate-800 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-40';
  return (
    <div className="relative flex items-center">
      <Search className="absolute start-2.5 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
      <input
        ref={inputRef}
        type="search"
        value={term}
        onChange={(e) => onTerm(e.target.value)}
        onKeyDown={keys}
        placeholder={t('graph.findPlaceholder')}
        aria-label={t('graph.find')}
        title={t('graph.findTitle')}
        className={`${ui.input} ps-8 w-40 sm:w-48`}
      />
      {term.trim() && (
        <span className="flex items-center gap-x-0.5 ms-2 text-xs text-slate-500 dark:text-slate-400 tabular-nums whitespace-nowrap" aria-live="polite">
          {!count ? t('graph.findNone') : index < 0 ? t('graph.findCount', { count }) : t('graph.findPosition', { index: index + 1, count })}
          <button type="button" className={step} disabled={!count} onClick={() => onStep(-1)} aria-label={t('graph.findPrevious')}><ChevronUp className="w-3.5 h-3.5" /></button>
          <button type="button" className={step} disabled={!count} onClick={() => onStep(1)} aria-label={t('graph.findNext')}><ChevronDown className="w-3.5 h-3.5" /></button>
        </span>
      )}
    </div>
  );
}

// A toolbar button with a panel under it; closes on a click elsewhere or Escape.
export function Popover({ icon: Icon, label, active = false, children, className = '' }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    const away = (e) => { if (!ref.current?.contains(e.target)) setOpen(false); };
    const esc = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('pointerdown', away);
    document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('pointerdown', away); document.removeEventListener('keydown', esc); };
  }, [open]);
  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-label={label}
        title={label}
        className={`${ui.icon} ${active || open ? ui.pressed : ''}`}
      >
        <Icon className="w-4 h-4" />
      </button>
      {open && (
        <div className={`absolute end-0 top-full mt-2 z-40 w-72 max-w-[calc(100vw-2rem)] rounded-(--radius-card) bg-white dark:bg-slate-800 shadow-xl border border-slate-200 dark:border-slate-700 p-4 text-sm ${className}`}
          role="dialog" aria-label={label}>
          {typeof children === 'function' ? children(() => setOpen(false)) : children}
        </div>
      )}
    </div>
  );
}

const SIZE_BY = ['uniform', 'connections', 'pagerank', 'betweenness'];
const GROUP_BY = ['none', 'case', 'component'];

// How the graph is drawn: node size, groups, folding, the saved layout.
export function ViewOptions({ sizeBy, onSizeBy, groupBy, onGroupBy, canGroupByCase, collapse, onCollapse, layout, onSaveLayout, onForgetLayout }) {
  const { t } = useTranslation();
  const label = ui.label;
  return (
    <div className="space-y-4">
      <div>
        <label className={label} htmlFor="graph-size-by">{t('graph.sizeBy')}</label>
        <select id="graph-size-by" value={sizeBy} onChange={(e) => onSizeBy(e.target.value)} className={`${ui.select} w-full`}>
          {SIZE_BY.map((v) => <option key={v} value={v}>{t(`graph.sizeByOptions.${v}`)}</option>)}
        </select>
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{t(`graph.sizeByHelp.${sizeBy}`)}</p>
      </div>
      <div>
        <label className={label} htmlFor="graph-group-by">{t('graph.groupBy')}</label>
        <select id="graph-group-by" value={groupBy} onChange={(e) => onGroupBy(e.target.value)} className={`${ui.select} w-full`}>
          {GROUP_BY.filter((v) => v !== 'case' || canGroupByCase).map((v) => <option key={v} value={v}>{t(`graph.groupByOptions.${v}`)}</option>)}
        </select>
      </div>
      <label className="flex items-start gap-x-2 text-sm text-slate-700 dark:text-slate-300">
        <input type="checkbox" checked={collapse} onChange={(e) => onCollapse(e.target.checked)} className="mt-0.5" />
        <span>{t('graph.collapseLeaves')}<span className="block text-xs text-slate-500 dark:text-slate-400">{t('graph.collapseLeavesHelp')}</span></span>
      </label>
      {layout && (
        <div className="pt-4 border-t border-slate-200 dark:border-slate-700">
          <div className={label}>{t('graph.savedLayout')}</div>
          <p className="text-xs text-slate-500 dark:text-slate-400" data-volatile>
            {layout.saved ? t('graph.savedLayoutOn', { date: formatDate(layout.updated_at) }) : t('graph.savedLayoutOff')}
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            <button type="button" onClick={onSaveLayout} disabled={layout.busy} className="btn btn-secondary h-8 px-3 py-0 text-xs">{t('graph.saveLayout')}</button>
            {layout.saved && (
              <button type="button" onClick={onForgetLayout} disabled={layout.busy} className="btn btn-ghost h-8 px-3 py-0 text-xs">{t('graph.resetLayout')}</button>
            )}
          </div>
          {layout.error && <p className="mt-1 text-xs text-red-600 dark:text-red-400" role="alert">{layout.error}</p>}
        </div>
      )}
    </div>
  );
}

export function ExportOptions({ onExport, close }) {
  const { t } = useTranslation();
  return (
    <div className="space-y-0.5 -m-2">
      {['png', 'graphml', 'json'].map((format) => (
        <button key={format} type="button" onClick={() => { close(); onExport(format); }}
          className="w-full px-2 py-1.5 rounded-md text-start hover:bg-slate-100 dark:hover:bg-slate-700">
          <span className="block text-slate-800 dark:text-slate-200">{t(`graph.exportFormats.${format}`)}</span>
          <span className="block text-xs text-slate-500 dark:text-slate-400">{t(`graph.exportHelp.${format}`)}</span>
        </button>
      ))}
    </div>
  );
}

// The graph as it was on a date: a slider from the first date to today.
const DAY = 86400000;
const toDay = (iso) => Date.parse(`${iso}T00:00:00Z`) / DAY;
const fromDay = (n) => new Date(n * DAY).toISOString().slice(0, 10);

export function AsOfBar({ span, date, onDate, onClose }) {
  const { t } = useTranslation();
  const today = new Date().toISOString().slice(0, 10);
  const min = toDay(span?.min || today);
  const max = Math.max(toDay(today), min);
  const value = date ? toDay(date) : max;
  return (
    <div className={`${ui.row} bg-sky-50 dark:bg-sky-950/30 text-xs`}>
      <label htmlFor="graph-as-of" className={ui.rowLabel}>{t('graph.asOf')}</label>
      <input
        id="graph-as-of"
        type="range"
        min={min}
        max={max}
        step={1}
        value={value}
        onChange={(e) => { const n = Number(e.target.value); onDate(n >= max ? null : fromDay(n)); }}
        className="flex-1 min-w-[8rem] max-w-md accent-accent-primary"
        aria-valuetext={date ? formatDate(date) : t('graph.asOfNow')}
      />
      <span className="tabular-nums font-medium text-slate-800 dark:text-slate-200 min-w-[6rem]" data-volatile>{date ? formatDate(date) : t('graph.asOfNow')}</span>
      {date && <button type="button" onClick={() => onDate(null)} className="text-accent-ink hover:underline">{t('graph.asOfReset')}</button>}
      <span className="text-slate-500 dark:text-slate-400 hidden lg:inline">{t('graph.asOfHelp')}</span>
      <button type="button" onClick={onClose} className={`${ui.icon} ms-auto h-7 w-7`} aria-label={t('common.close')}><X className="w-3.5 h-3.5" /></button>
    </div>
  );
}

// Focus: where you are, and the way back.
export function FocusTrail({ trail, nameOf, onGo, onClear }) {
  const { t } = useTranslation();
  return (
    <nav className={`${ui.row} gap-x-1 bg-slate-50 dark:bg-slate-900/60 text-xs`} aria-label={t('graph.focusTrail')}>
      <button type="button" onClick={onClear} className="text-accent-ink hover:underline">{t('graph.focusAll')}</button>
      {trail.map((step, i) => (
        <span key={`${step.id}-${i}`} className="flex items-center gap-x-1">
          <ChevronRight className="w-3 h-3 text-slate-400 rtl:rotate-180" />
          {i < trail.length - 1 ? (
            <button type="button" onClick={() => onGo(i)} className="text-accent-ink hover:underline"><bdi>{nameOf(step.id)}</bdi></button>
          ) : (
            <span className="font-medium text-slate-800 dark:text-slate-200" aria-current="location"><bdi>{nameOf(step.id)}</bdi></span>
          )}
          <span className="text-slate-500 dark:text-slate-400">({t('graph.depthHops', { count: step.hops })})</span>
        </span>
      ))}
    </nav>
  );
}
