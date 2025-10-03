import { registerHandler } from '../handler_manager';
import { TwoFingersTouchZoomRotateHandler } from '../handler/shim/two_fingers_touch';
registerHandler('touchZoomRotate', (map, options, manager) => {
    const el = map.getCanvasContainer();
    const touchRotate = manager._handlersById['touchRotate'];
    const touchZoom = manager._handlersById['touchZoom'];
    const tapDragZoom = manager._handlersById['tapDragZoom'];
    map.touchZoomRotate = new TwoFingersTouchZoomRotateHandler(el, touchZoom, touchRotate, tapDragZoom);
    if (options.interactive && options.touchZoomRotate) {
        map.touchZoomRotate.enable(options.touchZoomRotate);
    }
});
//# sourceMappingURL=touch-zoom-rotate.js.map