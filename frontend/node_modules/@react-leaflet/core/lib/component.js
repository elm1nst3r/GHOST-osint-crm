import React, { forwardRef, useEffect, useImperativeHandle, useState } from 'react';
import { createPortal } from 'react-dom';
import { LeafletProvider } from './context.js';
export function createContainerComponent(useElement) {
    function ContainerComponent(props, forwardedRef) {
        const { instance , context  } = useElement(props).current;
        useImperativeHandle(forwardedRef, ()=>instance);
        return props.children == null ? null : /*#__PURE__*/ React.createElement(LeafletProvider, {
            value: context
        }, props.children);
    }
    return /*#__PURE__*/ forwardRef(ContainerComponent);
}
export function createDivOverlayComponent(useElement) {
    function OverlayComponent(props, forwardedRef) {
        const [isOpen, setOpen] = useState(false);
        const { instance  } = useElement(props, setOpen).current;
        useImperativeHandle(forwardedRef, ()=>instance);
        useEffect(function updateOverlay() {
            if (isOpen) {
                instance.update();
            }
        }, [
            instance,
            isOpen,
            props.children
        ]);
        // @ts-ignore _contentNode missing in type definition
        const contentNode = instance._contentNode;
        return contentNode ? /*#__PURE__*/ createPortal(props.children, contentNode) : null;
    }
    return /*#__PURE__*/ forwardRef(OverlayComponent);
}
export function createLeafComponent(useElement) {
    function LeafComponent(props, forwardedRef) {
        const { instance  } = useElement(props).current;
        useImperativeHandle(forwardedRef, ()=>instance);
        return null;
    }
    return /*#__PURE__*/ forwardRef(LeafComponent);
}
