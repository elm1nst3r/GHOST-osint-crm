// A small map with the spot a photo was taken (file-metadata plan). Loaded
// lazily, so Leaflet only arrives when a photo with a position is opened.
import { MapContainer, TileLayer, Marker } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import '../../utils/leafletIcons';
import { OSM_TILE_URL, OSM_ATTRIBUTION, OSM_TILE_REFERRER_POLICY } from '../../utils/mapConstants';

const PhotoMap = ({ latitude, longitude, height = 180 }) => (
  <div style={{ height }} className="rounded-md overflow-hidden border border-gray-200 dark:border-gray-600 isolate">
    <MapContainer center={[latitude, longitude]} zoom={14} style={{ height: '100%', width: '100%' }} scrollWheelZoom={false}>
      <TileLayer attribution={OSM_ATTRIBUTION} url={OSM_TILE_URL} referrerPolicy={OSM_TILE_REFERRER_POLICY} />
      <Marker position={[latitude, longitude]} />
    </MapContainer>
  </div>
);

export default PhotoMap;
