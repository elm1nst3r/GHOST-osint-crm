import { LatLngBounds } from 'leaflet';
export function updateMediaOverlay(overlay, props, prevProps) {
    if (props.bounds instanceof LatLngBounds && props.bounds !== prevProps.bounds) {
        overlay.setBounds(props.bounds);
    }
    if (props.opacity != null && props.opacity !== prevProps.opacity) {
        overlay.setOpacity(props.opacity);
    }
    if (props.zIndex != null && props.zIndex !== prevProps.zIndex) {
        // @ts-ignore missing in definition but inherited from ImageOverlay
        overlay.setZIndex(props.zIndex);
    }
}
