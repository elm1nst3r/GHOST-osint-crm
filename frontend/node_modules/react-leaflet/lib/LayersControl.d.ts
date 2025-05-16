import { Control, type Layer } from 'leaflet';
import React, { type ForwardRefExoticComponent, type FunctionComponent, type ReactNode, type RefAttributes } from 'react';
export interface LayersControlProps extends Control.LayersOptions {
    children?: ReactNode;
}
export declare const useLayersControlElement: (props: LayersControlProps, context: Readonly<{
    __version: number;
    map: import("leaflet").Map;
    layerContainer?: import("leaflet").LayerGroup<any> | import("@react-leaflet/core/lib/context").ControlledLayer | undefined;
    layersControl?: Control.Layers | undefined;
    overlayContainer?: Layer | undefined;
    pane?: string | undefined;
}>) => React.MutableRefObject<Readonly<{
    instance: Control.Layers;
    context: Readonly<{
        __version: number;
        map: import("leaflet").Map;
        layerContainer?: import("leaflet").LayerGroup<any> | import("@react-leaflet/core/lib/context").ControlledLayer | undefined;
        layersControl?: Control.Layers | undefined;
        overlayContainer?: Layer | undefined;
        pane?: string | undefined;
    }>;
    container?: any;
}>>;
export declare const useLayersControl: (props: LayersControlProps) => React.MutableRefObject<Readonly<{
    instance: Control.Layers;
    context: Readonly<{
        __version: number;
        map: import("leaflet").Map;
        layerContainer?: import("leaflet").LayerGroup<any> | import("@react-leaflet/core/lib/context").ControlledLayer | undefined;
        layersControl?: Control.Layers | undefined;
        overlayContainer?: Layer | undefined;
        pane?: string | undefined;
    }>;
    container?: any;
}>>;
export interface ControlledLayerProps {
    checked?: boolean;
    children: ReactNode;
    name: string;
}
export declare const LayersControl: ForwardRefExoticComponent<LayersControlProps & RefAttributes<Control.Layers>> & {
    BaseLayer: FunctionComponent<ControlledLayerProps>;
    Overlay: FunctionComponent<ControlledLayerProps>;
};
type AddLayerFunc = (layersControl: Control.Layers, layer: Layer, name: string) => void;
export declare function createControlledLayer(addLayerToControl: AddLayerFunc): (props: ControlledLayerProps) => JSX.Element | null;
export {};
