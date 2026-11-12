// The steps the update dialog shows: back up, (pin), update, check. GHOST
// never runs them itself; the admin copies them to the server.
//
// `install` comes from GET /api/version (admins only): method images |
// source | manual, pinnedVersion, database bundled | external, db* fields.

export const UPDATE_METHODS = ['images', 'source', 'manual'];

// The database host as the backend container sees it; from the server's own
// shell, Docker's name for the host is just localhost.
const hostSide = (host) => (host === 'host.docker.internal' ? 'localhost' : host);

const pgDump = (install, file) =>
  `pg_dump -h ${hostSide(install.dbHost)} -p ${install.dbPort} -U ${install.dbUser} ${install.dbName} > ${file}`;

export function updateSteps({ install = {}, method, current, latest }) {
  const info = {
    database: 'bundled', dbHost: 'localhost', dbPort: '5432', dbUser: 'postgres', dbName: 'osint_crm_db',
    pinnedVersion: null, ...install,
  };
  const dbFile = `backups/ghost-${current}-db.sql`;
  const filesFile = `backups/ghost-${current}-files.tar.gz`;
  const steps = [];

  if (method === 'manual') {
    steps.push({ key: 'backupManual', commands: ['mkdir -p backups', pgDump(info, dbFile)] });
    steps.push({
      key: 'updateManual',
      commands: ['git pull', '(cd backend && npm ci)', '(cd frontend && npm ci && npm run build)'],
    });
    steps.push({ key: 'restartManual', commands: [] });
    return steps;
  }

  steps.push({
    key: info.database === 'bundled' ? 'backup' : 'backupExternal',
    commands: [
      'mkdir -p backups',
      info.database === 'bundled'
        ? `docker compose exec -T db pg_dump -U ${info.dbUser} ${info.dbName} > ${dbFile}`
        : pgDump(info, dbFile),
      `docker compose exec -T backend tar czf - -C /usr/src/app/data files > ${filesFile}`,
    ],
  });

  // A pinned version stays put until .env names the new one. Built from
  // source, the git checkout decides the version, so the pin doesn't matter.
  if (method === 'images' && info.pinnedVersion) {
    steps.push({ key: 'pin', commands: [`GHOST_VERSION=${latest}`] });
  }

  steps.push(method === 'source'
    ? { key: 'updateSource', commands: ['git pull', 'docker compose up -d --build'] }
    : { key: 'updateImages', commands: ['git pull', 'docker compose pull', 'docker compose up -d'] });

  steps.push({ key: 'check', commands: [] });
  return steps;
}

// Releases the admin should read before updating: ones with a "before you
// upgrade" section, and major versions.
export const needsAttention = (releases = []) => releases.filter((r) => r.beforeUpgrade || r.major);
