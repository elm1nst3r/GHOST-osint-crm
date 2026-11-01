// File: backend/utils/fileNames.js
// Filename handling for uploaded files (issue #97). Pure, so it's unit-tested.

// Browsers send the multipart filename as raw UTF-8 bytes, but busboy (under
// multer 1.x) decodes it as Latin-1, so "Выписка.pdf" arrives as
// "Ð\u0092Ñ\u008b...". Re-encoding as Latin-1 recovers the original bytes.
// A name that already holds characters above U+00FF was decoded correctly
// (e.g. sent as RFC 5987 filename*), and one that isn't valid UTF-8 after
// re-decoding really was Latin-1; both are left alone.
function fixMultipartFilename(name) {
  if (typeof name !== 'string' || name === '') return name;
  if (/[^\u0000-ÿ]/.test(name)) return name;
  const decoded = Buffer.from(name, 'latin1').toString('utf8');
  return decoded.includes('�') ? name : decoded;
}

const MAX_NAME_LENGTH = 255;

// The original name is only ever displayed and offered back as the download
// name -- files are stored under random names -- but it still shouldn't carry
// path parts or control characters into a Content-Disposition header.
function sanitizeFilename(name) {
  let n = String(name || '').normalize('NFC');
  n = n.split(/[\\/]/).pop();                 // drop any path
  n = n.replace(/[\u0000-\u001f\u007f]/g, ''); // control characters
  n = n.trim().replace(/^\.+/, '');            // no hidden/relative names
  if (!n) n = 'file';
  if (n.length > MAX_NAME_LENGTH) {
    const dot = n.lastIndexOf('.');
    const ext = dot > 0 && n.length - dot <= 16 ? n.slice(dot) : '';
    n = n.slice(0, MAX_NAME_LENGTH - ext.length) + ext;
  }
  return n;
}

module.exports = { fixMultipartFilename, sanitizeFilename, MAX_NAME_LENGTH };
