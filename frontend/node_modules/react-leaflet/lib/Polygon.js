import { createElementObject, createPathComponent, extendContext } from '@react-leaflet/core';
import { Polygon as LeafletPolygon } from 'leaflet';
export const Polygon = createPathComponent(function createPolygon({ positions , ...options }, ctx) {
    const polygon = new LeafletPolygon(positions, options);
    return createElementObject(polygon, extendContext(ctx, {
        overlayContainer: polygon
    }));
}, function updatePolygon(layer, props, prevProps) {
    if (props.positions !== prevProps.positions) {
        layer.setLatLngs(props.positions);
    }
});
