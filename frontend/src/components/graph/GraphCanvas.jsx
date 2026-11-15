// File: frontend/src/components/graph/GraphCanvas.jsx
//
// One Cytoscape instance (graph plan, phase 1). Knows nothing about the API:
// it draws the elements it's given, keeps positions when they change, and
// reports taps, double-taps and new connections.
import { forwardRef, useEffect, useEffectEvent, useImperativeHandle, useRef } from 'react';
import cytoscape from './cytoscape';

export const LAYOUTS = {
  force: {
    name: 'fcose', quality: 'default', animate: true, animationDuration: 450,
    nodeRepulsion: () => 9000, idealEdgeLength: () => 95, nodeSeparation: 90,
    packComponents: true, fit: true, padding: 40,
  },
  hierarchical: { name: 'dagre', rankDir: 'TB', nodeSep: 45, rankSep: 90, animate: true, animationDuration: 450, fit: true, padding: 40 },
  concentric: {
    name: 'concentric', concentric: (n) => n.data('degree') || 0, levelWidth: () => 2,
    minNodeSpacing: 30, animate: true, animationDuration: 450, fit: true, padding: 40,
  },
  circle: { name: 'circle', animate: true, animationDuration: 450, fit: true, padding: 40 },
  grid: { name: 'grid', animate: true, animationDuration: 450, fit: true, padding: 40 },
};


// Puts nodes that are new next to a neighbour already on the canvas, so the
// layout only has to settle them instead of starting over.
function placeNear(cy, added) {
  added.forEach((node) => {
    const placed = node.neighborhood('node').filter((n) => !added.contains(n));
    if (placed.length) {
      const p = placed[0].position();
      node.position({ x: p.x + (Math.random() - 0.5) * 80, y: p.y + (Math.random() - 0.5) * 80 });
    }
  });
}

