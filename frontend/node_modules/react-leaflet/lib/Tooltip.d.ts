import { type EventedProps } from '@react-leaflet/core';
import { type LatLngExpression, Tooltip as LeafletTooltip, type TooltipOptions } from 'leaflet';
import { type ReactNode } from 'react';
export interface TooltipProps extends TooltipOptions, EventedProps {
    children?: ReactNode;
    position?: LatLngExpression;
}
export declare const Tooltip: import("react").ForwardRefExoticComponent<TooltipProps & import("react").RefAttributes<LeafletTooltip>>;
