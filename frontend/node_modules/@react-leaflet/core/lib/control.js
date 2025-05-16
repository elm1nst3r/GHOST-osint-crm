import { useEffect, useRef } from 'react';
import { useLeafletContext } from './context.js';
export function createControlHook(useElement) {
    return function useLeafletControl(props) {
        const context = useLeafletContext();
        const elementRef = useElement(props, context);
        const { instance  } = elementRef.current;
        const positionRef = useRef(props.position);
        const { position  } = props;
        useEffect(function addControl() {
            instance.addTo(context.map);
            return function removeControl() {
                instance.remove();
            };
        }, [
            context.map,
            instance
        ]);
        useEffect(function updateControl() {
            if (position != null && position !== positionRef.current) {
                instance.setPosition(position);
                positionRef.current = position;
            }
        }, [
            instance,
            position
        ]);
        return elementRef;
    };
}
