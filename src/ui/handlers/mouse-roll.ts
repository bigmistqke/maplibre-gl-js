import {registerHandler} from '../handler_manager';
import {generateMouseRollHandler} from '../handler/mouse';

registerHandler('mouseRoll', (map, options, manager) => {
    const getCenter = () => map.project(map.getCenter());
    const mouseRoll = generateMouseRollHandler(options, getCenter);
    manager._add('mouseRoll', mouseRoll, ['mousePitch']);
});
