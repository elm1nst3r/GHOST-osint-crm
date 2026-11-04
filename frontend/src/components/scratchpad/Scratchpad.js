// File: frontend/src/components/scratchpad/Scratchpad.js
//
// The floating scratchpad: a launcher button in a corner that opens a small
// panel for pasting and jotting markdown notes. Desktop: draggable by its
// header and resizable from the bottom-right corner; position/size are kept
// per device. Phones: a bottom sheet.
//
// Also owns the two ways of capturing text from elsewhere in GHOST: the
// "Add to scratchpad" button that appears next to a text selection, and the
// Alt+Shift+A shortcut.

import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { NotebookPen, Settings2, Minus, Copy, Check, Trash2, Undo2, ArrowLeft, ClipboardPlus } from 'lucide-react';
import { useScratchpad, UNDO_MS } from '../../contexts/ScratchpadContext';
import { useUI } from '../../contexts/UIContext';
import { useProject } from '../../contexts/ProjectContext';
import { useAuth } from '../../contexts/AuthContext';
import { formatPersonName } from '../../utils/personName';
import { ScratchpadEntry, ScratchpadComposer, copyText } from './ScratchpadNotes';
import ScratchpadTodos from './ScratchpadTodos';
import ScratchpadSettingsView, { screenCorner } from './ScratchpadSettingsView';
import { themeFor, FONT_SIZE_CLASS } from './scratchpadTheme';

const MARGIN = 16;
const DEFAULT_SIZE = { w: 360, h: 480 };
const MIN_SIZE = { w: 280, h: 240 };
const GEOMETRY_KEY = 'ghost_scratchpad_geometry';
// Admins have the system-health widget pinned to the bottom end corner on
// desktop (bottom-right; bottom-left in RTL), i.e. the default corner.
const HEALTH_WIDGET_OFFSET = 56;

const MOBILE_QUERY = '(max-width: 767px)';

