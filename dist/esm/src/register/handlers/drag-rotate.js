import { registerHandler } from '../../ui/handler_manager';
import { DragRotateHandler } from '../../ui/handler/shim/drag_rotate';
registerHandler('dragRotate', (map, options, manager) => {
    const mouseRotate = manager._handlersById['mouseRotate'];
    const mousePitch = manager._handlersById['mousePitch'];
    const mouseRoll = manager._handlersById['mouseRoll'];
    map.dragRotate = new DragRotateHandler(options, mouseRotate, mousePitch, mouseRoll);
    if (options.interactive && options.dragRotate) {
        map.dragRotate.enable();
    }
});
//# sourceMappingURL=drag-rotate.js.map