const {
  isNewer, parseVersion, beforeUpgradeSection, releasesNewerThan, installInfo,
} = require('./updateCheckService');

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

describe('beforeUpgradeSection', () => {
  test('returns the section under a "before you upgrade" heading, up to the next heading', () => {
    const body = '### Fixed\n- a bug\n\n### ⚠️ Before you upgrade\nBack up first.\n\n#### Details\nmore\n\n### Translations\n- ru';
    expect(beforeUpgradeSection(body)).toBe('Back up first.\n\n#### Details\nmore');
  });

  test('accepts "before updating" and runs to the end', () => {
    expect(beforeUpgradeSection('## Before updating\nStop the stack.')).toBe('Stop the stack.');
  });

  test('null when there is no such heading, or it is empty', () => {
    expect(beforeUpgradeSection('### Fixed\nBack up before you upgrade, as always.')).toBeNull();
    expect(beforeUpgradeSection('### Before you upgrade\n### Fixed\n- x')).toBeNull();
    expect(beforeUpgradeSection(null)).toBeNull();
  });
});

describe('releasesNewerThan', () => {
  const list = [
    { tag_name: 'v3.1.4', name: 'v3.1.4', body: 'notes', html_url: 'u4', published_at: 't4' },
    { tag_name: 'v4.0.0', body: '### Before you upgrade\nDump the database.' },
    { tag_name: 'v3.2.0', body: '' },
    { tag_name: 'v3.10.0-rc1', prerelease: true },
    { tag_name: 'v3.9.0', draft: true },
    { tag_name: 'nightly' },
  ];

  test('only published releases newer than the running one, newest first', () => {
    const out = releasesNewerThan(list, '3.1.4');
    expect(out.map((r) => r.version)).toEqual(['4.0.0', '3.2.0']);
    expect(out[0]).toMatchObject({ beforeUpgrade: 'Dump the database.', major: true });
    expect(out[1]).toMatchObject({ beforeUpgrade: null, major: false });
  });

  test('nothing newer gives an empty list; junk input is tolerated', () => {
    expect(releasesNewerThan(list, '4.0.0')).toEqual([]);
    expect(releasesNewerThan(null, '3.1.4')).toEqual([]);
  });

  test('very long notes are cut', () => {
    const [r] = releasesNewerThan([{ tag_name: 'v9.0.0', body: 'x'.repeat(30000) }], '3.1.4');
    expect(r.notes.length).toBeLessThan(20010);
  });
});

describe('installInfo', () => {
  test('published image with the bundled database', () => {
    expect(installInfo({ GHOST_BUILD: 'published', DB_HOST: 'db' }, true)).toMatchObject({
      method: 'images', database: 'bundled', pinnedVersion: null, dbUser: 'postgres', dbName: 'osint_crm_db',
    });
  });

  test('local build, pinned version, external database', () => {
    expect(installInfo({ GHOST_VERSION: '3.1.4', DB_HOST: 'pg.internal', DB_USER: 'ghost' }, true)).toMatchObject({
      method: 'source', pinnedVersion: '3.1.4', database: 'external', dbHost: 'pg.internal', dbUser: 'ghost',
    });
  });

  test('outside Docker', () => {
    expect(installInfo({ DB_HOST: 'localhost' }, false)).toMatchObject({ method: 'manual', database: 'external' });
  });
});
