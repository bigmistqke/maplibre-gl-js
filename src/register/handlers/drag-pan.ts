import {registerHandler} from '../../ui/handler_manager';
import type {MousePanHandler} from '../../ui/handler/mouse';
import type {TouchPanHandler} from '../../ui/handler/touch_pan';
import {DragPanHandler} from '../../ui/handler/shim/drag_pan';

registerHandler('dragPan', (map, options, manager) => {
    const el = map.getCanvasContainer();

    // Get handlers from registry if available
    const mousePan = manager._handlersById['mousePan'] as MousePanHandler | undefined;
    const touchPan = manager._handlersById['touchPan'] as TouchPanHandler | undefined;

    map.dragPan = new DragPanHandler(el, mousePan, touchPan);

    if (options.interactive && options.dragPan) {
        map.dragPan.enable(options.dragPan);
    }
});
