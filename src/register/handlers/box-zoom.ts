import {registerHandler} from '../../ui/handler_manager';
import {BoxZoomHandler} from '../../ui/handler/box_zoom';

registerHandler('boxZoom', (map, options, manager) => {
    const boxZoom = map.boxZoom = new BoxZoomHandler(map, options);
    manager._add('boxZoom', boxZoom);
    if (options.interactive && options.boxZoom) {
        boxZoom.enable();
    }
});
