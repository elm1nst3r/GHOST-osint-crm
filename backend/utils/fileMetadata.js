// Photo metadata (file-metadata plan): which files are worth reading, and
// the small, stable shape GHOST stores in files.metadata from what ExifReader
// reads (EXIF, GPS, XMP, IPTC). Pure, so it's tested without files.
//
// Stored shape (every part optional, empty parts left out):
//   camera:  { make, model, lens, software, body_serial, lens_serial }
//   taken_at: "2024-05-01T14:03:22+02:00" (with the offset when the photo
//            records one) or "2024-05-01T14:03:22" (camera clock, zone unknown)
//   gps:     { latitude, longitude, altitude, direction }
//   image:   { width, height, orientation }
//   people:  { artist, creator, copyright }
//   text:    { title, description, keywords }
//   identifying: ["camera.body_serial", ...]  values that identify one device

// Formats ExifReader reads.
const READABLE_TYPES = new Set([
  'image/jpeg', 'image/pjpeg', 'image/tiff', 'image/png', 'image/webp',
  'image/heic', 'image/heif', 'image/avif',
]);
const READABLE_EXTENSIONS = /\.(jpe?g|tiff?|png|webp|heic|heif|avif)$/i;

// Browsers send HEIC as application/octet-stream more often than not, so
// the extension counts too.
const isReadable = (mimeType, name) =>
  READABLE_TYPES.has(String(mimeType || '').toLowerCase()) || READABLE_EXTENSIONS.test(String(name || ''));

const text = (v, max = 200) => {
  if (Array.isArray(v)) v = v.filter((x) => x != null && x !== '').join(', ');
  if (v && typeof v === 'object' && 'value' in v) v = v.value; // XMP lang-alt
  if (v == null) return undefined;
  const s = String(v).replace(/\0/g, '').trim();
  // ExifReader's placeholder for a value cut off in a damaged file.
  if (!s || s === '<faulty value>') return undefined;
  return s.slice(0, max);
};

const num = (v) => {
  if (Array.isArray(v)) v = v[0];
  const n = typeof v === 'number' ? v : Number.parseFloat(v);
  return Number.isFinite(n) ? n : undefined;
};

// Drops undefined values and empty objects.
const compact = (o) => {
  const out = {};
  for (const [k, v] of Object.entries(o)) {
    if (v === undefined) continue;
    if (v && typeof v === 'object' && !Array.isArray(v) && Object.keys(v).length === 0) continue;
    out[k] = v;
  }
  return out;
};

