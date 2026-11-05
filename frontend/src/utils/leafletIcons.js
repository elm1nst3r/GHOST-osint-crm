// Leaflet's default marker images, bundled with the app.
//
// Leaflet works out its image path from the CSS at runtime, which breaks
// under a bundler, so the URLs are set here. They used to point at cdnjs,
// which told a third party each time an investigator opened a map. Import
// this module once, for its side effect, wherever a map renders.
import L from 'leaflet';
import iconRetinaUrl from 'leaflet/dist/images/marker-icon-2x.png';
import iconUrl from 'leaflet/dist/images/marker-icon.png';
import shadowUrl from 'leaflet/dist/images/marker-shadow.png';

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({ iconRetinaUrl, iconUrl, shadowUrl });
