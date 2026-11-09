// File: backend/routes/oidc.js
//
// Single sign-on through OpenID Connect (issue #105), mounted at
// /api/auth/oidc. The browser navigates here (these are not fetch calls):
//
//   GET /login     → redirect to the identity provider
//   GET /callback  → the provider sends the browser back; on success the
//                    usual GHOST session starts and the browser goes to "/".
//
// And one the provider calls itself, server to server:
//
//   POST /backchannel-logout → the provider ended a session (signed out, or
//                    ended by an admin); GHOST ends the matching sessions.
//
// Failures go back to the sign-in page as /?sso_error=<code>, never with
// details: those go to the server log.
const express = require('express');
const router = express.Router();
const { readOidcConfig } = require('../utils/oidcConfig');
const { COOKIE, sealState, openState, readCookie, cookieOptions } = require('../utils/oidcState');
const { establishSession, saveSession, endSsoSessions } = require('../utils/sessions');
const { encryptAtRest } = require('../utils/secretBox');
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
    // For signing out at the provider too, "recent sign-in" checks, and
    // ending this session when the provider ends its own (sid, refresh).
    req.session.sso = {
      issuer: result.issuer,
      idToken: result.idToken,
      at: Date.now(),
      ...(result.sid ? { sid: result.sid } : {}),
      ...(result.refreshToken ? { refresh: encryptAtRest(result.refreshToken) } : {}),
    };
    await saveSession(req);
    if (user.created) await req.audit.log('user', user.id, 'create', 'sso', null, result.issuer);
    if (user.roleChanged) await req.audit.log('user', user.id, 'update', 'role', null, `${user.role} (from ${cfg.adminGroup} at sign-in)`);
    back(res, null);
  } catch (err) {
    console.error('SSO: sign-in failed:', err.message);
    back(res, 'failed');
  }
});

// OpenID Connect Back-Channel Logout 1.0. The provider POSTs a signed
// logout token (form field logout_token); no cookie, no browser. Answers 200
// when the token is valid, even if no GHOST session matched (already gone).
router.post('/backchannel-logout', async (req, res) => {
  res.set('Cache-Control', 'no-store');
  const refuse = (description) => res.status(400).json({ error: 'invalid_request', error_description: description });
  const cfg = readOidcConfig();
  if (!cfg.enabled) return refuse('single sign-on is not enabled');
  const token = req.body && req.body.logout_token;
  if (typeof token !== 'string' || !token) return refuse('logout_token is missing');

  let target;
  try {
    target = await oidc.verifyLogoutToken(cfg, token);
  } catch (err) {
    console.warn('SSO: back-channel logout refused:', err.message);
    return refuse('invalid logout token');
  }

  try {
    const userIds = await endSsoSessions(pool, target);
    if (userIds.length) console.info(`SSO: the identity provider signed out ${userIds.length} session(s)`);
    for (const id of new Set(userIds)) {
      await req.audit.log('user', id, 'logout', 'sso', null, 'ended by the identity provider');
    }
    res.status(200).end();
  } catch (err) {
    console.error('SSO: back-channel logout failed:', err.message);
    res.status(500).json({ error: 'server_error' });
  }
});

module.exports = router;
