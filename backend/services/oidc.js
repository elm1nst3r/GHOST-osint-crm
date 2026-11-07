// File: backend/services/oidc.js
//
// Single sign-on through OpenID Connect (issue #105): Authorization Code flow
// with PKCE, via openid-client. The provider's metadata is discovered once
// and cached (and fetched again after a failure).
//
// Who signs in is decided here:
//   - an identity already linked (issuer + subject) → that GHOST user, if
//     active; with OIDC_ADMIN_GROUP set, the role follows the group;
//   - otherwise, with OIDC_AUTO_PROVISION on and no local user with the same
//     email → a new GHOST user without a password;
//   - otherwise → nobody: the attempt is recorded for an admin to link
//     (Users → Single sign-on), never matched automatically to an existing
//     account.
const { pool } = require('../config/database');
const { readOidcConfig } = require('../utils/oidcConfig');
const { usernameBase, uniqueUsername, nameParts, roleFromClaims, displayName } = require('../utils/oidcClaims');

let clientLib = null;
const lib = async () => { clientLib ||= await import('openid-client'); return clientLib; };

let configPromise = null;
let configKey = null;

async function providerConfig(cfg = readOidcConfig()) {
  const key = [cfg.issuer, cfg.clientId, cfg.clientSecret, cfg.allowHttp].join('|');
  if (!configPromise || configKey !== key) {
    configKey = key;
    configPromise = (async () => {
      const client = await lib();
      const options = cfg.allowHttp ? { execute: [client.allowInsecureRequests] } : undefined;
      return cfg.clientSecret
        ? client.discovery(new URL(cfg.issuer), cfg.clientId, cfg.clientSecret, undefined, options)
        : client.discovery(new URL(cfg.issuer), cfg.clientId, undefined, client.None(), options);
    })();
    configPromise.catch(() => { configPromise = null; });
  }
  return configPromise;
}

// Where to send the browser, and what to remember until it comes back.
async function startSignIn(cfg = readOidcConfig()) {
  const client = await lib();
  const config = await providerConfig(cfg);
  const verifier = client.randomPKCECodeVerifier();
  const state = client.randomState();
  const nonce = client.randomNonce();
  const url = client.buildAuthorizationUrl(config, {
    redirect_uri: cfg.redirectUri,
    scope: cfg.scopes,
    code_challenge: await client.calculatePKCECodeChallenge(verifier),
    code_challenge_method: 'S256',
    state,
    nonce,
  });
  return { url: url.href, state: { state, nonce, verifier } };
}

// Checks the provider's answer (state, nonce, PKCE, ID token signature and
// audience) and returns the identity's claims and ID token.
async function finishCallback(cfg, query, saved) {
  const client = await lib();
  const config = await providerConfig(cfg);
  const callbackUrl = new URL(cfg.redirectUri);
  callbackUrl.search = query;
  const tokens = await client.authorizationCodeGrant(config, callbackUrl, {
    pkceCodeVerifier: saved.verifier,
    expectedState: saved.state,
    expectedNonce: saved.nonce,
    idTokenExpected: true,
  });
  let claims = tokens.claims();
  // Some providers only put groups (or the email) in the userinfo response.
  if (cfg.adminGroup || !claims.email) {
    try {
      const info = await client.fetchUserInfo(config, tokens.access_token, claims.sub);
      claims = { ...info, ...claims, ...(info[cfg.groupsClaim] !== undefined ? { [cfg.groupsClaim]: info[cfg.groupsClaim] } : {}) };
    } catch { /* userinfo is optional */ }
  }
  return { claims, idToken: tokens.id_token, issuer: config.serverMetadata().issuer };
}

