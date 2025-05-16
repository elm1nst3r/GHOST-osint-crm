import { createElementHook, createElementObject, createLayerHook, updateMediaOverlay } from '@react-leaflet/core';
import { SVGOverlay as LeafletSVGOverlay } from 'leaflet';
import { forwardRef, useImperativeHandle } from 'react';
import { createPortal } from 'react-dom';
export const useSVGOverlayElement = createElementHook(function createSVGOverlay(props, context) {
    const { attributes , bounds , ...options } = props;
    const container = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    container.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    if (attributes != null) {
        Object.keys(attributes).forEach((name)=>{
            container.setAttribute(name, attributes[name]);
        });
    }
    const overlay = new LeafletSVGOverlay(container, bounds, options);
    return createElementObject(overlay, context, container);
}, updateMediaOverlay);
export const useSVGOverlay = createLayerHook(useSVGOverlayElement);
function SVGOverlayComponent({ children , ...options }, forwardedRef) {
    const { instance , container  } = useSVGOverlay(options).current;
    useImperativeHandle(forwardedRef, ()=>instance);
    return container == null || children == null ? null : /*#__PURE__*/ createPortal(children, container);
}
export const SVGOverlay = /*#__PURE__*/ forwardRef(SVGOverlayComponent);
