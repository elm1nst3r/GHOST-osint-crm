import { lazy, Suspense, useRef, useState, useTransition } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, Crosshair, Loader2, Map as MapIcon, MapPin, Pencil, Plus, Save, Search, Trash2 } from 'lucide-react';
import { editLocation, GEOCODE_FAILURE_FIELDS } from '../../utils/entryEdits';
import { geocodingAPI } from '../../utils/api';
import { addressQuery, coordsOf, geocodeDetail, geocodeReason } from '../../utils/geocodeReasons';

// Leaflet only loads when someone opens the map picker.
const PositionPicker = lazy(() => import('../map/PositionPicker'));

const EMPTY_LOCATION = { type: 'primary_residence', address: '', city: '', state: '', country: '', postal_code: '', notes: '', latitude: '', longitude: '' };
const ADDRESS_FIELDS = ['address', 'city', 'state', 'country', 'postal_code'];
const draftOf = (loc) => Object.fromEntries(Object.keys(EMPTY_LOCATION).map((k) => [k, loc[k] ?? EMPTY_LOCATION[k]]));
const fixed = (n) => Number(n).toFixed(5);

// What a lookup found, in one shape: { found } | { failed }.
async function lookUp(loc) {
  const q = addressQuery(loc);
  if (!q) return { failed: { reason: 'empty', message: '' } };
  let r;
  try {
    r = await geocodingAPI.lookup(q);
  } catch (err) {
    return { failed: { reason: err.status === 429 ? 'rate_limited' : 'service_error', message: err.message } };
  }
  if (r.success) {
    return { found: { lat: r.result.lat, lng: r.result.lng, place: r.result.displayName || q, confidence: r.result.confidence } };
  }
  const best = r.best_match;
  return {
    failed: {
      reason: r.reason,
      message: r.message,
      best: best && Number.isFinite(best.lat) ? { lat: best.lat, lng: best.lng, place: best.displayName || best.display_name, confidence: best.confidence } : null,
    },
  };
}

const failureFields = (failed) => ({
  geocode_failure: failed.reason,
  geocode_message: failed.message,
  ...(failed.best ? { geocode_best_match: { lat: failed.best.lat, lng: failed.best.lng, display_name: failed.best.place, confidence: failed.best.confidence } } : {}),
  geocode_attempted_at: new Date().toISOString(),
});

