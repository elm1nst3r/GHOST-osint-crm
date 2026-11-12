import { describe, expect, test } from 'vitest';
import { needsAttention, updateSteps } from './updateSteps';

const keys = (steps) => steps.map((s) => s.key);

describe('updateSteps', () => {
  test('published images with the bundled database', () => {
    const steps = updateSteps({
      install: { database: 'bundled', dbUser: 'postgres', dbName: 'osint_crm_db' },
      method: 'images', current: '3.1.4', latest: '3.1.5',
    });
    expect(keys(steps)).toEqual(['backup', 'updateImages', 'check']);
    expect(steps[0].commands).toEqual([
      'mkdir -p backups',
      'docker compose exec -T db pg_dump -U postgres osint_crm_db > backups/ghost-3.1.4-db.sql',
      'docker compose exec -T backend tar czf - -C /usr/src/app/data files > backups/ghost-3.1.4-files.tar.gz',
    ]);
    expect(steps[1].commands).toEqual(['git pull', 'docker compose pull', 'docker compose up -d']);
  });

  test('a pinned version gets a step to change it, only for published images', () => {
    const install = { pinnedVersion: '3.1.4' };
    expect(updateSteps({ install, method: 'images', current: '3.1.4', latest: '3.2.0' })[1])
      .toEqual({ key: 'pin', commands: ['GHOST_VERSION=3.2.0'] });
    expect(keys(updateSteps({ install, method: 'source', current: '3.1.4', latest: '3.2.0' })))
      .toEqual(['backup', 'updateSource', 'check']);
  });

  test('external database: pg_dump from the server, Docker host name as localhost', () => {
    const [backup] = updateSteps({
      install: { database: 'external', dbHost: 'host.docker.internal', dbPort: '5433', dbUser: 'ghost', dbName: 'ghostdb' },
      method: 'source', current: '3.1.4', latest: '3.1.5',
    });
    expect(backup.key).toBe('backupExternal');
    expect(backup.commands[1]).toBe('pg_dump -h localhost -p 5433 -U ghost ghostdb > backups/ghost-3.1.4-db.sql');
  });

  test('without Docker', () => {
    const steps = updateSteps({ install: { dbHost: 'localhost' }, method: 'manual', current: '3.1.4', latest: '3.1.5' });
    expect(keys(steps)).toEqual(['backupManual', 'updateManual', 'restartManual']);
    expect(steps[1].commands[0]).toBe('git pull');
  });
});

describe('needsAttention', () => {
  test('releases with a before-upgrade section or a new major version', () => {
    const releases = [
      { version: '4.0.0', major: true, beforeUpgrade: null },
      { version: '3.3.0', major: false, beforeUpgrade: 'Dump first.' },
      { version: '3.2.0', major: false, beforeUpgrade: null },
    ];
    expect(needsAttention(releases).map((r) => r.version)).toEqual(['4.0.0', '3.3.0']);
    expect(needsAttention(undefined)).toEqual([]);
  });
});
