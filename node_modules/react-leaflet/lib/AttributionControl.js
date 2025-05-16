import { createControlComponent } from '@react-leaflet/core';
import { Control } from 'leaflet';
export const AttributionControl = createControlComponent(function createAttributionControl(props) {
    return new Control.Attribution(props);
});
