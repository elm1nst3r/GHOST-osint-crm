import { createElementObject, createPathComponent, extendContext, updateCircle } from '@react-leaflet/core';
import { CircleMarker as LeafletCircleMarker } from 'leaflet';
export const CircleMarker = createPathComponent(function createCircleMarker({ center , children: _c , ...options }, ctx) {
    const marker = new LeafletCircleMarker(center, options);
    return createElementObject(marker, extendContext(ctx, {
        overlayContainer: marker
    }));
}, updateCircle);
