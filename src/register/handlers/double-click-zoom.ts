import {registerHandler} from '../../ui/handler_manager';
import type {TapZoomHandler} from '../../ui/handler/tap_zoom';
import type {ClickZoomHandler} from '../../ui/handler/click_zoom';
import {DoubleClickZoomHandler} from '../../ui/handler/shim/dblclick_zoom';

registerHandler('doubleClickZoom', (map, options, manager) => {
    // Get handlers from registry if available
    const clickZoom = manager._handlersById['clickZoom'] as ClickZoomHandler | undefined;
    const tapZoom = manager._handlersById['tapZoom'] as TapZoomHandler | undefined;

    map.doubleClickZoom = new DoubleClickZoomHandler(clickZoom, tapZoom);

    if (options.interactive && options.doubleClickZoom) {
        map.doubleClickZoom.enable();
    }
});
