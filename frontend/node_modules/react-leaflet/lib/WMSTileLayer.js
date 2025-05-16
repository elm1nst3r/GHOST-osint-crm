import { createElementObject, createTileLayerComponent, updateGridLayer, withPane } from '@react-leaflet/core';
import { TileLayer } from 'leaflet';
export const WMSTileLayer = createTileLayerComponent(function createWMSTileLayer({ eventHandlers: _eh , params ={} , url , ...options }, context) {
    const layer = new TileLayer.WMS(url, {
        ...params,
        ...withPane(options, context)
    });
    return createElementObject(layer, context);
}, function updateWMSTileLayer(layer, props, prevProps) {
    updateGridLayer(layer, props, prevProps);
    if (props.params != null && props.params !== prevProps.params) {
        layer.setParams(props.params);
    }
});
