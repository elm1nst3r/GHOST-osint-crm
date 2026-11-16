import { describe, expect, test } from 'vitest';
import { NAV_GROUPS, SWITCHABLE_MODULES, isModuleOn, visibleNavGroups, startSection, START_PAGES } from './modules';

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

describe('collapsible groups', () => {
  test('a collapsed group shows only the section you are in', async () => {
    const { itemsShown } = await import('./modules');
    const money = ['transactions', 'assets', 'properties', 'crypto-wallets'];
    expect(itemsShown(money, false, 'people')).toEqual(money);
    expect(itemsShown(money, true, 'people')).toEqual([]);
    expect(itemsShown(money, true, 'assets')).toEqual(['assets']);
  });

  test('the remembered list keeps only real headings', async () => {
    const { readCollapsedGroups, writeCollapsedGroups } = await import('./modules');
    writeCollapsedGroups(['money', 'bogus', 'analysis']);
    expect(readCollapsedGroups()).toEqual(['money', 'analysis']);
    localStorage.setItem('ghost-nav-collapsed', 'not json');
    expect(readCollapsedGroups()).toEqual([]);
  });
});

describe('start page', () => {
  test('the chosen section, if it exists and is on; the dashboard otherwise', () => {
    expect(startSection('relationships', [])).toBe('relationships');
    expect(startSection('relationships', ['relationships'])).toBe('dashboard');
    expect(startSection('people', ['relationships'])).toBe('people');
    expect(startSection(null, [])).toBe('dashboard');
    expect(startSection('nowhere', [])).toBe('dashboard');
    expect(START_PAGES).toContain('dashboard');
    expect(START_PAGES).not.toContain('settings');
  });
});
