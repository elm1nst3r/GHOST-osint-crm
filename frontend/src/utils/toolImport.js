// File: frontend/src/utils/toolImport.js
//
// Parsing for the OSINT tool bulk import.
//
// Tool lists in the wild are spreadsheets and JSON dumps with wildly
// inconsistent headers — "URL", "Link", "Website", "Tool Name", "Name". Being
// strict about column names would mean everyone hand-edits their file first,
// so headers are normalised and a range of aliases accepted.
//
// Kept separate from the component so the parsing can be tested directly; it's
// the part most likely to be subtly wrong.

import Papa from 'papaparse';

// Header aliases → canonical field. Compared lowercased with punctuation and
// spaces stripped, so "Tool Name", "tool_name" and "toolname" all match.
const FIELD_ALIASES = {
  name: ['name', 'toolname', 'tool', 'title'],
  link: ['link', 'url', 'website', 'site', 'address', 'href'],
  description: ['description', 'desc', 'summary', 'about'],
  category: ['category', 'type', 'group'],
  status: ['status', 'state'],
  tags: ['tags', 'tag', 'keywords', 'labels'],
  notes: ['notes', 'note', 'comment', 'comments'],
};

const normalizeHeader = (h) => String(h || '').toLowerCase().replace(/[^a-z0-9]/g, '');

const canonicalField = (header) => {
  const key = normalizeHeader(header);
  return Object.keys(FIELD_ALIASES).find((field) =>
    FIELD_ALIASES[field].includes(key)
  ) || null;
};

// Tags arrive as "osint; recon" or "osint, recon" or a real array.
export const parseTags = (value) => {
  if (Array.isArray(value)) return value.map((t) => String(t).trim()).filter(Boolean);
  if (value === null || value === undefined) return [];
  return String(value)
    .split(/[;,|]/)
    .map((t) => t.trim())
    .filter(Boolean);
};

const rowToTool = (raw) => {
  const tool = { name: '', link: '', description: '', category: '', status: '', tags: [], notes: '' };
  Object.entries(raw).forEach(([header, value]) => {
    const field = canonicalField(header);
    if (!field) return; // unrecognised columns are ignored, not an error
    if (field === 'tags') tool.tags = parseTags(value);
    else tool[field] = value === null || value === undefined ? '' : String(value).trim();
  });
  return tool;
};

// Returns { tools, errors, format }. Errors carry a row number matching what
// the user sees in their spreadsheet, so they can go and fix it.
export const parseToolImport = (text) => {
  const trimmed = (text || '').trim();
  if (!trimmed) return { tools: [], errors: [], format: null };

  // JSON: either a bare array or { tools: [...] } as produced by an export.
  if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
    try {
      const parsed = JSON.parse(trimmed);
      const list = Array.isArray(parsed) ? parsed : parsed.tools;
      if (!Array.isArray(list)) {
        return { tools: [], errors: [{ row: null, message: 'JSON must be an array of tools, or an object with a "tools" array' }], format: 'json' };
      }
      const tools = [];
      const errors = [];
      list.forEach((entry, i) => {
        if (!entry || typeof entry !== 'object') {
          errors.push({ row: i + 1, message: 'Not an object' });
          return;
        }
        const tool = rowToTool(entry);
        if (!tool.name) errors.push({ row: i + 1, message: 'Missing a name' });
        else tools.push(tool);
      });
      return { tools, errors, format: 'json' };
    } catch (err) {
      return { tools: [], errors: [{ row: null, message: `Invalid JSON: ${err.message}` }], format: 'json' };
    }
  }

  // Otherwise CSV/TSV — papaparse detects the delimiter.
  const { data, errors: parseErrors, meta } = Papa.parse(trimmed, {
    header: true,
    skipEmptyLines: 'greedy',
    transformHeader: (h) => h.trim(),
  });

  const errors = parseErrors
    // Papa reports a delimiter guess as an "error" on single-column files.
    .filter((e) => e.code !== 'UndetectableDelimiter')
    // +2: one for the header row, one because spreadsheets are 1-indexed.
    .map((e) => ({ row: typeof e.row === 'number' ? e.row + 2 : null, message: e.message }));

  const recognised = (meta?.fields || []).some((f) => canonicalField(f));
  if (!recognised) {
    return {
      tools: [],
      errors: [{ row: null, message: 'No recognisable columns. The file needs a header row including at least a "name" column.' }],
      format: 'csv',
    };
  }

  const tools = [];
  data.forEach((raw, i) => {
    const tool = rowToTool(raw);
    if (!tool.name) errors.push({ row: i + 2, message: 'Missing a name' });
    else tools.push(tool);
  });

  return { tools, errors, format: 'csv' };
};

// Flag rows whose name already exists, so the preview can say what will happen
// before anything is written.
export const markDuplicates = (tools, existingTools = []) => {
  const existing = new Set(existingTools.map((t) => (t.name || '').trim().toLowerCase()));
  const seen = new Set();
  return tools.map((tool) => {
    const key = tool.name.trim().toLowerCase();
    const duplicateOfExisting = existing.has(key);
    const duplicateInFile = seen.has(key);
    seen.add(key);
    return { ...tool, duplicateOfExisting, duplicateInFile };
  });
};
