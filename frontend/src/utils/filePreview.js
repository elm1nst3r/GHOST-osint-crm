// File: frontend/src/utils/filePreview.js
//
// Which uploaded files (issue #97) can be shown inside GHOST, and helpers the
// preview needs. Anything not listed here is offered as a download only.
//
// The server always sends file bytes as application/octet-stream. The preview
// builds its own Blob with the type chosen HERE, from an allowlist, so a file
// claiming to be a PDF but holding HTML is still handed to the PDF viewer and
// never rendered as a page on GHOST's origin.

const ext = (name) => {
  const m = /\.([a-z0-9]+)$/i.exec(name || '');
  return m ? m[1].toLowerCase() : '';
};

const MB = 1024 * 1024;

const KINDS = {
  pdf: { exts: ['pdf'], mimes: ['application/pdf'], blobType: 'application/pdf', maxBytes: 100 * MB },
  image: {
    exts: ['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp'],
    mimes: ['image/png', 'image/jpeg', 'image/gif', 'image/webp', 'image/bmp'],
    maxBytes: 50 * MB,
  },
  table: { exts: ['csv', 'tsv'], mimes: ['text/csv', 'text/tab-separated-values'], maxBytes: 20 * MB },
  docx: {
    exts: ['docx'],
    mimes: ['application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
    maxBytes: 30 * MB,
  },
  text: {
    exts: ['txt', 'log', 'md', 'json', 'xml', 'yaml', 'yml', 'ini', 'cfg', 'conf', 'eml',
      'vcf', 'kml', 'gpx', 'sql', 'html', 'htm', 'js', 'py', 'sh', 'srt', 'nfo'],
    mimes: ['application/json', 'application/xml', 'message/rfc822'],
    mimePrefix: 'text/',
    maxBytes: 10 * MB,
  },
};

const IMAGE_BLOB_TYPES = {
  png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp', bmp: 'image/bmp',
};

// The extension decides first: browsers report many types inconsistently
// (Windows often sends application/vnd.ms-excel for .csv), and the extension
// is what the user sees. The reported type is only a fallback for unknown
// extensions.
export function previewKind(file) {
  if (!file) return null;
  const e = ext(file.original_name);
  const mime = String(file.mime_type || '').toLowerCase().split(';')[0].trim();

  let kind = Object.keys(KINDS).find((k) => KINDS[k].exts.includes(e));
  if (!kind) {
    kind = Object.keys(KINDS).find((k) =>
      KINDS[k].mimes.includes(mime) || (KINDS[k].mimePrefix && mime.startsWith(KINDS[k].mimePrefix)));
  }
  if (!kind) return null;
  if (Number(file.size_bytes) > KINDS[kind].maxBytes) return null;
  return kind;
}

// The Blob type the preview uses: never the type the uploader's browser sent.
export function previewBlobType(file, kind = previewKind(file)) {
  if (kind === 'pdf') return 'application/pdf';
  if (kind === 'image') {
    const e = ext(file.original_name);
    if (IMAGE_BLOB_TYPES[e]) return IMAGE_BLOB_TYPES[e];
    const mime = String(file.mime_type || '').toLowerCase();
    return Object.values(IMAGE_BLOB_TYPES).includes(mime) ? mime : 'application/octet-stream';
  }
  return 'text/plain';
}

// Languages whose legacy 8-bit files are usually Windows-1251 (Cyrillic).
const CYRILLIC_LANGS = ['ru', 'uk', 'be', 'bg', 'kk', 'sr', 'mk'];

export const TEXT_ENCODINGS = ['utf-8', 'windows-1251', 'windows-1252', 'koi8-r', 'utf-16le'];

// Share of non-ASCII bytes that sit in runs of 3+ letter-range bytes. In
// Windows-1251 every Cyrillic letter is such a byte, so words form runs; in
// Windows-1252 accented letters are mostly single bytes between ASCII ones.
function cyrillicRunShare(b) {
  let high = 0;
  let inRuns = 0;
  let run = 0;
  const flush = () => { if (run >= 3) inRuns += run; run = 0; };
  for (let i = 0; i < b.length; i += 1) {
    const x = b[i];
    if (x >= 0x80) high += 1;
    if (x >= 0xa8) run += 1; else flush();
  }
  flush();
  return high ? inRuns / high : 0;
}

// Encoding to try first. UTF-8 when the bytes are valid UTF-8 (or carry a
// BOM). Otherwise a legacy code page: Windows-1251 when the bytes look like
// Cyrillic words, else the usual one for the UI language. Exported call
// records and bank statements from older systems are often Windows-1251,
// which would otherwise show up as mojibake. The preview also lets the user
// pick the encoding by hand.
export function guessEncoding(bytes, language = 'en') {
  const b = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  if (b[0] === 0xff && b[1] === 0xfe) return 'utf-16le';
  try {
    new TextDecoder('utf-8', { fatal: true }).decode(b);
    return 'utf-8';
  } catch {
    if (cyrillicRunShare(b) >= 0.5) return 'windows-1251';
    const lang = String(language || '').toLowerCase().split('-')[0];
    return CYRILLIC_LANGS.includes(lang) ? 'windows-1251' : 'windows-1252';
  }
}

export function decodeText(bytes, encoding) {
  try {
    return new TextDecoder(encoding).decode(bytes);
  } catch {
    return new TextDecoder('utf-8').decode(bytes);
  }
}

export function formatBytes(n) {
  const v = Number(n);
  if (!Number.isFinite(v) || v < 0) return '';
  if (v < 1024) return `${v} B`;
  const units = ['KB', 'MB', 'GB', 'TB'];
  let x = v / 1024;
  let i = 0;
  while (x >= 1024 && i < units.length - 1) { x /= 1024; i += 1; }
  return `${x >= 10 ? Math.round(x) : x.toFixed(1)} ${units[i]}`;
}
