// Ending GHOST sessions when the identity provider ends them (issue #105).
// Pure helpers; the network side is in services/oidc.js.

const BACKCHANNEL_EVENT = 'http://schemas.openid.net/event/backchannel-logout';

// Checks a back-channel logout token's claims after its signature, issuer,
// audience and age are verified (OpenID Connect Back-Channel Logout 1.0,
// section 2.6). Returns which sessions it ends: { sid, sub }.
function checkLogoutClaims(claims) {
  const events = claims && claims.events;
  if (!events || typeof events !== 'object' || typeof events[BACKCHANNEL_EVENT] !== 'object' || events[BACKCHANNEL_EVENT] === null) {
    throw new Error('not a logout token (no back-channel logout event)');
  }
  if (claims.nonce !== undefined) throw new Error('a logout token must not have a nonce');
  const sid = typeof claims.sid === 'string' && claims.sid ? claims.sid : null;
  const sub = typeof claims.sub === 'string' && claims.sub ? claims.sub : null;
  if (!sid && !sub) throw new Error('a logout token needs sid or sub');
  return { sid, sub };
}

// Whether an SSO session is due for a check with the provider: the interval
// has passed, or a logout for the same user asked for one (recheck).
function sessionCheckDue(sso, now, minutes) {
  if (!sso || !sso.refresh) return false;
  if (sso.recheck) return true;
  if (!(minutes > 0)) return false;
  const last = sso.checkedAt ?? sso.at ?? 0;
  return now - last >= minutes * 60 * 1000;
}

// openid-client throws the token endpoint's error; only these mean the
// provider ended the session (or the user). Anything else (provider down,
// timeout) is "couldn't tell".
const ENDED_ERRORS = new Set(['invalid_grant']);
const sessionEndedError = (err) => Boolean(err && ENDED_ERRORS.has(err.error));

module.exports = { BACKCHANNEL_EVENT, checkLogoutClaims, sessionCheckDue, sessionEndedError };
