const { geocodeOutcome, applyOutcome, addressLine } = require('./geocodeOutcome');

const now = new Date('2026-11-09T12:00:00Z');
const home = { type: 'primary_residence', address: 'Bag End', city: 'Matamata', country: 'New Zealand', person_id: 7 };

describe('geocoding outcome on an address (#110)', () => {
  test('found: coordinates and provenance, no failure left over', () => {
    const before = { ...home, geocode_failure: 'timeout', geocode_message: 'slow', geocode_attempted_at: 'x' };
    const out = geocodeOutcome(before, { lat: -37.85, lng: 175.68, confidence: 82, provider: 'nominatim', cached: true }, now);
    expect(out).toMatchObject({ latitude: -37.85, longitude: 175.68, geocode_confidence: 82, geocode_provider: 'nominatim', geocoded_at: now.toISOString(), geocode_cached: true, person_id: 7 });
    expect(out).not.toHaveProperty('geocode_failure');
    expect(out).not.toHaveProperty('geocode_message');
  });

  test('not found: the reason and message are kept', () => {
    const out = geocodeOutcome(home, { failure: 'not_found', message: 'No results found for this address' }, now);
    expect(out).toMatchObject({ geocode_failure: 'not_found', geocode_message: 'No results found for this address', geocode_attempted_at: now.toISOString() });
    expect(out).not.toHaveProperty('latitude');
  });

  test('too uncertain: the closest match comes along', () => {
    const out = geocodeOutcome(home, { failure: 'low_confidence', message: 'too low', best_match: { lat: -37.9, lng: 175.7, confidence: 22, displayName: 'Matamata, Waikato' } }, now);
    expect(out.geocode_best_match).toEqual({ lat: -37.9, lng: 175.7, display_name: 'Matamata, Waikato', confidence: 22 });
  });

  test('provider problems keep their own reason (bad key, rate limit)', () => {
    expect(geocodeOutcome(home, { failure: 'service_error', message: 'LocationIQ rejected the API key — check it in Settings.' }, now))
      .toMatchObject({ geocode_failure: 'service_error', geocode_message: 'LocationIQ rejected the API key — check it in Settings.' });
    expect(geocodeOutcome(home, { failure: 'rate_limited', message: 'slow down' }, now).geocode_failure).toBe('rate_limited');
    expect(geocodeOutcome(home, null, now).geocode_failure).toBe('not_found');
  });

  test('writing back: only the result, never what the client sent along', () => {
    const stored = { type: 'work', address: 'Bag End', notes: 'n', geocode_failure: 'timeout', geocode_message: 'slow' };
    const sent = { ...stored, geocoded: false, provider: 'unknown', confidence: 0, cached: false, person_id: 7 };
    const found = applyOutcome(stored, geocodeOutcome(sent, { lat: 1, lng: 2, confidence: 80, provider: 'nominatim' }, now));
    expect(found).toEqual({ type: 'work', address: 'Bag End', notes: 'n', latitude: 1, longitude: 2, geocode_confidence: 80, geocode_provider: 'nominatim', geocoded_at: now.toISOString() });
    const failed = applyOutcome(stored, geocodeOutcome(sent, { failure: 'not_found', message: 'none' }, now));
    expect(failed).toEqual({ type: 'work', address: 'Bag End', notes: 'n', geocode_failure: 'not_found', geocode_message: 'none', geocode_attempted_at: now.toISOString() });
  });

  test('address line for the report', () => {
    expect(addressLine({ address: 'Bag End', city: 'Matamata', country: 'New Zealand' })).toBe('Bag End, Matamata, New Zealand');
  });
});
