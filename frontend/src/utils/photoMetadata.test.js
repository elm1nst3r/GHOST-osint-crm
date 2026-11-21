// Photo metadata display (file-metadata plan).
import { describe, test, expect } from 'vitest';
import { takenAtParts, hasLocation, coordinates, compassPoint, metadataRows, locationFromPhoto } from './photoMetadata';

describe('photo metadata', () => {
  test('the time is shown as the camera wrote it, with its time zone when known', () => {
    expect(takenAtParts('2024-09-22T14:03:22+12:00')).toEqual({ date: '2024-09-22', time: '14:03', offset: '+12:00' });
    expect(takenAtParts('2023-01-05T08:00:00')).toEqual({ date: '2023-01-05', time: '08:00', offset: null });
    expect(takenAtParts('2023-01-05T08:00:00.000Z')).toEqual({ date: '2023-01-05', time: '08:00', offset: '+00:00' });
    expect(takenAtParts('yesterday')).toBeNull();
    expect(takenAtParts(undefined)).toBeNull();
  });

  test('location, coordinates and direction', () => {
    const file = { metadata: { gps: { latitude: -37.8721, longitude: 175.6829 } } };
    expect(hasLocation(file)).toBe(true);
    expect(hasLocation({ metadata: { camera: {} } })).toBe(false);
    expect(hasLocation({})).toBe(false);
    expect(coordinates(file.metadata.gps)).toBe('-37.872100, 175.682900');
    expect([0, 44, 123.4, 359, -90].map(compassPoint)).toEqual(['N', 'NE', 'SE', 'N', 'W']);
    expect(locationFromPhoto({ metadata: file.metadata }, { label: 'L', notes: 'N' }))
      .toEqual({ type: 'other', label: 'L', notes: 'N', latitude: -37.8721, longitude: 175.6829 });
  });

  test('panel rows: empty values left out, serial numbers flagged', () => {
    expect(metadataRows({
      camera: { make: 'Apple', model: 'iPhone 15 Pro', body_serial: 'SN1' },
      image: { width: 4032, height: 3024 },
      people: { copyright: '(c) Bag End' },
      identifying: ['camera.body_serial'],
    })).toEqual([
      { key: 'camera', value: 'Apple iPhone 15 Pro' },
      { key: 'bodySerial', value: 'SN1', identifying: true },
      { key: 'size', value: '4032 × 3024' },
      { key: 'copyright', value: '(c) Bag End' },
    ]);
    expect(metadataRows(null)).toEqual([]);
  });
});
