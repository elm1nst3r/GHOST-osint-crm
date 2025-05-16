import { createElementObject, createLayerComponent, extendContext } from '@react-leaflet/core';
import { LayerGroup as LeafletLayerGroup } from 'leaflet';
export const LayerGroup = createLayerComponent(function createLayerGroup({ children: _c , ...options }, ctx) {
    const group = new LeafletLayerGroup([], options);
    return createElementObject(group, extendContext(ctx, {
        layerContainer: group
    }));
});
