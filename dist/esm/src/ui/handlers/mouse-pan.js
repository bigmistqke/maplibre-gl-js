import { registerHandler } from '../handler_manager';
import { generateMousePanHandler } from '../handler/mouse';
registerHandler('mousePan', (map, options, manager) => {
    const mousePan = generateMousePanHandler(options);
    manager._add('mousePan', mousePan);
});
//# sourceMappingURL=mouse-pan.js.map