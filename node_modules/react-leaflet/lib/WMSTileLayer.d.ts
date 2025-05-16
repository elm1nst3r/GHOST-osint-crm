/// <reference types="react" />
import { type LayerProps } from '@react-leaflet/core';
import { TileLayer, type WMSOptions, type WMSParams } from 'leaflet';
export interface WMSTileLayerProps extends WMSOptions, LayerProps {
    params?: WMSParams;
    url: string;
}
export declare const WMSTileLayer: import("react").ForwardRefExoticComponent<WMSTileLayerProps & import("react").RefAttributes<TileLayer.WMS>>;
