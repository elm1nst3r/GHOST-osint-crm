import { type FitBoundsOptions, type LatLngBoundsExpression, Map as LeafletMap, type MapOptions } from 'leaflet';
import React, { type CSSProperties, type ReactNode } from 'react';
export interface MapContainerProps extends MapOptions {
    bounds?: LatLngBoundsExpression;
    boundsOptions?: FitBoundsOptions;
    children?: ReactNode;
    className?: string;
    id?: string;
    placeholder?: ReactNode;
    style?: CSSProperties;
    whenReady?: () => void;
}
export declare const MapContainer: React.ForwardRefExoticComponent<MapContainerProps & React.RefAttributes<LeafletMap>>;
