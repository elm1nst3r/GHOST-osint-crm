import { useAttribution } from './attribution.js';
import { useLeafletContext } from './context.js';
import { useEventHandlers } from './events.js';
import { withPane } from './pane.js';
export function createDivOverlayHook(useElement, useLifecycle) {
    return function useDivOverlay(props, setOpen) {
        const context = useLeafletContext();
        const elementRef = useElement(withPane(props, context), context);
        useAttribution(context.map, props.attribution);
        useEventHandlers(elementRef.current, props.eventHandlers);
        useLifecycle(elementRef.current, context, props, setOpen);
        return elementRef;
    };
}
