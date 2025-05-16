import { LeafletProvider, createContainerComponent, createControlHook, createElementHook, createElementObject, extendContext, useLeafletContext } from '@react-leaflet/core';
import { Control } from 'leaflet';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
export const useLayersControlElement = createElementHook(function createLayersControl({ children: _c , ...options }, ctx) {
    const control = new Control.Layers(undefined, undefined, options);
    return createElementObject(control, extendContext(ctx, {
        layersControl: control
    }));
}, function updateLayersControl(control, props, prevProps) {
    if (props.collapsed !== prevProps.collapsed) {
        if (props.collapsed === true) {
            control.collapse();
        } else {
            control.expand();
        }
    }
});
export const useLayersControl = createControlHook(useLayersControlElement);
// @ts-ignore
export const LayersControl = createContainerComponent(useLayersControl);
export function createControlledLayer(addLayerToControl) {
    return function ControlledLayer(props) {
        const parentContext = useLeafletContext();
        const propsRef = useRef(props);
        const [layer, setLayer] = useState(null);
        const { layersControl , map  } = parentContext;
        const addLayer = useCallback((layerToAdd)=>{
            if (layersControl != null) {
                if (propsRef.current.checked) {
                    map.addLayer(layerToAdd);
                }
                addLayerToControl(layersControl, layerToAdd, propsRef.current.name);
                setLayer(layerToAdd);
            }
        }, [
            layersControl,
            map
        ]);
        const removeLayer = useCallback((layerToRemove)=>{
            layersControl?.removeLayer(layerToRemove);
            setLayer(null);
        }, [
            layersControl
        ]);
        const context = useMemo(()=>{
            return extendContext(parentContext, {
                layerContainer: {
                    addLayer,
                    removeLayer
                }
            });
        }, [
            parentContext,
            addLayer,
            removeLayer
        ]);
        useEffect(()=>{
            if (layer !== null && propsRef.current !== props) {
                if (props.checked === true && (propsRef.current.checked == null || propsRef.current.checked === false)) {
                    map.addLayer(layer);
                } else if (propsRef.current.checked === true && (props.checked == null || props.checked === false)) {
                    map.removeLayer(layer);
                }
                propsRef.current = props;
            }
        });
        return props.children ? /*#__PURE__*/ React.createElement(LeafletProvider, {
            value: context
        }, props.children) : null;
    };
}
LayersControl.BaseLayer = createControlledLayer(function addBaseLayer(layersControl, layer, name) {
    layersControl.addBaseLayer(layer, name);
});
LayersControl.Overlay = createControlledLayer(function addOverlay(layersControl, layer, name) {
    layersControl.addOverlay(layer, name);
});
