import {registerHandler} from '../handler_manager';
import {BoxZoomHandler} from '../handler/box_zoom';

registerHandler('boxZoom', (map, options, manager) => {
    const boxZoom = map.boxZoom = new BoxZoomHandler(map, options);
    manager._add('boxZoom', boxZoom);
    if (options.interactive && options.boxZoom) {
        boxZoom.enable();
    }
});
