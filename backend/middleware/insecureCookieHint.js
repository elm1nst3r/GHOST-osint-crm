// With NODE_ENV=production the session cookie is Secure, and express-session
// silently leaves it out of a response to a request that came in as plain
// HTTP: the sign-in succeeds, the browser gets no cookie, and the user is
// back at the sign-in page with no error anywhere (#42, #115). Say so in the
// log, once, the first time a sign-in arrives that way.
const SIGN_IN = /^\/api\/auth\/(login|mfa\/|oidc\/callback)/;

function insecureCookieHint({ secureCookie, log = console.warn } = {}) {
  let warned = false;
  return (req, res, next) => {
    if (secureCookie && !warned && !req.secure && SIGN_IN.test(req.path)) {
      warned = true;
      const proto = req.get('x-forwarded-proto');
      log('Sign-in over plain HTTP: NODE_ENV=production makes the session cookie HTTPS-only, so browsers ' +
        'will not keep it and users stay signed out. ' +
        (proto
          ? `The proxy in front reported X-Forwarded-Proto "${proto}". If users do reach GHOST over HTTPS, make the outer proxy send "https" (and check TRUST_PROXY).`
          : 'Serve GHOST over HTTPS through a reverse proxy that sets X-Forwarded-Proto, or set NODE_ENV to something else for plain-HTTP testing.'));
    }
    next();
  };
}

module.exports = { insecureCookieHint };
