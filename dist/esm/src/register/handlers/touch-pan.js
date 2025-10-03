import { registerHandler } from '../../ui/handler_manager';
import { TouchPanHandler } from '../../ui/handler/touch_pan';
registerHandler('touchPan', (map, options, manager) => {
    const touchPan = new TouchPanHandler(options, map);
    manager._add('touchPan', touchPan, ['touchZoom', 'touchRotate']);
});
//# sourceMappingURL=touch-pan.js.map