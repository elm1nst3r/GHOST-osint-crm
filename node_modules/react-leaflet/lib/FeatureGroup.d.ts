/// <reference types="react" />
import { type PathProps } from '@react-leaflet/core';
import { FeatureGroup as LeafletFeatureGroup } from 'leaflet';
import type { LayerGroupProps } from './LayerGroup.js';
export interface FeatureGroupProps extends LayerGroupProps, PathProps {
}
export declare const FeatureGroup: import("react").ForwardRefExoticComponent<FeatureGroupProps & import("react").RefAttributes<LeafletFeatureGroup<any>>>;
