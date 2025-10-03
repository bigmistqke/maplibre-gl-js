import {registerHandler} from '../handler_manager';
import {TwoFingersTouchRotateHandler, TwoFingersTouchZoomHandler} from '../handler/two_fingers_touch';
import {TwoFingersTouchZoomRotateHandler} from '../handler/shim/two_fingers_touch';
import {TapDragZoomHandler} from '../handler/tap_drag_zoom';
import {getHandlerFactory} from '../handler_manager';

registerHandler('touchZoomRotate', (map, options, manager) => {
    const el = map.getCanvasContainer();
    const touchRotate = new TwoFingersTouchRotateHandler();
    const touchZoom = new TwoFingersTouchZoomHandler();

    // We need tapDragZoom handler which should be registered separately
    // Try to get it from existing handlers or create a placeholder
    let tapDragZoom: TapDragZoomHandler | undefined = manager._handlersById['tapDragZoom'] as TapDragZoomHandler | undefined;
    if (!tapDragZoom) {
        // If tapDragZoom not registered, try to initialize it
        const tapDragZoomFactory = getHandlerFactory('tapDragZoom');
        if (tapDragZoomFactory) {
            tapDragZoomFactory(map, options, manager);
            tapDragZoom = manager._handlersById['tapDragZoom'] as TapDragZoomHandler;
        }
    }

    map.touchZoomRotate = new TwoFingersTouchZoomRotateHandler(el, touchZoom, touchRotate, tapDragZoom);
    manager._add('touchRotate', touchRotate, ['touchPan', 'touchZoom']);
    manager._add('touchZoom', touchZoom, ['touchPan', 'touchRotate']);
    if (options.interactive && options.touchZoomRotate) {
        map.touchZoomRotate.enable(options.touchZoomRotate);
    }
});