const useIsMobile = () => {
  const [mobile, setMobile] = useState(() => window.matchMedia?.(MOBILE_QUERY).matches ?? false);
  useEffect(() => {
    const mq = window.matchMedia?.(MOBILE_QUERY);
    if (!mq) return undefined;
    const onChange = () => setMobile(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);
  return mobile;
};

const readGeometry = () => {
  try {
    const g = JSON.parse(localStorage.getItem(GEOMETRY_KEY));
    if (g && Number.isFinite(g.w) && Number.isFinite(g.h)) return g;
  } catch { /* ignore */ }
  return null;
};

const saveGeometry = (g) => {
  try { localStorage.setItem(GEOMETRY_KEY, JSON.stringify(g)); } catch { /* ignore */ }
};

const clampSize = (w, h) => ({
  w: Math.max(MIN_SIZE.w, Math.min(w, window.innerWidth - 2 * MARGIN)),
  h: Math.max(MIN_SIZE.h, Math.min(h, window.innerHeight - 2 * MARGIN)),
});

const clampPos = (x, y, w, h) => ({
  x: Math.max(MARGIN, Math.min(x, window.innerWidth - w - MARGIN)),
  y: Math.max(MARGIN, Math.min(y, window.innerHeight - h - MARGIN)),
});

const cornerPos = (corner, w, h, bottomOffset) => ({
  x: corner.endsWith('right') ? window.innerWidth - w - MARGIN : MARGIN,
  y: corner.startsWith('bottom') ? window.innerHeight - h - MARGIN - bottomOffset : MARGIN,
});

// Where a note captured right now came from, e.g. "Op Nightjar · People · Jane Doe".
const useSourceLabel = () => {
  const { t } = useTranslation();
  const ui = useUI();
  const { activeProject } = useProject();
  return useCallback(() => {
    const entity =
      (ui.selectedPersonForDetail && formatPersonName(ui.selectedPersonForDetail)) ||
      ui.selectedBusinessForDetail?.name ||
      ui.selectedPropertyForDetail?.name ||
      ui.selectedAssetForDetail?.name ||
      ui.selectedCryptoWalletForDetail?.label || ui.selectedCryptoWalletForDetail?.address ||
      null;
    return [activeProject?.name, t(`app.nav.${ui.activeSection}`, { defaultValue: ui.activeSection }), entity]
      .filter(Boolean).join(' · ');
  }, [t, ui, activeProject]);
};

const isEditable = (el) => !!el && (el.closest?.('input, textarea, select, [contenteditable=""], [contenteditable="true"]'));

// ── Selection capture button ─────────────────────────────────────────────────

const SelectionCapture = ({ panelRef, onCapture }) => {
  const { t } = useTranslation();
  const [btn, setBtn] = useState(null); // { x, y, text }

  useEffect(() => {
    const evaluate = () => {
      const sel = window.getSelection();
      const text = sel && !sel.isCollapsed ? sel.toString().trim() : '';
      if (!text || !sel.rangeCount) { setBtn(null); return; }
      const anchor = sel.anchorNode?.nodeType === 1 ? sel.anchorNode : sel.anchorNode?.parentElement;
      if (!anchor || panelRef.current?.contains(anchor) || isEditable(anchor) || isEditable(document.activeElement)) {
        setBtn(null);
        return;
      }
      const rect = sel.getRangeAt(0).getBoundingClientRect();
      if (!rect.width && !rect.height) { setBtn(null); return; }
      const x = Math.max(8, Math.min(rect.right - 16, window.innerWidth - 190));
      const below = rect.bottom + 8;
      const y = below + 32 > window.innerHeight ? Math.max(8, rect.top - 40) : below;
      setBtn({ x, y, text });
    };
    const onUp = (e) => {
      if (e.target?.closest?.('[data-scratchpad-capture]')) return;
      setTimeout(evaluate, 0);
    };
    const onKeyUp = (e) => { if (e.shiftKey || e.key === 'Shift') setTimeout(evaluate, 0); };
    const hide = () => setBtn(null);
    const onDown = (e) => { if (!e.target?.closest?.('[data-scratchpad-capture]')) hide(); };
    document.addEventListener('mouseup', onUp);
    document.addEventListener('keyup', onKeyUp);
    document.addEventListener('mousedown', onDown);
    window.addEventListener('scroll', hide, true);
    window.addEventListener('resize', hide);
    return () => {
      document.removeEventListener('mouseup', onUp);
      document.removeEventListener('keyup', onKeyUp);
      document.removeEventListener('mousedown', onDown);
      window.removeEventListener('scroll', hide, true);
      window.removeEventListener('resize', hide);
    };
  }, [panelRef]);

  if (!btn) return null;
  return (
    <button
      type="button"
      data-scratchpad-capture
      onMouseDown={(e) => e.preventDefault()}
      onClick={() => { onCapture(btn.text); setBtn(null); }}
      style={{ left: btn.x, top: btn.y }}
      className="fixed z-[70] inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium shadow-glass-xl
        bg-slate-900 text-white dark:bg-white dark:text-slate-900 hover:opacity-90"
    >
      <ClipboardPlus className="w-3.5 h-3.5" />
      {t('scratchpad.addSelection')}
    </button>
  );
};

// ── Window (mounted once settings have loaded) ──────────────────────────────

const ScratchpadWindow = () => {
  const { t, i18n } = useTranslation();
  const { currentUser } = useAuth();
  const {
    entries, settings, error,
    open, setOpen,
    addEntry, updateEntry, deleteEntry, clearAll,
    pendingDelete, undoDelete,
    updateSettings, addedPulse,
  } = useScratchpad();
  const isMobile = useIsMobile();
  const sourceLabel = useSourceLabel();
  const theme = themeFor(settings.color);
  const fontClass = FONT_SIZE_CLASS[settings.fontSize] || FONT_SIZE_CLASS.md;

  const [view, setView] = useState('notes'); // 'notes' | 'settings'
  const [copiedAll, setCopiedAll] = useState(false);
  const [pulse, setPulse] = useState(false);
  const panelRef = useRef(null);
  const listRef = useRef(null);
  const composerRef = useRef(null);
  const prevCount = useRef(entries.length);

  const dir = i18n.dir(i18n.resolvedLanguage);
  const corner = screenCorner(settings.corner, dir);
  const bottomOffset = !isMobile && currentUser?.role === 'admin' && settings.corner === 'bottom-right'
    ? HEALTH_WIDGET_OFFSET : 0;

  // ── geometry (desktop) ────────────────────────────────────────────────────
  const [geo, setGeo] = useState(() => {
    const saved = readGeometry();
    const { w, h } = clampSize(saved?.w ?? DEFAULT_SIZE.w, saved?.h ?? DEFAULT_SIZE.h);
    const pos = saved?.custom ? clampPos(saved.x, saved.y, w, h) : cornerPos(corner, w, h, bottomOffset);
    return { ...pos, w, h, custom: !!saved?.custom };
  });
  const geoRef = useRef(geo);
  geoRef.current = geo;

  const placeAtCorner = useCallback((size) => {
    setGeo((g) => {
      const { w, h } = clampSize(size?.w ?? g.w, size?.h ?? g.h);
      const next = { ...cornerPos(corner, w, h, bottomOffset), w, h, custom: false };
      saveGeometry(next);
      return next;
    });
  }, [corner, bottomOffset]);

  // Corner setting changed: snap to it. Otherwise follow the corner only while
  // the user hasn't dragged it somewhere of their own.
  const lastCorner = useRef(corner);
  useEffect(() => {
    if (lastCorner.current !== corner) {
      lastCorner.current = corner;
      placeAtCorner();
    } else if (!geoRef.current.custom) {
      placeAtCorner();
    }
  }, [corner, bottomOffset, placeAtCorner]);

  // Keep it on screen when the window changes size.
  useEffect(() => {
    const onResize = () => {
      const g = geoRef.current;
      if (!g.custom) { placeAtCorner(); return; }
      const { w, h } = clampSize(g.w, g.h);
      setGeo({ ...g, ...clampPos(g.x, g.y, w, h), w, h });
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [placeAtCorner]);

  // Dragging by the header.
  const onHeaderPointerDown = (e) => {
    if (isMobile || e.button !== 0 || e.target.closest('button, input, a')) return;
    e.preventDefault();
    const start = { px: e.clientX, py: e.clientY, x: geoRef.current.x, y: geoRef.current.y };
    const el = e.currentTarget;
    el.setPointerCapture?.(e.pointerId);
    const onMove = (ev) => {
      const g = geoRef.current;
      setGeo({ ...g, ...clampPos(start.x + ev.clientX - start.px, start.y + ev.clientY - start.py, g.w, g.h), custom: true });
    };
    const onUp = () => {
      el.removeEventListener('pointermove', onMove);
      el.removeEventListener('pointerup', onUp);
      el.removeEventListener('pointercancel', onUp);
      saveGeometry(geoRef.current);
    };
    el.addEventListener('pointermove', onMove);
    el.addEventListener('pointerup', onUp);
    el.addEventListener('pointercancel', onUp);
  };

  // Resizing (native CSS resize handle) — record the new size.
  useLayoutEffect(() => {
    const el = panelRef.current;
    if (!open || isMobile || !el || typeof ResizeObserver === 'undefined') return undefined;
    let timer;
    const ro = new ResizeObserver(() => {
      const w = Math.round(el.offsetWidth);
      const h = Math.round(el.offsetHeight);
      const g = geoRef.current;
      if (Math.abs(w - g.w) < 2 && Math.abs(h - g.h) < 2) return;
      const size = clampSize(w, h);
      const next = { ...g, ...size, ...clampPos(g.x, g.y, size.w, size.h) };
      setGeo(next);
      clearTimeout(timer);
      timer = setTimeout(() => saveGeometry(next), 300);
    });
    ro.observe(el);
    return () => { ro.disconnect(); clearTimeout(timer); };
  }, [open, isMobile]);

  // ── capture ───────────────────────────────────────────────────────────────
  const capture = useCallback(async (text) => {
    await addEntry(text, sourceLabel());
  }, [addEntry, sourceLabel]);

  useEffect(() => {
    if (!settings.enabled) return undefined;
    const onKeyDown = (e) => {
      if (!e.altKey || !e.shiftKey || e.ctrlKey || e.metaKey) return;
      if (e.code === 'KeyS') {
        e.preventDefault();
        setOpen((o) => !o);
      } else if (e.code === 'KeyA') {
        e.preventDefault();
        const text = window.getSelection()?.toString().trim();
        if (text) {
          capture(text);
        } else {
          setOpen(true);
          setView('notes');
          setTimeout(() => composerRef.current?.focus(), 50);
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [settings.enabled, capture, setOpen]);

  // Flash the launcher when something is captured while closed.
  useEffect(() => {
    if (!addedPulse) return undefined;
    setPulse(true);
    const timer = setTimeout(() => setPulse(false), 900);
    return () => clearTimeout(timer);
  }, [addedPulse]);

  // Scroll to the newest note when one is added.
  useEffect(() => {
    if (entries.length > prevCount.current && listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
    prevCount.current = entries.length;
  }, [entries.length]);

  // Opening the panel shows the latest notes.
  useEffect(() => {
    if (open && listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [open]);

  const handleCopyAll = async () => {
    if (!entries.length) return;
    if (await copyText(entries.map((e) => e.content).join('\n\n---\n\n'))) {
      setCopiedAll(true);
      setTimeout(() => setCopiedAll(false), 1200);
    }
  };

  const headerBtn = 'p-1.5 rounded-md text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-black/5 dark:hover:bg-white/10 transition-colors disabled:opacity-40 disabled:pointer-events-none';

  // ── launcher ──────────────────────────────────────────────────────────────
  const launcherPos = isMobile
    ? { [dir === 'rtl' ? 'left' : 'right']: MARGIN, bottom: MARGIN }
    : {
        [corner.endsWith('right') ? 'right' : 'left']: MARGIN,
        [corner.startsWith('bottom') ? 'bottom' : 'top']: MARGIN + (corner.startsWith('bottom') ? bottomOffset : 0),
      };

  const panelStyle = isMobile
    ? { '--sp-idle-opacity': 1 }
    : { left: geo.x, top: geo.y, width: geo.w, height: geo.h, '--sp-idle-opacity': settings.opacity / 100 };

  return (
    <>
      {settings.selectionButton && <SelectionCapture panelRef={panelRef} onCapture={capture} />}

      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          style={launcherPos}
          className={`fixed z-[60] inline-flex items-center gap-2 rounded-full ps-3 pe-3.5 py-2 shadow-glass-xl border text-sm font-medium
            transition-transform hover:scale-105 ${theme.panel} ${pulse ? 'scale-110 ring-2 ring-accent-primary' : ''}`}
          title={`${t('scratchpad.open')} (Alt+Shift+S)`}
          aria-label={t('scratchpad.open')}
        >
          <NotebookPen className={`w-4 h-4 ${theme.icon}`} />
          <span className="hidden sm:inline">{t('scratchpad.title')}</span>
          {entries.length > 0 && (
            <span className="text-xs rounded-full px-1.5 bg-black/5 dark:bg-white/10">{entries.length}</span>
          )}
        </button>
      )}

      {open && (
        <div
          ref={panelRef}
          role="dialog"
          aria-label={t('scratchpad.title')}
          style={panelStyle}
          className={`scratchpad-panel fixed z-[60] flex flex-col overflow-hidden shadow-glass-xl rounded-[var(--radius-card)] ${theme.panel}
            ${isMobile ? 'inset-x-2 bottom-2 h-[65dvh]' : 'resize'}`}
        >
          {/* Header — drag handle */}
          <div
            onPointerDown={onHeaderPointerDown}
            className={`flex items-center gap-1 ps-3 pe-1.5 py-1.5 border-b select-none ${theme.header} ${isMobile ? '' : 'cursor-move'}`}
          >
            {view === 'settings' ? (
              <button type="button" onClick={() => setView('notes')} className={headerBtn} aria-label={t('scratchpad.backToNotes')} title={t('scratchpad.backToNotes')}>
                <ArrowLeft className="rtl:-scale-x-100 w-4 h-4" />
              </button>
            ) : (
              <NotebookPen className={`w-4 h-4 flex-shrink-0 ${theme.icon}`} />
            )}
            <span className="text-sm font-semibold text-slate-800 dark:text-slate-100 truncate ms-1">
              {view === 'settings' ? t('scratchpad.settings.title') : t('scratchpad.title')}
            </span>
            <div className="ms-auto flex items-center gap-0.5">
              {view === 'notes' && (
                <>
                  <button type="button" onClick={handleCopyAll} disabled={!entries.length} className={headerBtn} title={t('scratchpad.copyAll')} aria-label={t('scratchpad.copyAll')}>
                    {copiedAll ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                  </button>
                  <button type="button" onClick={clearAll} disabled={!entries.length} className={`${headerBtn} hover:!text-red-600`} title={t('scratchpad.clearAll')} aria-label={t('scratchpad.clearAll')}>
                    <Trash2 className="w-4 h-4" />
                  </button>
                  <button type="button" onClick={() => setView('settings')} className={headerBtn} title={t('scratchpad.settings.title')} aria-label={t('scratchpad.settings.title')}>
                    <Settings2 className="w-4 h-4" />
                  </button>
                </>
              )}
              <button type="button" onClick={() => setOpen(false)} className={headerBtn} title={`${t('scratchpad.minimize')} (Alt+Shift+S)`} aria-label={t('scratchpad.minimize')}>
                <Minus className="w-4 h-4" />
              </button>
            </div>
          </div>

          {view === 'settings' ? (
            <div className="flex-1 min-h-0 overflow-y-auto p-4">
              <ScratchpadSettingsView
                settings={settings}
                onChange={updateSettings}
                onResetGeometry={() => placeAtCorner(DEFAULT_SIZE)}
                isMobile={isMobile}
              />
            </div>
          ) : (
            <>
              <div ref={listRef} className="flex-1 min-h-0 overflow-y-auto px-3 py-2 space-y-2">
                {settings.showTodos && <ScratchpadTodos fontClass={fontClass} />}
                {entries.length === 0 ? (
                  <div className="text-center text-xs text-slate-500 dark:text-slate-400 py-6 px-4 space-y-1.5">
                    <p className="font-medium text-slate-600 dark:text-slate-300">{t('scratchpad.emptyTitle')}</p>
                    <p>{t('scratchpad.emptyHelp')}</p>
                  </div>
                ) : (
                  entries.map((entry) => (
                    <ScratchpadEntry
                      key={entry.id}
                      entry={entry}
                      onUpdate={updateEntry}
                      onDelete={deleteEntry}
                      theme={theme}
                      fontClass={fontClass}
                    />
                  ))
                )}
              </div>

              {(pendingDelete || error) && (
                <div className="px-3 pb-1">
                  {pendingDelete && (
                    <div className="relative overflow-hidden flex items-center gap-2 rounded-md bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 px-3 py-1.5 text-xs">
                      <span className="flex-1">
                        {pendingDelete.kind === 'clear'
                          ? t('scratchpad.clearedCount', { count: pendingDelete.ids.length })
                          : t('scratchpad.noteDeleted')}
                      </span>
                      <button type="button" onClick={undoDelete} className="inline-flex items-center gap-1 font-semibold hover:underline">
                        <Undo2 className="w-3.5 h-3.5" /> {t('scratchpad.undo')}
                      </button>
                      <span
                        key={pendingDelete.ids.join(',')}
                        className="absolute start-0 bottom-0 h-0.5 bg-accent-primary scratchpad-undo-bar"
                        style={{ animationDuration: `${UNDO_MS}ms` }}
                      />
                    </div>
                  )}
                  {error && (
                    <div className="mt-1 rounded-md bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300 px-3 py-1.5 text-xs">{error}</div>
                  )}
                </div>
              )}

              <div className="px-3 pb-3 pt-2 border-t border-black/5 dark:border-white/10">
                <ScratchpadComposer onAdd={(text) => addEntry(text)} fontClass={fontClass} inputRef={composerRef} />
              </div>
            </>
          )}
        </div>
      )}
    </>
  );
};

// Mounted only once the user's settings are known, so the window starts in
// the right corner instead of jumping there after load.
const Scratchpad = () => {
  const { loaded, settings } = useScratchpad();
  if (!loaded || !settings.enabled) return null;
  return <SilentBoundary><ScratchpadWindow /></SilentBoundary>;
};

// A floating widget that fails should vanish, not drop an error card into
// the page layout.
class SilentBoundary extends React.Component {
  constructor(props) { super(props); this.state = { failed: false }; }
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(error) { console.error('Scratchpad failed to render:', error); }
  render() { return this.state.failed ? null : this.props.children; }
}

export default Scratchpad;
