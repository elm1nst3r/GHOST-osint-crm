import { type LatLngBoundsExpression, type ImageOverlay as LeafletImageOverlay, type ImageOverlayOptions, type SVGOverlay as LeafletSVGOverlay, type VideoOverlay as LeafletVideoOverlay } from 'leaflet';
import type { InteractiveLayerProps } from './layer.js';
export interface MediaOverlayProps extends ImageOverlayOptions, InteractiveLayerProps {
    bounds: LatLngBoundsExpression;
}
export declare function updateMediaOverlay<E extends LeafletImageOverlay | LeafletSVGOverlay | LeafletVideoOverlay, P extends MediaOverlayProps>(overlay: E, props: P, prevProps: P): void;
