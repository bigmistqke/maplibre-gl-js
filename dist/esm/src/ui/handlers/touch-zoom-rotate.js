import { registerHandler } from '../handler_manager';
import { TwoFingersTouchRotateHandler, TwoFingersTouchZoomHandler } from '../handler/two_fingers_touch';
import { TwoFingersTouchZoomRotateHandler } from '../handler/shim/two_fingers_touch';
import { getHandlerFactory } from '../handler_manager';
registerHandler('touchZoomRotate', (map, options, manager) => {
    const el = map.getCanvasContainer();
    const touchRotate = new TwoFingersTouchRotateHandler();
    const touchZoom = new TwoFingersTouchZoomHandler();
    let tapDragZoom = manager._handlersById['tapDragZoom'];
    if (!tapDragZoom) {
        const tapDragZoomFactory = getHandlerFactory('tapDragZoom');
        if (tapDragZoomFactory) {
            tapDragZoomFactory(map, options, manager);
            tapDragZoom = manager._handlersById['tapDragZoom'];
        }
    }
    map.touchZoomRotate = new TwoFingersTouchZoomRotateHandler(el, touchZoom, touchRotate, tapDragZoom);
    manager._add('touchRotate', touchRotate, ['touchPan', 'touchZoom']);
    manager._add('touchZoom', touchZoom, ['touchPan', 'touchRotate']);
    if (options.interactive && options.touchZoomRotate) {
        map.touchZoomRotate.enable(options.touchZoomRotate);
    }
});
//# sourceMappingURL=touch-zoom-rotate.js.map