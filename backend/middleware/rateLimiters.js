// Rate limiting middleware using express-rate-limit.
// NOTE: This uses the default in-memory store, which is per-process.
// For multi-instance deployments, replace the `store` option with a Redis or
// PostgreSQL store (e.g. rate-limit-redis, rate-limit-postgresql) so all
// instances share a consistent counter.
const rateLimit = require('express-rate-limit');

// Login limiter: 10 attempts per IP+username combo per 15 minutes.
// Buckets by IP + username so probing different accounts doesn't share a bucket.
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
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

module.exports = { loginLimiter, geocodingLimiter };
