import { createContainerComponent, createDivOverlayComponent, createLeafComponent } from './component.js';
import { createControlHook } from './control.js';
import { createElementHook, createElementObject } from './element.js';
import { createLayerHook } from './layer.js';
import { createDivOverlayHook } from './div-overlay.js';
import { createPathHook } from './path.js';
export function createControlComponent(createInstance) {
    function createElement(props, context) {
        return createElementObject(createInstance(props), context);
    }
    const useElement = createElementHook(createElement);
    const useControl = createControlHook(useElement);
    return createLeafComponent(useControl);
}
export function createLayerComponent(createElement, updateElement) {
    const useElement = createElementHook(createElement, updateElement);
    const useLayer = createLayerHook(useElement);
    return createContainerComponent(useLayer);
}
export function createOverlayComponent(createElement, useLifecycle) {
    const useElement = createElementHook(createElement);
    const useOverlay = createDivOverlayHook(useElement, useLifecycle);
    return createDivOverlayComponent(useOverlay);
}
export function createPathComponent(createElement, updateElement) {
    const useElement = createElementHook(createElement, updateElement);
    const usePath = createPathHook(useElement);
    return createContainerComponent(usePath);
}
export function createTileLayerComponent(createElement, updateElement) {
    const useElement = createElementHook(createElement, updateElement);
    const useLayer = createLayerHook(useElement);
    return createLeafComponent(useLayer);
}
