import {registerHandler} from '../../ui/handler_manager';
import {generateMouseRotationHandler} from '../../ui/handler/mouse';

registerHandler('mouseRotate', (map, options, manager) => {
    const getCenter = () => map.project(map.getCenter());
    const mouseRotate = generateMouseRotationHandler(options, getCenter);
    manager._add('mouseRotate', mouseRotate, ['mousePitch']);
});
