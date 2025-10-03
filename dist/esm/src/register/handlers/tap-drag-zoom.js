import { registerHandler } from '../../ui/handler_manager';
import { TapDragZoomHandler } from '../../ui/handler/tap_drag_zoom';
registerHandler('tapDragZoom', (map, options, manager) => {
    const tapDragZoom = new TapDragZoomHandler();
    manager._add('tapDragZoom', tapDragZoom);
});
//# sourceMappingURL=tap-drag-zoom.js.map