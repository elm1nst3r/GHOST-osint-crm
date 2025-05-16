/// <reference types="react" />
import type { Control, Layer, LayerGroup, Map } from 'leaflet';
export declare const CONTEXT_VERSION = 1;
export declare type ControlledLayer = {
    addLayer(layer: Layer): void;
    removeLayer(layer: Layer): void;
};
export declare type LeafletContextInterface = Readonly<{
    __version: number;
    map: Map;
    layerContainer?: ControlledLayer | LayerGroup;
    layersControl?: Control.Layers;
    overlayContainer?: Layer;
    pane?: string;
}>;
export declare function createLeafletContext(map: Map): LeafletContextInterface;
export declare function extendContext(source: LeafletContextInterface, extra: Partial<LeafletContextInterface>): LeafletContextInterface;
export declare const LeafletContext: import("react").Context<Readonly<{
    __version: number;
    map: Map;
    layerContainer?: LayerGroup<any> | ControlledLayer | undefined;
    layersControl?: Control.Layers | undefined;
    overlayContainer?: Layer | undefined;
    pane?: string | undefined;
}> | null>;
export declare const LeafletProvider: import("react").Provider<Readonly<{
    __version: number;
    map: Map;
    layerContainer?: LayerGroup<any> | ControlledLayer | undefined;
    layersControl?: Control.Layers | undefined;
    overlayContainer?: Layer | undefined;
    pane?: string | undefined;
}> | null>;
export declare function useLeafletContext(): LeafletContextInterface;
