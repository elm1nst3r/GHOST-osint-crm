import { DomUtil } from 'leaflet';
function splitClassName(className) {
    return className.split(' ').filter(Boolean);
}
export function addClassName(element, className) {
    splitClassName(className).forEach((cls)=>{
        DomUtil.addClass(element, cls);
    });
}
export function removeClassName(element, className) {
    splitClassName(className).forEach((cls)=>{
        DomUtil.removeClass(element, cls);
    });
}
export function updateClassName(element, prevClassName, nextClassName) {
    if (element != null && nextClassName !== prevClassName) {
        if (prevClassName != null && prevClassName.length > 0) {
            removeClassName(element, prevClassName);
        }
        if (nextClassName != null && nextClassName.length > 0) {
            addClassName(element, nextClassName);
        }
    }
}
