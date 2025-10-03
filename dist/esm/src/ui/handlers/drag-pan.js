import { registerHandler } from '../handler_manager';
import { DragPanHandler } from '../handler/shim/drag_pan';
registerHandler('dragPan', (map, options, manager) => {
    const el = map.getCanvasContainer();
    const mousePan = manager._handlersById['mousePan'];
    const touchPan = manager._handlersById['touchPan'];
    map.dragPan = new DragPanHandler(el, mousePan, touchPan);
    if (options.interactive && options.dragPan) {
        map.dragPan.enable(options.dragPan);
    }
});
//# sourceMappingURL=drag-pan.js.map