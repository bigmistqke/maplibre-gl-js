import { registerHandler } from '../handler_manager';
import { DoubleClickZoomHandler } from '../handler/shim/dblclick_zoom';
registerHandler('doubleClickZoom', (map, options, manager) => {
    const clickZoom = manager._handlersById['clickZoom'];
    const tapZoom = manager._handlersById['tapZoom'];
    map.doubleClickZoom = new DoubleClickZoomHandler(clickZoom, tapZoom);
    if (options.interactive && options.doubleClickZoom) {
        map.doubleClickZoom.enable();
    }
});
//# sourceMappingURL=double-click-zoom.js.map