import { registerHandler } from '../../ui/handler_manager';
import { TwoFingersTouchRotateHandler } from '../../ui/handler/two_fingers_touch';
registerHandler('touchRotate', (map, options, manager) => {
    const touchRotate = new TwoFingersTouchRotateHandler();
    manager._add('touchRotate', touchRotate, ['touchPan', 'touchZoom']);
});
//# sourceMappingURL=touch-rotate.js.map