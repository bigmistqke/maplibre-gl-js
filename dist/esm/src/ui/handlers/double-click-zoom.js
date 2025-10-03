import { registerHandler } from '../handler_manager';
import { TapZoomHandler } from '../handler/tap_zoom';
import { ClickZoomHandler } from '../handler/click_zoom';
import { DoubleClickZoomHandler } from '../handler/shim/dblclick_zoom';
registerHandler('doubleClickZoom', (map, options, manager) => {
    const tapZoom = new TapZoomHandler(map);
    const clickZoom = new ClickZoomHandler(map);
    map.doubleClickZoom = new DoubleClickZoomHandler(clickZoom, tapZoom);
    manager._add('tapZoom', tapZoom);
    manager._add('clickZoom', clickZoom);
    if (options.interactive && options.doubleClickZoom) {
        map.doubleClickZoom.enable();
    }
});
//# sourceMappingURL=double-click-zoom.js.map