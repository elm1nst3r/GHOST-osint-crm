// Photo metadata (file-metadata plan): real files with known EXIF/GPS, built
// here byte by byte, read through the worker thread exactly as uploads are
// (ExifReader in services/fileMetadataWorker.js).
const fs = require('fs');
const os = require('os');
const path = require('path');
const zlib = require('zlib');
const { extractMetadata, MetadataBackfill } = require('./fileMetadata');
const { normalizeMetadata, isReadable } = require('../utils/fileMetadata');

// ── A small TIFF writer (little-endian) ──────────────────────────────────────
const TYPE_SIZE = { 1: 1, 2: 1, 3: 2, 4: 4, 5: 8 };
const ascii = (tag, s) => ({ tag, type: 2, values: Buffer.from(`${s}\0`, 'latin1') });
const short = (tag, n) => ({ tag, type: 3, values: [n] });
const long = (tag, n) => ({ tag, type: 4, values: [n] });
const byte = (tag, n) => ({ tag, type: 1, values: [n] });
const rational = (tag, ...nums) => ({ tag, type: 5, values: nums.map((n) => [Math.round(n * 10000), 10000]) });
const dms = (deg) => { const a = Math.abs(deg); const d = Math.floor(a); const m = Math.floor((a - d) * 60); return [d, m, (a - d - m / 60) * 3600]; };

function tiff({ ifd0 = [], exif = [], gps = [] }) {
  const ifds = [{ name: 'ifd0', entries: [...ifd0] }];
  if (exif.length) { ifd0.push(null); ifds.push({ name: 'exif', entries: exif }); }
  if (gps.length) ifds.push({ name: 'gps', entries: gps });
  if (exif.length) ifds[0].entries.push({ tag: 0x8769, type: 4, values: [0], pointer: 'exif' });
  if (gps.length) ifds[0].entries.push({ tag: 0x8825, type: 4, values: [0], pointer: 'gps' });
  const dataSize = (e) => { const n = Buffer.isBuffer(e.values) ? e.values.length : e.values.length * TYPE_SIZE[e.type]; return n > 4 ? n : 0; };
  let offset = 8;
  for (const ifd of ifds) {
    ifd.entries = ifd.entries.filter(Boolean).sort((a, b) => a.tag - b.tag);
    ifd.offset = offset;
    offset += 2 + ifd.entries.length * 12 + 4 + ifd.entries.reduce((s, e) => s + dataSize(e), 0);
  }
  const buf = Buffer.alloc(offset);
  buf.write('II', 0, 'latin1'); buf.writeUInt16LE(42, 2); buf.writeUInt32LE(8, 4);
  const at = Object.fromEntries(ifds.map((i) => [i.name, i.offset]));
  for (const ifd of ifds) {
    let p = ifd.offset;
    let data = p + 2 + ifd.entries.length * 12 + 4;
    buf.writeUInt16LE(ifd.entries.length, p); p += 2;
    for (const e of ifd.entries) {
      const values = e.pointer ? [at[e.pointer]] : e.values;
      const count = Buffer.isBuffer(values) ? values.length : values.length;
      buf.writeUInt16LE(e.tag, p); buf.writeUInt16LE(e.type, p + 2); buf.writeUInt32LE(count, p + 4);
      const size = count * TYPE_SIZE[e.type];
      let w = size > 4 ? data : p + 8;
      if (size > 4) { buf.writeUInt32LE(data, p + 8); data += size; }
      if (Buffer.isBuffer(values)) values.copy(buf, w);
      else for (const v of values) {
        if (e.type === 1) { buf.writeUInt8(v, w); w += 1; }
        else if (e.type === 3) { buf.writeUInt16LE(v, w); w += 2; }
        else if (e.type === 4) { buf.writeUInt32LE(v, w); w += 4; }
        else { buf.writeUInt32LE(v[0], w); buf.writeUInt32LE(v[1], w + 4); w += 8; }
      }
      p += 12;
    }
    buf.writeUInt32LE(0, p);
  }
  return buf;
}

const jpeg = (t) => {
  const app1 = Buffer.concat([Buffer.from('Exif\0\0', 'latin1'), t]);
  const len = Buffer.alloc(2); len.writeUInt16BE(app1.length + 2);
  return Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe1]), len, app1, Buffer.from([0xff, 0xd9])]);
};
const pngChunk = (type, data) => {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'latin1'), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(zlib.crc32(body) >>> 0);
  return Buffer.concat([len, body, crc]);
};
const png = (t) => {
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(640, 0); ihdr.writeUInt32BE(480, 4); ihdr[8] = 8; ihdr[9] = 2;
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk('IHDR', ihdr), pngChunk('eXIf', t), pngChunk('IEND', Buffer.alloc(0))]);
};

