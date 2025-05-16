import type { LeafletEventHandlerFnMap, Map } from 'leaflet';
export declare function useMap(): Map;
export declare function useMapEvent<T extends keyof LeafletEventHandlerFnMap>(type: T, handler: LeafletEventHandlerFnMap[T]): Map;
export declare function useMapEvents(handlers: LeafletEventHandlerFnMap): Map;
