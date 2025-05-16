import type { InteractiveLayerOptions, Layer, LayerOptions } from 'leaflet';
import { type LeafletContextInterface } from './context.js';
import type { LeafletElement, ElementHook } from './element.js';
import { type EventedProps } from './events.js';
export interface LayerProps extends EventedProps, LayerOptions {
}
export interface InteractiveLayerProps extends LayerProps, InteractiveLayerOptions {
}
export declare function useLayerLifecycle(element: LeafletElement<Layer>, context: LeafletContextInterface): void;
export declare function createLayerHook<E extends Layer, P extends LayerProps>(useElement: ElementHook<E, P>): (props: P) => ReturnType<ElementHook<E, P>>;