const LocationsSection = ({ locations, locationTypes, onChange }) => {
  const { t } = useTranslation();
  const [newLocation, setNewLocation] = useState(EMPTY_LOCATION);
  // Index of the address being edited in the form above the list (issue #109).
  const [editing, setEditing] = useState(null);
  // Result of the last lookup for the address in the form (issue #110).
  const [lookup, setLookup] = useState(null);
  const [showPicker, setShowPicker] = useState(false);
  const [coordsError, setCoordsError] = useState(false);
  // Coordinates the user set (typed, picked, or taken from a lookup) stay
  // when the address text changes; ones that came with the saved address go.
  const [coordsTouched, setCoordsTouched] = useState(false);
  const [busy, startBusy] = useTransition();
  const firstField = useRef(null);

  const reset = () => {
    setNewLocation(EMPTY_LOCATION); setEditing(null); setLookup(null);
    setShowPicker(false); setCoordsError(false); setCoordsTouched(false);
  };

  const setCoords = (lat, lng) => {
    setNewLocation((d) => ({ ...d, latitude: String(lat), longitude: String(lng) }));
    setCoordsTouched(true);
    setCoordsError(false);
  };

  const findOnMap = () => startBusy(async () => {
    const outcome = await lookUp(newLocation);
    setLookup(outcome);
    if (outcome.found) setCoords(outcome.found.lat, outcome.found.lng);
  });

  // Adding or updating an address without a position looks it up first, so
  // a miss shows now, with the reason, not silently later (issue #110).
  const submit = () => startBusy(async () => {
    if (!newLocation.address.trim()) return;
    const coords = coordsOf(newLocation);
    if (coords.invalid) { setCoordsError(true); return; }
    let draft = { ...newLocation };
    let failed = null;
    if (coords.empty) {
      const outcome = await lookUp(newLocation);
      if (outcome.found) draft = { ...draft, latitude: outcome.found.lat, longitude: outcome.found.lng };
      else failed = outcome.failed;
    }
    const c = coordsOf(draft);
    const entry = { ...draft, latitude: c.empty ? undefined : c.lat, longitude: c.empty ? undefined : c.lng };
    if (editing === null) {
      const added = { ...entry, id: Date.now() };
      GEOCODE_FAILURE_FIELDS.forEach((k) => delete added[k]);
      onChange([...locations, failed ? { ...added, ...failureFields(failed) } : added]);
    } else {
      onChange(locations.map((loc, i) => {
        if (i !== editing) return loc;
        const next = editLocation(loc, entry);
        if (c.empty) return failed ? { ...next, ...failureFields(failed) } : next;
        GEOCODE_FAILURE_FIELDS.forEach((k) => delete next[k]);
        return next;
      }));
    }
    reset();
  });

  const startEdit = (i) => {
    reset();
    setEditing(i);
    setNewLocation(draftOf(locations[i]));
    firstField.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    firstField.current?.focus({ preventScroll: true });
  };

  const remove = (i) => {
    onChange(locations.filter((_, idx) => idx !== i));
    if (editing === i) reset();
    else if (editing !== null && i < editing) setEditing(editing - 1);
  };

  const update = (key, value) => {
    setNewLocation((d) => {
      const next = { ...d, [key]: value };
      // A different address makes the old position wrong.
      if (ADDRESS_FIELDS.includes(key) && !coordsTouched) { next.latitude = ''; next.longitude = ''; }
      return next;
    });
    if (ADDRESS_FIELDS.includes(key)) setLookup(null);
    if (key === 'latitude' || key === 'longitude') { setCoordsTouched(true); setCoordsError(false); }
  };

  // A type that is no longer in the Data Model still shows while editing.
  const types = locationTypes.some((lt) => lt.value === newLocation.type)
    ? locationTypes
    : [...locationTypes, { value: newLocation.type, label: newLocation.type }];

  const inputClass = 'px-3 py-2 border dark:border-gray-600 rounded-md focus:outline-hidden focus:ring-2 focus:ring-blue-500 dark:bg-slate-700 dark:text-gray-100';
  const field = (key, placeholder, colClass = 'w-full') => (
    <input type="text" value={newLocation[key]} onChange={e => update(key, e.target.value)} placeholder={placeholder} className={`${colClass} ${inputClass}`} />
  );
  const draftCoords = coordsOf(newLocation);
  const pickerPosition = draftCoords.lat !== undefined ? [draftCoords.lat, draftCoords.lng] : null;
  const smallButton = 'px-3 py-1.5 text-sm border dark:border-gray-600 rounded-md text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-800 flex items-center gap-1.5 disabled:opacity-50';

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
        <MapPin className="w-4 h-4 inline me-1" />{t('personForm.locations.label')}
      </label>

      <div className={`space-y-3 mb-3 bg-gray-50 dark:bg-slate-900 p-4 rounded-lg ${editing !== null ? 'ring-2 ring-blue-500' : ''}`}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <select
            ref={firstField}
            value={newLocation.type}
            onChange={e => update('type', e.target.value)}
            className={`w-full ${inputClass}`}
          >
            {types.map(lt => <option key={lt.value} value={lt.value}>{lt.label}</option>)}
          </select>
          {field('address', t('personForm.locations.streetAddress'))}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {field('city', t('personForm.locations.city'))}
          {field('state', t('personForm.locations.stateProvince'))}
          {field('country', t('personForm.locations.country'))}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {field('postal_code', t('personForm.locations.postalCode'))}
          {field('notes', t('personForm.notesOptionalPlaceholder'))}
        </div>

        {/* Map position (issue #110): looked up, typed, or picked on the map. */}
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm text-gray-600 dark:text-gray-400 me-1">{t('personForm.locations.position')}</span>
            <input type="text" inputMode="decimal" dir="ltr" value={newLocation.latitude} onChange={e => update('latitude', e.target.value)}
              placeholder={t('personForm.locations.latitude')} aria-label={t('personForm.locations.latitude')} className={`w-32 ${inputClass}`} />
            <input type="text" inputMode="decimal" dir="ltr" value={newLocation.longitude} onChange={e => update('longitude', e.target.value)}
              placeholder={t('personForm.locations.longitude')} aria-label={t('personForm.locations.longitude')} className={`w-32 ${inputClass}`} />
            <button type="button" onClick={findOnMap} disabled={busy || !addressQuery(newLocation)} className={smallButton}>
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}{t('personForm.locations.findOnMap')}
            </button>
            <button type="button" onClick={() => setShowPicker((v) => !v)} className={smallButton} aria-expanded={showPicker}>
              <MapIcon className="w-4 h-4" />{showPicker ? t('personForm.locations.hideMap') : t('personForm.locations.pickOnMap')}
            </button>
          </div>
          {coordsError && <p className="text-sm text-red-600 dark:text-red-400">{t('personForm.locations.invalidCoords')}</p>}
          {lookup?.found && (
            <p className="text-sm text-green-700 dark:text-green-400">
              {t('personForm.locations.found', { place: lookup.found.place, confidence: lookup.found.confidence })}
            </p>
          )}
          {lookup?.failed && (
            <div className="text-sm text-amber-800 dark:text-amber-300 space-y-1">
              <p className="flex items-start gap-1.5">
                <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                <span>{t('personForm.locations.notFound', { reason: geocodeReason(t, lookup.failed.reason) })}</span>
              </p>
              {geocodeDetail(lookup.failed.reason, lookup.failed.message) && (
                <p className="text-xs text-gray-600 dark:text-gray-400 ps-5">{geocodeDetail(lookup.failed.reason, lookup.failed.message)}</p>
              )}
              {lookup.failed.best && (
                <p className="ps-5 flex flex-wrap items-center gap-2">
                  <span>{t('personForm.locations.closestMatch', { place: lookup.failed.best.place, confidence: lookup.failed.best.confidence })}</span>
                  <button type="button" onClick={() => setCoords(lookup.failed.best.lat, lookup.failed.best.lng)} className="text-blue-600 dark:text-blue-400 hover:underline">
                    {t('personForm.locations.useMatch')}
                  </button>
                </p>
              )}
              <p className="text-xs text-gray-600 dark:text-gray-400 ps-5">{t('personForm.locations.setByHandHint')}</p>
            </div>
          )}
          {showPicker && (
            <div className="space-y-1">
              <Suspense fallback={<div className="h-60 flex items-center justify-center"><Loader2 className="w-5 h-5 animate-spin text-gray-400" /></div>}>
                <PositionPicker position={pickerPosition} onPick={setCoords} />
              </Suspense>
              <p className="text-xs text-gray-500 dark:text-gray-400">{t('personForm.locations.pickHint')}</p>
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={submit} disabled={busy} className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 flex items-center disabled:opacity-60">
            {busy ? <Loader2 className="w-4 h-4 me-2 animate-spin" /> : editing === null ? <Plus className="w-4 h-4 me-2" /> : <Save className="w-4 h-4 me-2" />}
            {editing === null ? t('personForm.locations.addLocation') : t('personForm.locations.updateLocation')}
          </button>
          {editing !== null && (
            <button type="button" onClick={reset} className="px-4 py-2 border dark:border-gray-600 rounded-md text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-800">
              {t('common.cancel')}
            </button>
          )}
        </div>
      </div>

      <div className="space-y-2">
        {locations.map((loc, i) => {
          const c = coordsOf(loc);
          return (
            <div key={i} className={`flex items-center justify-between gap-x-3 p-3 bg-white dark:bg-slate-800 border rounded-lg ${editing === i ? 'border-blue-500 dark:border-blue-500' : ''}`}>
              <div className="min-w-0">
                <div className="flex items-center gap-x-2">
                  <span className="font-medium text-sm px-2 py-1 bg-blue-100 text-blue-800 rounded-sm">
                    {locationTypes.find(lt => lt.value === loc.type)?.label || loc.type}
                  </span>
                  <span className="font-medium">{loc.address}</span>
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  {[loc.city, loc.state, loc.country, loc.postal_code].filter(Boolean).join(', ')}
                </div>
                {loc.notes && <p className="text-sm text-gray-500 dark:text-gray-500 mt-1">{loc.notes}</p>}
                {c.lat !== undefined ? (
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 flex items-center gap-1">
                    <Crosshair className="w-3 h-3" /><span dir="ltr">{fixed(c.lat)}, {fixed(c.lng)}</span>
                  </p>
                ) : (
                  <p className="text-xs mt-1 text-amber-800 dark:text-amber-300 flex items-start gap-1">
                    <AlertTriangle className="w-3 h-3 mt-0.5 shrink-0" />
                    <span>
                      {loc.geocode_failure
                        ? t('personForm.locations.notOnMapReason', { reason: geocodeReason(t, loc.geocode_failure) })
                        : t('personForm.locations.notOnMapYet')}
                      {geocodeDetail(loc.geocode_failure, loc.geocode_message) && (
                        <span className="block text-gray-600 dark:text-gray-400">{geocodeDetail(loc.geocode_failure, loc.geocode_message)}</span>
                      )}
                    </span>
                  </p>
                )}
              </div>
              <div className="flex items-center gap-x-3 shrink-0">
                <button type="button" onClick={() => startEdit(i)} title={t('common.edit')} aria-label={t('common.edit')} className="text-gray-500 hover:text-blue-600 dark:text-gray-400 dark:hover:text-blue-400">
                  <Pencil className="w-4 h-4" />
                </button>
                <button type="button" onClick={() => remove(i)} title={t('common.delete')} aria-label={t('common.delete')} className="text-red-600 hover:text-red-700">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default LocationsSection;