async function endSessionUrl(cfg, idToken, postLogoutRedirect) {
  if (!cfg.enabled || !cfg.logout) return null;
  try {
    const client = await lib();
    const config = await providerConfig(cfg);
    if (!config.serverMetadata().end_session_endpoint) return null;
    return client.buildEndSessionUrl(config, {
      ...(idToken ? { id_token_hint: idToken } : {}),
      ...(postLogoutRedirect ? { post_logout_redirect_uri: postLogoutRedirect } : {}),
    }).href;
  } catch {
    return null;
  }
}

async function recordPending(db, issuer, claims, reason) {
  await db.query(
    `INSERT INTO sso_pending (issuer, subject, email, email_verified, display_name, preferred_username, reason)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     ON CONFLICT ON CONSTRAINT sso_pending_unique DO UPDATE SET
       email = EXCLUDED.email, email_verified = EXCLUDED.email_verified, display_name = EXCLUDED.display_name,
       preferred_username = EXCLUDED.preferred_username, reason = EXCLUDED.reason,
       attempts = sso_pending.attempts + 1, last_attempt_at = CURRENT_TIMESTAMP`,
    [issuer, claims.sub, claims.email || null, claims.email_verified ?? null, displayName(claims), claims.preferred_username || null, reason]
  );
}

// Creates a GHOST user (no password) for an identity and links it.
async function createUserForIdentity(db, { issuer, subject, email, display, preferred, claims = {}, role = 'user', linkedBy = null }) {
  const { rows: taken } = await db.query('SELECT username FROM users');
  const username = uniqueUsername(usernameBase({ preferred_username: preferred, email, name: display, ...claims }), taken.map((r) => r.username));
  const names = nameParts({ name: display, ...claims });
  const { rows } = await db.query(
    `INSERT INTO users (username, email, password_hash, first_name, last_name, role, is_active)
     VALUES ($1, $2, NULL, $3, $4, $5, true) RETURNING *`,
    [username, email || null, names.first_name, names.last_name, role]
  );
  await db.query(
    `INSERT INTO user_identities (user_id, issuer, subject, email, display_name, linked_by, last_login_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [rows[0].id, issuer, subject, email || null, display, linkedBy, linkedBy ? null : new Date()]
  );
  return rows[0];
}

// → { user } or { refused: 'not_linked' | 'inactive' | 'email_in_use' }
async function resolveUser(cfg, issuer, claims, db = pool) {
  const { rows } = await db.query(
    `SELECT u.*, i.id AS identity_id FROM user_identities i JOIN users u ON u.id = i.user_id
     WHERE i.issuer = $1 AND i.subject = $2`,
    [issuer, claims.sub]
  );
  if (rows[0]) {
    const user = rows[0];
    if (!user.is_active) return { refused: 'inactive' };
    await db.query('UPDATE user_identities SET last_login_at = CURRENT_TIMESTAMP, email = $1, display_name = $2 WHERE id = $3',
      [claims.email || null, displayName(claims), user.identity_id]);
    const role = roleFromClaims(claims, cfg, user.role);
    if (role !== user.role) {
      await db.query('UPDATE users SET role = $1 WHERE id = $2', [role, user.id]);
      user.role = role;
      user.roleChanged = true;
    }
    return { user };
  }

  if (cfg.autoProvision) {
    // A local account with this email may be the same person: an admin decides.
    if (claims.email) {
      const { rows: same } = await db.query('SELECT 1 FROM users WHERE lower(email) = lower($1) LIMIT 1', [claims.email]);
      if (same.length) { await recordPending(db, issuer, claims, 'email_in_use'); return { refused: 'email_in_use' }; }
    }
    const user = await createUserForIdentity(db, {
      issuer, subject: claims.sub, email: claims.email, display: displayName(claims), preferred: claims.preferred_username,
      claims, role: roleFromClaims(claims, cfg, 'user'),
    });
    user.created = true;
    return { user };
  }

  await recordPending(db, issuer, claims, 'not_linked');
  return { refused: 'not_linked' };
}

module.exports = { startSignIn, finishCallback, endSessionUrl, resolveUser, createUserForIdentity, providerConfig };
