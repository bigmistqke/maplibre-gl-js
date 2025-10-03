import { registerHandler } from '../../ui/handler_manager';
import { ScrollZoomHandler } from '../../ui/handler/scroll_zoom';
registerHandler('scrollZoom', (map, options, manager) => {
    const scrollZoom = map.scrollZoom = new ScrollZoomHandler(map, () => manager._triggerRenderFrame());
    manager._add('scrollZoom', scrollZoom, ['mousePan']);
    if (options.interactive && options.scrollZoom) {
        map.scrollZoom.enable(options.scrollZoom);
    }
});
//# sourceMappingURL=scroll-zoom.js.map