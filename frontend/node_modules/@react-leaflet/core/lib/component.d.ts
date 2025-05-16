import React, { type MutableRefObject, type ReactNode } from 'react';
import type { DivOverlay, DivOverlayHook } from './div-overlay.js';
import type { LeafletElement } from './element.js';
declare type ElementHook<E, P> = (props: P) => MutableRefObject<LeafletElement<E>>;
export declare type PropsWithChildren = {
    children?: ReactNode;
};
export declare function createContainerComponent<E, P extends PropsWithChildren>(useElement: ElementHook<E, P>): React.ForwardRefExoticComponent<React.PropsWithoutRef<P> & React.RefAttributes<E>>;
export declare function createDivOverlayComponent<E extends DivOverlay, P extends PropsWithChildren>(useElement: ReturnType<DivOverlayHook<E, P>>): React.ForwardRefExoticComponent<React.PropsWithoutRef<P> & React.RefAttributes<E>>;
export declare function createLeafComponent<E, P>(useElement: ElementHook<E, P>): React.ForwardRefExoticComponent<React.PropsWithoutRef<P> & React.RefAttributes<E>>;
export {};
