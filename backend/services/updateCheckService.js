// File: backend/services/updateCheckService.js
//
// Tells the app whether a newer release exists (issue: in-app update mechanism).
//
// Deliberately narrow: it reads the public GitHub releases API and compares
// version numbers. It does not download anything, and nothing in the app can
// update itself — that would require mounting the Docker socket into a
// web-facing container, which turns any RCE into host root. Updating stays a
// deliberate operator action; the app shows the release notes and the
// commands to run, and the operator runs them.
//
// The check runs server-side (the browser never contacts GitHub), is cached for
// six hours, and can be switched off completely for deployments that must make
// no outbound connections. When it's off, no request is made at all.

const fs = require('fs');

const REPO = 'elm1nst3r/GHOST-osint-crm';
// The list, not /releases/latest: someone a few versions behind should see
// every release they would skip, including any that needs manual steps.
const RELEASES_URL = `https://api.github.com/repos/${REPO}/releases?per_page=30`;
const CACHE_MS = 6 * 60 * 60 * 1000;
const TIMEOUT_MS = 5000;
const NOTES_MAX = 20000;

// "v2.12.1" / "2.12.1" -> [2, 12, 1]. Anything unparseable sorts lowest so a
// malformed tag can never be announced as an upgrade.
const parseVersion = (raw) => {
  const m = String(raw || '').trim().replace(/^v/i, '').match(/^(\d+)\.(\d+)\.(\d+)/);
  return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null;
};

const compareVersions = (a, b) => {
  const x = parseVersion(a);
  const y = parseVersion(b);
  for (let i = 0; i < 3; i++) {
    if (x[i] !== y[i]) return x[i] - y[i];
  }
  return 0;
};

const isNewer = (candidate, current) => {
  if (!parseVersion(candidate) || !parseVersion(current)) return false;
  return compareVersions(candidate, current) > 0;
};

// A release that needs work before updating (say a database move) says so in
// its notes under a heading such as "### ⚠️ Before you upgrade". Returns that
// section's text, or null.
const BEFORE_UPGRADE = /^(#{2,4})[ \t]+[^\n]*\bbefore (?:you )?(?:upgrad|updat)/im;
const beforeUpgradeSection = (body) => {
  const text = String(body || '');
  const m = BEFORE_UPGRADE.exec(text);
  if (!m) return null;
  const rest = text.slice(m.index + m[0].length);
  const startOfBody = rest.indexOf('\n');
  const after = startOfBody === -1 ? '' : rest.slice(startOfBody + 1);
  // Ends at the next heading of the same or a higher level.
  const next = new RegExp(`^#{1,${m[1].length}}[ \\t]`, 'm').exec(after);
  const section = (next ? after.slice(0, next.index) : after).trim();
  return section || null;
};

// GitHub's release list -> the published releases newer than `current`,
// newest first, with what the update dialog shows.
const releasesNewerThan = (list, current) => (Array.isArray(list) ? list : [])
  .filter((r) => r && !r.draft && !r.prerelease)
  .map((r) => ({ ...r, version: String(r.tag_name || '').replace(/^v/i, '') }))
  .filter((r) => isNewer(r.version, current))
  .sort((a, b) => compareVersions(b.version, a.version))
  .map((r) => {
    const notes = String(r.body || '');
    return {
      version: r.version,
      name: r.name || null,
      url: r.html_url || null,
      publishedAt: r.published_at || null,
      notes: notes.length > NOTES_MAX ? `${notes.slice(0, NOTES_MAX)}\n\n…` : notes,
      beforeUpgrade: beforeUpgradeSection(notes),
      major: parseVersion(r.version)[0] > parseVersion(current)[0],
    };
  });

// How this instance runs, so the dialog can show the right commands. Only
// for admins (the route strips it for everyone else).
const installInfo = (env = process.env, inDocker = fs.existsSync('/.dockerenv')) => {
  const dbHost = env.DB_HOST || 'localhost';
  let method = 'manual';
  if (inDocker) method = env.GHOST_BUILD === 'published' ? 'images' : 'source';
  return {
    method,
    pinnedVersion: env.GHOST_VERSION || null,
    database: inDocker && dbHost === 'db' ? 'bundled' : 'external',
    dbHost,
    dbPort: env.DB_PORT || '5432',
    dbUser: env.DB_USER || 'postgres',
    dbName: env.DB_NAME || 'osint_crm_db',
  };
};

class UpdateCheckService {
  constructor(pool, currentVersion) {
    this.pool = pool;
    this.currentVersion = currentVersion;
    this.cache = null;
    this.cachedAt = 0;
  }

  // Enabled unless explicitly turned off, so the default is "tell me about
  // security fixes" rather than silence.
  async isEnabled() {
    try {
      const res = await this.pool.query(
        `SELECT value FROM app_settings WHERE key = 'update_check_enabled'`
      );
      if (res.rows.length === 0) return true;
      return res.rows[0].value !== 'false';
    } catch {
      return true;
    }
  }

  async getStatus({ force = false } = {}) {
    const enabled = await this.isEnabled();
    const base = { currentVersion: this.currentVersion, checkEnabled: enabled };

    if (!enabled) return { ...base, latestVersion: null, updateAvailable: false };

    if (!force && this.cache && Date.now() - this.cachedAt < CACHE_MS) {
      return { ...base, ...this.cache };
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      const response = await fetch(RELEASES_URL, {
        headers: {
          Accept: 'application/vnd.github+json',
          'User-Agent': `GHOST-OSINT-CRM/${this.currentVersion}`,
        },
        signal: controller.signal,
      });
      if (!response.ok) throw new Error(`GitHub returned ${response.status}`);

      const releases = releasesNewerThan(await response.json(), this.currentVersion);
      const latest = releases[0];
      this.cache = {
        latestVersion: latest ? latest.version : this.currentVersion,
        updateAvailable: Boolean(latest),
        releaseUrl: latest ? latest.url : null,
        releaseName: latest ? latest.name : null,
        publishedAt: latest ? latest.publishedAt : null,
        releases,
      };
      this.cachedAt = Date.now();
      return { ...base, ...this.cache };
    } catch (error) {
      // Never let a failed check surface as an error to the user — an
      // air-gapped or rate-limited instance is not a broken one.
      return {
        ...base,
        latestVersion: null,
        updateAvailable: false,
        checkFailed: true,
      };
    } finally {
      clearTimeout(timer);
    }
  }
}

module.exports = {
  UpdateCheckService, isNewer, parseVersion, beforeUpgradeSection, releasesNewerThan, installInfo,
};
