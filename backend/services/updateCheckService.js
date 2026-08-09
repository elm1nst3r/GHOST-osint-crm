// File: backend/services/updateCheckService.js
//
// Tells the app whether a newer release exists (issue: in-app update mechanism).
//
// Deliberately narrow: it reads the public GitHub releases API and compares
// version numbers. It does not download anything, and nothing in the app can
// update itself — that would require mounting the Docker socket into a
// web-facing container, which turns any RCE into host root. Updating stays a
// deliberate operator action; this only removes the "how would I know?" part.
//
// The check runs server-side (the browser never contacts GitHub), is cached for
// six hours, and can be switched off completely for deployments that must make
// no outbound connections. When it's off, no request is made at all.

const REPO = 'elm1nst3r/GHOST-osint-crm';
const RELEASES_URL = `https://api.github.com/repos/${REPO}/releases/latest`;
const CACHE_MS = 6 * 60 * 60 * 1000;
const TIMEOUT_MS = 5000;

// "v2.12.1" / "2.12.1" -> [2, 12, 1]. Anything unparseable sorts lowest so a
// malformed tag can never be announced as an upgrade.
const parseVersion = (raw) => {
  const m = String(raw || '').trim().replace(/^v/i, '').match(/^(\d+)\.(\d+)\.(\d+)/);
  return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null;
};

const isNewer = (candidate, current) => {
  const a = parseVersion(candidate);
  const b = parseVersion(current);
  if (!a || !b) return false;
  for (let i = 0; i < 3; i++) {
    if (a[i] > b[i]) return true;
    if (a[i] < b[i]) return false;
  }
  return false;
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

      const data = await response.json();
      const latestVersion = String(data.tag_name || '').replace(/^v/i, '');
      this.cache = {
        latestVersion: latestVersion || null,
        updateAvailable: isNewer(latestVersion, this.currentVersion),
        releaseUrl: data.html_url || null,
        releaseName: data.name || null,
        publishedAt: data.published_at || null,
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

module.exports = { UpdateCheckService, isNewer, parseVersion };
