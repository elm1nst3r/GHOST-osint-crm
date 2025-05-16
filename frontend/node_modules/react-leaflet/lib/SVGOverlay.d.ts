import { type MediaOverlayProps } from '@react-leaflet/core';
import { SVGOverlay as LeafletSVGOverlay } from 'leaflet';
import { type ReactNode } from 'react';
export interface SVGOverlayProps extends MediaOverlayProps {
    attributes?: Record<string, string>;
    children?: ReactNode;
}
export declare const useSVGOverlayElement: (props: SVGOverlayProps, context: Readonly<{
    __version: number;
    map: import("leaflet").Map;
    layerContainer?: import("leaflet").LayerGroup<any> | import("@react-leaflet/core/lib/context").ControlledLayer | undefined;
    layersControl?: import("leaflet").Control.Layers | undefined;
    overlayContainer?: import("leaflet").Layer | undefined;
    pane?: string | undefined;
}>) => import("react").MutableRefObject<Readonly<{
    instance: LeafletSVGOverlay;
    context: Readonly<{
        __version: number;
        map: import("leaflet").Map;
        layerContainer?: import("leaflet").LayerGroup<any> | import("@react-leaflet/core/lib/context").ControlledLayer | undefined;
        layersControl?: import("leaflet").Control.Layers | undefined;
        overlayContainer?: import("leaflet").Layer | undefined;
        pane?: string | undefined;
    }>;
    container?: any;
}>>;
export declare const useSVGOverlay: (props: SVGOverlayProps) => import("react").MutableRefObject<Readonly<{
    instance: LeafletSVGOverlay;
    context: Readonly<{
        __version: number;
        map: import("leaflet").Map;
        layerContainer?: import("leaflet").LayerGroup<any> | import("@react-leaflet/core/lib/context").ControlledLayer | undefined;
        layersControl?: import("leaflet").Control.Layers | undefined;
        overlayContainer?: import("leaflet").Layer | undefined;
        pane?: string | undefined;
    }>;
    container?: any;
}>>;
export declare const SVGOverlay: import("react").ForwardRefExoticComponent<SVGOverlayProps & import("react").RefAttributes<LeafletSVGOverlay>>;
