import { registerHandler } from '../handler_manager';
import { TwoFingersTouchRotateHandler, TwoFingersTouchZoomHandler } from '../handler/two_fingers_touch';
import { TwoFingersTouchZoomRotateHandler } from '../handler/shim/two_fingers_touch';
registerHandler('touchZoomRotate', (map, options, manager) => {
    const el = map.getCanvasContainer();
    const touchRotate = new TwoFingersTouchRotateHandler();
    const touchZoom = new TwoFingersTouchZoomHandler();
    const tapDragZoom = manager._handlersById['tapDragZoom'];
    map.touchZoomRotate = new TwoFingersTouchZoomRotateHandler(el, touchZoom, touchRotate, tapDragZoom);
    manager._add('touchRotate', touchRotate, ['touchPan', 'touchZoom']);
    manager._add('touchZoom', touchZoom, ['touchPan', 'touchRotate']);
    if (options.interactive && options.touchZoomRotate) {
        map.touchZoomRotate.enable(options.touchZoomRotate);
    }
});
//# sourceMappingURL=touch-zoom-rotate.js.map