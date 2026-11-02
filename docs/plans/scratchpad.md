# Scratchpad — plan

A small floating notepad for copying text around and quick notes while
working in GHOST. Meant for working memory, not long-term storage. Private
to each user and not tied to a project.

## Shipped (v1)

- Floating panel, on by default; off switch in **Settings → General**.
- Drag (header), resize (bottom-right edge), minimise to a corner button;
  bottom sheet on phones. Position/size are remembered per device.
- Notes are markdown, rendered (GFM: lists, tables, code, links). `- [ ]`
  tick boxes are clickable. Edit (double-click), copy as text, delete one,
  clear all — deletes are undoable for a few seconds.
- Capture: select text anywhere in GHOST → **Add to scratchpad**, or
  `Alt+Shift+A`. The note records where it came from (project · section ·
  open record). `Alt+Shift+S` opens/closes.
- The active project's open dashboard to-dos, collapsible, tickable;
  can be turned off.
- Own settings: corner, color, opacity when idle, text size, to-dos on/off,
  selection button on/off.
- Stored server-side per user (`scratchpad_entries`, `scratchpad_settings`),
  every query scoped to the session user. Not audit-logged, not exported, not
  exposed over MCP. No auto-clear.
- OPSEC: sanitised markdown, no remote loads (images become links, styles
  stripped), links open without a referrer.

## Later

- **Star / pin notes** — keep chosen notes at the top, protected from
  *Clear all*. Only worth pairing with optional auto-clear (e.g. "clear
  unstarred notes older than N days", off by default).
- **Auto-detect identifiers** — emails, phone numbers, IPs, domains/URLs,
  crypto wallets and coordinates in a note become chips: search GHOST,
  or create an entity from it.
- **Promote to record** — turn a note (or a line) into a note on a person,
  a new entity, or a case to-do.
- **@mentions** — type `@` to link a person/business; click to open it.
- **Defang / refang** — toggle `http://evil.com` ↔ `hxxp://evil[.]com` for
  safe pasting into reports.
- **Search / filter** notes once lists get long.
- **Drag notes to reorder.**
