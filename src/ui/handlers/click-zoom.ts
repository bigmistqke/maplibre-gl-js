import {registerHandler} from '../handler_manager';
import {ClickZoomHandler} from '../handler/click_zoom';

registerHandler('clickZoom', (map, options, manager) => {
    const clickZoom = new ClickZoomHandler(map);
    manager._add('clickZoom', clickZoom);
});
