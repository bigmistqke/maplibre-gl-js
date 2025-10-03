import {registerHandler} from '../handler_manager';
import {generateMousePanHandler} from '../handler/mouse';
import {TouchPanHandler} from '../handler/touch_pan';
import {DragPanHandler} from '../handler/shim/drag_pan';

registerHandler('dragPan', (map, options, manager) => {
    const el = map.getCanvasContainer();
    const mousePan = generateMousePanHandler(options);
    const touchPan = new TouchPanHandler(options, map);
    map.dragPan = new DragPanHandler(el, mousePan, touchPan);
    manager._add('mousePan', mousePan);
    manager._add('touchPan', touchPan, ['touchZoom', 'touchRotate']);
    if (options.interactive && options.dragPan) {
        map.dragPan.enable(options.dragPan);
    }
});
