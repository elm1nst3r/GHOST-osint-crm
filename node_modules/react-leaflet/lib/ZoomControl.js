import { createControlComponent } from '@react-leaflet/core';
import { Control } from 'leaflet';
export const ZoomControl = createControlComponent(function createZoomControl(props) {
    return new Control.Zoom(props);
});
