import { registerHandler } from '../handler_manager';
import { generateMouseRotationHandler, generateMousePitchHandler, generateMouseRollHandler } from '../handler/mouse';
import { DragRotateHandler } from '../handler/shim/drag_rotate';
registerHandler('dragRotate', (map, options, manager) => {
    const getCenter = () => map.project(map.getCenter());
    const mouseRotate = generateMouseRotationHandler(options, getCenter);
    const mousePitch = generateMousePitchHandler(options);
    const mouseRoll = generateMouseRollHandler(options, getCenter);
    map.dragRotate = new DragRotateHandler(options, mouseRotate, mousePitch, mouseRoll);
    manager._add('mouseRotate', mouseRotate, ['mousePitch']);
    manager._add('mousePitch', mousePitch, ['mouseRotate', 'mouseRoll']);
    manager._add('mouseRoll', mouseRoll, ['mousePitch']);
    if (options.interactive && options.dragRotate) {
        map.dragRotate.enable();
    }
});
//# sourceMappingURL=drag-rotate.js.map