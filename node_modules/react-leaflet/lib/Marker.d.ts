import { type EventedProps } from '@react-leaflet/core';
import { type LatLngExpression, Marker as LeafletMarker, type MarkerOptions } from 'leaflet';
import type { ReactNode } from 'react';
export interface MarkerProps extends MarkerOptions, EventedProps {
    children?: ReactNode;
    position: LatLngExpression;
}
export declare const Marker: import("react").ForwardRefExoticComponent<MarkerProps & import("react").RefAttributes<LeafletMarker<any>>>;
