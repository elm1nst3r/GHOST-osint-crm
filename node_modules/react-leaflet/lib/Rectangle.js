import { createElementObject, createPathComponent, extendContext } from '@react-leaflet/core';
import { Rectangle as LeafletRectangle } from 'leaflet';
export const Rectangle = createPathComponent(function createRectangle({ bounds , ...options }, ctx) {
    const rectangle = new LeafletRectangle(bounds, options);
    return createElementObject(rectangle, extendContext(ctx, {
        overlayContainer: rectangle
    }));
}, function updateRectangle(layer, props, prevProps) {
    if (props.bounds !== prevProps.bounds) {
        layer.setBounds(props.bounds);
    }
});
