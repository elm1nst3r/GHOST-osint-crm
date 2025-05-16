import { createElementObject, createOverlayComponent } from '@react-leaflet/core';
import { Tooltip as LeafletTooltip } from 'leaflet';
import { useEffect } from 'react';
export const Tooltip = createOverlayComponent(function createTooltip(props, context) {
    const tooltip = new LeafletTooltip(props, context.overlayContainer);
    return createElementObject(tooltip, context);
}, function useTooltipLifecycle(element, context, { position  }, setOpen) {
    useEffect(function addTooltip() {
        const container = context.overlayContainer;
        if (container == null) {
            return;
        }
        const { instance  } = element;
        const onTooltipOpen = (event)=>{
            if (event.tooltip === instance) {
                if (position != null) {
                    instance.setLatLng(position);
                }
                instance.update();
                setOpen(true);
            }
        };
        const onTooltipClose = (event)=>{
            if (event.tooltip === instance) {
                setOpen(false);
            }
        };
        container.on({
            tooltipopen: onTooltipOpen,
            tooltipclose: onTooltipClose
        });
        container.bindTooltip(instance);
        return function removeTooltip() {
            container.off({
                tooltipopen: onTooltipOpen,
                tooltipclose: onTooltipClose
            });
            // @ts-ignore protected property
            if (container._map != null) {
                container.unbindTooltip();
            }
        };
    }, [
        element,
        context,
        setOpen,
        position
    ]);
});
