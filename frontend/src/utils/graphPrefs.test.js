// Remembered graph settings (graph view tidy-up, 2026-11-16).
import { describe, test, expect, beforeEach } from 'vitest';
import { readGraphPrefs, writeGraphPrefs, cleanPrefs, DEFAULT_PREFS, MAX_TYPES, MAX_LAYERS } from './graphPrefs';

describe('graph preferences', () => {
  beforeEach(() => localStorage.clear());

  test('nothing stored: everything on', () => {
    const p = readGraphPrefs(7);
    expect(p).toBe(DEFAULT_PREFS);
    expect(Object.values(p.types).every(Boolean)).toBe(true);
    expect(Object.values(p.layers).every(Boolean)).toBe(true);
  });

  test('what was switched off stays off, per user; case filters are not kept', () => {
    writeGraphPrefs(7, {
      ...DEFAULT_PREFS,
      types: { ...MAX_TYPES, identifier: false },
      layers: { ...MAX_LAYERS, financial: false },
      sizeBy: 'pagerank',
      filters: { ...DEFAULT_PREFS.filters, searchTerm: 'Baggins', caseIds: [3], categories: ['Suspect'] },
      showFilters: true,
    });
    const p = readGraphPrefs(7);
    expect(p.types.identifier).toBe(false);
    expect(p.types.person).toBe(true);
    expect(p.layers.financial).toBe(false);
    expect(p.sizeBy).toBe('pagerank');
    expect(p.filters).toMatchObject({ searchTerm: 'Baggins', caseIds: [], categories: ['Suspect'] });
    expect(p.showFilters).toBe(true);
    expect(readGraphPrefs(8)).toBe(DEFAULT_PREFS);
  });

  test('damaged or old values fall back safely', () => {
    localStorage.setItem('ghost-graph-view:7', '{not json');
    expect(readGraphPrefs(7)).toBe(DEFAULT_PREFS);
    const p = cleanPrefs({ types: { person: false, spaceship: false }, layout: 'spiral', sizeBy: 7, solo: 'nope', filters: { minConnections: -2, dateRange: 'decade', categories: [1, 'A'] } });
    expect(p.types).toEqual({ ...MAX_TYPES, person: false });
    expect(p).toMatchObject({ layout: 'force', sizeBy: 'connections', solo: null });
    expect(p.filters).toMatchObject({ minConnections: 0, dateRange: 'all', categories: ['A'], showIsolated: true });
  });
});
