import { registerHandler } from '../handler_manager';
import { TwoFingersTouchRotateHandler } from '../handler/two_fingers_touch';
registerHandler('touchRotate', (map, options, manager) => {
    const touchRotate = new TwoFingersTouchRotateHandler();
    manager._add('touchRotate', touchRotate, ['touchPan', 'touchZoom']);
});
//# sourceMappingURL=touch-rotate.js.map