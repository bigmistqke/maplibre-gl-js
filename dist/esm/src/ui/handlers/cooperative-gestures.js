import { registerHandler } from '../handler_manager';
import { CooperativeGesturesHandler } from '../handler/cooperative_gestures';
registerHandler('cooperativeGestures', (map, options, manager) => {
    const cooperativeGestures = map.cooperativeGestures = new CooperativeGesturesHandler(map, options.cooperativeGestures);
    manager._add('cooperativeGestures', cooperativeGestures);
    if (options.cooperativeGestures) {
        cooperativeGestures.enable();
    }
});
//# sourceMappingURL=cooperative-gestures.js.map