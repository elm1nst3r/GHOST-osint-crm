// The sign-in in progress (issue #105): state, nonce and PKCE verifier,
// kept in a short-lived encrypted cookie rather than the session. The
// session cookie is SameSite=Strict, so the browser doesn't send it when the
// identity provider redirects back; this cookie is Lax and only goes to
// /api/auth/oidc.
const { encryptAtRest, decryptAtRest } = require('./secretBox');

const COOKIE = 'ghost_oidc';
const TTL_MS = 10 * 60 * 1000;

const sealState = (data) => encryptAtRest(JSON.stringify({ ...data, at: Date.now() }));

function openState(sealed) {
  if (!sealed) return null;
  try {
    const data = JSON.parse(decryptAtRest(sealed));
    if (!data || typeof data.at !== 'number' || Date.now() - data.at > TTL_MS) return null;
    return data;
  } catch {
    return null;
  }
}

function readCookie(req, name) {
  const header = req.headers.cookie || '';
  for (const part of header.split(';')) {
    const i = part.indexOf('=');
    if (i > 0 && part.slice(0, i).trim() === name) return decodeURIComponent(part.slice(i + 1).trim());
  }
  return null;
}

const cookieOptions = (secure) => ({ httpOnly: true, sameSite: 'lax', secure, path: '/api/auth/oidc', maxAge: TTL_MS });

module.exports = { COOKIE, TTL_MS, sealState, openState, readCookie, cookieOptions };
