import { Control, type ControlOptions } from 'leaflet';
import type { ElementHook } from './element.js';
export declare function createControlHook<E extends Control, P extends ControlOptions>(useElement: ElementHook<E, P>): (props: P) => ReturnType<ElementHook<E, P>>;
