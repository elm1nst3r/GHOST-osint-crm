import type { Popup, Tooltip } from 'leaflet';
import { type LeafletContextInterface } from './context.js';
import type { LeafletElement, ElementHook } from './element.js';
import type { LayerProps } from './layer.js';
export declare type DivOverlay = Popup | Tooltip;
export declare type SetOpenFunc = (open: boolean) => void;
export declare type DivOverlayLifecycleHook<E, P> = (element: LeafletElement<E>, context: LeafletContextInterface, props: P, setOpen: SetOpenFunc) => void;
export declare type DivOverlayHook<E extends DivOverlay, P> = (useElement: ElementHook<E, P>, useLifecycle: DivOverlayLifecycleHook<E, P>) => (props: P, setOpen: SetOpenFunc) => ReturnType<ElementHook<E, P>>;
export declare function createDivOverlayHook<E extends DivOverlay, P extends LayerProps>(useElement: ElementHook<E, P>, useLifecycle: DivOverlayLifecycleHook<E, P>): (props: P, setOpen: SetOpenFunc) => ReturnType<ElementHook<E, P>>;
