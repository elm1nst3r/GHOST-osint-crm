import { type PathProps } from '@react-leaflet/core';
import { type LatLngExpression, Polyline as LeafletPolyline, type PolylineOptions } from 'leaflet';
import type { ReactNode } from 'react';
export interface PolylineProps extends PolylineOptions, PathProps {
    children?: ReactNode;
    positions: LatLngExpression[] | LatLngExpression[][];
}
export declare const Polyline: import("react").ForwardRefExoticComponent<PolylineProps & import("react").RefAttributes<LeafletPolyline<import("geojson").LineString | import("geojson").MultiLineString, any>>>;
