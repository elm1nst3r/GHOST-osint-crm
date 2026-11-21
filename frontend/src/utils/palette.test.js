// Command palette helpers (search-and-command-palette plan).
import { describe, test, expect, beforeEach } from 'vitest';
import { readRecent, pushRecent, forgetRecent, matchesText, filterItems, resultTarget } from './palette';

describe('recently opened records', () => {
  beforeEach(() => localStorage.clear());

  test('newest first, no duplicates, at most 8, per user', () => {
    for (let i = 1; i <= 10; i += 1) pushRecent(1, { type: 'person', id: i, title: `P${i}` });
    pushRecent(1, { type: 'person', id: 5, title: 'P5 renamed' });
    const list = readRecent(1);
    expect(list.map((r) => r.id)).toEqual([5, 10, 9, 8, 7, 6, 4, 3]);
    expect(list[0].title).toBe('P5 renamed');
    expect(readRecent(2)).toEqual([]);
    expect(forgetRecent(1, 'person', 5).map((r) => r.id)).toEqual([10, 9, 8, 7, 6, 4, 3]);
  });

  test('ignores incomplete records and broken storage', () => {
    pushRecent(1, { type: 'person', id: 1 });
    expect(readRecent(1)).toEqual([]);
    localStorage.setItem('ghost-recent-records:1', '{not json');
    expect(readRecent(1)).toEqual([]);
  });
});

describe('matching menu items and actions', () => {
  test('every word, ignoring case and accents', () => {
    expect(matchesText('New crypto wallet', 'wal NEW')).toBe(true);
    expect(matchesText('Lothlórien', 'lothlorien')).toBe(true);
    expect(matchesText('New person', 'business')).toBe(false);
    expect(matchesText('anything', '  ')).toBe(true);
  });

  test('items starting with the query come first', () => {
    const items = [{ label: 'New business' }, { label: 'Businesses' }, { label: 'People' }];
    expect(filterItems(items, 'bus').map((i) => i.label)).toEqual(['Businesses', 'New business']);
    expect(filterItems(items, '')).toBe(items);
    expect(filterItems([{ label: 'Advanced search', keywords: 'filter saved records' }], 'records')).toHaveLength(1);
  });
});

test('where each result opens', () => {
  expect(resultTarget('person', 3)).toEqual({ kind: 'entity' });
  expect(resultTarget('file', 3)).toEqual({ kind: 'file' });
  expect(resultTarget('case', 3)).toEqual({ kind: 'route', path: '/cases?case=3' });
  expect(resultTarget('wireless_network', 9)).toEqual({ kind: 'route', path: '/wireless?network=9' });
  expect(resultTarget('todo', 1)).toEqual({ kind: 'route', path: '/dashboard' });
  expect(resultTarget('nope', 1)).toBeNull();
});