// EXIF writes "2024:05:01 14:03:22"; offsets look like "+02:00".
const EXIF_DATE = /^(\d{4}):(\d{2}):(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?/;
const OFFSET = /^[+-]\d{2}:\d{2}$/;

function takenAt(raw) {
  const value = raw.DateTimeOriginal ?? raw.CreateDate ?? raw.DateTimeDigitized ?? raw.ModifyDate ?? raw.DateCreated;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? undefined : value.toISOString();
  const m = EXIF_DATE.exec(String(value ?? '').trim());
  if (!m || m[1] === '0000') return undefined;
  const iso = `${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6] || '00'}`;
  const offset = String(raw.OffsetTimeOriginal ?? raw.OffsetTime ?? raw.OffsetTimeDigitized ?? '').trim();
  return OFFSET.test(offset) ? `${iso}${offset}` : iso;
}

function gps(raw) {
  const latitude = num(raw.latitude);
  const longitude = num(raw.longitude);
  if (latitude === undefined || longitude === undefined) return undefined;
  if (Math.abs(latitude) > 90 || Math.abs(longitude) > 180) return undefined;
  // 0,0 is what a camera writes when it had no fix.
  if (latitude === 0 && longitude === 0) return undefined;
  let altitude = num(raw.GPSAltitude);
  if (altitude !== undefined && Number(raw.GPSAltitudeRef) === 1) altitude = -altitude;
  const direction = num(raw.GPSImgDirection);
  const round = (n, d) => Math.round(n * 10 ** d) / 10 ** d;
  return compact({
    latitude: round(latitude, 7),
    longitude: round(longitude, 7),
    altitude: altitude === undefined ? undefined : round(altitude, 1),
    direction: direction === undefined ? undefined : round(direction, 1),
  });
}

// ExifReader's expanded output ({ exif, gps, xmp, iptc, file, png, riff, … },
// each tag { value, description }) → one flat object of plain values, keyed
// by EXIF names, which normalizeMetadata reads.
const IPTC_KEYS = {
  'By-line': 'Byline', 'Copyright Notice': 'CopyrightNotice', 'Caption/Abstract': 'Caption',
  'Object Name': 'ObjectName', Keywords: 'Keywords',
};
const SIZE_KEYS = { 'Image Width': 'ImageWidth', 'Image Height': 'ImageHeight' };

function plainValue(tag, group) {
  if (!tag || typeof tag !== 'object') return undefined;
  // XMP: the description is the readable text (also for lists and lang-alt).
  if (group === 'xmp') return typeof tag.description === 'string' ? tag.description : undefined;
  const v = tag.value;
  if (typeof v === 'number' || typeof v === 'string') return v;
  if (Array.isArray(v)) {
    if (v.length === 2 && v.every((x) => typeof x === 'number') && group === 'exif' && Array.isArray(tag.value)) {
      return v[1] ? v[0] / v[1] : undefined; // a rational
    }
    if (v.every((x) => typeof x === 'string')) return v.join(', ');
    if (v.length === 1 && typeof v[0] === 'number') return v[0];
    if (Array.isArray(v[0]) && v[0].length === 2 && typeof v[0][0] === 'number') {
      return v[0][1] ? v[0][0] / v[0][1] : undefined; // a list of rationals: the first
    }
  }
  return typeof tag.description === 'string' || typeof tag.description === 'number' ? tag.description : undefined;
}

function flattenTags(tags) {
  if (!tags || typeof tags !== 'object') return null;
  const raw = {};
  for (const group of ['exif', 'iptc', 'xmp', 'file', 'png', 'pngFile', 'riff']) {
    for (const [key, tag] of Object.entries(tags[group] || {})) {
      const name = (group === 'iptc' && IPTC_KEYS[key]) || SIZE_KEYS[key] || key;
      if (raw[name] !== undefined) continue;
      const value = plainValue(tag, group);
      if (value !== undefined && value !== '') raw[name] = value;
    }
  }
  // ExifReader works out the signed coordinates and altitude itself.
  const gpsGroup = tags.gps || {};
  if (gpsGroup.Latitude != null) raw.latitude = gpsGroup.Latitude;
  if (gpsGroup.Longitude != null) raw.longitude = gpsGroup.Longitude;
  if (gpsGroup.Altitude != null) { raw.GPSAltitude = gpsGroup.Altitude; delete raw.GPSAltitudeRef; }
  return raw;
}

// raw: flattenTags' output (dates stay as written in the file).
function normalizeMetadata(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const camera = compact({
    make: text(raw.Make, 100),
    model: text(raw.Model, 100),
    lens: text(raw.LensModel ?? raw.Lens, 120),
    software: text(raw.Software ?? raw.CreatorTool, 120),
    body_serial: text(raw.BodySerialNumber ?? raw.SerialNumber ?? raw.CameraSerialNumber, 80),
    lens_serial: text(raw.LensSerialNumber, 80),
  });
  const width = num(raw.ExifImageWidth ?? raw.ImageWidth ?? raw.PixelXDimension);
  const height = num(raw.ExifImageHeight ?? raw.ImageHeight ?? raw.PixelYDimension);
  const orientation = num(raw.Orientation);
  const result = compact({
    camera,
    taken_at: takenAt(raw),
    gps: gps(raw),
    image: compact({
      width: width && width > 0 ? Math.round(width) : undefined,
      height: height && height > 0 ? Math.round(height) : undefined,
      orientation: orientation >= 1 && orientation <= 8 ? orientation : undefined,
    }),
    people: compact({
      artist: text(raw.Artist ?? raw.Byline, 120),
      creator: text(raw.creator, 120),
      copyright: text(raw.Copyright ?? raw.rights ?? raw.CopyrightNotice, 200),
    }),
    text: compact({
      title: text(raw.title ?? raw.ObjectName ?? raw.XPTitle, 200),
      description: text(raw.ImageDescription ?? raw.description ?? raw.Caption, 500),
      keywords: text(raw.subject ?? raw.Keywords, 300),
    }),
  });
  const identifying = ['body_serial', 'lens_serial'].filter((k) => camera[k]).map((k) => `camera.${k}`);
  if (identifying.length) result.identifying = identifying;
  return Object.keys(result).length ? result : null;
}

module.exports = { isReadable, flattenTags, normalizeMetadata };
