// Rate limiting middleware using express-rate-limit.
// NOTE: This uses the default in-memory store, which is per-process.
// For multi-instance deployments, replace the `store` option with a Redis or
// PostgreSQL store (e.g. rate-limit-redis, rate-limit-postgresql) so all
// instances share a consistent counter.
const rateLimit = require('express-rate-limit');

// Login limiter: 10 attempts per IP+username combo per 15 minutes by default.
// Override via env: LOGIN_RATE_LIMIT_MAX (integer), LOGIN_RATE_LIMIT_WINDOW_MS (milliseconds).
// Set LOGIN_RATE_LIMIT_DISABLE=true to remove rate limiting entirely (e.g. for automated clients).
// Buckets by IP + username so probing different accounts doesn't share a bucket.
const loginLimiter = process.env.LOGIN_RATE_LIMIT_DISABLE === 'true'
  ? (req, res, next) => next()
  : rateLimit({
  windowMs: parseInt(process.env.LOGIN_RATE_LIMIT_WINDOW_MS, 10) || 15 * 60 * 1000,
  max: parseInt(process.env.LOGIN_RATE_LIMIT_MAX, 10) || 10,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Too many login attempts. Please try again later.' },
  keyGenerator: (req) => {
    const username = (req.body && req.body.username) || '';
    return `${req.ip}|${username.toLowerCase()}`;
  },
});

// Geocoding limiter: 60 requests per IP per minute.
// Prevents using the instance as an anonymous geocoding proxy.
const geocodingLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Geocoding rate limit exceeded. Please slow down.' },
});

// General API limiter: 300 requests per IP per minute.
// Applied to all authenticated data-access routes to prevent scraping/DoS.
const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 300,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Too many requests. Please slow down.' },
});

module.exports = { loginLimiter, geocodingLimiter, apiLimiter };
