// Reads a photo's metadata in a worker thread (services/fileMetadata.js
// starts it), so a malformed or hostile file can't stall the server: the
// parent ends this thread after a timeout, and its memory is capped.
const { parentPort, workerData } = require('worker_threads');
const ExifReader = require('exifreader');
const { flattenTags } = require('../utils/fileMetadata');

ExifReader.load(workerData.path, { expanded: true, includeUnknown: false, computed: true })
  .then((tags) => parentPort.postMessage({ raw: flattenTags(tags) }))
  .catch((err) => parentPort.postMessage({ error: String(err?.message || err).slice(0, 200), name: err?.name }));
