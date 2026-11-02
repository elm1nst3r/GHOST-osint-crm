// File: frontend/src/utils/scratchpadMarkdown.js
//
// Markdown for the scratchpad: GitHub-flavoured (tables, task lists,
// strikethrough), single newlines kept as line breaks like a notepad, and
// everything sanitised with DOMPurify because notes are often pasted from
// untrusted pages.
//
// OPSEC: nothing in a note may make the browser fetch a remote resource on
// its own. Images become plain links (a pasted tracking pixel would otherwise
// leak the analyst's IP to the target), and style attributes are stripped
// (background-image: url(...) does the same).

import { Marked } from 'marked';
import DOMPurify from 'dompurify';

const escapeHtml = (s) => String(s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

let taskCounter = 0;

const marked = new Marked({
  gfm: true,
  breaks: true,
  renderer: {
    // Task-list checkboxes are clickable: each gets its position so a click
    // can be mapped back to the matching "[ ]" in the source (toggleTask).
    checkbox({ checked }) {
      const index = taskCounter++;
      return `<input type="checkbox" data-task-index="${index}"${checked ? ' checked=""' : ''}> `;
    },
    image({ href, text }) {
      const label = text || href || 'image';
      return `<a href="${escapeHtml(href || '')}">🖼 ${escapeHtml(label)}</a>`;
    },
  },
});

const PURIFY_CONFIG = {
  FORBID_TAGS: ['img', 'image', 'picture', 'source', 'video', 'audio', 'iframe', 'object', 'embed', 'style', 'link', 'form', 'svg', 'math'],
  FORBID_ATTR: ['style', 'srcset', 'background', 'poster'],
  ADD_ATTR: ['target'],
};

let hooksInstalled = false;
function installHooks() {
  if (hooksInstalled) return;
  hooksInstalled = true;
  DOMPurify.addHook('afterSanitizeAttributes', (node) => {
    if (node.tagName === 'A' && node.getAttribute('href')) {
      node.setAttribute('target', '_blank');
      node.setAttribute('rel', 'noopener noreferrer nofollow');
    }
    // Only checkboxes the markdown renderer made are interactive.
    if (node.tagName === 'INPUT' && node.getAttribute('type') !== 'checkbox') {
      node.remove();
    }
  });
}

// Markdown source -> sanitised HTML string.
export function renderMarkdown(source) {
  installHooks();
  taskCounter = 0;
  const html = marked.parse(String(source || ''), { async: false });
  return DOMPurify.sanitize(html, PURIFY_CONFIG);
}

// Lines that open/close a fenced code block; task markers inside one aren't
// rendered as checkboxes, so they must not be counted either.
const FENCE = /^\s{0,3}(```|~~~)/;
const TASK = /^(\s*(?:>\s*)*(?:[-*+]|\d+[.)])\s+\[)([ xX])(\])/;

// Flip the index-th task checkbox ("- [ ]" <-> "- [x]") in the source.
// Returns the source unchanged if there is no such task.
export function toggleTask(source, index) {
  const lines = String(source).split('\n');
  let inFence = false;
  let seen = 0;
  for (let i = 0; i < lines.length; i++) {
    if (FENCE.test(lines[i])) { inFence = !inFence; continue; }
    if (inFence) continue;
    const m = lines[i].match(TASK);
    if (!m) continue;
    if (seen === index) {
      const next = m[2] === ' ' ? 'x' : ' ';
      lines[i] = m[1] + next + m[3] + lines[i].slice(m[0].length);
      return lines.join('\n');
    }
    seen++;
  }
  return source;
}

// Plain-text version of a note, for "copy" (drops markdown syntax).
export function markdownToPlainText(source) {
  const div = document.createElement('div');
  div.innerHTML = renderMarkdown(source);
  div.querySelectorAll('input[type="checkbox"]').forEach((cb) => {
    cb.replaceWith(document.createTextNode(cb.checked ? '[x]' : '[ ]'));
  });
  div.querySelectorAll('br').forEach((br) => br.replaceWith('\n'));
  div.querySelectorAll('p, li, h1, h2, h3, h4, h5, h6, pre, blockquote, tr').forEach((el) => el.append('\n'));
  return div.textContent.replace(/\n{3,}/g, '\n\n').trim();
}
