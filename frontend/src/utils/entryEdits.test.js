import { describe, expect, test } from 'vitest';
import { editLocation, editOsintEntry } from './entryEdits';

describe('editing an address (#109)', () => {
  const home = { type: 'primary_residence', address: '1 Bagshot Row', city: 'Hobbiton', country: 'Shire', notes: '', latitude: -37.85, longitude: 175.68 };

  test('a changed address drops the map position so saving looks it up again', () => {
    const next = editLocation(home, { ...home, address: '3 Bagshot Row' });
    expect(next.address).toBe('3 Bagshot Row');
    expect(next).not.toHaveProperty('latitude');
    expect(next).not.toHaveProperty('longitude');
    expect(editLocation(home, { ...home, postal_code: 'SH1' })).not.toHaveProperty('latitude');
  });

  test('coordinates set in the form win, even with a changed address', () => {
    const next = editLocation(home, { ...home, address: 'Somewhere new', latitude: '-37.8721', longitude: '175.6829' });
    expect(next).toMatchObject({ address: 'Somewhere new', latitude: -37.8721, longitude: 175.6829 });
    const failed = { ...home, latitude: undefined, longitude: undefined, geocode_failure: 'not_found', geocode_message: 'none' };
    const fixed = editLocation(failed, { ...failed, latitude: -37.8, longitude: 175.6 });
    expect(fixed).not.toHaveProperty('geocode_failure');
  });

  test('a changed address also forgets why the old one was not found', () => {
    const failed = { ...home, latitude: undefined, longitude: undefined, geocode_failure: 'not_found', geocode_message: 'none' };
    const next = editLocation(failed, { ...failed, address: '5 Bagshot Row' });
    expect(next).not.toHaveProperty('geocode_failure');
    expect(next).not.toHaveProperty('geocode_message');
  });

  test('type or notes alone keep it; so does whitespace', () => {
    expect(editLocation(home, { ...home, type: 'work', notes: 'garden' })).toMatchObject({ type: 'work', notes: 'garden', latitude: -37.85, longitude: 175.68 });
    expect(editLocation(home, { ...home, city: ' Hobbiton ' })).toHaveProperty('latitude', -37.85);
  });
});

describe('editing an OSINT entry (#109)', () => {
  const finding = { tool_name: 'Breach search', retrieved_at: '2026-11-01T10:00:00Z' };
  const found = { type: 'Other', value: 'sha1:9f86d0', notes: '', verified: false, source: finding, sources: [finding] };

  test('a value typed by hand just changes', () => {
    const next = editOsintEntry({ type: 'Email', value: 'a@x.example', notes: '' }, { type: 'Email', value: 'b@x.example', notes: 'work' });
    expect(next).toEqual({ type: 'Email', value: 'b@x.example', notes: 'work' });
  });

  test('a found value keeps its findings and remembers what the tool found', () => {
    const next = editOsintEntry(found, { type: 'Other', value: '4111 1111 1111 1111', notes: 'full number' });
    expect(next).toMatchObject({ value: '4111 1111 1111 1111', notes: 'full number', verified: false, sources: [finding], source: finding });
    expect(next).toMatchObject({ original_type: 'Other', original_value: 'sha1:9f86d0' });
    // A second edit still points at the first value.
    expect(editOsintEntry(next, { ...next, value: '4111111111111111' })).toMatchObject({ original_value: 'sha1:9f86d0' });
  });

  test('notes alone, or editing back, leave no trace', () => {
    expect(editOsintEntry(found, { ...found, notes: 'checked' })).not.toHaveProperty('original_value');
    const edited = editOsintEntry(found, { ...found, value: 'other' });
    expect(editOsintEntry(edited, { ...edited, value: 'SHA1:9F86D0' })).not.toHaveProperty('original_value');
  });
});
