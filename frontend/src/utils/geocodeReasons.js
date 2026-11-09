// Why an address isn't on the map, in the user's language (issue #110).
// The provider's own message is shown as detail where it says something the
// reason doesn't (a rejected API key, what an uncertain match matched).
const KNOWN = new Set(['not_found', 'low_confidence', 'rate_limited', 'timeout', 'service_error', 'empty']);

export const geocodeReason = (t, reason) => t(`geocoding.reasons.${KNOWN.has(reason) ? reason : 'unknown'}`);

export const geocodeDetail = (reason, message) => (reason === 'service_error' || reason === 'low_confidence' ? message || '' : '');

export const addressQuery = (loc) => [loc.address, loc.city, loc.state, loc.postal_code, loc.country]
  .map((v) => String(v ?? '').trim()).filter(Boolean).join(', ');

// Both or neither; within range.
export function coordsOf(loc) {
  const blank = (v) => v === '' || v === null || v === undefined;
  if (blank(loc.latitude) && blank(loc.longitude)) return { empty: true };
  const lat = Number(loc.latitude);
  const lng = Number(loc.longitude);
  const ok = !blank(loc.latitude) && !blank(loc.longitude) && Number.isFinite(lat) && Number.isFinite(lng)
    && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
  return ok ? { lat, lng } : { invalid: true };
}
