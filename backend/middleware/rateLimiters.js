// Rate limiting middleware using express-rate-limit (v8).
//
// Login, the second sign-in step and integrated tool searches keep their
// counters in Postgres (middleware/rateLimitStore.js): a restart doesn't
// reset them, and several backend instances share one count. The general API
// and geocoding limiters stay in process memory; they are about load, and a
// database write per request would cost more than they save.
//
// IPv6 clients are counted per /56 block (express-rate-limit's default and
// ipKeyGenerator): an ISP hands each customer a whole block, so counting
// single addresses would let one person rotate through millions of them.
const { rateLimit, ipKeyGenerator } = require('express-rate-limit');
const { pool } = require('../config/database');
const { PostgresRateLimitStore } = require('./rateLimitStore');

const dbStore = (prefix) => new PostgresRateLimitStore({ pool, prefix });

// Login limiter: 10 attempts per IP+username combo per 15 minutes by default.
// Override via env: LOGIN_RATE_LIMIT_MAX (integer), LOGIN_RATE_LIMIT_WINDOW_MS (milliseconds).
// Set LOGIN_RATE_LIMIT_DISABLE=true to remove rate limiting entirely (e.g. for automated clients).
// Buckets by IP + username so probing different accounts doesn't share a bucket.
const loginLimiter = process.env.LOGIN_RATE_LIMIT_DISABLE === 'true'
  ? (req, res, next) => next()
  : rateLimit({
  windowMs: parseInt(process.env.LOGIN_RATE_LIMIT_WINDOW_MS, 10) || 15 * 60 * 1000,
  limit: parseInt(process.env.LOGIN_RATE_LIMIT_MAX, 10) || 10,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  store: dbStore('login'),
  message: { error: 'Too many login attempts. Please try again later.' },
  keyGenerator: (req) => {
    const username = (req.body && req.body.username) || '';
    return `${ipKeyGenerator(req.ip)}|${String(username).toLowerCase()}`;
  },
});

// Geocoding limiter: 60 requests per IP per minute.
// Prevents using the instance as an anonymous geocoding proxy.
const geocodingLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 60,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { error: 'Geocoding rate limit exceeded. Please slow down.' },
});

// General API limiter: 300 requests per IP per minute.
// Applied to all authenticated data-access routes to prevent scraping/DoS.
const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 300,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { error: 'Too many requests. Please slow down.' },
});

// Searches with integrated OSINT tools (issue #96) call third-party APIs,
// often paid ones, so they get a tighter per-client budget than the API.
const integrationLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 30,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  store: dbStore('integration'),
  message: { error: 'Too many tool searches. Please wait a minute.' },
});

// Second sign-in step (issue #90): counted per account, not per IP, so
// guessing someone's 6-digit code from many addresses doesn't get more tries.
// Honours LOGIN_RATE_LIMIT_DISABLE like the login limiter.
const mfaLimiter = process.env.LOGIN_RATE_LIMIT_DISABLE === 'true'
  ? (req, res, next) => next()
  : rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  store: dbStore('mfa'),
  message: { error: 'Too many verification attempts. Please try again later.' },
  keyGenerator: (req) => {
    const userId = req.session?.pendingMfa?.userId;
    return userId ? `user|${userId}` : `ip|${ipKeyGenerator(req.ip)}`;
  },
});

// Single sign-on (issue #105). Not the login limiter: that one counts per
// IP and username, and an SSO request has no username, so everyone behind
// one IP (an office) would share ten attempts. Credentials are checked at the
// identity provider; this only stops a flood of redirects. A browser
// navigation, so the answer is a redirect back to the sign-in page.
const ssoLimiter = process.env.LOGIN_RATE_LIMIT_DISABLE === 'true'
  ? (req, res, next) => next()
  : rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: parseInt(process.env.SSO_RATE_LIMIT_MAX, 10) || 120,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    store: dbStore('sso'),
    keyGenerator: (req) => ipKeyGenerator(req.ip),
    handler: (req, res) => res.redirect(302, '/?sso_error=busy'),
  });

module.exports = {
  ssoLimiter, loginLimiter, geocodingLimiter, apiLimiter, integrationLimiter, mfaLimiter };
