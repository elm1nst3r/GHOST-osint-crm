// When the session check can't get an answer (issue: a 429 showed the
// sign-in screen). Only a real "you are signed out" from the server may show
// the sign-in screen; anything else means "couldn't tell", so ask again:
//   - rate limited (429): after the server's Retry-After (5 s without one),
//     at most 2 minutes;
//   - anything else (restarting, offline): 1, 2, 4, 8, 16, then every 30 s.
// → { reason: 'rate_limited' | 'unreachable', seconds }
export function sessionRetry(error, attempt) {
  if (error?.status === 429) {
    const after = Number(error.retryAfter);
    const seconds = Number.isFinite(after) && after > 0 ? Math.ceil(after) : 5;
    return { reason: 'rate_limited', seconds: Math.min(seconds, 120) };
  }
  return { reason: 'unreachable', seconds: Math.min(2 ** Math.max(0, attempt - 1), 30) };
}

// Seconds from a Retry-After header: delta-seconds or an HTTP date. null when
// missing or unreadable.
export function retryAfterSeconds(header, now = Date.now()) {
  if (header == null || header === '') return null;
  const n = Number(header);
  if (Number.isFinite(n)) return Math.max(0, n);
  const at = Date.parse(header);
  return Number.isNaN(at) ? null : Math.max(0, Math.ceil((at - now) / 1000));
}
