import { useEffect } from 'react';
import { useAttribution } from './attribution.js';
import { useLeafletContext } from './context.js';
import { useEventHandlers } from './events.js';
import { withPane } from './pane.js';
export function useLayerLifecycle(element, context) {
    useEffect(function addLayer() {
        const container = context.layerContainer ?? context.map;
        container.addLayer(element.instance);
        return function removeLayer() {
            context.layerContainer?.removeLayer(element.instance);
            context.map.removeLayer(element.instance);
        };
    }, [
        context,
        element
    ]);
}
export function createLayerHook(useElement) {
    return function useLayer(props) {
        const context = useLeafletContext();
        const elementRef = useElement(withPane(props, context), context);
        useAttribution(context.map, props.attribution);
        useEventHandlers(elementRef.current, props.eventHandlers);
        useLayerLifecycle(elementRef.current, context);
        return elementRef;
    };
}
