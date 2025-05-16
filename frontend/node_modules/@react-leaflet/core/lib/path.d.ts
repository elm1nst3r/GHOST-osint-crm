import type { FeatureGroup, Path, PathOptions } from 'leaflet';
import type { LeafletElement, ElementHook } from './element.js';
import { type InteractiveLayerProps } from './layer.js';
export interface PathProps extends InteractiveLayerProps {
    pathOptions?: PathOptions;
}
export declare function usePathOptions(element: LeafletElement<FeatureGroup | Path>, props: PathProps): void;
export declare function createPathHook<E extends FeatureGroup | Path, P extends PathProps>(useElement: ElementHook<E, P>): (props: P) => ReturnType<ElementHook<E, P>>;
