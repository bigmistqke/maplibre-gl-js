import { registerHandler } from '../../ui/handler_manager';
import { generateMousePitchHandler } from '../../ui/handler/mouse';
registerHandler('mousePitch', (map, options, manager) => {
    const mousePitch = generateMousePitchHandler(options);
    manager._add('mousePitch', mousePitch, ['mouseRotate', 'mouseRoll']);
});
//# sourceMappingURL=mouse-pitch.js.map