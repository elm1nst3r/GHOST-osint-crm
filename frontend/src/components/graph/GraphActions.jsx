// File: frontend/src/components/graph/GraphActions.jsx
//
// Working from the graph (graph plan, phase 2): the inspector for what's
// selected, the right-click menu, the bar for a multiple selection, and the
// transactions behind a money link. Phase 3: the shortest path and the
// statistics panels, focus and path actions.
import { useEffect, useEffectEvent, useRef, useState, useTransition } from 'react';
import { useTranslation } from 'react-i18next';
import {
  X, ExternalLink, Crosshair, Pencil, Trash2, EyeOff, Eye, Pin, PinOff, Search, Link2, Expand,
  LayoutGrid, List, Plus, Undo2, Scan, Route, Focus, UnfoldVertical,
} from 'lucide-react';
import { nodeLabel, linksOf, edgeEditable, edgeManagedBy } from '../../utils/graphElements';
import { relationshipsAPI, transactionsAPI } from '../../utils/api';
import { formatDate, formatNumber } from '../../utils/format';
import { optionLabel } from '../../utils/optionLabels';
import { useUI } from '../../contexts/UIContext';
import { canOpen, canEdit, CREATABLE } from './useOpenEntity';

const Dot = ({ color, square = false }) => (
  <span className={`inline-block w-2.5 h-2.5 shrink-0 ${square ? 'rounded-sm' : 'rounded-full'}`} style={{ background: color }} />
);
const smallButton = 'btn px-2.5 py-1.5 text-xs flex items-center gap-x-1';
const SHOWN_LINKS = 40;

// ── Inspector ────────────────────────────────────────────────────────────────

export function Inspector({ selection, graph, multi, edgeLabel, formatName, colors, actions, onClose }) {
  const { t } = useTranslation();
  const close = (
    <button type="button" onClick={onClose} className="absolute top-2 end-2 p-1 rounded-sm text-slate-400 hover:text-slate-600 dark:hover:text-slate-200" aria-label={t('common.close')}>
      <X className="w-4 h-4" />
    </button>
  );
  if (multi.length > 1) return <MultiList ids={multi} graph={graph} formatName={formatName} colors={colors} actions={actions} close={close} />;
  if (!selection) return null;
  if (selection.kind === 'edge') {
    return <EdgeDetails edge={selection.data} graph={graph} edgeLabel={edgeLabel} formatName={formatName} actions={actions} close={close} />;
  }
  return <NodeDetails node={selection.data} graph={graph} edgeLabel={edgeLabel} formatName={formatName} colors={colors} actions={actions} close={close} />;
}

