const { parseDisabledModules, SWITCHABLE_MODULES } = require('./modules');

describe('switchable modules', () => {
  test('keeps known ids in a stable order and ignores the rest', () => {
    expect(parseDisabledModules(JSON.stringify(['wireless', 'nope', 'crypto-wallets']))).toEqual(['crypto-wallets', 'wireless']);
  });
  test('nothing stored, or garbage, means everything is on', () => {
    expect(parseDisabledModules(undefined)).toEqual([]);
    expect(parseDisabledModules('not json')).toEqual([]);
    expect(parseDisabledModules('{"a":1}')).toEqual([]);
  });
  test('core sections cannot be switched off', () => {
    for (const core of ['dashboard', 'cases', 'people', 'businesses', 'settings']) expect(SWITCHABLE_MODULES).not.toContain(core);
  });
});
