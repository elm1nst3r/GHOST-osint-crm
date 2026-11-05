// File: frontend/src/components/tools/builder/JsonPicker.jsx
//
// A service's test response as a clickable tree (integration builder). Click
// a value, or a list of plain values, to make it a result field. Values
// already picked are highlighted.
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronRight, ChevronDown, Plus } from 'lucide-react';

const isScalar = (v) => v === null || ['string', 'number', 'boolean'].includes(typeof v);
const keyOf = (segs) => JSON.stringify(segs);

const Scalar = ({ value }) => {
  if (value === null) return <span className="text-gray-400">null</span>;
  if (typeof value === 'string') return <span className="text-green-700 dark:text-green-400 break-all">"{value}"</span>;
  return <span className="text-blue-700 dark:text-blue-300">{String(value)}</span>;
};

const Node = ({ name, value, segs, depth, onPick, picked }) => {
  const { t } = useTranslation();
  const [open, setOpen] = useState(depth < 3);
  const label = name !== undefined && (
    <span className="text-purple-700 dark:text-purple-300">{typeof name === 'number' ? `[${name}]` : name}</span>
  );

  if (isScalar(value)) {
    const isPicked = picked.has(keyOf(segs));
    return (
      <div className="flex items-start gap-1 ps-4 py-0.5">
        {label}{label && <span className="text-gray-400">:</span>}
        <button
          type="button"
          onClick={() => onPick(segs, value)}
          title={t('builder.pickHint')}
          className={`text-start rounded-sm px-1 -mx-1 hover:bg-yellow-100 dark:hover:bg-yellow-900/40 ${isPicked ? 'bg-yellow-200 dark:bg-yellow-800/60' : ''}`}
        >
          <Scalar value={value} />
        </button>
      </div>
    );
  }

  const isArray = Array.isArray(value);
  const entries = isArray ? value.map((v, i) => [i, v]) : Object.entries(value);
  const scalarList = isArray && value.length > 0 && value.every(isScalar);
  return (
    <div className="ps-4">
      <div className="flex items-center gap-1 py-0.5">
        <button type="button" onClick={() => setOpen(!open)} className="flex items-center gap-1 text-gray-600 dark:text-gray-300" aria-expanded={open}>
          {open ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
          {label}
          <span className="text-gray-400 text-xs">{isArray ? t('builder.listOf', { count: value.length }) : '{…}'}</span>
        </button>
        {scalarList && (
          <button
            type="button"
            onClick={() => onPick(segs, value)}
            className={`ms-1 inline-flex items-center gap-0.5 text-xs px-1.5 rounded-sm border border-gray-300 dark:border-gray-600 hover:bg-yellow-100 dark:hover:bg-yellow-900/40 ${picked.has(keyOf(segs)) ? 'bg-yellow-200 dark:bg-yellow-800/60' : ''}`}
          >
            <Plus className="w-3 h-3" />{t('builder.pickWholeList')}
          </button>
        )}
      </div>
      {open && entries.map(([k, v]) => (
        <Node key={k} name={k} value={v} segs={[...segs, k]} depth={depth + 1} onPick={onPick} picked={picked} />
      ))}
    </div>
  );
};

// A JSON tree reads left-to-right in every language, like a code block, so it
// stays LTR inside an RTL page (issue #99).
const JsonPicker = ({ json, onPick, picked = new Set() }) => (
  <div dir="ltr" className="font-mono text-xs leading-relaxed -ms-4 overflow-x-auto">
    {isScalar(json)
      ? <div className="ps-4"><Scalar value={json} /></div>
      : <Node value={json} segs={[]} depth={0} onPick={onPick} picked={picked} />}
  </div>
);

export const pickedKey = keyOf;
export default JsonPicker;
