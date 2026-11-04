// File: backend/middleware/rateLimitStore.js
//
// express-rate-limit store backed by the rate_limits table. Used for the
// limits that protect accounts and paid APIs; the general API and geocoding
// limiters stay in memory, since they'd cost a database write per request.
//
// One row per limiter + client key. A window starts with the first hit and
// the counter resets when reset_at has passed; the upsert does that in one
// statement, so concurrent requests can't both slip under the limit.
// Expired rows are deleted every few minutes.
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000;
let cleanupTimer = null;

class PostgresRateLimitStore {
  constructor({ pool, prefix }) {
    this.pool = pool;
    this.prefix = `${prefix}:`;
    // Counts live in the database, shared by every backend instance.
    this.localKeys = false;
  }

  init(options) {
    this.windowMs = options.windowMs;
    if (!cleanupTimer) {
      cleanupTimer = setInterval(() => {
        this.pool.query('DELETE FROM rate_limits WHERE reset_at < NOW()')
          .catch((err) => console.error('Rate limit cleanup failed:', err.message));
      }, CLEANUP_INTERVAL_MS);
      cleanupTimer.unref();
    }
  }

  async get(key) {
    const { rows } = await this.pool.query(
      'SELECT hits, reset_at FROM rate_limits WHERE key = $1 AND reset_at > NOW()',
      [this.prefix + key]
    );
    return rows[0] ? { totalHits: rows[0].hits, resetTime: rows[0].reset_at } : undefined;
  }

  async increment(key) {
    const { rows } = await this.pool.query(
      `INSERT INTO rate_limits (key, hits, reset_at)
       VALUES ($1, 1, NOW() + make_interval(secs => $2::double precision / 1000))
       ON CONFLICT (key) DO UPDATE SET
         hits = CASE WHEN rate_limits.reset_at <= NOW() THEN 1 ELSE rate_limits.hits + 1 END,
         reset_at = CASE WHEN rate_limits.reset_at <= NOW() THEN EXCLUDED.reset_at ELSE rate_limits.reset_at END
       RETURNING hits, reset_at`,
      [this.prefix + key, this.windowMs]
    );
    return { totalHits: rows[0].hits, resetTime: rows[0].reset_at };
  }

  async decrement(key) {
    await this.pool.query(
      'UPDATE rate_limits SET hits = GREATEST(hits - 1, 0) WHERE key = $1',
      [this.prefix + key]
    );
  }

  async resetKey(key) {
    await this.pool.query('DELETE FROM rate_limits WHERE key = $1', [this.prefix + key]);
  }
}

module.exports = { PostgresRateLimitStore };
