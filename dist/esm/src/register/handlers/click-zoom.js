import { registerHandler } from '../../ui/handler_manager';
import { ClickZoomHandler } from '../../ui/handler/click_zoom';
registerHandler('clickZoom', (map, options, manager) => {
    const clickZoom = new ClickZoomHandler(map);
    manager._add('clickZoom', clickZoom);
});
//# sourceMappingURL=click-zoom.js.map