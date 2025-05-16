import { useEffect, useRef } from 'react';
export function createElementObject(instance, context, container) {
    return Object.freeze({
        instance,
        context,
        container
    });
}
export function createElementHook(createElement, updateElement) {
    if (updateElement == null) {
        return function useImmutableLeafletElement(props, context) {
            const elementRef = useRef();
            if (!elementRef.current) elementRef.current = createElement(props, context);
            return elementRef;
        };
    }
    return function useMutableLeafletElement(props, context) {
        const elementRef = useRef();
        if (!elementRef.current) elementRef.current = createElement(props, context);
        const propsRef = useRef(props);
        const { instance  } = elementRef.current;
        useEffect(function updateElementProps() {
            if (propsRef.current !== props) {
                updateElement(instance, props, propsRef.current);
                propsRef.current = props;
            }
        }, [
            instance,
            props,
            context
        ]);
        return elementRef;
    };
}
