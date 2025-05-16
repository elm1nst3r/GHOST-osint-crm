import { useLeafletContext } from '@react-leaflet/core';
import { useEffect } from 'react';
export function useMap() {
    return useLeafletContext().map;
}
export function useMapEvent(type, handler) {
    const map = useMap();
    useEffect(function addMapEventHandler() {
        // @ts-ignore event type
        map.on(type, handler);
        return function removeMapEventHandler() {
            // @ts-ignore event type
            map.off(type, handler);
        };
    }, [
        map,
        type,
        handler
    ]);
    return map;
}
export function useMapEvents(handlers) {
    const map = useMap();
    useEffect(function addMapEventHandlers() {
        map.on(handlers);
        return function removeMapEventHandlers() {
            map.off(handlers);
        };
    }, [
        map,
        handlers
    ]);
    return map;
}
