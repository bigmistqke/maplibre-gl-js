import { registerHandler } from '../../ui/handler_manager';
import { generateMouseRollHandler } from '../../ui/handler/mouse';
registerHandler('mouseRoll', (map, options, manager) => {
    const getCenter = () => map.project(map.getCenter());
    const mouseRoll = generateMouseRollHandler(options, getCenter);
    manager._add('mouseRoll', mouseRoll, ['mousePitch']);
});
//# sourceMappingURL=mouse-roll.js.map