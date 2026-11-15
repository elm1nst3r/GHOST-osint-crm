// File: frontend/src/components/graph/GraphPanels.jsx
//
// The pieces around the graph canvas (graph plan, phase 1): type and layer
// switches, filters, the card for what's selected, the legend, and the
// dialog that saves a new connection.
import { useState, useTransition } from 'react';
import { useTranslation } from 'react-i18next';
import { Search, RotateCcw } from 'lucide-react';
import { EDGE_LAYERS, typesInLayer } from '../../utils/edgeLayers';
import { NODE_TYPES, EMPTY_FILTERS, nodeLabel } from '../../utils/graphElements';
import { relationshipsAPI } from '../../utils/api';
import { optionLabel } from '../../utils/optionLabels';

const chip = (on) => `px-2 py-0.5 rounded-full border text-xs flex items-center gap-x-1.5 transition ${
  on
    ? 'border-accent-primary/60 bg-accent-primary/10 text-slate-800 dark:text-slate-100'
    : 'border-slate-300 dark:border-slate-600 text-slate-500 dark:text-slate-400'
}`;

const Dot = ({ color, square = false }) => (
  <span className={`inline-block w-2.5 h-2.5 ${square ? 'rounded-sm' : 'rounded-full'}`} style={{ background: color }} />
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
          className={chip(types[type] !== false)}
        >
          <Dot color={colors[type]} square={type !== 'person'} />
          {t(`graph.types.${type}`)}
          {types[type] !== false && counts[type] > 0 && <span className="tabular-nums opacity-70">{counts[type]}</span>}
        </button>
      ))}
      {identifierMode && types.identifier !== false && (
        <select
          value={identifierMode}
          onChange={(e) => onIdentifierMode(e.target.value)}
          className="py-0.5 text-xs"
          aria-label={t('graph.identifierModeLabel')}
        >
          <option value="shared">{t('graph.identifiersShared')}</option>
          <option value="all">{t('graph.identifiersAll')}</option>
        </select>
      )}
    </div>
  );
}

export function LayerSwitches({ layers, onChange, solo, onSolo, colors }) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1" role="group" aria-label={t('graph.layersLabel')}>
      {EDGE_LAYERS.map((layer) => {
        const soloed = solo === layer;
        const sample = colors[typesInLayer(layer)[0]] || colors.other;
        return (
          <span key={layer} className="flex items-center gap-x-1">
            <label className={`flex items-center gap-x-1 cursor-pointer text-slate-700 dark:text-slate-300 ${solo && !soloed ? 'opacity-40' : ''}`}>
              <input
                type="checkbox"
                checked={layers[layer] !== false}
                disabled={!!solo}
                onChange={(e) => onChange({ ...layers, [layer]: e.target.checked })}
                className="h-3 w-3"
              />
              <span className="inline-block w-3 h-0.5" style={{ background: sample }} />
              {t(`graph.layers.${layer}`)}
            </label>
            <button
              type="button"
              onClick={() => onSolo(soloed ? null : layer)}
              title={t('graph.soloLayerTitle')}
              aria-pressed={soloed}
              className={`px-1 rounded border text-[10px] leading-4 ${soloed ? 'bg-accent-primary text-white border-accent-primary' : 'border-slate-300 dark:border-slate-600 text-slate-500 dark:text-slate-400'}`}
            >
              {t('graph.soloLayerShort')}
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
      <div className="text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">{label}</div>
      <div className="flex flex-wrap gap-1">
        {values.map((v) => (
          <button key={v} type="button" aria-pressed={selected.includes(v)} onClick={() => toggle(v)} className={chip(selected.includes(v))}>
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
    <div className="px-3 py-3 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 max-h-[40%] overflow-y-auto shrink-0">
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
        <div>
          <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1" htmlFor="graph-search">{t('graph.search')}</label>
          <div className="relative">
            <Search className="absolute start-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
            <input id="graph-search" type="search" value={filters.searchTerm} onChange={(e) => set({ searchTerm: e.target.value })}
              placeholder={t('graph.searchPlaceholder')} className="input-base ps-7 py-1 text-sm" />
          </div>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <label className="text-xs text-slate-600 dark:text-slate-400">
            <span className="block font-medium mb-1">{t('graph.minConnections')}</span>
            <input type="number" min="0" value={filters.minConnections}
              onChange={(e) => set({ minConnections: Math.max(0, parseInt(e.target.value, 10) || 0) })} className="w-20 py-1 text-sm" />
          </label>
          <label className="text-xs text-slate-600 dark:text-slate-400">
            <span className="block font-medium mb-1">{t('graph.updated')}</span>
            <select value={filters.dateRange} onChange={(e) => set({ dateRange: e.target.value })} className="py-1 text-sm">
              {['all', 'week', 'month', 'year'].map((r) => <option key={r} value={r}>{t(`graph.dateRange.${r}`)}</option>)}
            </select>
          </label>
          <label className="flex items-center gap-x-1.5 text-xs text-slate-600 dark:text-slate-400 pb-1.5">
            <input type="checkbox" checked={filters.showIsolated} onChange={(e) => set({ showIsolated: e.target.checked })} />
            {t('graph.showIsolated')}
          </label>
        </div>
        <ChipList label={t('graph.cases')} values={cases.map((c) => c.id)} selected={filters.caseIds}
          onChange={(caseIds) => set({ caseIds })} render={(id) => cases.find((c) => c.id === id)?.case_name || id} />
        <ChipList label={t('graph.categories')} values={options.categories} selected={filters.categories} onChange={(categories) => set({ categories })} />
        <ChipList label={t('graph.statuses')} values={options.statuses} selected={filters.statuses} onChange={(statuses) => set({ statuses })} />
        <ChipList label={t('graph.connectionTypes')} values={options.connectionTypes} selected={filters.connectionTypes}
          onChange={(connectionTypes) => set({ connectionTypes })} render={edgeLabel} />
      </div>
      <button type="button" onClick={() => onChange(EMPTY_FILTERS)} className="btn btn-ghost px-2.5 py-1.5 text-xs mt-2 flex items-center gap-x-1">
        <RotateCcw className="w-3.5 h-3.5" />{t('graph.resetFilters')}
      </button>
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
