import { registerHandler } from '../handler_manager';
import { generateMousePitchHandler } from '../handler/mouse';
registerHandler('mousePitch', (map, options, manager) => {
    const mousePitch = generateMousePitchHandler(options);
    manager._add('mousePitch', mousePitch, ['mouseRotate', 'mouseRoll']);
});
//# sourceMappingURL=mouse-pitch.js.map