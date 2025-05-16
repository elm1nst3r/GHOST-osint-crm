import { createElementObject, createPathComponent, extendContext } from '@react-leaflet/core';
import { GeoJSON as LeafletGeoJSON } from 'leaflet';
export const GeoJSON = createPathComponent(function createGeoJSON({ data , ...options }, ctx) {
    const geoJSON = new LeafletGeoJSON(data, options);
    return createElementObject(geoJSON, extendContext(ctx, {
        overlayContainer: geoJSON
    }));
}, function updateGeoJSON(layer, props, prevProps) {
    if (props.style !== prevProps.style) {
        if (props.style == null) {
            layer.resetStyle();
        } else {
            layer.setStyle(props.style);
        }
    }
});
