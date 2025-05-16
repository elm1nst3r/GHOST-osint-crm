import { createElementObject, createOverlayComponent } from '@react-leaflet/core';
import { Popup as LeafletPopup } from 'leaflet';
import { useEffect } from 'react';
export const Popup = createOverlayComponent(function createPopup(props, context) {
    const popup = new LeafletPopup(props, context.overlayContainer);
    return createElementObject(popup, context);
}, function usePopupLifecycle(element, context, { position  }, setOpen) {
    useEffect(function addPopup() {
        const { instance  } = element;
        function onPopupOpen(event) {
            if (event.popup === instance) {
                instance.update();
                setOpen(true);
            }
        }
        function onPopupClose(event) {
            if (event.popup === instance) {
                setOpen(false);
            }
        }
        context.map.on({
            popupopen: onPopupOpen,
            popupclose: onPopupClose
        });
        if (context.overlayContainer == null) {
            // Attach to a Map
            if (position != null) {
                instance.setLatLng(position);
            }
            instance.openOn(context.map);
        } else {
            // Attach to container component
            context.overlayContainer.bindPopup(instance);
        }
        return function removePopup() {
            context.map.off({
                popupopen: onPopupOpen,
                popupclose: onPopupClose
            });
            context.overlayContainer?.unbindPopup();
            context.map.removeLayer(instance);
        };
    }, [
        element,
        context,
        setOpen,
        position
    ]);
});