// Frodo's phone in Matamata (Hobbiton), with the time zone written down.
const LAT = -37.8721; const LNG = 175.6829;
const fullExif = () => tiff({
  ifd0: [ascii(0x010f, 'Apple'), ascii(0x0110, 'iPhone 15 Pro'), ascii(0x0131, '18.1'),
    ascii(0x013b, 'Samwise Gamgee'), ascii(0x8298, '(c) Bag End'), short(0x0112, 6)],
  exif: [ascii(0x9003, '2024:09:22 14:03:22'), ascii(0x9011, '+12:00'), ascii(0xa431, 'SN-FRODO-0001'),
    ascii(0xa434, 'iPhone 15 Pro back camera 6.86mm f/1.78'), long(0xa002, 4032), long(0xa003, 3024)],
  gps: [ascii(0x0001, 'S'), rational(0x0002, ...dms(LAT)), ascii(0x0003, 'E'), rational(0x0004, ...dms(LNG)),
    byte(0x0005, 0), rational(0x0006, 81.5), rational(0x0011, 123.4)],
});

let dir;
const write = (name, data) => { const p = path.join(dir, name); fs.writeFileSync(p, data); return p; };
beforeAll(() => { dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ghost-meta-')); });
afterAll(() => fs.rmSync(dir, { recursive: true, force: true }));

describe('reading photo metadata', () => {
  test('a JPEG with camera, time zone and GPS', async () => {
    const meta = await extractMetadata(write('frodo.jpg', jpeg(fullExif())), { mimeType: 'image/jpeg', name: 'frodo.jpg' });
    expect(meta.camera).toEqual({
      make: 'Apple', model: 'iPhone 15 Pro', software: '18.1',
      lens: 'iPhone 15 Pro back camera 6.86mm f/1.78', body_serial: 'SN-FRODO-0001',
    });
    expect(meta.taken_at).toBe('2024-09-22T14:03:22+12:00');
    expect(meta.gps.latitude).toBeCloseTo(LAT, 4);
    expect(meta.gps.longitude).toBeCloseTo(LNG, 4);
    expect(meta.gps).toMatchObject({ altitude: 81.5, direction: 123.4 });
    expect(meta.image).toEqual({ width: 4032, height: 3024, orientation: 6 });
    expect(meta.people).toEqual({ artist: 'Samwise Gamgee', copyright: '(c) Bag End' });
    expect(meta.identifying).toEqual(['camera.body_serial']);
  });

  test('the same EXIF in a PNG and in a TIFF', async () => {
    const fromPng = await extractMetadata(write('frodo.png', png(fullExif())), { mimeType: 'image/png', name: 'frodo.png' });
    expect(fromPng.gps.latitude).toBeCloseTo(LAT, 4);
    expect(fromPng.camera.model).toBe('iPhone 15 Pro');
    const fromTiff = await extractMetadata(write('frodo.tif', fullExif()), { mimeType: 'image/tiff', name: 'frodo.tif' });
    expect(fromTiff.taken_at).toBe('2024-09-22T14:03:22+12:00');
  });

  test('no time zone, no GPS fix, below sea level', async () => {
    const t = tiff({
      ifd0: [ascii(0x010f, 'Canon')],
      exif: [ascii(0x9003, '2023:01:05 08:00:00')],
      gps: [ascii(0x0001, 'N'), rational(0x0002, 0, 0, 0), ascii(0x0003, 'E'), rational(0x0004, 0, 0, 0)],
    });
    const meta = await extractMetadata(write('canon.jpg', jpeg(t)), { mimeType: 'image/jpeg', name: 'canon.jpg' });
    expect(meta).toEqual({ camera: { make: 'Canon' }, taken_at: '2023-01-05T08:00:00' });
    const dead = tiff({ gps: [ascii(0x0001, 'N'), rational(0x0002, 31, 30, 0), ascii(0x0003, 'E'), rational(0x0004, 35, 28, 30), byte(0x0005, 1), rational(0x0006, 430)] });
    const meta2 = await extractMetadata(write('deadsea.jpg', jpeg(dead)), { mimeType: 'image/jpeg', name: 'deadsea.jpg' });
    expect(meta2.gps).toMatchObject({ latitude: 31.5, longitude: 35.475, altitude: -430 });
  });

  test('nothing to read, a corrupt file and a non-photo give null without throwing', async () => {
    const plain = Buffer.from([0xff, 0xd8, 0xff, 0xdb, 0x00, 0x04, 0x00, 0x00, 0xff, 0xd9]);
    expect(await extractMetadata(write('plain.jpg', plain), { mimeType: 'image/jpeg', name: 'plain.jpg' })).toBeNull();
    const corrupt = Buffer.concat([jpeg(fullExif()).subarray(0, 40), Buffer.alloc(30, 0xff)]);
    expect(await extractMetadata(write('broken.jpg', corrupt), { mimeType: 'image/jpeg', name: 'broken.jpg' })).toBeNull();
    expect(await extractMetadata(write('notes.txt', 'hello'), { mimeType: 'text/plain', name: 'notes.txt' })).toBeNull();
    expect(await extractMetadata(path.join(dir, 'missing.jpg'), { mimeType: 'image/jpeg', name: 'missing.jpg' })).toBeNull();
  });

  test('XMP: creator, title, keywords and the editing software', async () => {
    const xmp = '<x:xmpmeta xmlns:x="adobe:ns:meta/"><rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">'
      + '<rdf:Description xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:xmp="http://ns.adobe.com/xap/1.0/" xmp:CreatorTool="Darktable 5">'
      + '<dc:creator><rdf:Seq><rdf:li>Faramir</rdf:li></rdf:Seq></dc:creator>'
      + '<dc:title><rdf:Alt><rdf:li xml:lang="x-default">Henneth Annûn</rdf:li></rdf:Alt></dc:title>'
      + '<dc:subject><rdf:Bag><rdf:li>waterfall</rdf:li><rdf:li>ranger</rdf:li></rdf:Bag></dc:subject>'
      + '</rdf:Description></rdf:RDF></x:xmpmeta>';
    const body = Buffer.concat([Buffer.from('http://ns.adobe.com/xap/1.0/\0', 'latin1'), Buffer.from(xmp, 'utf8')]);
    const len = Buffer.alloc(2); len.writeUInt16BE(body.length + 2);
    const file = write('xmp.jpg', Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe1]), len, body, Buffer.from([0xff, 0xd9])]));
    expect(await extractMetadata(file, { mimeType: 'image/jpeg', name: 'xmp.jpg' })).toEqual({
      camera: { software: 'Darktable 5' },
      people: { creator: 'Faramir' },
      text: { title: 'Henneth Annûn', keywords: 'waterfall, ranger' },
    });
  });

  test('HEIC is recognised by its extension when the browser sends octet-stream', () => {
    expect(isReadable('application/octet-stream', 'IMG_0042.HEIC')).toBe(true);
    expect(isReadable('image/webp', 'x.webp')).toBe(true);
    expect(isReadable('application/pdf', 'x.pdf')).toBe(false);
  });

  test('a read that takes too long is stopped', async () => {
    // Starting the worker alone takes longer than 1 ms.
    const file = write('slow.jpg', jpeg(fullExif()));
    expect(await extractMetadata(file, { mimeType: 'image/jpeg', name: 'slow.jpg', timeoutMs: 1 })).toBeNull();
  });
});

