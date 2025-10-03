import { registerHandler } from '../handler_manager';
import { KeyboardHandler } from '../handler/keyboard';
registerHandler('keyboard', (map, options, manager) => {
    const keyboard = map.keyboard = new KeyboardHandler(map);
    manager._add('keyboard', keyboard);
    if (options.interactive && options.keyboard) {
        map.keyboard.enable();
    }
});
//# sourceMappingURL=keyboard.js.map