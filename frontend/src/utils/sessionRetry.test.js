// Session check retries (a rate limit or a restart must never look like "signed out").
import { describe, test, expect } from 'vitest';
import { sessionRetry, retryAfterSeconds } from './sessionRetry';

describe('sessionRetry', () => {
  test('rate limited: waits what the server asks, within limits', () => {
    expect(sessionRetry({ status: 429, retryAfter: 54 }, 1)).toEqual({ reason: 'rate_limited', seconds: 54 });
    expect(sessionRetry({ status: 429, retryAfter: 0.4 }, 3)).toEqual({ reason: 'rate_limited', seconds: 1 });
    expect(sessionRetry({ status: 429 }, 1)).toEqual({ reason: 'rate_limited', seconds: 5 });
    expect(sessionRetry({ status: 429, retryAfter: 900 }, 1).seconds).toBe(120);
  });

  test('anything else: backs off to every 30 seconds, never gives up', () => {
    expect([1, 2, 3, 4, 5, 6, 20].map((a) => sessionRetry({ status: 502 }, a).seconds)).toEqual([1, 2, 4, 8, 16, 30, 30]);
    expect(sessionRetry(new TypeError('Failed to fetch'), 1).reason).toBe('unreachable');
  });
});

test('retryAfterSeconds reads seconds and HTTP dates', () => {
  expect(retryAfterSeconds('54')).toBe(54);
  expect(retryAfterSeconds('Thu, 01 Jan 2026 00:01:00 GMT', Date.parse('2026-01-01T00:00:00Z'))).toBe(60);
  expect(retryAfterSeconds(null)).toBeNull();
  expect(retryAfterSeconds('soon')).toBeNull();
});
