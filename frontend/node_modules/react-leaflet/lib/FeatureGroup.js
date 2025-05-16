import { createElementObject, createPathComponent, extendContext } from '@react-leaflet/core';
import { FeatureGroup as LeafletFeatureGroup } from 'leaflet';
export const FeatureGroup = createPathComponent(function createFeatureGroup({ children: _c , ...options }, ctx) {
    const group = new LeafletFeatureGroup([], options);
    return createElementObject(group, extendContext(ctx, {
        layerContainer: group,
        overlayContainer: group
    }));
});
