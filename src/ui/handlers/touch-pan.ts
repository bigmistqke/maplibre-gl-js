import {registerHandler} from '../handler_manager';
import {TouchPanHandler} from '../handler/touch_pan';

registerHandler('touchPan', (map, options, manager) => {
    const touchPan = new TouchPanHandler(options, map);
    manager._add('touchPan', touchPan, ['touchZoom', 'touchRotate']);
});
