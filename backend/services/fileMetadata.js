// Photo metadata (file-metadata plan): reads EXIF/GPS/XMP/IPTC from uploaded
// photos into files.metadata.
//
// Reading never blocks or fails an upload. ExifReader runs in a worker thread
// (fileMetadataWorker.js) with a memory cap and a timeout, so a malformed or
// hostile file costs at most a few seconds of one thread. Failures are
// logged and the file is marked as read (metadata_read_at), with no metadata.
//
// Files uploaded before this existed are read once in the background after
// the upgrade (MetadataBackfill), a few at a time.
const path = require('path');
const { Worker } = require('worker_threads');
const { isReadable, normalizeMetadata } = require('../utils/fileMetadata');
const storage = require('./fileStorage');

const TIMEOUT_MS = 5000;
const WORKER = path.join(__dirname, 'fileMetadataWorker.js');

// → the flattened tags, or null. Rejects on a timeout or a parse error.
function readRaw(filePath, timeoutMs = TIMEOUT_MS) {
  return new Promise((resolve, reject) => {
    const worker = new Worker(WORKER, {
      workerData: { path: filePath },
      resourceLimits: { maxOldGenerationSizeMb: 96, maxYoungGenerationSizeMb: 16 },
    });
    let done = false;
    const finish = (fn, value) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      worker.terminate().catch(() => {});
      fn(value);
    };
    const timer = setTimeout(() => finish(reject, new Error(`timed out after ${timeoutMs} ms`)), timeoutMs);
    worker.once('message', (msg) => (msg.error ? finish(reject, new Error(msg.error)) : finish(resolve, msg.raw)));
    worker.once('error', (err) => finish(reject, err));
    worker.once('exit', (code) => finish(reject, new Error(`reader stopped (exit ${code})`)));
  });
}

// → the normalised metadata, or null (not a photo, nothing in it, or it
// couldn't be read). Never throws.
async function extractMetadata(filePath, { mimeType, name, timeoutMs } = {}) {
  if (!isReadable(mimeType, name)) return null;
  try {
    return normalizeMetadata(await readRaw(filePath, timeoutMs));
  } catch (err) {
    // A file with no metadata at all is normal: not worth a log line.
    if (!/no exif data|invalid image format|unknown file/i.test(err.message)) {
      console.warn(`[files] could not read the metadata of "${name}": ${err.message}`);
    }
    return null;
  }
}

// Reads one stored file and saves the result. Marks it read either way.
async function readAndStore(db, file) {
  let metadata = null;
  if (isReadable(file.mime_type, file.original_name)) {
    metadata = await extractMetadata(storage.storedPath(file.stored_name), { mimeType: file.mime_type, name: file.original_name });
  }
  await db.query('UPDATE files SET metadata = $1, metadata_read_at = NOW() WHERE id = $2',
    [metadata ? JSON.stringify(metadata) : null, file.id]);
  return metadata;
}

// Files never read (uploaded before metadata existed): a batch at a time with
// a pause in between, oldest first. Stops when none are left; idempotent.
class MetadataBackfill {
  constructor(db, { batchSize = 10, pauseMs = 2000 } = {}) {
    this.db = db;
    this.batchSize = batchSize;
    this.pauseMs = pauseMs;
    this.stopped = false;
  }

  async runOnce() {
    const { rows } = await this.db.query(
      `SELECT id, stored_name, mime_type, original_name FROM files
       WHERE metadata_read_at IS NULL ORDER BY id LIMIT $1`, [this.batchSize]);
    for (const file of rows) {
      if (this.stopped) break;
      await readAndStore(this.db, file).catch((err) => {
        console.warn(`[files] metadata backfill skipped file ${file.id}: ${err.message}`);
        return this.db.query('UPDATE files SET metadata_read_at = NOW() WHERE id = $1', [file.id]);
      });
    }
    return rows.length;
  }

  async run() {
    let total = 0;
    for (;;) {
      if (this.stopped) return total;
      const n = await this.runOnce();
      total += n;
      if (n < this.batchSize) break;
      await new Promise((r) => { this.timer = setTimeout(r, this.pauseMs); });
    }
    if (total) console.log(`[files] read the metadata of ${total} existing file(s)`);
    return total;
  }

  start() {
    this.run().catch((err) => console.error('[files] metadata backfill failed:', err.message));
  }

  stop() {
    this.stopped = true;
    clearTimeout(this.timer);
  }
}

module.exports = { extractMetadata, readAndStore, MetadataBackfill, TIMEOUT_MS };
