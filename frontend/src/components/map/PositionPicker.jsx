// A small map for setting an address's position by hand (issue #110): click
// the map or drag the pin. Loaded lazily, so Leaflet only arrives when used.
import { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, useMap, useMapEvents } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import '../../utils/leafletIcons';
import { OSM_TILE_URL, OSM_ATTRIBUTION, OSM_TILE_REFERRER_POLICY } from '../../utils/mapConstants';

const round = (n) => Math.round(n * 1e6) / 1e6;

function ClickToSet({ onPick }) {
  useMapEvents({ click: (e) => onPick(round(e.latlng.lat), round(e.latlng.lng)) });
  return null;
}

// Follow a position set from outside (typed, or found by a lookup).
function FollowPosition({ position }) {
  const map = useMap();
  const [lat, lng] = position || [];
  useEffect(() => {
    if (lat === undefined) return;
    map.setView([lat, lng], Math.max(map.getZoom(), 14));
  }, [map, lat, lng]);
  return null;
}

const PositionPicker = ({ position, onPick, height = 240 }) => (
  <div style={{ height }} className="rounded-md overflow-hidden border dark:border-gray-600 isolate">
    <MapContainer center={position || [20, 0]} zoom={position ? 14 : 2} style={{ height: '100%', width: '100%' }} scrollWheelZoom>
      <TileLayer attribution={OSM_ATTRIBUTION} url={OSM_TILE_URL} referrerPolicy={OSM_TILE_REFERRER_POLICY} />
      <ClickToSet onPick={onPick} />
      <FollowPosition position={position} />
      {position && (
        <Marker
          position={position}
          draggable
          eventHandlers={{ dragend: (e) => { const p = e.target.getLatLng(); onPick(round(p.lat), round(p.lng)); } }}
        />
      )}
    </MapContainer>
  </div>
);

export default PositionPicker;
