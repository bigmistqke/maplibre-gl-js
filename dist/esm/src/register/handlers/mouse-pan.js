import { registerHandler } from '../../ui/handler_manager';
import { generateMousePanHandler } from '../../ui/handler/mouse';
registerHandler('mousePan', (_map, options, manager) => {
    const mousePan = generateMousePanHandler(options);
    manager._add('mousePan', mousePan);
});
//# sourceMappingURL=mouse-pan.js.map