const GraphCanvas = forwardRef(function GraphCanvas({
  elements, stylesheet, layout = 'force', connectMode = false, focusId = null, resetKey = null,
  canConnect = () => false, onSelect, onOpen, onConnect, minimap = true, minimapColors = {},
  pinned = [], placeHint = null, onPlaced, onContextMenu, onSelectionChange, onMoved,
}, ref) {
  const containerRef = useRef(null);
  const cyRef = useRef(null);
  const ehRef = useRef(null);
  const layoutRef = useRef(null);
  const minimapRef = useRef(null);
  const lastResetKey = useRef(resetKey);

  const runLayout = (name = layout, opts = {}) => {
    const cy = cyRef.current;
    if (!cy || cy.nodes().length === 0) return;
    layoutRef.current?.stop();
    layoutRef.current = cy.layout({ ...(LAYOUTS[name] || LAYOUTS.force), ...opts });
    layoutRef.current.run();
  };

  useImperativeHandle(ref, () => ({
    fit: () => cyRef.current?.animate({ fit: { padding: 40 } }, { duration: 300 }),
    zoomBy: (factor) => {
      const cy = cyRef.current;
      if (!cy) return;
      cy.animate({ zoom: { level: cy.zoom() * factor, position: { x: cy.width() / 2, y: cy.height() / 2 } } }, { duration: 200 });
    },
    relayout: () => runLayout(layout, { randomize: true }),
    png: () => cyRef.current?.png({ full: true, scale: 2, bg: getComputedStyle(containerRef.current).backgroundColor }),
    cy: () => cyRef.current,
    // Lay out only the selected nodes, where they are.
    layoutSelected: () => {
      const cy = cyRef.current;
      const sel = cy?.nodes(':selected');
      if (!sel || sel.length < 2) return;
      const bb = sel.boundingBox();
      sel.layout({ ...(LAYOUTS[layout] || LAYOUTS.force), fit: false, randomize: false, boundingBox: { x1: bb.x1, y1: bb.y1, w: Math.max(bb.w, 200), h: Math.max(bb.h, 200) } }).run();
    },
    positions: (ids) => Object.fromEntries(ids.map((id) => [id, { ...cyRef.current?.getElementById(id).position() }])),
    setPositions: (map) => {
      const cy = cyRef.current;
      if (!cy) return;
      cy.batch(() => Object.entries(map).forEach(([id, p]) => {
        const n = cy.getElementById(id);
        if (n.nonempty()) { const locked = n.locked(); n.unlock(); n.position(p); if (locked) n.lock(); }
      }));
    },
    select: (ids) => {
      const cy = cyRef.current;
      if (!cy) return;
      cy.batch(() => { cy.elements().unselect(); ids.forEach((id) => cy.getElementById(id).select()); });
    },
    unselectAll: () => cyRef.current?.elements().unselect(),
    // A rendered (screen) point → graph coordinates.
    toModel: ({ x, y }) => {
      const cy = cyRef.current;
      const pan = cy.pan(); const zoom = cy.zoom();
      return { x: (x - pan.x) / zoom, y: (y - pan.y) / zoom };
    },
  }));

  const emitSelect = useEffectEvent((sel) => onSelect?.(sel));
  const emitOpen = useEffectEvent((data) => onOpen?.(data));
  const emitConnect = useEffectEvent((a, b) => onConnect?.(a, b));
  const checkConnect = useEffectEvent((a, b) => canConnect(a, b));
  const redrawMinimap = useEffectEvent(() => minimapRef.current?.());
  const emitMenu = useEffectEvent((menu) => onContextMenu?.(menu));
  const emitSelection = useEffectEvent((ids) => onSelectionChange?.(ids));
  const emitMoved = useEffectEvent((before) => onMoved?.(before));
  const emitPlaced = useEffectEvent(() => onPlaced?.());
  const hint = useEffectEvent(() => placeHint);
  const layoutNow = useEffectEvent((opts) => runLayout(layout, opts));

  // Create once.
  useEffect(() => {
    const cy = cytoscape({
      container: containerRef.current,
      elements: [],
      style: [], // the stylesheet effect below applies it
      minZoom: 0.05,
      maxZoom: 4,
      boxSelectionEnabled: true,
      selectionType: 'single', // Shift/Ctrl/Cmd-click adds or removes (below)
    });
    cyRef.current = cy;

    // Shift/Ctrl/Cmd-click toggles a node in the selection: Cytoscape's own
    // single selection runs first, then the earlier selection is put back.
    let before = cy.collection();
    cy.on('tapstart', 'node', () => { before = cy.nodes(':selected'); });
    cy.on('tap', 'node', (e) => {
      const ev = e.originalEvent || {};
      const node = e.target;
      if (ev.shiftKey || ev.ctrlKey || ev.metaKey) {
        const keep = before;
        const wasSelected = keep.contains(node);
        setTimeout(() => cy.batch(() => {
          keep.difference(node).select();
          if (wasSelected) node.unselect(); else node.select();
        }), 0);
      }
      emitSelect({ kind: 'node', data: node.data() });
    });
    cy.on('tap', 'edge', (e) => emitSelect({ kind: 'edge', data: e.target.data() }));
    cy.on('tap', (e) => { if (e.target === cy) emitSelect(null); });
    cy.on('dbltap', 'node', (e) => emitOpen(e.target.data()));

    // Right-click, or a long press on touch screens: the context menu.
    const menu = (e) => {
      const target = e.target;
      const kind = target === cy ? 'canvas' : target.isNode() ? 'node' : 'edge';
      if (kind === 'node' && !target.selected()) { cy.elements().unselect(); target.select(); }
      emitMenu({ kind, data: kind === 'canvas' ? null : target.data(), x: e.renderedPosition.x, y: e.renderedPosition.y, model: { ...e.position } });
    };
    cy.on('cxttap', menu);
    cy.on('taphold', menu);

    // What's selected (box select, Shift-click), reported once per change.
    let selTimer = null;
    cy.on('select unselect', 'node', () => {
      clearTimeout(selTimer);
      selTimer = setTimeout(() => emitSelection(cy.nodes(':selected').map((n) => n.id())), 30);
    });

    // Moves by hand, for undo.
    let grabbed = null;
    cy.on('grab', 'node', () => {
      const moving = cy.nodes(':selected').union(cy.nodes(':grabbed'));
      grabbed = Object.fromEntries(moving.map((n) => [n.id(), { ...n.position() }]));
    });
    cy.on('free', 'node', () => {
      if (!grabbed) return;
      const before = grabbed;
      grabbed = null;
      const moved = Object.entries(before).some(([id, p]) => {
        const now = cy.getElementById(id).position();
        return Math.abs(now.x - p.x) > 1 || Math.abs(now.y - p.y) > 1;
      });
      if (moved) emitMoved(before);
    });

    // Hover: the node and its neighbours stay, the rest fades.
    cy.on('mouseover', 'node', (e) => {
      const node = e.target;
      cy.batch(() => {
        cy.elements().difference(node.closedNeighborhood()).addClass('faded');
        node.connectedEdges().addClass('highlighted');
        node.addClass('hovered');
      });
    });
    cy.on('mouseout', 'node', () => {
      cy.batch(() => cy.elements().removeClass('faded highlighted hovered'));
    });

    const eh = cy.edgehandles({
      canConnect: (s, t) => !s.same(t) && checkConnect(s.data(), t.data()),
      edgeParams: () => ({ data: { type: 'pending' } }),
      hoverDelay: 120,
      snap: true,
      snapThreshold: 30,
    });
    eh.disable();
    ehRef.current = eh;
    cy.on('ehcomplete', (event, source, target, added) => {
      added.remove();
      cy.elements().removeClass('faded highlighted hovered');
      emitConnect(source.data(), target.data());
    });

    let pending = null;
    cy.on('render viewport', () => {
      if (pending) return;
      pending = setTimeout(() => { pending = null; redrawMinimap(); }, 120);
    });

    const resize = new ResizeObserver(() => cy.resize());
    resize.observe(containerRef.current);
    return () => {
      resize.disconnect();
      clearTimeout(pending);
      clearTimeout(selTimer);
      layoutRef.current?.stop();
      eh.destroy();
      cy.destroy();
      cyRef.current = null;
    };
  }, []);

  useEffect(() => { cyRef.current?.style(stylesheet); }, [stylesheet]);

  // Elements: update in place, keep positions, lay out only what's new.
  const syncElements = useEffectEvent(() => {
    const cy = cyRef.current;
    if (!cy) return;
    const wanted = new Map(elements.map((el) => [el.data.id, el]));
    const hadNodes = cy.nodes().length > 0;
    let added = cy.collection();
    cy.batch(() => {
      cy.elements().filter((el) => !wanted.has(el.id())).remove();
      for (const el of elements) {
        const existing = cy.getElementById(el.data.id);
        if (existing.nonempty()) {
          existing.data(el.data);
          existing.classes(el.classes || '');
        } else if (el.group === 'nodes') {
          added = added.union(cy.add(el));
        }
      }
      // Edges after nodes: both ends must exist.
      for (const el of elements) {
        if (el.group === 'edges' && cy.getElementById(el.data.id).empty()) cy.add(el);
      }
    });
    // Something just created at a spot on the canvas starts there.
    const at = hint();
    if (at && added.nonempty() && hadNodes) {
      added.filter((n) => n.neighborhood('node').difference(added).empty()).position({ ...at });
      emitPlaced();
      return; // leave everything else where it is
    }
    // A new centre or depth is a new picture: lay it all out afresh.
    const reset = lastResetKey.current !== resetKey;
    lastResetKey.current = resetKey;
    if (!hadNodes || reset) layoutNow({ randomize: true });
    else if (added.nonempty()) {
      placeNear(cy, added);
      layoutNow(layout === 'force' ? { randomize: false } : {});
    }
  });
  useEffect(() => { syncElements(); }, [elements]);
  useEffect(() => { layoutNow(); }, [layout]);

  // Pinned nodes stay where they are, through layouts too.
  const applyPins = useEffectEvent(() => {
    const cy = cyRef.current;
    if (!cy) return;
    const set = new Set(pinned);
    cy.batch(() => cy.nodes().forEach((n) => {
      if (set.has(n.id())) n.lock().addClass('pinned'); else n.unlock().removeClass('pinned');
    }));
  });
  useEffect(() => { applyPins(); }, [pinned, elements]);

  useEffect(() => {
    const eh = ehRef.current;
    if (!eh) return;
    if (connectMode) { eh.enable(); eh.enableDrawMode(); } else { eh.disableDrawMode(); eh.disable(); }
  }, [connectMode]);

  // Centre on the focus entity once it's laid out.
  useEffect(() => {
    const cy = cyRef.current;
    if (!cy || !focusId) return;
    const node = cy.getElementById(focusId);
    if (node.nonempty()) node.select();
  }, [focusId, elements]);

  return (
    <div className="relative h-full w-full">
      {/* Cytoscape makes its container position: relative, so it's sized
          with width/height, not absolute insets. */}
      <div ref={containerRef} className="h-full w-full" data-testid="graph-canvas" />
      {minimap && <Minimap cyRef={cyRef} colors={minimapColors} redrawRef={minimapRef} />}
    </div>
  );
});

