import { describe, expect, test } from 'vitest';
import { NAV_GROUPS, SWITCHABLE_MODULES, isModuleOn, visibleNavGroups } from './modules';

describe('sidebar modules', () => {
  test('every menu section is in exactly one group', () => {
    const ids = NAV_GROUPS.flatMap((g) => g.items);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of SWITCHABLE_MODULES) expect(ids).toContain(id);
  });

  test('core sections are always on', () => {
    for (const id of ['dashboard', 'cases', 'people', 'businesses', 'settings']) expect(isModuleOn(SWITCHABLE_MODULES, id)).toBe(true);
  });

  test('switched-off items leave their group, and an empty group leaves the menu', () => {
    const groups = visibleNavGroups(['wireless', 'map', 'relationships', 'crypto-wallets']);
    expect(groups.map((g) => g.heading)).toEqual([null, 'investigation', 'money', 'sources']);
    expect(groups.find((g) => g.heading === 'money').items).toEqual(['transactions', 'assets', 'properties']);
  });
});
