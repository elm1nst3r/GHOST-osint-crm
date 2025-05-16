import { type MediaOverlayProps } from '@react-leaflet/core';
import { VideoOverlay as LeafletVideoOverlay, type VideoOverlayOptions } from 'leaflet';
import type { ReactNode } from 'react';
export interface VideoOverlayProps extends MediaOverlayProps, VideoOverlayOptions {
    children?: ReactNode;
    play?: boolean;
    url: string | string[] | HTMLVideoElement;
}
export declare const VideoOverlay: import("react").ForwardRefExoticComponent<VideoOverlayProps & import("react").RefAttributes<LeafletVideoOverlay>>;
