import {registerHandler} from '../handler_manager';
import type {TwoFingersTouchRotateHandler, TwoFingersTouchZoomHandler} from '../handler/two_fingers_touch';
import {TwoFingersTouchZoomRotateHandler} from '../handler/shim/two_fingers_touch';
import type {TapDragZoomHandler} from '../handler/tap_drag_zoom';

registerHandler('touchZoomRotate', (map, options, manager) => {
    const el = map.getCanvasContainer();

    // Get handlers from registry if available
    const touchRotate = manager._handlersById['touchRotate'] as TwoFingersTouchRotateHandler | undefined;
    const touchZoom = manager._handlersById['touchZoom'] as TwoFingersTouchZoomHandler | undefined;
    const tapDragZoom = manager._handlersById['tapDragZoom'] as TapDragZoomHandler | undefined;

    map.touchZoomRotate = new TwoFingersTouchZoomRotateHandler(el, touchZoom, touchRotate, tapDragZoom);

    if (options.interactive && options.touchZoomRotate) {
        map.touchZoomRotate.enable(options.touchZoomRotate);
    }
});
