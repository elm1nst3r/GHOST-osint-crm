import { describe, expect, test } from 'vitest';
import { coordsOf, addressQuery, geocodeReason, geocodeDetail } from './geocodeReasons';

describe('geocoding helpers (#110)', () => {
  test('coordinates: both or neither, in range', () => {
    expect(coordsOf({ latitude: '', longitude: '' })).toEqual({ empty: true });
    expect(coordsOf({})).toEqual({ empty: true });
    expect(coordsOf({ latitude: '-37.85', longitude: '175.68' })).toEqual({ lat: -37.85, lng: 175.68 });
    expect(coordsOf({ latitude: 0, longitude: 0 })).toEqual({ lat: 0, lng: 0 });
    expect(coordsOf({ latitude: '-37.85', longitude: '' })).toEqual({ invalid: true });
    expect(coordsOf({ latitude: '95', longitude: '10' })).toEqual({ invalid: true });
    expect(coordsOf({ latitude: 'abc', longitude: '10' })).toEqual({ invalid: true });
  });

  test('address query and reasons', () => {
    expect(addressQuery({ address: ' Bag End ', city: 'Matamata', postal_code: '3400', country: 'New Zealand', state: '' })).toBe('Bag End, Matamata, 3400, New Zealand');
    const t = (k) => k;
    expect(geocodeReason(t, 'not_found')).toBe('geocoding.reasons.not_found');
    expect(geocodeReason(t, 'weird')).toBe('geocoding.reasons.unknown');
    expect(geocodeDetail('service_error', 'LocationIQ rejected the API key')).toBe('LocationIQ rejected the API key');
    expect(geocodeDetail('not_found', 'No results')).toBe('');
  });
});
