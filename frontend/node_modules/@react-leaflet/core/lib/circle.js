export function updateCircle(layer, props, prevProps) {
    if (props.center !== prevProps.center) {
        layer.setLatLng(props.center);
    }
    if (props.radius != null && props.radius !== prevProps.radius) {
        layer.setRadius(props.radius);
    }
}