describe('normalizeMetadata', () => {
  test('XMP and IPTC fields, values cleaned and cut', () => {
    expect(normalizeMetadata({
      creator: ['Gandalf'], rights: { lang: 'x-default', value: 'Grey Company' },
      title: 'Orthanc', subject: ['tower', 'wizard'], Model: `  ${'x'.repeat(300)}\0 `,
    })).toEqual({
      camera: { model: 'x'.repeat(100) },
      people: { creator: 'Gandalf', copyright: 'Grey Company' },
      text: { title: 'Orthanc', keywords: 'tower, wizard' },
    });
    expect(normalizeMetadata({})).toBeNull();
    expect(normalizeMetadata(null)).toBeNull();
    expect(normalizeMetadata({ latitude: 95, longitude: 10 })).toBeNull();
  });
});

describe('MetadataBackfill', () => {
  test('reads each unread file once, in batches, and is idempotent', async () => {
    const files = [
      { id: 1, stored_name: 'a'.repeat(32), mime_type: 'text/plain', original_name: 'a.txt', metadata_read_at: null },
      { id: 2, stored_name: 'b'.repeat(32), mime_type: 'application/pdf', original_name: 'b.pdf', metadata_read_at: null },
      { id: 3, stored_name: 'c'.repeat(32), mime_type: 'text/csv', original_name: 'c.csv', metadata_read_at: null },
    ];
    const db = {
      query: async (sql, params) => {
        if (/^\s*SELECT/.test(sql)) return { rows: files.filter((f) => !f.metadata_read_at).slice(0, params[0]) };
        const id = params[params.length - 1];
        files.find((f) => f.id === id).metadata_read_at = new Date();
        return { rows: [] };
      },
    };
    const backfill = new MetadataBackfill(db, { batchSize: 2, pauseMs: 1 });
    expect(await backfill.run()).toBe(3);
    expect(files.every((f) => f.metadata_read_at)).toBe(true);
    expect(await backfill.run()).toBe(0);
  });
});
