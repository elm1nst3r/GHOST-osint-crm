// What you change on the graph itself, not in the data (graph plan, phase 2):
// hidden entities, pinned ones, neighbours shown on request, moves. All of it
// can be undone, step by step. Data changes (links, edits) go through the
// normal API and the audit log instead.
import { useState } from 'react';

const LIMIT = 50;

export function useGraphEdits(canvasRef) {
  const [hidden, setHidden] = useState([]);
  const [pinned, setPinned] = useState([]);
  const [keep, setKeep] = useState([]); // brought in by "Show neighbours"
  const [history, setHistory] = useState([]);

  const record = (entry) => setHistory((h) => [...h.slice(-(LIMIT - 1)), entry]);
  const change = ({ hidden: h = hidden, pinned: p = pinned, keep: k = keep }) => {
    record({ kind: 'state', state: { hidden, pinned, keep } });
    setHidden(h); setPinned(p); setKeep(k);
  };
  const uniq = (list) => [...new Set(list)];

  return {
    hidden, pinned, keep,
    canUndo: history.length > 0,
    hide: (ids) => change({ hidden: uniq([...hidden, ...ids]), keep: keep.filter((id) => !ids.includes(id)) }),
    showOnly: (ids, allIds) => change({ hidden: allIds.filter((id) => !ids.includes(id)) }),
    unhideAll: () => change({ hidden: [] }),
    togglePin: (ids) => {
      const allPinned = ids.every((id) => pinned.includes(id));
      change({ pinned: allPinned ? pinned.filter((id) => !ids.includes(id)) : uniq([...pinned, ...ids]) });
    },
    // Neighbours brought in: shown whatever the switches and filters say.
    bringIn: (ids) => change({ keep: uniq([...keep, ...ids]), hidden: hidden.filter((id) => !ids.includes(id)) }),
    moved: (before) => record({ kind: 'move', positions: before }),
    undo: () => {
      const last = history[history.length - 1];
      if (!last) return;
      setHistory((h) => h.slice(0, -1));
      if (last.kind === 'move') canvasRef.current?.setPositions(last.positions);
      else { setHidden(last.state.hidden); setPinned(last.state.pinned); setKeep(last.state.keep); }
    },
    reset: () => { setHidden([]); setPinned([]); setKeep([]); setHistory([]); },
  };
}
