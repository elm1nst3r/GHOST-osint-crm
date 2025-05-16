import { useEffect, useRef } from 'react';
import { useLeafletContext } from './context.js';
import { useEventHandlers } from './events.js';
import { useLayerLifecycle } from './layer.js';
import { withPane } from './pane.js';
export function usePathOptions(element, props) {
    const optionsRef = useRef();
    useEffect(function updatePathOptions() {
        if (props.pathOptions !== optionsRef.current) {
            const options = props.pathOptions ?? {};
            element.instance.setStyle(options);
            optionsRef.current = options;
        }
    }, [
        element,
        props
    ]);
}
export function createPathHook(useElement) {
    return function usePath(props) {
        const context = useLeafletContext();
        const elementRef = useElement(withPane(props, context), context);
        useEventHandlers(elementRef.current, props.eventHandlers);
        useLayerLifecycle(elementRef.current, context);
        usePathOptions(elementRef.current, props);
        return elementRef;
    };
}
