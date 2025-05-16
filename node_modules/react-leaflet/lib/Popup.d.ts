import { type EventedProps } from '@react-leaflet/core';
import { type LatLngExpression, Popup as LeafletPopup, type PopupOptions } from 'leaflet';
import { type ReactNode } from 'react';
export interface PopupProps extends PopupOptions, EventedProps {
    children?: ReactNode;
    position?: LatLngExpression;
}
export declare const Popup: import("react").ForwardRefExoticComponent<PopupProps & import("react").RefAttributes<LeafletPopup>>;
