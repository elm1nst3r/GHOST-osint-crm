// Photo metadata (file-metadata plan): reading files.metadata for display.
// The backend writes it (backend/utils/fileMetadata.js describes the shape).

// "2024-09-22T14:03:22+12:00" → { date: '2024-09-22', time: '14:03', offset: '+12:00' }.
// The time is the camera's clock where the photo was taken, so it's shown as
// written, never converted to the viewer's time zone. offset is null when the
// photo doesn't record one.
export function takenAtParts(takenAt) {
  const m = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})(?::\d{2})?(?:\.\d+)?(Z|[+-]\d{2}:\d{2})?$/.exec(String(takenAt || ''));
  if (!m) return null;
  return { date: m[1], time: m[2], offset: m[3] === 'Z' ? '+00:00' : (m[3] || null) };
}

export const hasLocation = (file) =>
  Number.isFinite(file?.metadata?.gps?.latitude) && Number.isFinite(file?.metadata?.gps?.longitude);

export const coordinates = (gps, digits = 6) =>
  `${Number(gps.latitude).toFixed(digits)}, ${Number(gps.longitude).toFixed(digits)}`;

// Compass point for a direction in degrees (0 = north), e.g. 123.4 → 'SE'.
const POINTS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
export const compassPoint = (deg) => POINTS[Math.round((((Number(deg) % 360) + 360) % 360) / 45) % 8];

// The rows of the metadata panel, in order: [{ key, value, identifying? }].
// `key` is the i18n key under photoMeta.fields; empty values are left out.
export function metadataRows(metadata) {
  if (!metadata) return [];
  const { camera = {}, image = {}, people = {}, text = {} } = metadata;
  const identifying = new Set(metadata.identifying || []);
  const rows = [
    ['camera', [camera.make, camera.model].filter(Boolean).join(' ')],
    ['lens', camera.lens],
    ['software', camera.software],
    ['bodySerial', camera.body_serial, identifying.has('camera.body_serial')],
    ['lensSerial', camera.lens_serial, identifying.has('camera.lens_serial')],
    ['size', image.width && image.height ? `${image.width} × ${image.height}` : null],
    ['artist', people.artist],
    ['creator', people.creator],
    ['copyright', people.copyright],
    ['title', text.title],
    ['description', text.description],
    ['keywords', text.keywords],
  ];
  return rows
    .filter(([, value]) => value != null && value !== '')
    .map(([key, value, flag]) => (flag ? { key, value, identifying: true } : { key, value }));
}

// The location added to a person from a photo's GPS position.
export const locationFromPhoto = (file, { label, notes }) => ({
  type: 'other',
  label,
  notes,
  latitude: file.metadata.gps.latitude,
  longitude: file.metadata.gps.longitude,
});
