import { registerHandler } from '../../ui/handler_manager';
import { TwoFingersTouchPitchHandler } from '../../ui/handler/two_fingers_touch';
registerHandler('touchPitch', (map, options, manager) => {
    const touchPitch = map.touchPitch = new TwoFingersTouchPitchHandler(map);
    manager._add('touchPitch', touchPitch);
    if (options.interactive && options.touchPitch) {
        map.touchPitch.enable(options.touchPitch);
    }
});
//# sourceMappingURL=touch-pitch.js.map