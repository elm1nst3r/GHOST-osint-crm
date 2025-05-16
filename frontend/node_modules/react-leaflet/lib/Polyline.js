import { createElementObject, createPathComponent, extendContext } from '@react-leaflet/core';
import { Polyline as LeafletPolyline } from 'leaflet';
export const Polyline = createPathComponent(function createPolyline({ positions , ...options }, ctx) {
    const polyline = new LeafletPolyline(positions, options);
    return createElementObject(polyline, extendContext(ctx, {
        overlayContainer: polyline
    }));
}, function updatePolyline(layer, props, prevProps) {
    if (props.positions !== prevProps.positions) {
        layer.setLatLngs(props.positions);
    }
});
