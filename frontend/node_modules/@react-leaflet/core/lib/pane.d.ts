import type { LayerOptions } from 'leaflet';
import type { LeafletContextInterface } from './context.js';
export declare function withPane<P extends LayerOptions>(props: P, context: LeafletContextInterface): P;
