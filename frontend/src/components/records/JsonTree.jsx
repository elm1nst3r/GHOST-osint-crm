// File: frontend/src/components/records/JsonTree.jsx
//
// A saved record (issue #96) shown as the provider returned it: objects and
// lists fold open and shut, values are shown as typed. With `onPick`, every
// text or number value gets a button to add it to the person's OSINT data;
// it receives the value's path ("result[2].EMAIL") and the value.
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronRight, ChevronDown, Plus } from 'lucide-react';

const IDENTIFIER = /^[A-Za-z_$][\w$]*$/;
const childPath = (path, key, isIndex) => {
  if (isIndex) return `${path}[${key}]`;
  const part = IDENTIFIER.test(key) ? key : `[${JSON.stringify(key)}]`;
  if (!path) return part;
  return part.startsWith('[') ? `${path}${part}` : `${path}.${part}`;
};

const Leaf = ({ value }) => {
  if (value === null) return <span className="italic text-gray-400">null</span>;
  if (typeof value === 'string') return <bdi dir="auto" className="text-gray-900 dark:text-gray-100 break-all">{value}</bdi>;
  if (typeof value === 'boolean') return <span className="font-mono text-purple-700 dark:text-purple-300">{String(value)}</span>;
  return <span className="font-mono tabular-nums text-blue-700 dark:text-blue-300">{String(value)}</span>;
};

const Node = ({ name, value, path, depth, openDepth, onPick, isIndex }) => {
  const { t } = useTranslation();
  const branch = value !== null && typeof value === 'object';
  const [open, setOpen] = useState(depth < openDepth);
  const label = name === undefined ? null : (
    <span className={isIndex ? 'text-gray-400 tabular-nums' : 'text-gray-500 dark:text-gray-400'}><bdi dir="auto">{name}</bdi>:</span>
  );

  if (!branch) {
    const pickable = onPick && (typeof value === 'string' ? value.trim() !== '' : typeof value === 'number');
    return (
      <div className="group flex items-start gap-1.5 py-0.5 ps-5">
        {label}
        <Leaf value={value} />
        {pickable && (
          <button
            type="button"
            onClick={() => onPick(path, String(value))}
            className="reveal-on-hover shrink-0 p-0.5 rounded-sm text-gray-400 hover:text-blue-600 hover:bg-gray-100 dark:hover:bg-gray-700"
            title={t('records.addValue')}
            aria-label={t('records.addValueNamed', { value: String(value) })}
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    );
  }

  const entries = Array.isArray(value) ? value.map((v, i) => [String(i), v]) : Object.entries(value);
  const summary = Array.isArray(value) ? t('records.listSummary', { count: entries.length }) : t('records.objectSummary', { count: entries.length });
  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        className="flex items-center gap-1 py-0.5 text-start hover:text-blue-600"
      >
        {open ? <ChevronDown className="w-4 h-4 shrink-0" /> : <ChevronRight className="w-4 h-4 shrink-0 rtl:-scale-x-100" />}
        {label}
        <span className="text-xs text-gray-400">{summary}</span>
      </button>
      {open && (
        <div className="ms-2 ps-2 border-s border-gray-200 dark:border-gray-700">
          {entries.map(([k, v]) => (
            <Node
              key={k}
              name={k}
              value={v}
              path={childPath(path, k, Array.isArray(value))}
              depth={depth + 1}
              openDepth={openDepth}
              onPick={onPick}
              isIndex={Array.isArray(value)}
            />
          ))}
        </div>
      )}
    </div>
  );
};

const JsonTree = ({ value, onPick, openDepth = 2 }) => {
  const entries = value !== null && typeof value === 'object'
    ? (Array.isArray(value) ? value.map((v, i) => [String(i), v]) : Object.entries(value))
    : null;
  if (!entries) return <Node value={value} path="" depth={0} openDepth={openDepth} onPick={onPick} />;
  return (
    <div className="text-sm">
      {entries.map(([k, v]) => (
        <Node
          key={k}
          name={k}
          value={v}
          path={childPath('', k, Array.isArray(value))}
          depth={1}
          openDepth={openDepth}
          onPick={onPick}
          isIndex={Array.isArray(value)}
        />
      ))}
    </div>
  );
};

export default JsonTree;
