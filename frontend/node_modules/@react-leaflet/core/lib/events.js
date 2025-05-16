import { useEffect, useRef } from 'react';
export function useEventHandlers(element, eventHandlers) {
    const eventHandlersRef = useRef();
    useEffect(function addEventHandlers() {
        if (eventHandlers != null) {
            element.instance.on(eventHandlers);
        }
        eventHandlersRef.current = eventHandlers;
        return function removeEventHandlers() {
            if (eventHandlersRef.current != null) {
                element.instance.off(eventHandlersRef.current);
            }
            eventHandlersRef.current = null;
        };
    }, [
        element,
        eventHandlers
    ]);
}
