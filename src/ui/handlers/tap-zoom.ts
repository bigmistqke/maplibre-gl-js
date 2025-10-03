import {registerHandler} from '../handler_manager';
import {TapZoomHandler} from '../handler/tap_zoom';

registerHandler('tapZoom', (map, options, manager) => {
    const tapZoom = new TapZoomHandler(map);
    manager._add('tapZoom', tapZoom);
});
