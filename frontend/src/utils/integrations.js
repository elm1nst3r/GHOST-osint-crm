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

// Every (tool, operation) pair that accepts an input of this kind. Within one
// tool an exact match wins: Wayback has both a URL and a domain search, and a
// domain should run the domain one, not both.
export function operationsFor(tools, kind) {
  if (!kind) return [];
  const out = [];
  for (const tool of runnableTools(tools)) {
    const ops = tool.integration.operations;
    const exact = ops.filter((op) => op.input === kind);
    const chosen = exact.length ? exact : ops.filter((op) => kindsAccepting(kind).includes(op.input));
    chosen.forEach((op) => out.push({ tool, op }));
  }
  return out;
}

export const INPUT_KINDS = ['email', 'domain', 'ip', 'username', 'phone', 'url'];
