// Single sign-on settings (issue #105), read from the environment. OpenID
// Connect is off unless OIDC_ENABLED=true and the issuer and client are set.
//
//   OIDC_ENABLED=true
//   OIDC_ISSUER_URL=https://keycloak.example.com/realms/ghost
//                                     (exactly as the provider writes it: Authentik's ends in /)
//   OIDC_CLIENT_ID=ghost
//   OIDC_CLIENT_SECRET=...            (empty for a public client: PKCE only)
//   OIDC_REDIRECT_URI=https://ghost.example.com/api/auth/oidc/callback
//   OIDC_SCOPES=openid profile email
//   OIDC_DISPLAY_NAME=Keycloak        (the sign-in button: "Sign in with Keycloak")
//   OIDC_AUTO_PROVISION=false         (create a GHOST user on first sign-in)
//   OIDC_ADMIN_GROUP=ghost-admins     (optional: this group makes someone an admin)
//   OIDC_GROUPS_CLAIM=groups
//   OIDC_LOGOUT=true                  (signing out of GHOST also signs out at the provider)
//   OIDC_SESSION_CHECK_MINUTES=5      (ask the provider this often whether the session is still on; 0 = never)
//   OIDC_ALLOW_HTTP=false             (only for local testing against an http:// provider)
//   LOCAL_LOGIN_ENABLED=true          (GHOST passwords; keep on as a fallback)

const bool = (v, dflt) => (v === undefined || v === '' ? dflt : /^(1|true|yes|on)$/i.test(String(v).trim()));

function readOidcConfig(env = process.env) {
  // As configured: the provider's metadata and tokens must name this exact
  // issuer, and some end in a slash (Authentik: .../application/o/ghost/).
  const issuer = (env.OIDC_ISSUER_URL || '').trim();
  const clientId = (env.OIDC_CLIENT_ID || '').trim();
  const redirectUri = (env.OIDC_REDIRECT_URI || '').trim();
  const wanted = bool(env.OIDC_ENABLED, false);
  const problems = [];
  if (wanted) {
    if (!issuer) problems.push('OIDC_ISSUER_URL is not set');
    if (!clientId) problems.push('OIDC_CLIENT_ID is not set');
    if (!redirectUri) problems.push('OIDC_REDIRECT_URI is not set');
    else if (!/\/api\/auth\/oidc\/callback$/.test(redirectUri)) problems.push('OIDC_REDIRECT_URI must end in /api/auth/oidc/callback');
    const allowHttp = bool(env.OIDC_ALLOW_HTTP, false);
    if (issuer && !issuer.startsWith('https://') && !allowHttp) problems.push('OIDC_ISSUER_URL must use https:// (OIDC_ALLOW_HTTP=true only for local testing)');
  }
  const checkRaw = String(env.OIDC_SESSION_CHECK_MINUTES ?? '').trim();
  const checkMinutes = checkRaw === '' ? 5 : Number(checkRaw);
  const sessionCheckMinutes = Number.isFinite(checkMinutes) && checkMinutes > 0 ? Math.max(1, Math.min(checkMinutes, 1440)) : 0;
  const scopes = (env.OIDC_SCOPES || 'openid profile email').split(/[\s,]+/).filter(Boolean);
  if (!scopes.includes('openid')) scopes.unshift('openid');
  return {
    enabled: wanted && problems.length === 0,
    problems,
    issuer,
    clientId,
    clientSecret: env.OIDC_CLIENT_SECRET || '',
    redirectUri,
    scopes: scopes.join(' '),
    displayName: (env.OIDC_DISPLAY_NAME || 'SSO').trim().slice(0, 40) || 'SSO',
    autoProvision: bool(env.OIDC_AUTO_PROVISION, false),
    adminGroup: (env.OIDC_ADMIN_GROUP || '').trim(),
    groupsClaim: (env.OIDC_GROUPS_CLAIM || 'groups').trim(),
    logout: bool(env.OIDC_LOGOUT, true),
    sessionCheckMinutes,
    allowHttp: bool(env.OIDC_ALLOW_HTTP, false),
    localLoginEnabled: bool(env.LOCAL_LOGIN_ENABLED, true),
  };
}

// The provider names its issuer `discovered`, GHOST was given `expected`. If
// the two differ only by a trailing slash, the provider's form is the right
// one (#115: an Authentik issuer configured without its slash, or a Keycloak
// one with an extra slash). → the issuer to use, or null.
function issuerSlashVariant(expected, discovered) {
  if (typeof expected !== 'string' || typeof discovered !== 'string' || expected === discovered) return null;
  return expected.replace(/\/+$/, '') === discovered.replace(/\/+$/, '') ? discovered : null;
}

module.exports = { readOidcConfig, issuerSlashVariant };
