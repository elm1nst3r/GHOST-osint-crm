import type { Evented, LeafletEventHandlerFnMap } from 'leaflet';
import type { LeafletElement } from './element.js';
export declare type EventedProps = {
    eventHandlers?: LeafletEventHandlerFnMap;
};
export declare function useEventHandlers(element: LeafletElement<Evented>, eventHandlers: LeafletEventHandlerFnMap | null | undefined): void;
