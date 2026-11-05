// File: frontend/src/components/scratchpad/ScratchpadNotes.jsx
// One note (rendered markdown, click-to-tick task lists, inline edit) and the
// composer at the bottom of the panel.

import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Copy, Check, Pencil, X, Plus } from 'lucide-react';
import { renderMarkdown, toggleTask, markdownToPlainText } from '../../utils/scratchpadMarkdown';
import { formatDateTime, formatTime } from '../../utils/format';

const MAX_LEN = 20000;

export async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Fallback for non-secure contexts (plain-http self-hosting).
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    let ok;
    try { ok = document.execCommand('copy'); } catch { ok = false; }
    ta.remove();
    return ok;
  }
}

const autosize = (el, maxPx) => {
  if (!el) return;
  el.style.height = 'auto';
  el.style.height = `${Math.min(el.scrollHeight, maxPx)}px`;
};

const formatWhen = (iso) => {
  if (!iso) return '';
  const sameDay = new Date(iso).toDateString() === new Date().toDateString();
  return sameDay
    ? formatTime(iso, { hour: '2-digit', minute: '2-digit' })
    : formatDateTime(iso, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
};

const iconBtn = 'p-1 rounded-md text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-black/5 dark:hover:bg-white/10 transition-colors';

export const ScratchpadEntry = ({ entry, onUpdate, onDelete, theme, fontClass }) => {
  const { t } = useTranslation();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(entry.content);
  const [copied, setCopied] = useState(false);
  const textareaRef = useRef(null);

  const html = useMemo(() => renderMarkdown(entry.content), [entry.content]);

  useEffect(() => {
    if (editing && textareaRef.current) {
      const el = textareaRef.current;
      el.focus();
      el.setSelectionRange(el.value.length, el.value.length);
      autosize(el, 320);
    }
  }, [editing]);

  const startEdit = () => { setDraft(entry.content); setEditing(true); };
  const cancelEdit = () => { setEditing(false); setDraft(entry.content); };
  const saveEdit = async () => {
    if (!draft.trim()) return;
    if (draft !== entry.content) await onUpdate(entry.id, draft);
    setEditing(false);
  };

  const handleClick = (e) => {
    const box = e.target.closest('input[type="checkbox"][data-task-index]');
    if (!box) return;
    onUpdate(entry.id, toggleTask(entry.content, Number(box.dataset.taskIndex)));
  };

  const handleCopy = async () => {
    if (await copyText(markdownToPlainText(entry.content))) {
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    }
  };

  return (
    <div className={`group rounded-lg border px-3 py-2 ${theme.entry}`}>
      <div className="flex items-center gap-2 mb-1 min-h-[22px]">
        <span className="text-[11px] text-slate-500 dark:text-slate-400 truncate" title={entry.source_label || undefined}>
          {formatWhen(entry.created_at)}
          {entry.source_label && <> · {entry.source_label}</>}
        </span>
        {!editing && (
          <div className="ms-auto flex items-center gap-0.5 reveal-on-hover transition-opacity">
            <button type="button" onClick={handleCopy} className={iconBtn} title={t('scratchpad.copyNote')} aria-label={t('scratchpad.copyNote')}>
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
            </button>
            <button type="button" onClick={startEdit} className={iconBtn} title={t('scratchpad.editNote')} aria-label={t('scratchpad.editNote')}>
              <Pencil className="w-3.5 h-3.5" />
            </button>
            <button type="button" onClick={() => onDelete(entry.id)} className={`${iconBtn} hover:text-red-600!`} title={t('scratchpad.deleteNote')} aria-label={t('scratchpad.deleteNote')}>
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>

      {editing ? (
        <div>
          <textarea
            ref={textareaRef}
            value={draft}
            maxLength={MAX_LEN}
            onChange={(e) => { setDraft(e.target.value); autosize(e.target, 320); }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); saveEdit(); }
              if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); cancelEdit(); }
            }}
            className={`input-base py-1.5! px-2! font-mono resize-none ${fontClass}`}
            rows={3}
          />
          <div className="flex justify-end gap-2 mt-1.5">
            <button type="button" onClick={cancelEdit} className="btn btn-secondary py-1! px-2.5! text-xs">{t('common.cancel')}</button>
            <button type="button" onClick={saveEdit} disabled={!draft.trim()} className="btn btn-primary py-1! px-2.5! text-xs">{t('common.save')}</button>
          </div>
        </div>
      ) : (
        <div
          dir="auto"
          className={`scratchpad-md wrap-break-word ${fontClass}`}
          onClick={handleClick}
          onDoubleClick={(e) => { if (!e.target.closest('a, input')) startEdit(); }}
          // Sanitised by DOMPurify in renderMarkdown().
          dangerouslySetInnerHTML={{ __html: html }}
        />
      )}
    </div>
  );
};

export const ScratchpadComposer = ({ onAdd, fontClass, inputRef }) => {
  const { t } = useTranslation();
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!text.trim() || busy) return;
    setBusy(true);
    const ok = await onAdd(text);
    setBusy(false);
    if (ok) {
      setText('');
      if (inputRef.current) inputRef.current.style.height = 'auto';
    }
  };

  return (
    <div className="flex items-end gap-2">
      <textarea
        ref={inputRef}
        value={text}
        maxLength={MAX_LEN}
        onChange={(e) => { setText(e.target.value); autosize(e.target, 180); }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); submit(); }
          if (e.key === 'Escape') { e.stopPropagation(); e.target.blur(); }
        }}
        rows={2}
        placeholder={t('scratchpad.composerPlaceholder')}
        aria-label={t('scratchpad.composerPlaceholder')}
        className={`input-base py-1.5! px-2.5! resize-none ${fontClass}`}
      />
      <button
        type="button"
        onClick={submit}
        disabled={!text.trim() || busy}
        className="btn btn-primary p-2! shrink-0"
        title={t('scratchpad.addNote')}
        aria-label={t('scratchpad.addNote')}
      >
        <Plus className="w-4 h-4" />
      </button>
    </div>
  );
};
