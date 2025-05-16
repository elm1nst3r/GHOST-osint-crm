import { LeafletProvider, addClassName, useLeafletContext } from '@react-leaflet/core';
import React, { forwardRef, useState, useEffect, useImperativeHandle, useMemo } from 'react';
import { createPortal } from 'react-dom';
const DEFAULT_PANES = [
    'mapPane',
    'markerPane',
    'overlayPane',
    'popupPane',
    'shadowPane',
    'tilePane',
    'tooltipPane'
];
function omitPane(obj, pane) {
    const { [pane]: _p , ...others } = obj;
    return others;
}
function createPane(name, props, context) {
    if (DEFAULT_PANES.indexOf(name) !== -1) {
        throw new Error(`You must use a unique name for a pane that is not a default Leaflet pane: ${name}`);
    }
    if (context.map.getPane(name) != null) {
        throw new Error(`A pane with this name already exists: ${name}`);
    }
    const parentPaneName = props.pane ?? context.pane;
    const parentPane = parentPaneName ? context.map.getPane(parentPaneName) : undefined;
    const element = context.map.createPane(name, parentPane);
    if (props.className != null) {
        addClassName(element, props.className);
    }
    if (props.style != null) {
        Object.keys(props.style).forEach((key)=>{
            // @ts-ignore
            element.style[key] = props.style[key];
        });
    }
    return element;
}
function PaneComponent(props, forwardedRef) {
    const [paneName] = useState(props.name);
    const [paneElement, setPaneElement] = useState(null);
    useImperativeHandle(forwardedRef, ()=>paneElement, [
        paneElement
    ]);
    const context = useLeafletContext();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    const newContext = useMemo(()=>({
            ...context,
            pane: paneName
        }), [
        context
    ]);
    useEffect(()=>{
        setPaneElement(createPane(paneName, props, context));
        return function removeCreatedPane() {
            const pane = context.map.getPane(paneName);
            pane?.remove?.();
            // @ts-ignore map internals
            if (context.map._panes != null) {
                // @ts-ignore map internals
                context.map._panes = omitPane(context.map._panes, paneName);
                // @ts-ignore map internals
                context.map._paneRenderers = omitPane(// @ts-ignore map internals
                context.map._paneRenderers, paneName);
            }
        };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    return props.children != null && paneElement != null ? /*#__PURE__*/ createPortal(/*#__PURE__*/ React.createElement(LeafletProvider, {
        value: newContext
    }, props.children), paneElement) : null;
}
export const Pane = /*#__PURE__*/ forwardRef(PaneComponent);
