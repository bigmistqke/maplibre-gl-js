import {registerHandler} from '../../ui/handler_manager';
import type {MouseRotateHandler, MousePitchHandler, MouseRollHandler} from '../../ui/handler/mouse';
import {DragRotateHandler} from '../../ui/handler/shim/drag_rotate';

registerHandler('dragRotate', (map, options, manager) => {
    // Get handlers from registry if available
    const mouseRotate = manager._handlersById['mouseRotate'] as MouseRotateHandler | undefined;
    const mousePitch = manager._handlersById['mousePitch'] as MousePitchHandler | undefined;
    const mouseRoll = manager._handlersById['mouseRoll'] as MouseRollHandler | undefined;

    map.dragRotate = new DragRotateHandler(options, mouseRotate, mousePitch, mouseRoll);

    if (options.interactive && options.dragRotate) {
        map.dragRotate.enable();
    }
});
