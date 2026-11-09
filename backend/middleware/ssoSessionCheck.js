// Single sign-on session checks (issue #105).
//
// An admin can end a user's session at the identity provider (Keycloak:
// Sessions → Sign out). Back-channel logout tells GHOST at once when the
// provider can reach it, and marks the user's other sessions for a check on
// their next request (recheck). As a fallback, every OIDC_SESSION_CHECK_MINUTES
// GHOST uses the session's refresh token: it stops working when the
// provider's session ends, and then the GHOST session ends too, so the next
// request (or a page reload) lands on the sign-in screen.
//
// When the provider can't be reached, the session stays on and is checked
// again a minute later: an outage shouldn't sign everyone out.
const { readOidcConfig } = require('../utils/oidcConfig');
const { sessionCheckDue } = require('../utils/oidcLogout');
const { encryptAtRest, decryptAtRest } = require('../utils/secretBox');
const { regenerateSession } = require('../utils/sessions');

const RETRY_AFTER_ERROR_MS = 60 * 1000;
// Requests that arrive while a check runs, or shortly after but still carry
// the session as it was before, share its result instead of using the same
// refresh token again (providers that rotate refresh tokens refuse a used
// one, which would look like a sign-out). The key includes the stored token,
// which changes with every check, so a later check always asks again.
const SHARE_RESULT_MS = 30 * 1000;
const checks = new Map();

function ssoSessionCheck({ readConfig = readOidcConfig, refresh, now = Date.now } = {}) {
  const refreshSession = refresh || ((cfg, token) => require('../services/oidc').refreshSession(cfg, token));

  return async (req, res, next) => {
    const sso = req.session && req.session.sso;
    if (req.apiToken || !sso || !req.session.userId) return next();
    const cfg = readConfig();
    if (!cfg.enabled || !sessionCheckDue(sso, now(), cfg.sessionCheckMinutes)) return next();

    const key = `${req.sessionID}:${sso.refresh}`;
    let check = checks.get(key);
    if (!check) {
      const token = decryptAtRest(sso.refresh);
      check = (token ? refreshSession(cfg, token) : Promise.resolve({ ended: true, reason: 'stored token unreadable' }))
        .catch((error) => ({ error }));
      checks.set(key, check);
      check.then(() => setTimeout(() => checks.delete(key), SHARE_RESULT_MS).unref());
    }
    const result = await check;

    try {
      if (result.ended) {
        console.info(`SSO: the identity provider ended the session of user ${req.session.userId} (${result.reason || 'refresh refused'})`);
        await regenerateSession(req); // drops the stored session; this request continues signed out
        return next();
      }
      if (result.error) {
        console.warn('SSO: could not check the session with the identity provider:', result.error.message);
        sso.checkedAt = now() - cfg.sessionCheckMinutes * 60 * 1000 + RETRY_AFTER_ERROR_MS;
        delete sso.recheck;
        return next();
      }
      sso.refresh = encryptAtRest(result.refreshToken);
      if (result.idToken) sso.idToken = result.idToken;
      sso.checkedAt = now();
      delete sso.recheck;
      next();
    } catch (err) {
      next(err);
    }
  };
}

module.exports = { ssoSessionCheck, _checks: checks };
