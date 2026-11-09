// What a geocoding attempt leaves on an address (issue #110).
//
// Found: coordinates plus where they came from. Not found: the reason
// (not_found, low_confidence, rate_limited, timeout, service_error), the
// provider's message, and for low_confidence the closest match, so the
// person form and the map can say why an address isn't on the map instead
// of failing silently. A later success, or changing the address, clears it.

const FAILURE_FIELDS = ['geocode_failure', 'geocode_message', 'geocode_best_match', 'geocode_attempted_at'];

const withoutFailure = (location) => {
  const rest = { ...location };
  for (const k of FAILURE_FIELDS) delete rest[k];
  return rest;
};

const bestMatchOf = (m) => (m && Number.isFinite(m.lat) && Number.isFinite(m.lng)
  ? { lat: m.lat, lng: m.lng, display_name: m.displayName || m.display_name || null, confidence: m.confidence ?? null }
  : null);

function geocodeOutcome(location, coords, now = new Date()) {
  if (coords && !coords.failure && Number.isFinite(coords.lat) && Number.isFinite(coords.lng)) {
    return {
      ...withoutFailure(location),
      latitude: coords.lat,
      longitude: coords.lng,
      geocode_confidence: coords.confidence || 0,
      geocode_provider: coords.provider || null,
      geocoded_at: now.toISOString(),
      ...(coords.cached ? { geocode_cached: true } : {}),
    };
  }
  const best = bestMatchOf(coords && coords.best_match);
  return {
    ...withoutFailure(location),
    geocode_failure: (coords && coords.failure) || 'not_found',
    geocode_message: (coords && coords.message) || 'No results found for this address',
    ...(best ? { geocode_best_match: best } : {}),
    geocode_attempted_at: now.toISOString(),
  };
}

// Just what a geocoding attempt decides, to write onto a stored address:
// never the fields of whatever was sent in (display-only extras included).
const RESULT_FIELDS = ['latitude', 'longitude', 'geocode_confidence', 'geocode_provider', 'geocoded_at', ...FAILURE_FIELDS];
function applyOutcome(stored, outcome) {
  const next = { ...stored };
  for (const k of RESULT_FIELDS) delete next[k];
  for (const k of RESULT_FIELDS) if (outcome[k] !== undefined) next[k] = outcome[k];
  return next;
}

const addressLine = (loc) => [loc.address, loc.city, loc.state, loc.postal_code, loc.country].filter(Boolean).join(', ');

module.exports = { geocodeOutcome, applyOutcome, withoutFailure, addressLine, FAILURE_FIELDS };
