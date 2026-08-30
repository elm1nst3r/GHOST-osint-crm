// File: backend/services/projectRetentionService.js
//
// Archived-project retention (issue #88). When an operator configures a
// retention window in Settings, a project that has sat in 'closed' status
// (archived) longer than that window is permanently deleted — the project
// row and every project-scoped entity — the same cascade the manual
// "Delete Project & All Data" action runs.
//
// Deliberately conservative:
//   - Default is 0 = never. Nothing is deleted unless an operator opts in.
//   - Only 'closed' projects with a non-null archived_at older than the
//     window are eligible. Active / on_hold projects are never touched.
//   - Runs on a plain daily interval, plus once shortly after boot. No cron
//     dependency; this is not time-of-day sensitive.
//   - Each project is deleted in its own transaction, so one failure doesn't
//     block the rest.
//
// Like UpdateCheckService this reads app_settings live each run, so a
// changed policy takes effect on the next tick without a restart.
const { deleteProjectCascade, getProjectStats } = require('../utils/deleteProjectCascade');

const RETENTION_KEY = 'archived_project_retention_days';
const RUN_INTERVAL_MS = 24 * 60 * 60 * 1000; // daily
const STARTUP_DELAY_MS = 5 * 60 * 1000;      // 5 min after boot

class ProjectRetentionService {
  constructor(pool) {
    this.pool = pool;
    this.timer = null;
    this.startupTimer = null;
    this.running = false;
  }

  async getRetentionDays() {
    try {
      const { rows } = await this.pool.query(`SELECT value FROM app_settings WHERE key = $1`, [RETENTION_KEY]);
      if (rows.length === 0) return 0;
      const n = parseInt(rows[0].value, 10);
      return Number.isFinite(n) && n > 0 ? n : 0;
    } catch {
      return 0;
    }
  }

  // Returns the list of deleted project ids (empty when the policy is off or
  // nothing is due). Safe to call directly from a test or an admin trigger.
  async runOnce() {
    if (this.running) return [];
    this.running = true;
    const deleted = [];
    try {
      const retentionDays = await this.getRetentionDays();
      if (retentionDays <= 0) return [];

      const { rows: due } = await this.pool.query(
        `SELECT id, name FROM projects
         WHERE status = 'closed'
           AND archived_at IS NOT NULL
           AND archived_at < NOW() - ($1 || ' days')::interval
         ORDER BY archived_at ASC`,
        [String(retentionDays)]
      );

      for (const project of due) {
        const client = await this.pool.connect();
        try {
          const { counts, total } = await getProjectStats(client, project.id);
          await client.query('BEGIN');
          await deleteProjectCascade(client, project.id);
          await client.query('COMMIT');
          deleted.push(project.id);
          console.log(
            `[retention] deleted archived project ${project.id} ("${project.name}") ` +
            `after ${retentionDays}d — removed ${total} records`,
            counts
          );
        } catch (err) {
          await client.query('ROLLBACK').catch(() => {});
          console.error(`[retention] failed to delete project ${project.id}:`, err.message);
        } finally {
          client.release();
        }
      }
    } catch (err) {
      console.error('[retention] sweep failed:', err.message);
    } finally {
      this.running = false;
    }
    return deleted;
  }

  start() {
    if (this.timer) return;
    this.startupTimer = setTimeout(() => this.runOnce(), STARTUP_DELAY_MS);
    this.timer = setInterval(() => this.runOnce(), RUN_INTERVAL_MS);
    // Don't keep the event loop alive just for this.
    if (this.startupTimer.unref) this.startupTimer.unref();
    if (this.timer.unref) this.timer.unref();
  }

  stop() {
    if (this.timer) clearInterval(this.timer);
    if (this.startupTimer) clearTimeout(this.startupTimer);
    this.timer = null;
    this.startupTimer = null;
  }
}

module.exports = { ProjectRetentionService };
