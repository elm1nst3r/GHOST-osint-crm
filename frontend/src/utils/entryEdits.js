// Editing a person's addresses and OSINT entries in place (issue #109).
// Everything the form doesn't show (map position, where a tool found a
// value, verification) is kept unless the edit makes it wrong.

const ADDRESS_FIELDS = ['address', 'city', 'state', 'country', 'postal_code'];
const same = (a, b) => String(a ?? '').trim() === String(b ?? '').trim();
const sameValue = (a, b) => String(a ?? '').trim().toLowerCase() === String(b ?? '').trim().toLowerCase();

// Why an address isn't on the map (issue #110), as saved by a geocoding run.
export const GEOCODE_FAILURE_FIELDS = ['geocode_failure', 'geocode_message', 'geocode_best_match', 'geocode_attempted_at'];
const dropFailure = (loc) => { GEOCODE_FAILURE_FIELDS.forEach((k) => delete loc[k]); return loc; };
const num = (v) => (v === '' || v === null || v === undefined ? null : Number(v));
const sameCoords = (a, b) => num(a.latitude) === num(b.latitude) && num(a.longitude) === num(b.longitude);

// Coordinates set in the form win: typed, picked on the map or looked up.
// Otherwise a changed address loses its map position, and saving the person
// looks it up again (the server geocodes addresses without coordinates).
// Type or notes alone keep it.
export function editLocation(old, edited) {
  const next = { ...old, ...edited };
  if (!sameCoords(old, edited) && num(edited.latitude) !== null && num(edited.longitude) !== null) {
    next.latitude = num(edited.latitude);
    next.longitude = num(edited.longitude);
    return dropFailure(next);
  }
  if (ADDRESS_FIELDS.some((k) => !same(old[k], edited[k]))) {
    delete next.latitude;
    delete next.longitude;
    dropFailure(next);
  }
  return next;
}

const hasFindings = (e) => Boolean(e.source) || (Array.isArray(e.sources) && e.sources.length > 0);

// A value a tool found keeps its findings when edited (e.g. a card hash
// replaced by the full number), and remembers what the tool found:
// original_type/original_value, set on the first change only. Editing it
// back to that value clears them again.
export function editOsintEntry(old, edited) {
  const next = { ...old, ...edited };
  if (!hasFindings(old)) return next;
  const origType = old.original_type ?? old.type;
  const origValue = old.original_value ?? old.value;
  if (sameValue(next.type, origType) && sameValue(next.value, origValue)) {
    delete next.original_type;
    delete next.original_value;
  } else {
    next.original_type = origType;
    next.original_value = origValue;
  }
  return next;
}
