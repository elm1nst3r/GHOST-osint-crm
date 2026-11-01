// File: backend/services/fileStorage.js
//
// Disk storage for uploaded files (issue #97).
//
// Files live under FILES_DIR (Docker: the `files_data` volume), deliberately
// NOT under public/: everything in public/ is served by express.static with
// no login. They are stored under random names, so nothing a user typed ever
// becomes part of a path, and are only ever read back through
// GET /api/files/:id/content after a project-membership check.
//
//   FILES_DIR/tmp/     multer writes uploads here first
//   FILES_DIR/store/ab/abcdef...   finished files, fanned out by prefix
//
// Several paths delete database rows that own files (deleting one file, a
// whole project, the archived-project retention job). Rather than teach each
// of them about the disk, a sweep removes stored files that no longer have a
// `files` row. Single-file deletes still unlink immediately; the sweep is the
// safety net, and the only mechanism for project deletes.
const fs = require('fs');
const fsp = fs.promises;
const path = require('path');
const crypto = require('crypto');

const ROOT = path.resolve(process.env.FILES_DIR || path.join(__dirname, '..', 'data', 'files'));
const TMP_DIR = path.join(ROOT, 'tmp');
const STORE_DIR = path.join(ROOT, 'store');

const DEFAULT_MAX_BYTES = 50 * 1024 * 1024;
const MAX_BYTES = (() => {
  const n = parseInt(process.env.FILES_MAX_BYTES || '', 10);
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_MAX_BYTES;
})();

const STORED_NAME_RE = /^[a-f0-9]{32}$/;

// A stored file younger than this is never swept: an upload is moved into
// store/ just before its row is inserted, so a brand-new file without a row
// is normal for a moment.
const SWEEP_MIN_AGE_MS = 60 * 60 * 1000;
const TMP_MAX_AGE_MS = 24 * 60 * 60 * 1000;

function ensureDirs() {
  fs.mkdirSync(TMP_DIR, { recursive: true });
  fs.mkdirSync(STORE_DIR, { recursive: true });
}

function storedPath(storedName) {
  if (!STORED_NAME_RE.test(storedName || '')) throw new Error('Invalid stored file name');
  return path.join(STORE_DIR, storedName.slice(0, 2), storedName);
}

function sha256OfFile(filePath) {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256');
    fs.createReadStream(filePath)
      .on('error', reject)
      .on('data', (chunk) => hash.update(chunk))
      .on('end', () => resolve(hash.digest('hex')));
  });
}

// Moves a finished multer upload from tmp/ into store/. Both live under ROOT,
// so this is a rename, not a copy.
async function storeUpload(tmpPath) {
  const sha256 = await sha256OfFile(tmpPath);
  const { size } = await fsp.stat(tmpPath);
  const storedName = crypto.randomBytes(16).toString('hex');
  const dest = storedPath(storedName);
  await fsp.mkdir(path.dirname(dest), { recursive: true });
  await fsp.rename(tmpPath, dest);
  return { storedName, sha256, size };
}

async function removeStored(storedName) {
  try {
    await fsp.unlink(storedPath(storedName));
  } catch (err) {
    if (err.code !== 'ENOENT') console.error(`[files] could not remove ${storedName}:`, err.message);
  }
}

async function removeTmp(tmpPath) {
  if (!tmpPath) return;
  await fsp.unlink(tmpPath).catch(() => {});
}

async function listDir(dir) {
  try {
    return await fsp.readdir(dir, { withFileTypes: true });
  } catch (err) {
    if (err.code === 'ENOENT') return [];
    throw err;
  }
}

// Removes stored files with no `files` row, and abandoned tmp uploads.
// Returns how many files were removed.
async function sweepOrphans(pool) {
  const now = Date.now();
  let removed = 0;

  const { rows } = await pool.query('SELECT stored_name FROM files');
  const known = new Set(rows.map((r) => r.stored_name));

  for (const bucket of await listDir(STORE_DIR)) {
    if (!bucket.isDirectory()) continue;
    const bucketDir = path.join(STORE_DIR, bucket.name);
    for (const entry of await listDir(bucketDir)) {
      if (!entry.isFile() || known.has(entry.name)) continue;
      const full = path.join(bucketDir, entry.name);
      const { mtimeMs } = await fsp.stat(full);
      if (now - mtimeMs < SWEEP_MIN_AGE_MS) continue;
      await fsp.unlink(full).catch(() => {});
      removed += 1;
    }
  }

  for (const entry of await listDir(TMP_DIR)) {
    if (!entry.isFile()) continue;
    const full = path.join(TMP_DIR, entry.name);
    const { mtimeMs } = await fsp.stat(full);
    if (now - mtimeMs < TMP_MAX_AGE_MS) continue;
    await fsp.unlink(full).catch(() => {});
    removed += 1;
  }

  return removed;
}

const SWEEP_INTERVAL_MS = 24 * 60 * 60 * 1000;
const SWEEP_STARTUP_DELAY_MS = 2 * 60 * 1000;

// Runs the sweep shortly after boot and then daily. requestSweep() runs one
// soon (used after a project delete), coalescing repeated requests.
class FileSweepService {
  constructor(pool) {
    this.pool = pool;
    this.timers = [];
    this.pending = null;
  }

  start() {
    const startup = setTimeout(() => this.run(), SWEEP_STARTUP_DELAY_MS);
    const daily = setInterval(() => this.run(), SWEEP_INTERVAL_MS);
    startup.unref?.();
    daily.unref?.();
    this.timers.push(startup, daily);
  }

  stop() {
    this.timers.forEach((t) => clearTimeout(t));
    this.timers = [];
  }

  // Called after a project delete. Files uploaded in the last hour are
  // skipped (see SWEEP_MIN_AGE_MS) and go on the next daily run.
  requestSweep() {
    if (this.pending) return;
    this.pending = setTimeout(() => { this.pending = null; this.run(); }, 5000);
    this.pending.unref?.();
  }

  async run() {
    try {
      const removed = await sweepOrphans(this.pool);
      if (removed > 0) console.log(`[files] removed ${removed} orphaned file(s)`);
    } catch (err) {
      console.error('[files] sweep failed:', err.message);
    }
  }
}

module.exports = {
  ROOT,
  TMP_DIR,
  STORE_DIR,
  MAX_BYTES,
  ensureDirs,
  storedPath,
  storeUpload,
  removeStored,
  removeTmp,
  sweepOrphans,
  sha256OfFile,
  FileSweepService,
};
