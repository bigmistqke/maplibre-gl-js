import {registerHandler} from '../handler_manager';
import {TapDragZoomHandler} from '../handler/tap_drag_zoom';

registerHandler('tapDragZoom', (map, options, manager) => {
    const tapDragZoom = new TapDragZoomHandler();
    manager._add('tapDragZoom', tapDragZoom);
});