function NodeDetails({ node: n, graph, edgeLabel, formatName, colors, actions, close }) {
  const { t } = useTranslation();
  const [showAll, setShowAll] = useState(false);
  const links = linksOf(graph, n.id);
  const shown = showAll ? links : links.slice(0, SHOWN_LINKS);
  const pinned = actions.isPinned(n.id);
  return (
    <div className="relative" aria-label={nodeLabel(n, formatName)}>
      {close}
      <div className="flex items-center gap-x-1.5 text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
        <Dot color={colors.node[n.type]} square={n.type !== 'person'} />
        {n.type === 'identifier' ? t(`graph.identifierKinds.${n.kind}`) : t(`graph.types.${n.type}`)}
      </div>
      <h3 className="font-semibold text-slate-900 dark:text-slate-100 mt-0.5 pe-6 break-words"><bdi>{nodeLabel(n, formatName)}</bdi></h3>
      <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm text-slate-600 dark:text-slate-400">
        {n.category && (<><dt>{t('graph.category')}</dt><dd>{n.category}</dd></>)}
        {n.status && (<><dt>{t('graph.status')}</dt><dd>{n.status}</dd></>)}
        <dt>{t('graph.connections')}</dt><dd className="tabular-nums">{n.degree ?? links.length}</dd>
      </dl>
      {n.foreign && <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">{t('graph.otherProject')}</p>}

      <div className="mt-3 flex flex-wrap gap-1.5">
        {canOpen(n.type) && (
          <button type="button" onClick={() => actions.open(n)} className={`${smallButton} btn-primary`}><ExternalLink className="w-3.5 h-3.5" />{t('graph.open')}</button>
        )}
        {canEdit(n.type) && !n.foreign && (
          <button type="button" onClick={() => actions.edit(n)} className={`${smallButton} btn-secondary`}><Pencil className="w-3.5 h-3.5" />{t('graph.edit')}</button>
        )}
        {actions.canCentre && n.type !== 'identifier' && (
          <button type="button" onClick={() => actions.centre(n)} className={`${smallButton} btn-ghost`}><Crosshair className="w-3.5 h-3.5" />{t('graph.centreHere')}</button>
        )}
      </div>
      <div className="mt-1.5 flex flex-wrap gap-1.5">
        {n.type !== 'identifier' && (
          <button type="button" onClick={() => actions.expand(n)} className={`${smallButton} btn-ghost`}><Expand className="w-3.5 h-3.5" />{t('graph.showNeighbours')}</button>
        )}
        <button type="button" onClick={() => actions.togglePin([n.id])} className={`${smallButton} btn-ghost`}>
          {pinned ? <PinOff className="w-3.5 h-3.5" /> : <Pin className="w-3.5 h-3.5" />}{pinned ? t('graph.unpin') : t('graph.pin')}
        </button>
        {actions.canHide(n) && (
          <button type="button" onClick={() => actions.hide([n.id])} className={`${smallButton} btn-ghost`}><EyeOff className="w-3.5 h-3.5" />{t('graph.hide')}</button>
        )}
        {n.type === 'person' && actions.canSearch && (
          <button type="button" onClick={() => actions.search(n)} className={`${smallButton} btn-ghost`}><Search className="w-3.5 h-3.5" />{t('graph.runSearch')}</button>
        )}
        <button type="button" onClick={() => actions.focus(n, 1)} className={`${smallButton} btn-ghost`}><Focus className="w-3.5 h-3.5" />{t('graph.focusHere')}</button>
        <button type="button" onClick={() => actions.pathFrom(n)} className={`${smallButton} btn-ghost`}><Route className="w-3.5 h-3.5" />{t('graph.pathFromHere')}</button>
      </div>
      {actions.foldedCount(n.id) > 0 && (
        <div className="mt-2 flex items-center gap-x-2 text-xs text-slate-600 dark:text-slate-400">
          {t('graph.foldedHere', { count: actions.foldedCount(n.id) })}
          <button type="button" onClick={() => actions.unfold(n.id)} className="flex items-center gap-x-1 text-accent-ink hover:underline">
            <UnfoldVertical className="w-3.5 h-3.5" />{t('graph.unfold')}
          </button>
        </div>
      )}

      {links.length > 0 && (
        <div className="mt-4">
          <h4 className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
            {n.type === 'identifier' ? t('graph.heldBy', { count: links.length }) : t('graph.linksShown', { count: links.length })}
          </h4>
          <ul className="mt-1.5 space-y-0.5">
            {shown.map(({ edge, other, outgoing }) => (
              <li key={edge.id}>
                <button
                  type="button"
                  onClick={() => actions.selectNode(other.id)}
                  className="w-full flex items-center gap-x-2 px-1.5 py-1 rounded-md text-start text-sm hover:bg-slate-100 dark:hover:bg-slate-700/60"
                >
                  <Dot color={colors.node[other.type]} square={other.type !== 'person'} />
                  <bdi className="flex-1 truncate text-slate-800 dark:text-slate-200">{nodeLabel(other, formatName)}</bdi>
                  {n.type !== 'identifier' && (
                    <span className={`text-xs text-slate-500 dark:text-slate-400 shrink-0 ${edge.matched_by_name ? 'italic' : ''}`}>
                      {outgoing ? '' : '← '}{edgeLabel(edge.type)}{edge.count > 1 ? ` ×${edge.count}` : ''}
                    </span>
                  )}
                </button>
              </li>
            ))}
          </ul>
          {links.length > shown.length && (
            <button type="button" onClick={() => setShowAll(true)} className="mt-1 text-xs text-accent-ink hover:underline">
              {t('graph.showAllLinks', { count: links.length })}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function EdgeDetails({ edge: e, graph, edgeLabel, formatName, actions, close }) {
  const { t } = useTranslation();
  const byId = new Map(graph.nodes.map((n) => [n.id, n]));
  const name = (id) => { const n = byId.get(id); return n ? nodeLabel(n, formatName) : id; };
  const [editing, setEditing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState(null);
  const [busy, startBusy] = useTransition();
  const managedBy = edgeManagedBy(e);

  const remove = () => startBusy(async () => {
    setError(null);
    const failed = await relationshipsAPI.remove(e.relationship_id).then(() => null, (err) => err.message);
    if (failed) setError(failed); else actions.changed();
  });

  return (
    <div className="relative">
      {close}
      <div className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">{t('graph.connection')}</div>
      <h3 className="font-semibold text-slate-900 dark:text-slate-100 mt-0.5 pe-6">{edgeLabel(e.type)}</h3>
      <div className="mt-2 text-sm text-slate-700 dark:text-slate-300">
        <button type="button" className="hover:underline" onClick={() => actions.selectNode(e.source)}><bdi>{name(e.source)}</bdi></button>
        {' → '}
        <button type="button" className="hover:underline" onClick={() => actions.selectNode(e.target)}><bdi>{name(e.target)}</bdi></button>
      </div>
      {e.note && !editing && <p className="mt-2 text-sm text-slate-600 dark:text-slate-400" dir="auto">{e.note}</p>}
      {e.matched_by_name && <p className="mt-2 text-sm text-amber-700 dark:text-amber-300">{t('graph.matchedByName')}</p>}

      {editing ? (
        <EdgeEditForm edge={e} connectionTypes={actions.connectionTypes} onCancel={() => setEditing(false)} onSaved={() => { setEditing(false); actions.changed(); }} />
      ) : (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {edgeEditable(e) && (
            <>
              <button type="button" onClick={() => setEditing(true)} className={`${smallButton} btn-secondary`}><Pencil className="w-3.5 h-3.5" />{t('graph.editLink')}</button>
              {!confirming && (
                <button type="button" onClick={() => setConfirming(true)} className={`${smallButton} btn-ghost text-red-600 dark:text-red-400`}><Trash2 className="w-3.5 h-3.5" />{t('graph.deleteLink')}</button>
              )}
            </>
          )}
          {managedBy && (
            <button type="button" onClick={() => actions.edit(byId.get(managedBy))} className={`${smallButton} btn-secondary`}>
              <Pencil className="w-3.5 h-3.5" />{t('graph.editIn', { name: name(managedBy) })}
            </button>
          )}
          {e.type === 'holds' && (
            <button type="button" onClick={() => actions.open(byId.get(e.target))} className={`${smallButton} btn-secondary`}><ExternalLink className="w-3.5 h-3.5" />{t('graph.openAsset')}</button>
          )}
        </div>
      )}
      {confirming && (
        <div className="mt-3 p-3 rounded-lg border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/30 text-sm" role="alertdialog" aria-label={t('graph.deleteLinkConfirm')}>
          <p className="text-red-800 dark:text-red-200">{t('graph.deleteLinkConfirm')}</p>
          <div className="mt-2 flex gap-2">
            <button type="button" onClick={remove} disabled={busy} className={`${smallButton} btn-danger`}>{t('graph.deleteLink')}</button>
            <button type="button" onClick={() => setConfirming(false)} className={`${smallButton} btn-ghost`}>{t('common.cancel')}</button>
          </div>
        </div>
      )}
      {error && <p className="mt-2 text-sm text-red-600 dark:text-red-400" role="alert">{error}</p>}
      {e.kind === 'transaction' && <EdgeTransactions edge={e} />}
    </div>
  );
}

function EdgeEditForm({ edge, connectionTypes, onCancel, onSaved }) {
  const { t } = useTranslation();
  const [type, setType] = useState(edge.type);
  const [note, setNote] = useState(edge.note || '');
  const [error, setError] = useState(null);
  const [saving, startSaving] = useTransition();
  const options = connectionTypes.some((o) => o.value === edge.type) ? connectionTypes : [{ value: edge.type, label: edge.type }, ...connectionTypes];
  const save = () => startSaving(async () => {
    setError(null);
    const failed = await relationshipsAPI.update(edge.relationship_id, { relationship_type: type, note: note.trim() || null })
      .then(() => null, (err) => err.message);
    if (failed) setError(failed); else onSaved();
  });
  return (
    <div className="mt-3 space-y-2">
      <label className="block text-xs font-medium text-slate-600 dark:text-slate-400" htmlFor="graph-edge-type">{t('graph.connectionType')}</label>
      <select id="graph-edge-type" value={type} onChange={(e) => setType(e.target.value)} className="input-base py-1.5">
        {options.map((o) => <option key={o.value} value={o.value}>{optionLabel(t, 'connection_type', o.value, o.label)}</option>)}
      </select>
      <label className="block text-xs font-medium text-slate-600 dark:text-slate-400" htmlFor="graph-edge-note">{t('graph.note')}</label>
      <input id="graph-edge-note" value={note} onChange={(e) => setNote(e.target.value)} className="input-base py-1.5" dir="auto" />
      {error && <p className="text-sm text-red-600 dark:text-red-400" role="alert">{error}</p>}
      <div className="flex gap-2">
        <button type="button" onClick={save} disabled={saving} className={`${smallButton} btn-primary`}>{t('common.save')}</button>
        <button type="button" onClick={onCancel} className={`${smallButton} btn-ghost`}>{t('common.cancel')}</button>
      </div>
    </div>
  );
}

// The transactions combined into one money link.
const party = (row, dir) => (row[`${dir}_person_id`] ? `person:${row[`${dir}_person_id`]}`
  : row[`${dir}_business_id`] ? `business:${row[`${dir}_business_id`]}`
    : row[`${dir}_wallet_id`] ? `crypto_wallet:${row[`${dir}_wallet_id`]}` : null);

function EdgeTransactions({ edge }) {
  const { t } = useTranslation();
  const { setSelectedTransactionForDetail } = useUI();
  const [rows, setRows] = useState(null);
  const load = useEffectEvent(() => {
    let cancelled = false;
    const [type, id] = edge.source.split(':');
    const request = type === 'person' ? transactionsAPI.getByPerson(id)
      : type === 'business' ? transactionsAPI.getByBusiness(id)
        : transactionsAPI.getAll({ wallet_id: id, limit: 1000 });
    request
      .then((res) => {
        if (cancelled) return;
        const list = (res?.data || res || []).filter((r) => party(r, 'from') === edge.source && party(r, 'to') === edge.target);
        setRows(list);
      })
      .catch(() => { if (!cancelled) setRows([]); });
    return () => { cancelled = true; };
  });
  useEffect(() => load(), [edge.id]);

  return (
    <div className="mt-3">
      <h4 className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">{t('graph.transactionsCount', { count: edge.count || 0 })}</h4>
      {rows === null ? (
        <p className="mt-1 text-sm text-slate-500">{t('common.loading')}</p>
      ) : (
        <ul className="mt-1.5 space-y-0.5">
          {rows.map((r) => (
            <li key={r.id}>
              <button type="button" onClick={() => setSelectedTransactionForDetail(r)}
                className="w-full flex items-center justify-between gap-x-2 px-1.5 py-1 rounded-md text-start text-sm hover:bg-slate-100 dark:hover:bg-slate-700/60">
                <span className="text-slate-700 dark:text-slate-300">{formatDate(r.occurred_on)} · {r.transaction_type}</span>
                {r.value != null && <span className="tabular-nums text-slate-500 dark:text-slate-400">{formatNumber(Number(r.value))} {r.currency || ''}</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function MultiList({ ids, graph, formatName, colors, actions, close }) {
  const { t } = useTranslation();
  const byId = new Map(graph.nodes.map((n) => [n.id, n]));
  const nodes = ids.map((id) => byId.get(id)).filter(Boolean);
  return (
    <div className="relative">
      {close}
      <h3 className="font-semibold text-slate-900 dark:text-slate-100 pe-6">{t('graph.selectedCount', { count: nodes.length })}</h3>
      <ul className="mt-2 space-y-0.5">
        {nodes.map((n) => (
          <li key={n.id} className="flex items-center gap-x-2 px-1.5 py-1 rounded-md hover:bg-slate-100 dark:hover:bg-slate-700/60 text-sm">
            <Dot color={colors.node[n.type]} square={n.type !== 'person'} />
            <button type="button" onClick={() => actions.selectNode(n.id)} className="flex-1 truncate text-start text-slate-800 dark:text-slate-200"><bdi>{nodeLabel(n, formatName)}</bdi></button>
            {canOpen(n.type) && (
              <button type="button" onClick={() => actions.open(n)} className="p-1 text-slate-400 hover:text-accent-ink" aria-label={t('graph.openName', { name: nodeLabel(n, formatName) })}>
                <ExternalLink className="w-3.5 h-3.5" />
              </button>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

// ── Multiple selection ───────────────────────────────────────────────────────

export function SelectionBar({ count, onHide, onShowOnly, onPin, onLayout, onList, onClear, onPath }) {
  const { t } = useTranslation();
  const b = 'px-2 py-1 rounded-md text-xs flex items-center gap-x-1 text-white/90 hover:bg-white/15';
  return (
    <div className="absolute top-3 start-1/2 -translate-x-1/2 rtl:translate-x-1/2 z-20 flex flex-wrap items-center gap-1 px-2 py-1.5 rounded-xl bg-black/70 backdrop-blur shadow-lg" role="toolbar" aria-label={t('graph.selectedCount', { count })}>
      <span className="px-1.5 text-xs font-medium text-white tabular-nums">{t('graph.selectedCount', { count })}</span>
      <button type="button" onClick={onHide} className={b}><EyeOff className="w-3.5 h-3.5" />{t('graph.hide')}</button>
      <button type="button" onClick={onShowOnly} className={b}><Eye className="w-3.5 h-3.5" />{t('graph.showOnlyThese')}</button>
      <button type="button" onClick={onPin} className={b}><Pin className="w-3.5 h-3.5" />{t('graph.pin')}</button>
      <button type="button" onClick={onLayout} className={b}><LayoutGrid className="w-3.5 h-3.5" />{t('graph.layOutThese')}</button>
      <button type="button" onClick={onList} className={b}><List className="w-3.5 h-3.5" />{t('graph.list')}</button>
      {count === 2 && onPath && <button type="button" onClick={onPath} className={b}><Route className="w-3.5 h-3.5" />{t('graph.shortestPath')}</button>}
      <button type="button" onClick={onClear} className={b} aria-label={t('graph.clearSelection')}><X className="w-3.5 h-3.5" /></button>
    </div>
  );
}

// ── Context menu ─────────────────────────────────────────────────────────────

export function ContextMenu({ menu, graph, multi, formatName, actions, onClose }) {
  const { t } = useTranslation();
  const ref = useRef(null);
  // Focus the first item, and keep the menu inside the canvas.
  const place = useEffectEvent(() => {
    const el = ref.current;
    if (!el) return;
    const box = el.parentElement.getBoundingClientRect();
    el.style.left = `${Math.max(8, Math.min(menu.x, box.width - el.offsetWidth - 8))}px`;
    el.style.top = `${Math.max(8, Math.min(menu.y, box.height - el.offsetHeight - 8))}px`;
    el.querySelector('button')?.focus();
  });
  useEffect(() => { place(); }, [menu]);
  const closeOnKey = (e) => {
    if (e.key === 'Escape') { e.stopPropagation(); onClose(); }
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      const items = [...ref.current.querySelectorAll('button')];
      const i = items.indexOf(document.activeElement);
      items[(i + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length]?.focus();
    }
  };
  const run = (fn) => () => { onClose(); fn(); };
  const item = (Icon, label, fn, danger = false) => (
    <button key={label} type="button" role="menuitem" onClick={run(fn)}
      className={`w-full flex items-center gap-x-2 px-3 py-1.5 text-sm text-start hover:bg-slate-100 dark:hover:bg-slate-700 focus:bg-slate-100 dark:focus:bg-slate-700 outline-none ${danger ? 'text-red-600 dark:text-red-400' : 'text-slate-700 dark:text-slate-200'}`}>
      <Icon className="w-4 h-4 shrink-0" />{label}
    </button>
  );

  const items = [];
  if (menu.kind === 'node' && multi.length > 1) {
    if (multi.length === 2) items.push(item(Route, t('graph.shortestPath'), () => actions.pathBetween(multi[0], multi[1])));
    items.push(
      item(EyeOff, t('graph.hideSelected', { count: multi.length }), () => actions.hide(multi)),
      item(Eye, t('graph.showOnlyThese'), () => actions.showOnly(multi)),
      item(Pin, t('graph.pinSelected'), () => actions.togglePin(multi)),
      item(LayoutGrid, t('graph.layOutThese'), () => actions.layoutSelected()),
    );
  } else if (menu.kind === 'node') {
    const n = menu.data;
    if (canOpen(n.type)) items.push(item(ExternalLink, t('graph.open'), () => actions.open(n)));
    if (canEdit(n.type) && !n.foreign) items.push(item(Pencil, t('graph.edit'), () => actions.edit(n)));
    if (actions.canCentre && n.type !== 'identifier') items.push(item(Crosshair, t('graph.centreHere'), () => actions.centre(n)));
    if (n.type !== 'identifier') items.push(item(Expand, t('graph.showNeighbours'), () => actions.expand(n)));
    if (['person', 'business', 'crypto_wallet'].includes(n.type)) items.push(item(Link2, t('graph.connectFromHere'), () => actions.connectFrom(n)));
    if (n.type === 'person' && actions.canSearch) items.push(item(Search, t('graph.runSearch'), () => actions.search(n)));
    items.push(item(actions.isPinned(n.id) ? PinOff : Pin, actions.isPinned(n.id) ? t('graph.unpin') : t('graph.pin'), () => actions.togglePin([n.id])));
    if (actions.canHide(n)) items.push(item(EyeOff, t('graph.hide'), () => actions.hide([n.id])));
    items.push(
      item(Focus, t('graph.focusHops', { count: 1 }), () => actions.focus(n, 1)),
      item(Focus, t('graph.focusHops', { count: 2 }), () => actions.focus(n, 2)),
    );
    if (actions.pathStart && actions.pathStart !== n.id) items.push(item(Route, t('graph.pathToHere'), () => actions.pathBetween(actions.pathStart, n.id)));
    else items.push(item(Route, t('graph.pathFromHere'), () => actions.pathFrom(n)));
    if (actions.foldedCount(n.id) > 0) items.push(item(UnfoldVertical, t('graph.unfold'), () => actions.unfold(n.id)));
  } else if (menu.kind === 'edge') {
    const e = menu.data;
    const byId = new Map(graph.nodes.map((x) => [x.id, x]));
    items.push(item(List, t('graph.details'), () => actions.selectEdge(e)));
    if (edgeEditable(e)) items.push(item(Pencil, t('graph.editLink'), () => actions.selectEdge(e)));
    const managedBy = edgeManagedBy(e);
    if (managedBy && byId.get(managedBy)) items.push(item(Pencil, t('graph.editIn', { name: nodeLabel(byId.get(managedBy), formatName) }), () => actions.edit(byId.get(managedBy))));
  } else {
    if (actions.canCreate) {
      CREATABLE.forEach((type) => items.push(item(Plus, t(`graph.newHere.${type}`), () => actions.createAt(type, menu.model))));
    }
    if (actions.hiddenCount > 0) items.push(item(Eye, t('graph.showHidden', { count: actions.hiddenCount }), () => actions.unhideAll()));
    if (actions.canUndo) items.push(item(Undo2, t('graph.undo'), () => actions.undo()));
    items.push(item(Scan, t('graph.fit'), () => actions.fit()));
  }

  const style = { left: menu.x, top: menu.y };
  return (
    <>
      <div className="absolute inset-0 z-30" onClick={onClose} onContextMenu={(e) => { e.preventDefault(); onClose(); }} aria-hidden="true" />
      <div
        ref={ref}
        role="menu"
        onKeyDown={closeOnKey}
        className="absolute z-40 min-w-[13rem] max-w-[18rem] max-h-[calc(100%-1rem)] overflow-y-auto py-1 rounded-lg bg-white dark:bg-slate-800 shadow-xl border border-slate-200 dark:border-slate-700"
        style={style}
      >
        {items}
      </div>
    </>
  );
}

// ── Shortest path ────────────────────────────────────────────────────────────

// The chain of links between two entities, over what's shown. `path` is
// { nodes, edges } (ids) or null; `to` null while the other end is picked.
export function PathPanel({ from, to, path, graph, edgeLabel, formatName, colors, actions, onClose }) {
  const { t } = useTranslation();
  const nodes = new Map(graph.nodes.map((n) => [n.id, n]));
  const edges = new Map(graph.edges.map((e) => [e.id, e]));
  const name = (id) => (nodes.get(id) ? nodeLabel(nodes.get(id), formatName) : id);
  const nodeRow = (id) => {
    const n = nodes.get(id);
    return (
      <button type="button" onClick={() => actions.selectNode(id)}
        className="w-full flex items-center gap-x-2 px-1.5 py-1 rounded-md text-start text-sm hover:bg-slate-100 dark:hover:bg-slate-700/60">
        {n && <Dot color={colors.node[n.type]} square={n.type !== 'person'} />}
        <bdi className="flex-1 truncate text-slate-800 dark:text-slate-200">{name(id)}</bdi>
      </button>
    );
  };
  return (
    <div className="relative" role="region" aria-label={t('graph.shortestPath')}>
      <button type="button" onClick={onClose} className="absolute top-0 end-0 p-1 rounded-sm text-slate-400 hover:text-slate-600 dark:hover:text-slate-200" aria-label={t('graph.clearPath')}>
        <X className="w-4 h-4" />
      </button>
      <div className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">{t('graph.shortestPath')}</div>
      {!to ? (
        <p className="mt-1 text-sm text-slate-700 dark:text-slate-300 pe-6">{t('graph.pickPathEnd', { name: name(from) })}</p>
      ) : !path ? (
        <>
          <h3 className="font-semibold text-slate-900 dark:text-slate-100 mt-0.5 pe-6"><bdi>{name(from)}</bdi> → <bdi>{name(to)}</bdi></h3>
          <p className="mt-2 text-sm text-amber-700 dark:text-amber-300">{t('graph.noPath')}</p>
        </>
      ) : (
        <>
          <h3 className="font-semibold text-slate-900 dark:text-slate-100 mt-0.5 pe-6">{t('graph.pathLength', { count: path.edges.length })}</h3>
          <ol className="mt-2">
            {path.nodes.map((id, i) => {
              const e = edges.get(path.edges[i]);
              return (
                <li key={id}>
                  {nodeRow(id)}
                  {e && (
                    <button type="button" onClick={() => actions.selectEdge(e)}
                      className="ms-3 ps-3 py-0.5 border-s-2 border-slate-300 dark:border-slate-600 text-xs text-slate-500 dark:text-slate-400 hover:text-accent-ink text-start">
                      {e.source === id ? '↓ ' : '↑ '}{edgeLabel(e.type)}{e.count > 1 ? ` ×${e.count}` : ''}
                    </button>
                  )}
                </li>
              );
            })}
          </ol>
        </>
      )}
    </div>
  );
}

// ── Statistics ───────────────────────────────────────────────────────────────

export function StatsPanel({ stats, approximate, formatName, graph, colors, actions, onClose }) {
  const { t } = useTranslation();
  const nodes = new Map(graph.nodes.map((n) => [n.id, n]));
  const list = (title, rows, value = null) => (rows.length > 0 && (
    <div className="mt-3">
      <h4 className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">{title}</h4>
      <ol className="mt-1 space-y-0.5">
        {rows.map((r) => {
          const n = nodes.get(r.id);
          if (!n) return null;
          return (
            <li key={r.id}>
              <button type="button" onClick={() => actions.selectNode(r.id)}
                className="w-full flex items-center gap-x-2 px-1.5 py-1 rounded-md text-start text-sm hover:bg-slate-100 dark:hover:bg-slate-700/60">
                <Dot color={colors.node[n.type]} square={n.type !== 'person'} />
                <bdi className="flex-1 truncate text-slate-800 dark:text-slate-200">{nodeLabel(n, formatName)}</bdi>
                {value && <span className="text-xs tabular-nums text-slate-500 dark:text-slate-400">{value(r.value)}</span>}
              </button>
            </li>
          );
        })}
      </ol>
    </div>
  ));
  const figure = (label, n) => (
    <div className="rounded-lg bg-slate-100 dark:bg-slate-700/50 px-2 py-1.5">
      <div className="text-lg font-semibold tabular-nums text-slate-900 dark:text-slate-100">{formatNumber(n)}</div>
      <div className="text-xs text-slate-500 dark:text-slate-400">{label}</div>
    </div>
  );
  return (
    <div className="relative" role="region" aria-label={t('graph.stats')}>
      <button type="button" onClick={onClose} className="absolute top-0 end-0 p-1 rounded-sm text-slate-400 hover:text-slate-600 dark:hover:text-slate-200" aria-label={t('common.close')}>
        <X className="w-4 h-4" />
      </button>
      <h3 className="font-semibold text-slate-900 dark:text-slate-100 pe-6">{t('graph.stats')}</h3>
      <p className="text-xs text-slate-500 dark:text-slate-400">{t('graph.statsOfShown')}</p>
      <div className="mt-2 grid grid-cols-2 gap-1.5">
        {figure(t('graph.statsEntities'), stats.nodes)}
        {figure(t('graph.statsLinks'), stats.edges)}
        {figure(t('graph.statsGroups'), stats.groups)}
        {figure(t('graph.statsIsolated'), stats.isolated.length)}
      </div>
      {list(t('graph.mostConnected'), stats.mostConnected, (v) => formatNumber(v))}
      {list(approximate ? t('graph.mostBetweenApprox') : t('graph.mostBetween'), stats.mostBetween, (v) => `${formatNumber(Math.round(v * 1000) / 10)} %`)}
      {list(t('graph.isolatedList', { count: stats.isolated.length }), stats.isolated.slice(0, 10).map((id) => ({ id })))}
    </div>
  );
}
