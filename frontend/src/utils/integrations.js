// File: frontend/src/utils/integrations.js
//
// Matching a person's OSINT data to integrated tools (issue #96). Mirrors
// inputKindForOsint in backend/services/integrations/manifest.js so the UI
// offers the same searches the server will accept; the server still
// validates every input itself.

const isEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
const isIPv4 = (v) => /^(25[0-5]|2[0-4]\d|1?\d?\d)(\.(25[0-5]|2[0-4]\d|1?\d?\d)){3}$/.test(v);
const isIPv6 = (v) => v.includes(':') && /^[0-9a-f:.]+$/i.test(v) && (v.match(/:/g) || []).length >= 2;

export function inputKindForOsint(type, value) {
  const t = String(type || '').toLowerCase();
  const v = String(value || '').trim();
  if (isEmail(v)) return 'email';
  if (isIPv4(v) || isIPv6(v)) return 'ip';
  if (/e-?mail|почт/.test(t)) return 'email';
  if (/phone|tel|mobile|телеф/.test(t)) return 'phone';
  if (/\bip\b|ip address/.test(t)) return 'ip';
  if (/domain|website|web site|site|url|сайт|домен/.test(t)) {
    return /^[a-z]+:\/\//i.test(v) && /\/[^/]/.test(v.replace(/^[a-z]+:\/\/[^/]+/i, '')) ? 'url' : 'domain';
  }
  if (/user|social|telegram|twitter|instagram|github|vk|nick|login|ник/.test(t)) return 'username';
  return null;
}

// A domain-only operation can also take a URL's host, and a URL operation a
// bare domain, so those two kinds stand in for each other.
const COMPATIBLE = { domain: ['domain', 'url'], url: ['url', 'domain'] };
export const kindsAccepting = (kind) => COMPATIBLE[kind] || [kind];

// Tools that can actually run now: integrated, enabled, with a key if needed.
export const runnableTools = (tools) =>
  (tools || []).filter((t) => t.kind === 'integration' && t.connection_status === 'connected' && t.integration);

// The identifier kinds. Two more exist (issue #96 feedback): 'text', a search
// type the admin named (op.input_label), matched to a person's OSINT entries
// by their type (op.osint_types); and 'none', a search without input.
export const INPUT_KINDS = ['email', 'domain', 'ip', 'username', 'phone', 'url'];
const isIdentifier = (op) => INPUT_KINDS.includes(op.input);
const sameType = (a, b) => String(a || '').trim().toLowerCase() === String(b || '').trim().toLowerCase();

// Does this search take this input? An input is a person's OSINT entry
// ({ type, value, kind }), a typed-in identifier ({ kind }) or a typed-in
// value for a custom search type ({ custom: its name }).
export function accepts(op, input) {
  if (op.input === 'none') return false;
  if (op.input === 'text') {
    if (input.custom) return sameType(input.custom, op.input_label);
    return Boolean(input.type) && (op.osint_types || []).some((t) => sameType(t, input.type));
  }
  return !input.custom && Boolean(input.kind) && kindsAccepting(input.kind).includes(op.input);
}

// Every (tool, operation) pair that accepts this input. Within one tool an
// exact identifier match wins: Wayback has both a URL and a domain search, and
// a domain should run the domain one, not both.
export function operationsForInput(tools, input) {
  const out = [];
  for (const tool of runnableTools(tools)) {
    const ops = tool.integration.operations;
    const identifierOps = ops.filter(isIdentifier);
    const exact = input.kind && !input.custom ? identifierOps.filter((op) => op.input === input.kind) : [];
    const chosen = exact.length ? exact : identifierOps.filter((op) => accepts(op, input));
    [...chosen, ...ops.filter((op) => op.input === 'text' && accepts(op, input))].forEach((op) => out.push({ tool, op }));
  }
  return out;
}

export const operationsFor = (tools, kind) => (kind ? operationsForInput(tools, { kind }) : []);

// Custom search types the tools offer, for typing a value in by hand.
export const customSearchTypes = (tools) => [...new Set(runnableTools(tools)
  .flatMap((tool) => tool.integration.operations)
  .filter((op) => op.input === 'text' && op.input_label)
  .map((op) => op.input_label))];

// Searches that take no input (account balance, status).
export const noInputOperations = (tools) => runnableTools(tools)
  .flatMap((tool) => tool.integration.operations.filter((op) => op.input === 'none').map((op) => ({ tool, op })));

// ── Repeated values in results (issue #96) ─────────────────────────────────
// A value is identified by its OSINT type (or, for display-only fields, its
// field label) and its text, so the same email in 27 rows is one value.
const valueKind = (f) => (f.osintType ? `type:${String(f.osintType).toLowerCase()}` : `field:${f.label}`);
export const occurrenceKey = (f, value) => `${valueKind(f)}\u0000${value}`;

// How many times each value occurred in one search's results, across all of
// its rows: counts collected within a field (`counts`), times identical rows
// merged into one (`count`), summed over every row the value appears in.
export function occurrenceTotals(result) {
  const totals = new Map();
  for (const item of result?.items || []) {
    for (const f of item.fields || []) {
      f.values.forEach((value, i) => {
        const key = occurrenceKey(f, value);
        totals.set(key, (totals.get(key) || 0) + (f.counts?.[i] ?? 1) * (item.count ?? 1));
      });
    }
  }
  return totals;
}

// The values of one search's results that can be added to a person, once
// each, in the order they first appear: [{ key, osintType, value, label }].
// Values a search found that can be added to a person, each once, with the
// sources named by the records it occurred in (results.recordSource).
export function addableValues(result) {
  const out = new Map();
  for (const item of result?.items || []) {
    for (const f of item.fields || []) {
      if (!f.osintType) continue;
      for (const value of f.values) {
        const key = occurrenceKey(f, value);
        if (!out.has(key)) out.set(key, { key, osintType: f.osintType, value, label: f.label, recordSources: [] });
        const sources = out.get(key).recordSources;
        if (item.recordSource && !sources.includes(item.recordSource) && sources.length < MAX_RECORD_SOURCES) sources.push(item.recordSource);
      }
    }
  }
  return [...out.values()];
}
const MAX_RECORD_SOURCES = 20;

// A first guess at the OSINT data type of a value picked from a saved record,
// from its field name and shape. Only a suggestion: the user chooses.
export function guessOsintType(path, value) {
  const name = String(path).split(/[.[\]]/).filter(Boolean).pop()?.toLowerCase() || '';
  const v = String(value).trim();
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) return 'Email';
  if (/^(\d{1,3}\.){3}\d{1,3}$/.test(v) || /^[0-9a-f:]{6,}$/i.test(v) && v.includes(':') && /ip/.test(name)) return 'IP Address';
  if (/^https?:\/\//i.test(v)) return 'Website';
  if (/phone|tel|mobile|msisdn/.test(name) || /^\+?[\d\s().-]{7,}$/.test(v)) return 'Phone';
  if (/user(name)?|login|nick|handle/.test(name)) return 'Username';
  if (/passport|document|inn|snils|ssn|tax/.test(name)) return 'Document ID';
  if (/plate|vin|vehicle|car/.test(name)) return 'Vehicle';
  return 'Other';
}
