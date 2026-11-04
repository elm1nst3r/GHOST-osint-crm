export const OSM_TILE_URL = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
// The app sends no Referer anywhere (nginx Referrer-Policy: no-referrer),
// but OpenStreetMap's tile usage policy asks for one, so tile requests send
// the origin only: the server address, never the page path.
export const OSM_TILE_REFERRER_POLICY = 'strict-origin-when-cross-origin';
export const OSM_ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';
