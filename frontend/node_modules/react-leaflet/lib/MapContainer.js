function _extends() {
    _extends = Object.assign || function(target) {
        for(var i = 1; i < arguments.length; i++){
            var source = arguments[i];
            for(var key in source){
                if (Object.prototype.hasOwnProperty.call(source, key)) {
                    target[key] = source[key];
                }
            }
        }
        return target;
    };
    return _extends.apply(this, arguments);
}
import { LeafletProvider, createLeafletContext } from '@react-leaflet/core';
import { Map as LeafletMap } from 'leaflet';
import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useState } from 'react';
function MapContainerComponent({ bounds , boundsOptions , center , children , className , id , placeholder , style , whenReady , zoom , ...options }, forwardedRef) {
    const [props] = useState({
        className,
        id,
        style
    });
    const [context, setContext] = useState(null);
    useImperativeHandle(forwardedRef, ()=>context?.map ?? null, [
        context
    ]);
    const mapRef = useCallback((node)=>{
        if (node !== null && context === null) {
            const map = new LeafletMap(node, options);
            if (center != null && zoom != null) {
                map.setView(center, zoom);
            } else if (bounds != null) {
                map.fitBounds(bounds, boundsOptions);
            }
            if (whenReady != null) {
                map.whenReady(whenReady);
            }
            setContext(createLeafletContext(map));
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    useEffect(()=>{
        return ()=>{
            context?.map.remove();
        };
    }, [
        context
    ]);
    const contents = context ? /*#__PURE__*/ React.createElement(LeafletProvider, {
        value: context
    }, children) : placeholder ?? null;
    return /*#__PURE__*/ React.createElement("div", _extends({}, props, {
        ref: mapRef
    }), contents);
}
export const MapContainer = /*#__PURE__*/ forwardRef(MapContainerComponent);
