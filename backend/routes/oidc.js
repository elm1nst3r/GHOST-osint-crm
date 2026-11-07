// File: backend/routes/oidc.js
//
// Single sign-on through OpenID Connect (issue #105), mounted at
// /api/auth/oidc. The browser navigates here (these are not fetch calls):
//
//   GET /login     → redirect to the identity provider
//   GET /callback  → the provider sends the browser back; on success the
//                    usual GHOST session starts and the browser goes to "/".
//
// Failures go back to the sign-in page as /?sso_error=<code>, never with
// details: those go to the server log.
const express = require('express');
const router = express.Router();
const { readOidcConfig } = require('../utils/oidcConfig');
const { COOKIE, sealState, openState, readCookie, cookieOptions } = require('../utils/oidcState');
const { establishSession, saveSession } = require('../utils/sessions');
const { ssoLimiter } = require('../middleware/rateLimiters');
const { pool } = require('../config/database');
const oidc = require('../services/oidc');

const secureCookie = () => process.env.NODE_ENV === 'production';
const back = (res, code) => res.redirect(302, code ? `/?sso_error=${encodeURIComponent(code)}` : '/');

router.get('/login', ssoLimiter, async (req, res) => {
  const cfg = readOidcConfig();
  if (!cfg.enabled) return back(res, 'disabled');
  try {
    const { url, state } = await oidc.startSignIn(cfg);
    res.cookie(COOKIE, sealState(state), cookieOptions(secureCookie()));
    res.redirect(302, url);
  } catch (err) {
    console.error('SSO: could not reach the identity provider:', err.message);
    back(res, 'unavailable');
  }
});

router.get('/callback', ssoLimiter, async (req, res) => {
  const cfg = readOidcConfig();
  if (!cfg.enabled) return back(res, 'disabled');
  const saved = openState(readCookie(req, COOKIE));
  res.clearCookie(COOKIE, { path: '/api/auth/oidc' });
  if (req.query.error) return back(res, req.query.error === 'access_denied' ? 'denied' : 'failed');
  if (!saved) return back(res, 'expired');

  let result;
  try {
    const query = req.originalUrl.includes('?') ? req.originalUrl.slice(req.originalUrl.indexOf('?')) : '';
    result = await oidc.finishCallback(cfg, query, saved);
  } catch (err) {
    console.error('SSO: sign-in response rejected:', err.message);
    return back(res, 'failed');
  }

  try {
    const { user, refused } = await oidc.resolveUser(cfg, result.issuer, result.claims);
    if (refused) return back(res, refused);
    // The identity provider handles two-step verification, so GHOST's own
    // "Require two-factor" doesn't apply to single sign-on (Roy, #105).
    await pool.query('UPDATE users SET last_login = NOW() WHERE id = $1', [user.id]);
    await establishSession(req, user, { mfaSetupRequired: false });
    // For signing out at the provider too, and for "recent sign-in" checks.
    req.session.sso = { issuer: result.issuer, idToken: result.idToken, at: Date.now() };
    await saveSession(req);
    if (user.created) await req.audit.log('user', user.id, 'create', 'sso', null, result.issuer);
    if (user.roleChanged) await req.audit.log('user', user.id, 'update', 'role', null, `${user.role} (from ${cfg.adminGroup} at sign-in)`);
    back(res, null);
  } catch (err) {
    console.error('SSO: sign-in failed:', err.message);
    back(res, 'failed');
  }
});

module.exports = router;
