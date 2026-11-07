// Turning an identity provider's ID token claims into GHOST users (issue
// #105). Pure functions, tested on their own.

// Usernames: 3-50 of letters, digits and . _ - (what the admin form allows).
function usernameBase(claims) {
  const raw = claims.preferred_username || (claims.email ? String(claims.email).split('@')[0] : '') || claims.name || 'user';
  const cleaned = String(raw).normalize('NFKD').replace(/[^\w.-]+/g, '').replace(/^[.-]+/, '').slice(0, 40);
  return cleaned.length >= 3 ? cleaned : `user-${cleaned || 'sso'}`.slice(0, 40);
}

// A free username: the base, then base-2, base-3, …
function uniqueUsername(base, taken) {
  const lower = new Set([...taken].map((u) => u.toLowerCase()));
  if (!lower.has(base.toLowerCase())) return base;
  for (let i = 2; ; i++) if (!lower.has(`${base}-${i}`.toLowerCase())) return `${base}-${i}`;
}

function nameParts(claims) {
  const first = claims.given_name || (claims.name ? String(claims.name).split(' ')[0] : null);
  const last = claims.family_name || (claims.name && String(claims.name).includes(' ') ? String(claims.name).split(' ').slice(1).join(' ') : null);
  return { first_name: first ? String(first).slice(0, 100) : null, last_name: last ? String(last).slice(0, 100) : null };
}

// The groups claim may be a list, a single string, or (Keycloak with full
// paths) "/ghost-admins". Nested claim names like realm_access.roles work.
function groupsOf(claims, groupsClaim) {
  const value = String(groupsClaim || 'groups').split('.').reduce((o, k) => (o == null ? o : o[k]), claims);
  const list = Array.isArray(value) ? value : value == null ? [] : [value];
  return list.map((g) => String(g).replace(/^\//, ''));
}

// With an admin group configured the provider decides: in the group means
// admin, not in it means user. Without one, GHOST's own role stays.
function roleFromClaims(claims, cfg, currentRole) {
  if (!cfg.adminGroup) return currentRole || 'user';
  return groupsOf(claims, cfg.groupsClaim).includes(cfg.adminGroup.replace(/^\//, '')) ? 'admin' : 'user';
}

const displayName = (claims) => claims.name || [claims.given_name, claims.family_name].filter(Boolean).join(' ') || claims.preferred_username || claims.email || null;

module.exports = { usernameBase, uniqueUsername, nameParts, groupsOf, roleFromClaims, displayName };