// A small overview of the whole graph with the visible part framed; click or
// drag in it to move there.
function Minimap({ cyRef, colors, redrawRef }) {
  const canvasRef = useRef(null);
  const geometry = useRef(null);
  const W = 168;
  const H = 112;

  const draw = () => {
    const cy = cyRef.current;
    const canvas = canvasRef.current;
    if (!cy || !canvas) return;
    const ctx = canvas.getContext('2d');
    const ratio = window.devicePixelRatio || 1;
    canvas.width = W * ratio;
    canvas.height = H * ratio;
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    ctx.clearRect(0, 0, W, H);
    const nodes = cy.nodes(':visible');
    if (nodes.empty()) return;
    const bb = nodes.boundingBox();
    const scale = Math.min((W - 8) / Math.max(bb.w, 1), (H - 8) / Math.max(bb.h, 1));
    const ox = (W - bb.w * scale) / 2 - bb.x1 * scale;
    const oy = (H - bb.h * scale) / 2 - bb.y1 * scale;
    geometry.current = { scale, ox, oy };
    ctx.globalAlpha = 0.35;
    ctx.strokeStyle = colors.edge || '#64748b';
    ctx.lineWidth = 0.5;
    cy.edges(':visible').forEach((e) => {
      const a = e.source().position(); const b = e.target().position();
      ctx.beginPath(); ctx.moveTo(a.x * scale + ox, a.y * scale + oy); ctx.lineTo(b.x * scale + ox, b.y * scale + oy); ctx.stroke();
    });
    ctx.globalAlpha = 1;
    nodes.forEach((n) => {
      const p = n.position();
      ctx.fillStyle = (colors.node || {})[n.data('type')] || '#94a3b8';
      ctx.beginPath(); ctx.arc(p.x * scale + ox, p.y * scale + oy, 2, 0, Math.PI * 2); ctx.fill();
    });
    const ext = cy.extent();
    ctx.strokeStyle = colors.view || '#fbbf24';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(ext.x1 * scale + ox, ext.y1 * scale + oy, ext.w * scale, ext.h * scale);
  };
  useEffect(() => { redrawRef.current = draw; });

  const moveTo = (event) => {
    const cy = cyRef.current;
    const g = geometry.current;
    if (!cy || !g) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const x = (event.clientX - rect.left - g.ox) / g.scale;
    const y = (event.clientY - rect.top - g.oy) / g.scale;
    cy.pan({ x: cy.width() / 2 - x * cy.zoom(), y: cy.height() / 2 - y * cy.zoom() });
  };

  return (
    <canvas
      ref={canvasRef}
      style={{ width: W, height: H }}
      className="absolute bottom-3 end-3 rounded-lg border border-white/10 bg-black/40 backdrop-blur-sm cursor-pointer hidden sm:block"
      onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); moveTo(e); }}
      onPointerMove={(e) => { if (e.buttons) moveTo(e); }}
      aria-hidden="true"
    />
  );
}

export default GraphCanvas;
