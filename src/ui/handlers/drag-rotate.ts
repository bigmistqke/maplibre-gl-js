import {registerHandler} from '../handler_manager';
import type {MouseRotateHandler, MousePitchHandler, MouseRollHandler} from '../handler/mouse';
import {DragRotateHandler} from '../handler/shim/drag_rotate';

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
