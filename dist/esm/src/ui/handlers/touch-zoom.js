import { registerHandler } from '../handler_manager';
import { TwoFingersTouchZoomHandler } from '../handler/two_fingers_touch';
registerHandler('touchZoom', (map, options, manager) => {
    const touchZoom = new TwoFingersTouchZoomHandler();
    manager._add('touchZoom', touchZoom, ['touchPan', 'touchRotate']);
});
//# sourceMappingURL=touch-zoom.js.map