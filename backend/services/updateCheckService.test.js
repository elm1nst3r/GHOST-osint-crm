const { isNewer, parseVersion } = require('./updateCheckService');

describe('parseVersion', () => {
  test('accepts tags with and without a leading v', () => {
    expect(parseVersion('v2.12.1')).toEqual([2, 12, 1]);
    expect(parseVersion('2.12.1')).toEqual([2, 12, 1]);
  });

  test('tolerates suffixes and whitespace', () => {
    expect(parseVersion(' 2.12.1-beta ')).toEqual([2, 12, 1]);
  });

  test('returns null for anything unparseable', () => {
    ['', 'latest', 'v2.12', null, undefined, 'nightly'].forEach((v) =>
      expect(parseVersion(v)).toBeNull()
    );
  });
});

describe('isNewer', () => {
  test('detects a genuine upgrade at each level', () => {
    expect(isNewer('2.12.1', '2.12.0')).toBe(true);
    expect(isNewer('2.13.0', '2.12.9')).toBe(true);
    expect(isNewer('3.0.0', '2.99.99')).toBe(true);
  });

  test('is false for the same version', () => {
    expect(isNewer('2.12.0', '2.12.0')).toBe(false);
    expect(isNewer('v2.12.0', '2.12.0')).toBe(false);
  });

  test('is false when the release is older — never advertise a downgrade', () => {
    expect(isNewer('2.11.9', '2.12.0')).toBe(false);
    expect(isNewer('1.0.0', '2.12.0')).toBe(false);
  });

  test('compares numerically, not as strings', () => {
    // '9' > '10' as text, which would hide every release after x.9
    expect(isNewer('2.10.0', '2.9.0')).toBe(true);
    expect(isNewer('2.9.0', '2.10.0')).toBe(false);
  });

  test('an unparseable version is never announced as an upgrade', () => {
    expect(isNewer('garbage', '2.12.0')).toBe(false);
    expect(isNewer('2.13.0', 'garbage')).toBe(false);
    expect(isNewer(null, '2.12.0')).toBe(false);
  });
});
