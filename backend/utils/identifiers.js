// Identifiers: emails, phones, usernames, domains, URLs and IP addresses,
// recognised and normalised so the same value written two ways is one value
// (graph plan, roadmap "shared groundwork"). The graph draws each as a node
// linked to everyone who has it, so two people sharing a phone connect
// through it. Relationship discovery and import will reuse this.
//
// Recognition and normalising reuse what the integrations already do for
// search input (services/integrations/manifest.js): the OSINT entry types
// are user-editable labels, so the label is a hint and a value that plainly
// is an email or IP wins.
const { normalizeInput, inputKindForOsint } = require('../services/integrations/manifest');

const KINDS = ['email', 'phone', 'username', 'domain', 'url', 'ip'];

const looksLikeUrl = (v) => /^[a-z]+:\/\//i.test(v) || /^[\w-]+(\.[\w-]+)+\/\S/.test(v);

// A comparable form of a normalised value: case doesn't matter for any of
// these kinds (usernames are matched case-insensitively by nearly every
// service), and a URL's trailing slash and "www." don't make another page.
function keyFor(kind, normalised) {
  if (kind === 'url') {
    const u = new URL(normalised);
    const host = u.hostname.toLowerCase().replace(/^www\./, '');
    const path = u.pathname.replace(/\/+$/, '');
    return `${host}${path}${u.search}`.toLowerCase();
  }
  return normalised.toLowerCase();
}

// → { kind, key, value } or null when the entry isn't an identifier.
// `value` is the text as entered (for the label), `key` the comparable form.
function identifierOf(type, raw) {
  const value = String(raw ?? '').trim();
  if (!value || value.length > 500) return null;
  const attempt = (kind) => {
    try { return { kind, key: keyFor(kind, normalizeInput(kind, value)), value }; } catch { return null; }
  };
  const kind = inputKindForOsint(type, value);
  if (kind) {
    const found = attempt(kind);
    if (found) return found;
  }
  // "Social Media: twitter.com/ivan" is a profile address, not a username.
  if (looksLikeUrl(value)) return attempt('url');
  return null;
}

// A business's own contact fields.
function businessIdentifiers(business) {
  return [
    business.email && identifierOf('email', business.email),
    business.phone && identifierOf('phone', business.phone),
    business.website && identifierOf('website', business.website),
  ].filter(Boolean);
}

module.exports = { KINDS, identifierOf, businessIdentifiers, keyFor };
