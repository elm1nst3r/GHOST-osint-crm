import { createElementObject, createTileLayerComponent, updateGridLayer, withPane } from '@react-leaflet/core';
import { TileLayer as LeafletTileLayer } from 'leaflet';
export const TileLayer = createTileLayerComponent(function createTileLayer({ url , ...options }, context) {
    const layer = new LeafletTileLayer(url, withPane(options, context));
    return createElementObject(layer, context);
}, function updateTileLayer(layer, props, prevProps) {
    updateGridLayer(layer, props, prevProps);
    const { url  } = props;
    if (url != null && url !== prevProps.url) {
        layer.setUrl(url);
    }
});
